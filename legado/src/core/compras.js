// Fornecedores e compras (pedido → recebimento → estoque + conta a pagar)
const { auditar } = require('./util');
const arred = (n) => Math.round(n * 100) / 100;

// ---------- Fornecedores ----------
function listarFornecedores(db, p) {
  const like = `%${String((p && p.busca) || '').trim()}%`;
  const linhas = db.prepare(`
    SELECT f.*, (SELECT COUNT(*) FROM compras c WHERE c.fornecedor_id = f.id) AS qtd_compras
    FROM fornecedores f WHERE f.ativo = 1 AND (f.nome LIKE ? OR f.cnpj LIKE ?)
    ORDER BY f.nome LIMIT 200
  `).all(like, like);
  return { ok: true, fornecedores: linhas };
}

function salvarFornecedor(db, p, quem) {
  const nome = String(p.nome || '').trim();
  if (!nome) return { ok: false, erro: 'Informe o nome do fornecedor.' };
  if (p.id) {
    db.prepare('UPDATE fornecedores SET nome=?, cnpj=?, telefone=?, email=?, obs=? WHERE id=?')
      .run(nome, p.cnpj || null, p.telefone || null, p.email || null, p.obs || null, p.id);
    auditar(db, quem, 'fornecedor_editado', nome);
    return { ok: true, id: p.id };
  }
  const r = db.prepare('INSERT INTO fornecedores (nome, cnpj, telefone, email, obs) VALUES (?,?,?,?,?)')
    .run(nome, p.cnpj || null, p.telefone || null, p.email || null, p.obs || null);
  auditar(db, quem, 'fornecedor_criado', nome);
  return { ok: true, id: Number(r.lastInsertRowid) };
}

function excluirFornecedor(db, id, quem) {
  const pend = db.prepare("SELECT COUNT(*) n FROM compras WHERE fornecedor_id=? AND status='pendente'").get(id);
  if (pend.n > 0) return { ok: false, erro: 'Há compras pendentes deste fornecedor.' };
  db.prepare('UPDATE fornecedores SET ativo=0 WHERE id=?').run(id);
  auditar(db, quem, 'fornecedor_excluido', `#${id}`);
  return { ok: true };
}

