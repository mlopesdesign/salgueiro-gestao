// Dashboard — agregação única para o painel executivo
const arred = (n) => Math.round((Number(n) || 0) * 100) / 100;
const { pode } = require('./permissoes');

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resumo(db, usuario) {
  const hojeStr = ymd(new Date());
  const mesIni = hojeStr.slice(0, 8) + '01';

  // --- Vendas de hoje ---
  const hoje = db.prepare(`
    SELECT COUNT(*) qtd, COALESCE(SUM(total),0) total, COALESCE(AVG(total),0) ticket
    FROM vendas WHERE status='concluida' AND date(criado_em)=date('now','localtime')
  `).get();

  // --- Vendas do mês + CMV (custo) para lucro bruto ---
  const mes = db.prepare(`
    SELECT COUNT(*) qtd, COALESCE(SUM(total),0) total
    FROM vendas WHERE status='concluida' AND date(criado_em) BETWEEN ? AND ?
  `).get(mesIni, hojeStr);
  const cmv = db.prepare(`
    SELECT COALESCE(SUM(vi.qtd*pr.preco_custo),0) custo
    FROM venda_itens vi
    JOIN vendas v ON v.id=vi.venda_id
    JOIN variacoes va ON va.id=vi.variacao_id
    JOIN produtos pr ON pr.id=va.produto_id
    WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ?
  `).get(mesIni, hojeStr);
  const lucroBruto = arred(mes.total - cmv.custo);
  const margem = mes.total > 0 ? Math.round((lucroBruto / mes.total) * 1000) / 10 : 0;

  // --- Série dos últimos 14 dias (preenche buracos com zero) ---
  const linhas = db.prepare(`
    SELECT date(criado_em) dia, COALESCE(SUM(total),0) total, COUNT(*) qtd
    FROM vendas
    WHERE status='concluida' AND date(criado_em) >= date('now','localtime','-13 days')
    GROUP BY dia
  `).all();
  const mapa = {};
  for (const l of linhas) mapa[l.dia] = { total: arred(l.total), qtd: l.qtd };
  const serie = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = ymd(d);
    serie.push({ dia: k, total: mapa[k] ? mapa[k].total : 0, qtd: mapa[k] ? mapa[k].qtd : 0 });
  }

  // --- Top 5 produtos do mês ---
  const top = db.prepare(`
    SELECT pr.nome, SUM(vi.qtd) pecas, SUM(vi.total) receita
    FROM venda_itens vi
    JOIN vendas v ON v.id=vi.venda_id
    JOIN variacoes va ON va.id=vi.variacao_id
    JOIN produtos pr ON pr.id=va.produto_id
    WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ?
    GROUP BY pr.id ORDER BY receita DESC LIMIT 5
  `).all(mesIni, hojeStr).map(t => ({ nome: t.nome, pecas: t.pecas, receita: arred(t.receita) }));

  // --- Estoque ---
  const est = db.prepare(`SELECT COUNT(*) produtos FROM produtos WHERE ativo=1`).get();
  const pecas = db.prepare(`SELECT COALESCE(SUM(estoque),0) n FROM variacoes WHERE ativo=1`).get();
  const valorVenda = db.prepare(`
    SELECT COALESCE(SUM(va.estoque*pr.preco_venda),0) v
    FROM variacoes va JOIN produtos pr ON pr.id=va.produto_id
    WHERE va.ativo=1 AND pr.ativo=1
  `).get();
  const abaixoMin = db.prepare(`
    SELECT COUNT(*) n FROM (
      SELECT pr.id, pr.estoque_minimo, COALESCE(SUM(va.estoque),0) est
      FROM produtos pr JOIN variacoes va ON va.produto_id=pr.id AND va.ativo=1
      WHERE pr.ativo=1 GROUP BY pr.id
      HAVING pr.estoque_minimo>0 AND est<=pr.estoque_minimo)
  `).get();

  // --- Caixa aberto ---
  const caixa = db.prepare(`SELECT id, aberto_em FROM caixas WHERE fechado_em IS NULL ORDER BY id DESC LIMIT 1`).get();

  // --- Financeiro: vencidos e a vencer (7 dias) ---
  const finVencidos = db.prepare(`
    SELECT tipo, COALESCE(SUM(valor),0) total, COUNT(*) qtd
    FROM financeiro_lancamentos
    WHERE pago_em IS NULL AND vencimento IS NOT NULL AND date(vencimento) < date('now','localtime')
    GROUP BY tipo
  `).all();
  const finVencer = db.prepare(`
    SELECT tipo, COALESCE(SUM(valor),0) total, COUNT(*) qtd
    FROM financeiro_lancamentos
    WHERE pago_em IS NULL AND vencimento IS NOT NULL
      AND date(vencimento) BETWEEN date('now','localtime') AND date('now','localtime','+7 days')
    GROUP BY tipo
  `).all();
  const bucket = (rows) => {
    const o = { pagar: { total: 0, qtd: 0 }, receber: { total: 0, qtd: 0 } };
    for (const r of rows) o[r.tipo] = { total: arred(r.total), qtd: r.qtd };
    return o;
  };

  // --- Crediário / inadimplência ---
  const credAberto = db.prepare(`
    SELECT COALESCE(SUM(valor),0) total, COUNT(*) qtd FROM crediario_parcelas WHERE pago_em IS NULL
  `).get();
  const credAtraso = db.prepare(`
    SELECT COALESCE(SUM(valor),0) total, COUNT(DISTINCT cliente_id) clientes
    FROM crediario_parcelas WHERE pago_em IS NULL AND date(vencimento) < date('now','localtime')
  `).get();

  // --- Aniversariantes do mês ---
  const aniv = db.prepare(`
    SELECT COUNT(*) n FROM clientes
    WHERE ativo=1 AND nascimento IS NOT NULL
      AND strftime('%m', nascimento) = strftime('%m','now','localtime')
  `).get();

  // --- Alertas acionáveis (prontos para a UI) ---
  const alertas = [];
  if (abaixoMin.n > 0) alertas.push({ nivel: 'alerta', tela: 'estoque', texto: `${abaixoMin.n} produto(s) abaixo do estoque mínimo` });
  const vp = bucket(finVencidos).pagar; if (vp.qtd > 0) alertas.push({ nivel: 'perigo', tela: 'financeiro', texto: `${vp.qtd} conta(s) a pagar vencida(s) — ${arred(vp.total)}` });
  if (credAtraso.clientes > 0) alertas.push({ nivel: 'perigo', tela: 'clientes', texto: `${credAtraso.clientes} cliente(s) em atraso no crediário — ${arred(credAtraso.total)}` });
  if (!caixa) alertas.push({ nivel: 'info', tela: 'pdv', texto: 'Nenhum caixa aberto — abra o caixa para vender' });
  if (aniv.n > 0) alertas.push({ nivel: 'info', tela: 'clientes', texto: `${aniv.n} aniversariante(s) este mês` });

  // Gating financeiro: vendedor não vê lucro, custo, margem nem o financeiro
  const verFin = pode(usuario, 'dashboard.financeiro');
  const verFinanceiro = pode(usuario, 'financeiro.ver');
  const mesOut = verFin
    ? { qtd: mes.qtd, total: arred(mes.total), custo: arred(cmv.custo), lucro_bruto: lucroBruto, margem }
    : { qtd: mes.qtd, total: arred(mes.total), custo: null, lucro_bruto: null, margem: null };

  return {
    ok: true,
    hoje: { qtd: hoje.qtd, total: arred(hoje.total), ticket: arred(hoje.ticket) },
    mes: mesOut,
    serie,
    top_produtos: top,
    estoque: { produtos: est.produtos, pecas: pecas.n, valor_venda: arred(valorVenda.v), abaixo_min: abaixoMin.n },
    caixa: { aberto: !!caixa, aberto_em: caixa ? caixa.aberto_em : null },
    financeiro: verFinanceiro ? { vencidos: bucket(finVencidos), a_vencer: bucket(finVencer) } : null,
    crediario: {
      aberto_total: arred(credAberto.total), aberto_qtd: credAberto.qtd,
      atraso_total: arred(credAtraso.total), atraso_clientes: credAtraso.clientes
    },
    aniversariantes: aniv.n,
    alertas: verFinanceiro ? alertas : alertas.filter(a => a.tela !== 'financeiro')
  };
}

module.exports = { resumo };
