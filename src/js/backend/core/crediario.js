// Crediário — parcelas, recebimento, inadimplentes; extras de clientes
import { auditar } from './util.js';
const arred = (n) => Math.round(n * 100) / 100;

function obterCliente(db, id) {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id=?').get(id);
  if (!cliente) return { ok: false, erro: 'Cliente não encontrado.' };
  const compras = db.prepare(`
    SELECT v.id, v.total, v.status, v.criado_em,
           (SELECT COUNT(*) FROM venda_itens WHERE venda_id = v.id) AS itens
    FROM vendas v WHERE v.cliente_id = ? ORDER BY v.id DESC LIMIT 100
  `).all(id);
  const parcelas = db.prepare(`
    SELECT * FROM crediario_parcelas WHERE cliente_id = ? ORDER BY pago_em IS NOT NULL, vencimento
  `).all(id);
  return { ok: true, cliente, compras, parcelas };
}

// Parcelas em aberto de todos os clientes (com destaque para vencidas)
function parcelasAbertas(db, p) {
  const like = `%${String((p && p.busca) || '').trim()}%`;
  const linhas = db.prepare(`
    SELECT cp.id, cp.venda_id, cp.numero, cp.valor, COALESCE(cp.valor_pago, 0) AS valor_pago,
           cp.vencimento, c.id AS cliente_id, c.nome AS cliente, c.telefone,
           (cp.vencimento < date('now','localtime')) AS vencida,
           (SELECT COUNT(*) FROM crediario_parcelas t WHERE t.venda_id = cp.venda_id) AS total_parcelas
    FROM crediario_parcelas cp
    JOIN clientes c ON c.id = cp.cliente_id
    WHERE cp.pago_em IS NULL AND c.nome LIKE ?
    ORDER BY cp.vencimento
    LIMIT 300
  `).all(like);
  const totalAberto = arred(linhas.reduce((s, l) => s + (l.valor - l.valor_pago), 0));
  const totalVencido = arred(linhas.filter(l => l.vencida).reduce((s, l) => s + (l.valor - l.valor_pago), 0));
  return { ok: true, parcelas: linhas, total_aberto: totalAberto, total_vencido: totalVencido };
}

// Recebimento (total ou parcial). Se dinheiro e caixa aberto, entra na gaveta.
function receberParcela(db, p, quem) {
  const parc = db.prepare(`
    SELECT cp.*, c.nome AS cliente FROM crediario_parcelas cp
    JOIN clientes c ON c.id = cp.cliente_id WHERE cp.id=?
  `).get(p.parcela_id);
  if (!parc) return { ok: false, erro: 'Parcela não encontrada.' };
  if (parc.pago_em) return { ok: false, erro: 'Parcela já quitada.' };

  const restante = arred(parc.valor - (parc.valor_pago || 0));
  const valor = arred(Number(p.valor));
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, erro: 'Valor inválido.' };
  if (valor > restante) return { ok: false, erro: `Valor maior que o restante (${restante.toFixed(2)}).` };

  const forma = ['dinheiro', 'pix', 'debito', 'credito'].includes(p.forma) ? p.forma : 'dinheiro';
  const novoPago = arred((parc.valor_pago || 0) + valor);
  const quitada = novoPago >= parc.valor;

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE crediario_parcelas SET valor_pago=?, pago_em=? WHERE id=?`)
      .run(novoPago, quitada ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null, parc.id);
    db.prepare(`INSERT INTO financeiro_lancamentos (tipo, descricao, categoria, valor, vencimento, pago_em, valor_pago, origem, origem_id)
                VALUES ('receber', ?, 'Crediário', ?, ?, datetime('now','localtime'), ?, 'crediario', ?)`)
      .run(`Parcela ${parc.numero} venda #${parc.venda_id} — ${parc.cliente} (${forma})`,
           valor, parc.vencimento, valor, parc.id);
    // dinheiro recebido entra na gaveta se houver caixa aberto
    if (forma === 'dinheiro') {
      const cx = db.prepare('SELECT id FROM caixas WHERE fechado_em IS NULL ORDER BY id DESC LIMIT 1').get();
      if (cx) {
        db.prepare(`INSERT INTO caixa_movimentos (caixa_id, tipo, valor, motivo, usuario_id)
                    VALUES (?,?,?,?,?)`)
          .run(cx.id, 'suprimento', valor, `Recebimento crediário parcela #${parc.id} (${parc.cliente})`, quem.id);
      }
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }

  auditar(db, quem, 'crediario_recebido', `parcela #${parc.id} R$ ${valor.toFixed(2)} (${forma})`);
  return { ok: true, quitada, restante: arred(parc.valor - novoPago) };
}

function aniversariantes(db) {
  const linhas = db.prepare(`
    SELECT id, nome, telefone, nascimento,
           CAST(strftime('%d', nascimento) AS INTEGER) AS dia
    FROM clientes
    WHERE ativo = 1 AND nascimento IS NOT NULL
      AND strftime('%m', nascimento) = strftime('%m', date('now','localtime'))
    ORDER BY dia
  `).all();
  return { ok: true, clientes: linhas };
}

function excluirCliente(db, id, quem) {
  const devendo = db.prepare(
    'SELECT COUNT(*) n FROM crediario_parcelas WHERE cliente_id=? AND pago_em IS NULL'
  ).get(id);
  if (devendo.n > 0) return { ok: false, erro: 'Cliente tem parcelas em aberto no crediário.' };
  db.prepare('UPDATE clientes SET ativo=0 WHERE id=?').run(id);
  auditar(db, quem, 'cliente_excluido', `#${id}`);
  return { ok: true };
}

export { obterCliente, parcelasAbertas, receberParcela, aniversariantes, excluirCliente };