// ---------- Compras ----------
function criarCompra(db, p, quem) {
  const itens = Array.isArray(p.itens) ? p.itens : [];
  if (!itens.length) return { ok: false, erro: 'A compra não tem itens.' };
  for (const i of itens) {
    if (!(Number(i.qtd) > 0) || !(Number(i.custo_unit) >= 0)) {
      return { ok: false, erro: 'Item com quantidade ou custo inválido.' };
    }
  }
  const total = arred(itens.reduce((s, i) => s + Number(i.qtd) * Number(i.custo_unit), 0));
  db.exec('BEGIN');
  try {
    const r = db.prepare('INSERT INTO compras (fornecedor_id, numero_nf, total) VALUES (?,?,?)')
      .run(p.fornecedor_id || null, p.numero_nf || null, total);
    const compraId = Number(r.lastInsertRowid);
    const ins = db.prepare('INSERT INTO compra_itens (compra_id, variacao_id, qtd, custo_unit) VALUES (?,?,?,?)');
    for (const i of itens) ins.run(compraId, i.variacao_id, Number(i.qtd), arred(Number(i.custo_unit)));
    db.exec('COMMIT');
    auditar(db, quem, 'compra_criada', `#${compraId} R$ ${total.toFixed(2)}`);
    return { ok: true, id: compraId, total };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

function listarCompras(db) {
  const linhas = db.prepare(`
    SELECT c.*, f.nome AS fornecedor,
           (SELECT COUNT(*) FROM compra_itens ci WHERE ci.compra_id = c.id) AS qtd_itens
    FROM compras c LEFT JOIN fornecedores f ON f.id = c.fornecedor_id
    ORDER BY c.id DESC LIMIT 200
  `).all();
  return { ok: true, compras: linhas };
}

function obterCompra(db, id) {
  const compra = db.prepare(`
    SELECT c.*, f.nome AS fornecedor FROM compras c
    LEFT JOIN fornecedores f ON f.id = c.fornecedor_id WHERE c.id=?
  `).get(id);
  if (!compra) return { ok: false, erro: 'Compra não encontrada.' };
  const itens = db.prepare(`
    SELECT ci.*, p.nome AS produto, v.cor, v.tamanho, v.codigo_barras
    FROM compra_itens ci JOIN variacoes v ON v.id = ci.variacao_id
    JOIN produtos p ON p.id = v.produto_id WHERE ci.compra_id=?
  `).all(id);
  return { ok: true, compra, itens };
}

// Recebimento: entrada no estoque (com custo médio) + conta a pagar no financeiro
function receberCompra(db, p, quem) {
  const d = obterCompra(db, p.id);
  if (!d.ok) return d;
  if (d.compra.status !== 'pendente') return { ok: false, erro: 'Esta compra não está pendente.' };

  db.exec('BEGIN');
  try {
    for (const i of d.itens) {
      const v = db.prepare(`
        SELECT v.estoque, v.produto_id, p.preco_custo,
               COALESCE((SELECT SUM(x.estoque) FROM variacoes x
                         WHERE x.produto_id = v.produto_id AND x.ativo = 1), 0) AS estoque_produto
        FROM variacoes v JOIN produtos p ON p.id = v.produto_id WHERE v.id = ?
      `).get(i.variacao_id);
      db.prepare('UPDATE variacoes SET estoque = estoque + ? WHERE id=?').run(i.qtd, i.variacao_id);
      db.prepare(`INSERT INTO movimentos_estoque (variacao_id, tipo, qtd, custo_unit, motivo, usuario_id)
                  VALUES (?,?,?,?,?,?)`)
        .run(i.variacao_id, 'entrada', i.qtd, i.custo_unit, `Compra #${d.compra.id}`, quem.id);
      // custo médio ponderado
      if (i.custo_unit > 0) {
        const atual = v.estoque_produto;
        const novo = atual + i.qtd > 0
          ? ((atual * v.preco_custo) + (i.qtd * i.custo_unit)) / (atual + i.qtd)
          : i.custo_unit;
        db.prepare('UPDATE produtos SET preco_custo=? WHERE id=?')
          .run(arred(novo), v.produto_id);
      }
    }
    db.prepare("UPDATE compras SET status='recebida', recebido_em = datetime('now','localtime') WHERE id=?")
      .run(d.compra.id);
    if (d.compra.total > 0) {
      db.prepare(`INSERT INTO financeiro_lancamentos (tipo, descricao, categoria, valor, vencimento, origem, origem_id)
                  VALUES ('pagar', ?, 'Fornecedor', ?, ?, 'compra', ?)`)
        .run(`Compra #${d.compra.id}${d.compra.fornecedor ? ' — ' + d.compra.fornecedor : ''}${d.compra.numero_nf ? ' (NF ' + d.compra.numero_nf + ')' : ''}`,
             d.compra.total, p.vencimento || null, d.compra.id);
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }

  auditar(db, quem, 'compra_recebida', `#${d.compra.id}`);
  return { ok: true };
}

function cancelarCompra(db, id, quem) {
  const c = db.prepare('SELECT status FROM compras WHERE id=?').get(id);
  if (!c) return { ok: false, erro: 'Compra não encontrada.' };
  if (c.status !== 'pendente') return { ok: false, erro: 'Só compras pendentes podem ser canceladas.' };
  db.prepare("UPDATE compras SET status='cancelada' WHERE id=?").run(id);
  auditar(db, quem, 'compra_cancelada', `#${id}`);
  return { ok: true };
}

module.exports = {
  listarFornecedores, salvarFornecedor, excluirFornecedor,
  criarCompra, listarCompras, obterCompra, receberCompra, cancelarCompra
};
