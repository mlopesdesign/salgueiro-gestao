// Consignação — repasses a fornecedores por venda de produtos consignados.
// Regra: o fornecedor recebe o CUSTO da peça + X% do LUCRO (venda − custo);
// a loja fica com o restante do lucro. O custo é sempre DISCRIMINADO à parte,
// para que fique claro que o repasse do fornecedor = custo + a fatia dele do lucro.
// Fluxo: a venda de item consignado gera um movimento 'pendente' (no pdv.js);
// o acerto agrupa os pendentes do fornecedor numa conta a pagar no Financeiro,
// fechando o fluxo de caixa (parte da loja fica no resultado; a do fornecedor
// vira despesa 'Consignação', já embutindo o custo da peça).
import { auditar } from './util.js';

const arred = (n) => Math.round(n * 100) / 100;

// Resumo por fornecedor com o custo discriminado do lucro.
function resumo(db) {
  const linhas = db.prepare(`
    SELECT f.id AS fornecedor_id, f.nome AS fornecedor,
           SUM(CASE WHEN c.status='pendente' THEN c.qtd ELSE 0 END)              AS pecas_pendentes,
           SUM(CASE WHEN c.status='pendente' THEN c.valor_venda ELSE 0 END)      AS pendente_venda,
           SUM(CASE WHEN c.status='pendente' THEN c.valor_custo ELSE 0 END)      AS pendente_custo,
           SUM(CASE WHEN c.status='pendente' THEN c.valor_fornecedor ELSE 0 END) AS pendente_fornecedor,
           SUM(CASE WHEN c.status='pendente' THEN c.valor_loja ELSE 0 END)       AS pendente_loja,
           SUM(CASE WHEN c.status='acertado' THEN c.valor_fornecedor ELSE 0 END) AS total_acertado
    FROM consignacoes c JOIN fornecedores f ON f.id = c.fornecedor_id
    GROUP BY f.id, f.nome
    HAVING pendente_fornecedor > 0 OR total_acertado > 0
    ORDER BY pendente_fornecedor DESC, f.nome
  `).all();
  for (const l of linhas) {
    l.pecas_pendentes = l.pecas_pendentes || 0;
    l.pendente_venda = arred(l.pendente_venda || 0);
    l.pendente_custo = arred(l.pendente_custo || 0);
    l.pendente_fornecedor = arred(l.pendente_fornecedor || 0);
    l.pendente_loja = arred(l.pendente_loja || 0);
    l.total_acertado = arred(l.total_acertado || 0);
    // Discriminação: repasse = custo (l.pendente_custo) + fatia do fornecedor no lucro.
    l.pendente_lucro_fornecedor = arred(l.pendente_fornecedor - l.pendente_custo);
    // Lucro total gerado (venda − custo), só para leitura financeira.
    l.pendente_lucro_total = arred(l.pendente_venda - l.pendente_custo);
  }
  return { ok: true, fornecedores: linhas };
}

// Extrato de um fornecedor, com custo e lucro discriminados por movimento.
function listar(db, p) {
  const fornecedorId = Number(p && p.fornecedor_id) || 0;
  if (!fornecedorId) return { ok: false, erro: 'Fornecedor não informado.' };
  const linhas = db.prepare(`
    SELECT c.*, pr.nome AS produto, v.criado_em AS data_venda,
           (c.valor_venda - c.valor_custo)      AS lucro,
           (c.valor_fornecedor - c.valor_custo) AS lucro_fornecedor
    FROM consignacoes c
    JOIN produtos pr ON pr.id = c.produto_id
    JOIN vendas v ON v.id = c.venda_id
    WHERE c.fornecedor_id = ?
    ORDER BY c.id DESC LIMIT 300
  `).all(fornecedorId);
  for (const m of linhas) {
    m.lucro = arred(m.lucro || 0);
    m.lucro_fornecedor = arred(m.lucro_fornecedor || 0);
  }
  return { ok: true, movimentos: linhas };
}

// Acerto: agrupa os pendentes do fornecedor numa conta a pagar (custo já embutido).
function acertar(db, p, quem) {
  const fornecedorId = Number(p && p.fornecedor_id) || 0;
  if (!fornecedorId) return { ok: false, erro: 'Fornecedor não informado.' };
  const forn = db.prepare('SELECT id, nome FROM fornecedores WHERE id=?').get(fornecedorId);
  if (!forn) return { ok: false, erro: 'Fornecedor não encontrado.' };

  const pend = db.prepare(`
    SELECT COUNT(*) AS n, COALESCE(SUM(valor_fornecedor),0) AS total,
           COALESCE(SUM(valor_custo),0) AS custo, COALESCE(SUM(qtd),0) AS pecas
    FROM consignacoes WHERE fornecedor_id=? AND status='pendente'
  `).get(fornecedorId);
  if (!pend.n) return { ok: false, erro: 'Não há repasses pendentes para este fornecedor.' };

  const total = arred(pend.total);
  const custo = arred(pend.custo);
  db.exec('BEGIN');
  try {
    const r = db.prepare(`
      INSERT INTO financeiro_lancamentos (tipo, descricao, categoria, valor, vencimento, origem, origem_id)
      VALUES ('pagar', ?, 'Consignação', ?, date('now','localtime','+7 days'), 'consignacao', ?)
    `).run(`Acerto consignação — ${forn.nome} (${pend.pecas} peça(s), custo R$ ${custo})`, total, fornecedorId);
    const lancId = Number(r.lastInsertRowid);
    db.prepare(`UPDATE consignacoes SET status='acertado', acerto_id=?
                WHERE fornecedor_id=? AND status='pendente'`).run(lancId, fornecedorId);
    db.exec('COMMIT');
    auditar(db, quem, 'consignacao_acerto', `${forn.nome}: R$ ${total} (${pend.pecas} peças, custo R$ ${custo})`);
    return { ok: true, lancamento_id: lancId, valor: total, custo, pecas: pend.pecas, fornecedor: forn.nome };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

export { resumo, listar, acertar };