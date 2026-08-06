// Financeiro — contas a pagar/receber e fluxo de caixa
const { auditar } = require('./util');
const arred = (n) => Math.round(n * 100) / 100;

// filtros: { tipo, situacao: 'abertas'|'pagas'|'todas', mes: 'YYYY-MM' }
function listar(db, p) {
  const cond = [];
  const params = [];
  if (p.tipo === 'pagar' || p.tipo === 'receber') { cond.push('tipo = ?'); params.push(p.tipo); }
  if (p.situacao === 'abertas') cond.push('pago_em IS NULL');
  if (p.situacao === 'pagas') cond.push('pago_em IS NOT NULL');
  if (p.mes) { cond.push("strftime('%Y-%m', COALESCE(vencimento, criado_em)) = ?"); params.push(p.mes); }
  const linhas = db.prepare(`
    SELECT *, (pago_em IS NULL AND vencimento < date('now','localtime')) AS vencido
    FROM financeiro_lancamentos
    ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
    ORDER BY pago_em IS NOT NULL, COALESCE(vencimento, criado_em)
    LIMIT 500
  `).all(...params);
  const aPagar = arred(linhas.filter(l => l.tipo === 'pagar' && !l.pago_em).reduce((s, l) => s + l.valor, 0));
  const aReceber = arred(linhas.filter(l => l.tipo === 'receber' && !l.pago_em).reduce((s, l) => s + l.valor, 0));
  const vencidas = arred(linhas.filter(l => l.vencido).reduce((s, l) => s + l.valor, 0));
  return { ok: true, lancamentos: linhas, a_pagar: aPagar, a_receber: aReceber, vencidas };
}

function salvar(db, p, quem) {
  const descricao = String(p.descricao || '').trim();
  const valor = arred(Number(p.valor));
  if (!['pagar', 'receber'].includes(p.tipo)) return { ok: false, erro: 'Tipo inválido.' };
  if (!descricao) return { ok: false, erro: 'Informe a descrição.' };
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, erro: 'Valor inválido.' };

  if (p.id) {
    const atual = db.prepare('SELECT origem FROM financeiro_lancamentos WHERE id=?').get(p.id);
    if (!atual) return { ok: false, erro: 'Lançamento não encontrado.' };
    if (atual.origem) return { ok: false, erro: 'Lançamento automático não pode ser editado.' };
    db.prepare('UPDATE financeiro_lancamentos SET tipo=?, descricao=?, categoria=?, valor=?, vencimento=? WHERE id=?')
      .run(p.tipo, descricao, p.categoria || null, valor, p.vencimento || null, p.id);
    auditar(db, quem, 'financeiro_editado', `#${p.id} ${descricao}`);
    return { ok: true, id: p.id };
  }
  const r = db.prepare(`INSERT INTO financeiro_lancamentos (tipo, descricao, categoria, valor, vencimento)
                        VALUES (?,?,?,?,?)`)
    .run(p.tipo, descricao, p.categoria || null, valor, p.vencimento || null);
  auditar(db, quem, 'financeiro_criado', `${p.tipo}: ${descricao} R$ ${valor.toFixed(2)}`);
  return { ok: true, id: Number(r.lastInsertRowid) };
}

// dar baixa (pagar/receber)
function baixar(db, p, quem) {
  const l = db.prepare('SELECT * FROM financeiro_lancamentos WHERE id=?').get(p.id);
  if (!l) return { ok: false, erro: 'Lançamento não encontrado.' };
  if (l.pago_em) return { ok: false, erro: 'Já baixado.' };
  const valor = p.valor != null ? arred(Number(p.valor)) : l.valor;
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, erro: 'Valor inválido.' };
  db.prepare("UPDATE financeiro_lancamentos SET pago_em = datetime('now','localtime'), valor_pago=? WHERE id=?")
    .run(valor, l.id);
  auditar(db, quem, 'financeiro_baixado', `#${l.id} ${l.descricao} R$ ${valor.toFixed(2)}`);
  return { ok: true };
}

function excluir(db, id, quem) {
  const l = db.prepare('SELECT origem FROM financeiro_lancamentos WHERE id=?').get(id);
  if (!l) return { ok: false, erro: 'Lançamento não encontrado.' };
  if (l.origem) return { ok: false, erro: 'Lançamento automático não pode ser excluído.' };
  db.prepare('DELETE FROM financeiro_lancamentos WHERE id=?').run(id);
  auditar(db, quem, 'financeiro_excluido', `#${id}`);
  return { ok: true };
}

// Fluxo de caixa do mês: vendas por forma + lançamentos pagos + previsão em aberto
function fluxo(db, p) {
  const mes = p.mes || new Date().toISOString().slice(0, 7);

  const vendas = db.prepare(`
    SELECT COALESCE(SUM(v.total), 0) AS total, COUNT(*) AS qtd
    FROM vendas v WHERE v.status = 'concluida' AND strftime('%Y-%m', v.criado_em) = ?
  `).get(mes);

  const porForma = db.prepare(`
    SELECT vp.forma, SUM(vp.valor - vp.troco) AS total
    FROM venda_pagamentos vp JOIN vendas v ON v.id = vp.venda_id
    WHERE v.status = 'concluida' AND strftime('%Y-%m', v.criado_em) = ?
    GROUP BY vp.forma ORDER BY total DESC
  `).all(mes);

  const custoVendido = db.prepare(`
    SELECT COALESCE(SUM(vi.qtd * pr.preco_custo), 0) AS total
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    WHERE v.status = 'concluida' AND strftime('%Y-%m', v.criado_em) = ?
  `).get(mes);

  // realizado: pelo mês do pagamento; previsto: pelo mês do vencimento
  const realizado = db.prepare(`
    SELECT tipo, COALESCE(SUM(COALESCE(valor_pago, valor)), 0) AS total
    FROM financeiro_lancamentos
    WHERE pago_em IS NOT NULL AND strftime('%Y-%m', pago_em) = ? GROUP BY tipo
  `).all(mes);
  const previsto = db.prepare(`
    SELECT tipo, COALESCE(SUM(valor), 0) AS total
    FROM financeiro_lancamentos
    WHERE pago_em IS NULL AND strftime('%Y-%m', COALESCE(vencimento, criado_em)) = ? GROUP BY tipo
  `).all(mes);
  const g = (t, c) => ((c === 'realizado' ? realizado : previsto).find(x => x.tipo === t) || {}).total || 0;

  // crediário: recebimentos ficam em financeiro (origem crediario, tipo receber) — já incluídos acima
  const receitas = arred(vendas.total);
  const custo = arred(custoVendido.total);
  const despesasPagas = arred(g('pagar', 'realizado'));
  const lucroBruto = arred(receitas - custo);
  const resultado = arred(lucroBruto - despesasPagas);

  return {
    ok: true, mes,
    vendas: { total: receitas, qtd: vendas.qtd, custo, lucro_bruto: lucroBruto },
    por_forma: porForma,
    pagar: { realizado: despesasPagas, previsto: arred(g('pagar', 'previsto')) },
    receber: { realizado: arred(g('receber', 'realizado')), previsto: arred(g('receber', 'previsto')) },
    resultado
  };
}

module.exports = { listar, salvar, baixar, excluir, fluxo };
