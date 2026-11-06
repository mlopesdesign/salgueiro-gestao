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

// v3.37.0 — PEÇA CONSIGNADA DEVOLVIDA (devolução ou troca). Antes nada mexia
// em `consignacoes`: o fornecedor recebia pela peça que voltou para a arara e
// recebia de novo quando ela fosse revendida. Agora a quantidade devolvida sai
// do repasse PENDENTE daquela venda, na proporção (valores divididos pela qtd).
// Se o repasse já foi ACERTADO (pago), não há o que desfazer aqui: fica na
// auditoria para o acerto seguinte ser corrigido à mão.
function estornarDevolucao(db, vendaId, variacaoId, qtd, quem) {
  let falta = Math.round(Number(qtd) || 0);
  if (falta <= 0) return { ok: true, estornado: 0 };
  const v = db.prepare('SELECT produto_id FROM variacoes WHERE id=?').get(variacaoId);
  if (!v) return { ok: true, estornado: 0 };
  const linhas = db.prepare(`SELECT * FROM consignacoes WHERE venda_id=? AND produto_id=? AND status='pendente' AND qtd > 0 ORDER BY id`)
    .all(vendaId, v.produto_id);
  let estornado = 0;
  for (const c of linhas) {
    if (falta <= 0) break;
    const tira = Math.min(falta, c.qtd);
    if (tira >= c.qtd) {
      db.prepare("UPDATE consignacoes SET status='cancelado' WHERE id=?").run(c.id);
    } else {
      const f = (c.qtd - tira) / c.qtd;
      const r2 = (n) => Math.round((Number(n) || 0) * f * 100) / 100;
      db.prepare(`UPDATE consignacoes SET qtd=?, valor_venda=?, valor_custo=?, valor_fornecedor=?, valor_loja=? WHERE id=?`)
        .run(c.qtd - tira, r2(c.valor_venda), r2(c.valor_custo), r2(c.valor_fornecedor), r2(c.valor_loja), c.id);
    }
    falta -= tira; estornado += tira;
  }
  if (falta > 0) {
    const pagas = db.prepare(`SELECT COUNT(*) AS n FROM consignacoes WHERE venda_id=? AND produto_id=? AND status='acertado'`).get(vendaId, v.produto_id).n;
    if (pagas) auditar(db, quem, 'consignacao_devolvida_apos_acerto',
      `venda #${vendaId} produto #${v.produto_id}: ${falta} peça(s) devolvida(s) com o repasse já pago — descontar no próximo acerto`);
  }
  return { ok: true, estornado, sem_estorno: falta };
}

// v3.37.0 — peça consignada que SAI numa troca também gera repasse (antes não
// gerava: o fornecedor nunca recebia pela peça levada na troca). Mesma conta de
// pdv.registrarVenda: custo + % do lucro sobre o valor efetivamente cobrado.
function registrarSaida(db, vendaId, variacaoId, qtd, valorCobrado) {
  const pr = db.prepare(`SELECT p.id, p.consignado, p.pct_fornecedor, p.fornecedor_id, p.preco_custo
                           FROM variacoes v JOIN produtos p ON p.id = v.produto_id WHERE v.id=?`).get(variacaoId);
  if (!pr || !pr.consignado || !pr.fornecedor_id || !(pr.pct_fornecedor > 0)) return null;
  const a2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const valorConsig = a2(valorCobrado);
  const custoTotal = a2((Number(pr.preco_custo) || 0) * qtd);
  const lucro = a2(valorConsig - custoTotal);
  const valorForn = a2(custoTotal + lucro * pr.pct_fornecedor / 100);
  db.prepare(`INSERT INTO consignacoes
      (venda_id, produto_id, fornecedor_id, qtd, valor_venda, valor_custo, pct_fornecedor, valor_fornecedor, valor_loja)
      VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(vendaId, pr.id, pr.fornecedor_id, qtd, valorConsig, custoTotal, pr.pct_fornecedor, valorForn, a2(valorConsig - valorForn));
  return valorForn;
}

export { resumo, listar, acertar, estornarDevolucao, registrarSaida };