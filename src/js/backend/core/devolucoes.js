// Devoluções de venda — retorno ao estoque e reembolso
import { auditar } from './util.js';
import * as valesTroca from './vales_troca.js';
import * as estoques from './estoques.js';
const arred = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Itens ainda devolvíveis de uma venda (vendido − já devolvido)
function itensVenda(db, venda_id) {
  const venda = db.prepare('SELECT id, status, cliente_id, total, subtotal, desconto FROM vendas WHERE id=?').get(venda_id);
  if (!venda) return { ok: false, erro: 'Venda não encontrada.' };
  if (venda.status !== 'concluida') return { ok: false, erro: 'Só é possível devolver itens de vendas concluídas.' };
  const itens = db.prepare(`
    SELECT vi.variacao_id, vi.qtd, vi.total,
           p.nome AS produto, va.cor, va.tamanho,
           COALESCE((SELECT SUM(di.qtd) FROM devolucao_itens di
                     JOIN devolucoes d ON d.id = di.devolucao_id
                     WHERE d.venda_id = vi.venda_id AND di.variacao_id = vi.variacao_id), 0) AS devolvido
    FROM venda_itens vi
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos p ON p.id = va.produto_id
    WHERE vi.venda_id = ?
  `).all(venda_id);

  // Desconto geral da venda: proporcionar ao item pelo peso no subtotal.
  // venda_itens.total = qtd * preco_unit - desconto_item  (SEM desconto_geral)
  // valor efetivo pago = venda_itens.total * (vendas.total / vendas.subtotal)
  const descontoGeral = arred(Number(venda.desconto) || 0);
  const subtotalVenda = arred(Number(venda.subtotal) || 0);
  const fatorDesconto = (descontoGeral > 0 && subtotalVenda > 0)
    ? (Number(venda.total) / subtotalVenda)  // ex: 152/160 = 0.95
    : 1;

  for (const i of itens) {
    i.disponivel = i.qtd - i.devolvido;
    // valor efetivo pago por este item (proporciona o desconto geral)
    const totalEfetivo = arred(i.total * fatorDesconto);
    i.valor_unit = arred(totalEfetivo / i.qtd);
  }
  return { ok: true, venda, itens: itens.filter(i => i.disponivel > 0) };
}

function registrar(db, p, quem) {
  const info = itensVenda(db, p.venda_id);
  if (!info.ok) return info;
  const forma = ['dinheiro', 'estorno', 'vale'].includes(p.forma_reembolso) ? p.forma_reembolso : 'dinheiro';

  const disp = {};
  for (const i of info.itens) disp[i.variacao_id] = { max: i.disponivel, valor_unit: i.valor_unit };

  const itens = (Array.isArray(p.itens) ? p.itens : [])
    .map(i => ({ variacao_id: Number(i.variacao_id), qtd: Math.round(Number(i.qtd) || 0) }))
    .filter(i => i.qtd > 0);
  if (!itens.length) return { ok: false, erro: 'Selecione ao menos um item para devolver.' };
  for (const it of itens) {
    const d = disp[it.variacao_id];
    if (!d) return { ok: false, erro: 'Item não pertence a esta venda ou já foi devolvido.' };
    if (it.qtd > d.max) return { ok: false, erro: 'Quantidade acima do disponível para devolução.' };
  }

  db.exec('BEGIN');
  try {
    const caixa = db.prepare('SELECT id FROM caixas WHERE fechado_em IS NULL ORDER BY id DESC LIMIT 1').get();
    const rd = db.prepare(`
      INSERT INTO devolucoes (venda_id, cliente_id, usuario_id, caixa_id, tipo, valor_devolvido, forma_reembolso, motivo)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(p.venda_id, info.venda.cliente_id, quem ? quem.id : null, caixa ? caixa.id : null,
           'devolucao', 0, forma, p.motivo || null);
    const devId = Number(rd.lastInsertRowid);

    const insItem = db.prepare('INSERT INTO devolucao_itens (devolucao_id, variacao_id, qtd, valor_unit, total) VALUES (?,?,?,?,?)');
    const movEstoque = db.prepare('INSERT INTO movimentos_estoque (variacao_id, tipo, qtd, motivo, usuario_id, estoque_id) VALUES (?,?,?,?,?,?)');
    // a peça devolvida volta para o local de onde saiu na venda
    const localDev = estoques.daLoja(db, info.venda.loja_id);
    const localDevId = localDev ? localDev.id : null;
    let valorTotal = 0;
    for (const it of itens) {
      const d = disp[it.variacao_id];
      const total = arred(it.qtd * d.valor_unit);
      insItem.run(devId, it.variacao_id, it.qtd, d.valor_unit, total);
      db.prepare('UPDATE variacoes SET estoque = estoque + ? WHERE id=?').run(it.qtd, it.variacao_id);
      movEstoque.run(it.variacao_id, 'devolucao', it.qtd, `Devolução venda #${p.venda_id}`,
                     quem ? quem.id : null, localDevId);
      if (localDevId) estoques.aplicar(db, localDevId, it.variacao_id, it.qtd);
      valorTotal += total;
    }
    valorTotal = arred(valorTotal);
    db.prepare('UPDATE devolucoes SET valor_devolvido=? WHERE id=?').run(valorTotal, devId);

    // reembolso em dinheiro sai da gaveta (sangria)
    if (forma === 'dinheiro' && caixa) {
      db.prepare('INSERT INTO caixa_movimentos (caixa_id, tipo, valor, motivo, usuario_id) VALUES (?,?,?,?,?)')
        .run(caixa.id, 'sangria', valorTotal, `Devolução venda #${p.venda_id}`, quem ? quem.id : null);
    }

    // vale-troca: emite dentro da mesma transação
    let vale = null;
    if (forma === 'vale') {
      vale = valesTroca.criar(db, {
        valor: valorTotal,
        clienteId: info.venda.cliente_id,
        devolucaoId: devId
      }, quem);
    }

    db.exec('COMMIT');
    auditar(db, quem, 'devolucao_registrada', `#${devId} venda #${p.venda_id} (${forma})`);
    return { ok: true, id: devId, valor_devolvido: valorTotal, caixa: !!caixa, forma, vale };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function listar(db) {
  const linhas = db.prepare(`
    SELECT d.id, d.venda_id, d.valor_devolvido, d.forma_reembolso, d.motivo, d.criado_em,
           c.nome AS cliente, u.nome AS usuario,
           COALESCE((SELECT SUM(di.qtd) FROM devolucao_itens di WHERE di.devolucao_id = d.id), 0) AS pecas
    FROM devolucoes d
    LEFT JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN usuarios u ON u.id = d.usuario_id
    ORDER BY d.id DESC LIMIT 200
  `).all();
  return { ok: true, devolucoes: linhas };
}

export { itensVenda, registrar, listar };