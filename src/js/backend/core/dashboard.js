// Dashboard — agregação única para o painel executivo
const arred = (n) => Math.round((Number(n) || 0) * 100) / 100;
import { pode } from './permissoes.js';
// Troca não é venda — regra única do sistema. Ver core/vendas-sql.js.
import { NAO_TROCA, RECEBIDO_BRUTO, trocasDoPeriodo } from './vendas-sql.js';

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resumo(db, usuario) {
  const hojeStr = ymd(new Date());
  const mesIni = hojeStr.slice(0, 8) + '01';

  // --- Vendas de hoje ---
  const hojeRaw = db.prepare(`
    SELECT COUNT(*) qtd, COALESCE(SUM(${RECEBIDO_BRUTO('vendas')}),0) total
    FROM vendas WHERE status='concluida' AND date(criado_em)=date('now','localtime')
      ${NAO_TROCA('vendas')}
  `).get();
  // Saldo das trocas de hoje (pago a mais − troco devolvido). Linha própria.
  const hojeTroca = { total: trocasDoPeriodo(db, (x) => `date(${x}.criado_em)=date('now','localtime')`).saldo };
  // Devoluções de hoje — só de vendas ainda concluídas (canceladas não contam)
  const hojeDevol = db.prepare(`
    SELECT COALESCE(SUM(d.valor_devolvido),0) v FROM devolucoes d
    JOIN vendas v ON v.id=d.venda_id AND v.status='concluida' AND COALESCE(d.tipo,'') <> 'troca'
    WHERE date(d.criado_em)=date('now','localtime')
  `).get();
  // hoje.total = bruto (devolução fica em hoje.devolvido — nunca falso negativo no card)
  // VENDA É VENDA, TROCA É TROCA. `total` é só venda. A diferença da troca vai
  // em `trocas`, campo próprio, e aparece em linha separada no painel — nunca
  // somada ao número de vendas.
  const hoje = {
    qtd: hojeRaw.qtd,
    total: arred(hojeRaw.total),
    trocas: arred(hojeTroca.total),
    devolvido: arred(hojeDevol.v),
    ticket: hojeRaw.qtd > 0 ? arred(hojeRaw.total / hojeRaw.qtd) : 0
  };

  // --- Vendas do mês + CMV (custo) para lucro bruto ---
  const mesRaw = db.prepare(`
    SELECT COUNT(*) qtd, COALESCE(SUM(${RECEBIDO_BRUTO('vendas')}),0) total
    FROM vendas WHERE status='concluida' AND date(criado_em) BETWEEN ? AND ?
      ${NAO_TROCA('vendas')}
  `).get(mesIni, hojeStr);
  const mesTroca = { total: trocasDoPeriodo(db, (x) => `date(${x}.criado_em) BETWEEN ? AND ?`, [mesIni, hojeStr]).saldo };
  // Devoluções do mês — só de vendas ainda concluídas (canceladas não contam)
  const mesDevol = db.prepare(`
    SELECT COALESCE(SUM(d.valor_devolvido),0) v,
           COALESCE(SUM(di.qtd*pr.preco_custo),0) custo_dev
    FROM devolucoes d
    JOIN vendas vc ON vc.id=d.venda_id AND vc.status='concluida'
    JOIN devolucao_itens di ON di.devolucao_id=d.id
    JOIN variacoes va ON va.id=di.variacao_id
    JOIN produtos pr ON pr.id=va.produto_id
    WHERE date(d.criado_em) BETWEEN ? AND ?
      AND COALESCE(d.tipo,'') <> 'troca'
  `).get(mesIni, hojeStr);
  // mes.total = bruto; mes.devolvido é exibido separado no frontend
  const mes = { qtd: mesRaw.qtd, total: arred(mesRaw.total), trocas: arred(mesTroca.total), devolvido: arred(mesDevol.v) };
  // CMV — custo das peças VENDIDAS. A troca fica de fora aqui e é calculada
  // logo abaixo, senão acontece o que o Marcio pegou em 25/09/2026: a receita
  // da troca saiu de "vendas" (certo) mas o custo da peça que saiu continuou
  // dentro do CMV, e o lucro bruto ficou NEGATIVO — R$ 0,00 de venda menos
  // R$ 90,00 de custo = −R$ 90,00. Meia correção é pior que nenhuma.
  const cmv = db.prepare(`
    SELECT COALESCE(SUM(vi.qtd*pr.preco_custo),0) custo
    FROM venda_itens vi
    JOIN vendas v ON v.id=vi.venda_id
    JOIN variacoes va ON va.id=vi.variacao_id
    JOIN produtos pr ON pr.id=va.produto_id
    WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ?
      ${NAO_TROCA('v')}
  `).get(mesIni, hojeStr);

  // TROCA: entra peça e sai peça. O custo que conta é a DIFERENÇA entre o custo
  // da peça que saiu e o da que voltou — a peça devolvida volta para a
  // prateleira e pode ser vendida de novo, então o custo dela não é perda.
  // Lucro da troca = diferença recebida − esse custo líquido.
  const trocaCustoSaiu = db.prepare(`
    SELECT COALESCE(SUM(vi.qtd*pr.preco_custo),0) custo
    FROM venda_itens vi
    JOIN vendas v ON v.id=vi.venda_id
    JOIN variacoes va ON va.id=vi.variacao_id
    JOIN produtos pr ON pr.id=va.produto_id
    WHERE v.status='troca' AND date(v.criado_em) BETWEEN ? AND ?
  `).get(mesIni, hojeStr);
  const trocaCustoVoltou = db.prepare(`
    SELECT COALESCE(SUM(di.qtd*pr.preco_custo),0) custo
    FROM devolucoes d
    JOIN devolucao_itens di ON di.devolucao_id=d.id
    JOIN variacoes va ON va.id=di.variacao_id
    JOIN produtos pr ON pr.id=va.produto_id
    WHERE d.tipo='troca' AND date(d.criado_em) BETWEEN ? AND ?
  `).get(mesIni, hojeStr);
  const custoLiqTroca = arred((trocaCustoSaiu.custo || 0) - (trocaCustoVoltou.custo || 0));
  const lucroTroca = arred((mes.trocas || 0) - custoLiqTroca);

  // Devolução comum (fora da troca) já é abatida do CMV das vendas.
  const custoLiq = arred(cmv.custo - (mesDevol.custo_dev || 0));
  const receitaLiq = arred(mesRaw.total - mesDevol.v); // só venda
  // Lucro bruto = margem das vendas + margem das trocas.
  const lucroBruto = arred((receitaLiq - custoLiq) + lucroTroca);
  const baseMargem = arred(receitaLiq + (mes.trocas || 0));
  const margem = baseMargem > 0 ? Math.round((lucroBruto / baseMargem) * 1000) / 10 : 0;

  // --- Série dos últimos 14 dias (preenche buracos com zero) ---
  const linhas = db.prepare(`
    SELECT date(criado_em) dia,
           COALESCE(SUM(${RECEBIDO_BRUTO('vendas')}),0) total,
           COUNT(*) qtd
    FROM vendas
    WHERE status='concluida' AND date(criado_em) >= date('now','localtime','-13 days')
      ${NAO_TROCA('vendas')}
    GROUP BY dia
  `).all();
  const mapa = {};
  for (const l of linhas) mapa[l.dia] = { total: arred(l.total), qtd: l.qtd };
  // Devoluções por dia — só de vendas concluídas
  const serieDevol = db.prepare(`
    SELECT date(d.criado_em) dia, COALESCE(SUM(d.valor_devolvido),0) v
    FROM devolucoes d
    JOIN vendas vc ON vc.id=d.venda_id AND vc.status='concluida' AND COALESCE(d.tipo,'') <> 'troca'
    WHERE date(d.criado_em) >= date('now','localtime','-13 days')
    GROUP BY dia
  `).all();
  const devolMapa = {};
  for (const l of serieDevol) devolMapa[l.dia] = arred(l.v);
  const serie = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = ymd(d);
    const bruto = mapa[k] ? mapa[k].total : 0;
    const dev   = devolMapa[k] || 0;
    serie.push({ dia: k, total: Math.max(0, arred(bruto - dev)), bruto: arred(bruto), qtd: mapa[k] ? mapa[k].qtd : 0 });
  }

  // --- Top 5 produtos do mês (líquido de devoluções) ---
  const top = db.prepare(`
    SELECT pr.nome,
           SUM(vi.qtd) - COALESCE(dev.dev_qtd,0) pecas,
           SUM(vi.total) - COALESCE(dev.dev_val,0) receita
    FROM venda_itens vi
    JOIN vendas v ON v.id=vi.venda_id
    JOIN variacoes va ON va.id=vi.variacao_id
    JOIN produtos pr ON pr.id=va.produto_id
    LEFT JOIN (
      SELECT va2.produto_id,
             SUM(di.qtd) dev_qtd,
             SUM(di.qtd * CAST(vi2.total AS REAL) / vi2.qtd) dev_val
      FROM devolucao_itens di
      JOIN devolucoes d ON d.id=di.devolucao_id AND COALESCE(d.tipo,'') <> 'troca'
      JOIN vendas vs ON vs.id=d.venda_id
      JOIN venda_itens vi2 ON vi2.venda_id=d.venda_id AND vi2.variacao_id=di.variacao_id
      JOIN variacoes va2 ON va2.id=di.variacao_id
      WHERE vs.status='concluida' AND date(vs.criado_em) BETWEEN ? AND ?
      GROUP BY va2.produto_id
    ) dev ON dev.produto_id=pr.id
    WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ?
      ${NAO_TROCA('v')}
    GROUP BY pr.id HAVING pecas > 0
    ORDER BY receita DESC LIMIT 5
  `).all(mesIni, hojeStr, mesIni, hojeStr).map(t => ({ nome: t.nome, pecas: t.pecas, receita: arred(t.receita) }));

  // --- Estoque ---
  const est = db.prepare(`SELECT COUNT(*) produtos FROM produtos WHERE ativo=1`).get();
  const pecas = db.prepare(`SELECT COALESCE(SUM(estoque),0) n FROM variacoes WHERE ativo=1`).get();
  const valorVenda = db.prepare(`
    SELECT COALESCE(SUM(va.estoque*pr.preco_venda),0) v
    FROM variacoes va JOIN produtos pr ON pr.id=va.produto_id
    WHERE va.ativo=1 AND pr.ativo=1
  `).get();
  const abaixoMin = db.prepare(`
    SELECT COUNT(*) n FROM variacoes v
    JOIN produtos p ON p.id = v.produto_id
    WHERE p.ativo=1 AND v.ativo=1
      AND (v.estoque_minimo > 0 OR p.estoque_minimo > 0)
      AND v.estoque <= CASE WHEN v.estoque_minimo > 0 THEN v.estoque_minimo ELSE p.estoque_minimo END
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
  if (abaixoMin.n > 0) alertas.push({ nivel: 'alerta', tela: 'estoque', texto: `${abaixoMin.n} variação(ões) abaixo do estoque mínimo` });
  const vp = bucket(finVencidos).pagar; if (vp.qtd > 0) alertas.push({ nivel: 'perigo', tela: 'financeiro', texto: `${vp.qtd} conta(s) a pagar vencida(s) — ${arred(vp.total)}` });
  if (credAtraso.clientes > 0) alertas.push({ nivel: 'perigo', tela: 'clientes', texto: `${credAtraso.clientes} cliente(s) em atraso no crediário — ${arred(credAtraso.total)}` });
  if (!caixa) alertas.push({ nivel: 'info', tela: 'pdv', texto: 'Nenhum caixa aberto — abra o caixa para vender' });
  if (aniv.n > 0) alertas.push({ nivel: 'info', tela: 'clientes', texto: `${aniv.n} aniversariante(s) este mês` });

  // Gating financeiro: vendedor não vê lucro, custo, margem, valor estoque nem receita
  const verFin = pode(usuario, 'dashboard.financeiro');
  const verFinanceiro = pode(usuario, 'financeiro.ver');
  const mesOut = verFin
    ? { qtd: mes.qtd, total: mes.total, trocas: mes.trocas, lucro_trocas: lucroTroca, devolvido: mes.devolvido, custo: custoLiq, lucro_bruto: lucroBruto, margem }
    : { qtd: mes.qtd, total: null, trocas: null, lucro_trocas: null, devolvido: null, custo: null, lucro_bruto: null, margem: null };

  // top_produtos: sem receita para quem não tem permissão financeira
  const topOut = top.map(t => verFin
    ? t
    : { nome: t.nome, pecas: t.pecas, receita: null });

  // série 14 dias: ocultar totais monetários para quem não tem permissão
  const serieOut = verFin ? serie : serie.map(x => ({ dia: x.dia, qtd: x.qtd, total: null }));

  return {
    ok: true,
    hoje: { qtd: hoje.qtd, total: verFin ? hoje.total : null, trocas: verFin ? hoje.trocas : null,
            devolvido: verFin ? hoje.devolvido : null, ticket: verFin ? hoje.ticket : null },
    mes: mesOut,
    serie: serieOut,
    top_produtos: topOut,
    // valor_venda expõe preço × quantidade — só para quem tem permissão financeira
    estoque: { produtos: est.produtos, pecas: pecas.n, valor_venda: verFin ? arred(valorVenda.v) : null, abaixo_min: abaixoMin.n },
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

export { resumo };