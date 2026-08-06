// Relatórios — vendas por período, curva ABC, peças paradas
const arred = (n) => Math.round(n * 100) / 100;

// Subquery que retorna o total já devolvido de uma venda (alias v)
const _devSub = `COALESCE((SELECT SUM(d.valor_devolvido) FROM devolucoes d WHERE d.venda_id=v.id),0)`;

// p: { de: 'YYYY-MM-DD', ate: 'YYYY-MM-DD' }
function vendasPeriodo(db, p) {
  const de = p.de || new Date().toISOString().slice(0, 8) + '01';
  const ate = p.ate || new Date().toISOString().slice(0, 10);
  const lojaId = Number(p.loja_id) || 0; // 0 = todas as lojas
  const fLoja = lojaId ? 'AND v.loja_id = ?' : '';
  const ar = lojaId ? [de, ate, lojaId] : [de, ate];

  // Subtrai devoluções do total de cada venda (valor líquido)
  // COUNT só conta vendas com valor líquido > 0 (exclui totalmente devolvidas)
  const resumo = db.prepare(`
    SELECT COUNT(CASE WHEN (v.total - ${_devSub}) > 0 THEN 1 END) qtd,
           COALESCE(SUM(v.total - ${_devSub}),0) total,
           COALESCE(AVG(CASE WHEN (v.total - ${_devSub}) > 0 THEN (v.total - ${_devSub}) END),0) ticket
    FROM vendas v WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ? ${fLoja}
  `).get(...ar);

  const porDia = db.prepare(`
    SELECT date(v.criado_em) dia,
           COUNT(CASE WHEN (v.total - ${_devSub}) > 0 THEN 1 END) qtd,
           SUM(v.total - ${_devSub}) total
    FROM vendas v WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ? ${fLoja}
    GROUP BY dia ORDER BY dia
  `).all(...ar);

  const porVendedor = db.prepare(`
    SELECT u.nome vendedor,
           COUNT(CASE WHEN (v.total - ${_devSub}) > 0 THEN 1 END) qtd,
           SUM(v.total - ${_devSub}) total
    FROM vendas v LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ? ${fLoja}
    GROUP BY v.usuario_id ORDER BY total DESC
  `).all(...ar);

  // porCategoria: líquido de devoluções por categoria
  const arCat = lojaId ? [de, ate, lojaId, de, ate, lojaId] : [de, ate, de, ate];
  const fLojaVs = lojaId ? 'AND vs.loja_id = ?' : '';
  const porCategoria = db.prepare(`
    SELECT COALESCE(c.nome,'Sem categoria') categoria,
           SUM(vi.qtd) - COALESCE(dev.dev_qtd,0) pecas,
           SUM(vi.total) - COALESCE(dev.dev_val,0) total
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos p ON p.id = va.produto_id
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN (
      SELECT COALESCE(p2.categoria_id, -1) cat_id,
             SUM(di.qtd) dev_qtd,
             SUM(di.qtd * CAST(vi2.total AS REAL) / vi2.qtd) dev_val
      FROM devolucao_itens di
      JOIN devolucoes d ON d.id=di.devolucao_id
      JOIN vendas vs ON vs.id=d.venda_id
      JOIN venda_itens vi2 ON vi2.venda_id=d.venda_id AND vi2.variacao_id=di.variacao_id
      JOIN variacoes va2 ON va2.id=di.variacao_id
      JOIN produtos p2 ON p2.id=va2.produto_id
      WHERE vs.status='concluida' AND date(vs.criado_em) BETWEEN ? AND ? ${fLojaVs}
      GROUP BY p2.categoria_id
    ) dev ON dev.cat_id = COALESCE(p.categoria_id, -1)
    WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ? ${fLoja}
    GROUP BY COALESCE(c.id, -1), COALESCE(c.nome,'Sem categoria')
    ORDER BY total DESC
  `).all(...arCat);

  return { ok: true, de, ate,
    resumo: { qtd: resumo.qtd, total: arred(resumo.total), ticket: arred(resumo.ticket) },
    por_dia: porDia, por_vendedor: porVendedor, por_categoria: porCategoria };
}

// Consignados por mês: o que pagar a cada fornecedor (custo + partes).
// p: { mes: 'YYYY-MM' } — padrão: mês atual.
function consignadosMensal(db, p) {
  const mes = /^\d{4}-\d{2}$/.test(p && p.mes || '') ? p.mes : new Date().toISOString().slice(0, 7);
  const linhas = db.prepare(`
    SELECT f.id AS fornecedor_id, f.nome AS fornecedor, c.status,
           SUM(c.qtd) AS pecas,
           SUM(c.valor_venda) AS venda,
           SUM(c.valor_custo) AS custo,
           SUM(c.valor_fornecedor) AS fornecedor_total,
           SUM(c.valor_loja) AS loja_total
    FROM consignacoes c
    JOIN fornecedores f ON f.id = c.fornecedor_id
    JOIN vendas v ON v.id = c.venda_id
    WHERE strftime('%Y-%m', v.criado_em) = ? AND v.status = 'concluida'
    GROUP BY f.id, f.nome, c.status
    ORDER BY f.nome
  `).all(mes);
  const porFornecedor = new Map();
  for (const l of linhas) {
    const g = porFornecedor.get(l.fornecedor_id) ||
      { fornecedor_id: l.fornecedor_id, fornecedor: l.fornecedor,
        pecas: 0, venda: 0, custo: 0, parte_fornecedor: 0, parte_loja: 0,
        a_pagar: 0, ja_acertado: 0 };
    g.pecas += l.pecas || 0;
    g.venda = arred(g.venda + (l.venda || 0));
    g.custo = arred(g.custo + (l.custo || 0));
    g.parte_fornecedor = arred(g.parte_fornecedor + (l.fornecedor_total || 0));
    g.parte_loja = arred(g.parte_loja + (l.loja_total || 0));
    if (l.status === 'pendente') g.a_pagar = arred(g.a_pagar + (l.fornecedor_total || 0));
    else g.ja_acertado = arred(g.ja_acertado + (l.fornecedor_total || 0));
    porFornecedor.set(l.fornecedor_id, g);
  }
  const fornecedores = [...porFornecedor.values()];
  for (const g of fornecedores) g.lucro_fornecedor = arred(g.parte_fornecedor - g.custo);
  const tot = (campo) => arred(fornecedores.reduce((a, g) => a + (g[campo] || 0), 0));
  return { ok: true, mes, fornecedores,
    totais: { pecas: fornecedores.reduce((a, g) => a + g.pecas, 0),
      venda: tot('venda'), custo: tot('custo'),
      parte_fornecedor: tot('parte_fornecedor'), parte_loja: tot('parte_loja'),
      a_pagar: tot('a_pagar'), ja_acertado: tot('ja_acertado') } };
}

// Receita separada por loja no período (com total consolidado)
function receitaPorLoja(db, p) {
  const de = p.de || new Date().toISOString().slice(0, 8) + '01';
  const ate = p.ate || new Date().toISOString().slice(0, 10);
  const linhas = db.prepare(`
    SELECT l.id loja_id, l.nome loja,
           COUNT(v.id) qtd,
           COALESCE(SUM(v.total - ${_devSub}),0) total,
           COALESCE(AVG(v.total - ${_devSub}),0) ticket
    FROM lojas l
    LEFT JOIN vendas v ON v.loja_id = l.id AND v.status='concluida'
                       AND date(v.criado_em) BETWEEN ? AND ?
    WHERE l.ativo = 1
    GROUP BY l.id, l.nome
    ORDER BY total DESC, l.nome
  `).all(de, ate);
  let total = 0, qtd = 0;
  for (const l of linhas) { total += l.total; qtd += l.qtd; l.total = arred(l.total); l.ticket = arred(l.ticket); }
  return { ok: true, de, ate, lojas: linhas, total: arred(total), qtd };
}

// Curva ABC de produtos por receita no período (A=80%, B=95%, C=resto)
// Receita e peças são líquidos de devoluções.
function curvaAbc(db, p) {
  const de = p.de || '2000-01-01';
  const ate = p.ate || new Date().toISOString().slice(0, 10);
  const linhas = db.prepare(`
    SELECT pr.id, pr.nome, pr.referencia,
           SUM(vi.qtd) - COALESCE(dev.dev_qtd,0) pecas,
           SUM(vi.total) - COALESCE(dev.dev_val,0) receita,
           SUM(vi.qtd * pr.preco_custo) - COALESCE(dev.dev_custo,0) custo
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    LEFT JOIN (
      SELECT va2.produto_id,
             SUM(di.qtd) dev_qtd,
             SUM(di.qtd * CAST(vi2.total AS REAL) / vi2.qtd) dev_val,
             SUM(di.qtd * pr2.preco_custo) dev_custo
      FROM devolucao_itens di
      JOIN devolucoes d ON d.id=di.devolucao_id
      JOIN vendas vs ON vs.id=d.venda_id
      JOIN venda_itens vi2 ON vi2.venda_id=d.venda_id AND vi2.variacao_id=di.variacao_id
      JOIN variacoes va2 ON va2.id=di.variacao_id
      JOIN produtos pr2 ON pr2.id=va2.produto_id
      WHERE vs.status='concluida' AND date(vs.criado_em) BETWEEN ? AND ?
      GROUP BY va2.produto_id
    ) dev ON dev.produto_id=pr.id
    WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ?
    GROUP BY pr.id HAVING receita > 0
    ORDER BY receita DESC
  `).all(de, ate, de, ate);
  const totalReceita = linhas.reduce((s, l) => s + l.receita, 0) || 1;
  let acumulado = 0;
  for (const l of linhas) {
    const pctAntes = acumulado / totalReceita; // classe pelo acumulado ANTES do item
    acumulado += l.receita;
    l.classe = pctAntes < 0.8 ? 'A' : pctAntes < 0.95 ? 'B' : 'C';
    l.receita = arred(l.receita);
    l.margem = arred(l.receita - l.custo);
    l.pct = Math.round((l.receita / totalReceita) * 1000) / 10;
  }
  return { ok: true, produtos: linhas, total_receita: arred(totalReceita === 1 ? 0 : totalReceita) };
}

// Produtos com estoque e sem venda há X dias
function pecasParadas(db, p) {
  const dias = Number(p.dias) || 60;
  const linhas = db.prepare(`
    SELECT pr.id, pr.nome, pr.referencia, pr.preco_venda,
           COALESCE(SUM(va.estoque),0) estoque,
           (SELECT MAX(v.criado_em) FROM venda_itens vi
            JOIN vendas v ON v.id = vi.venda_id
            JOIN variacoes vx ON vx.id = vi.variacao_id
            WHERE vx.produto_id = pr.id AND v.status='concluida') ultima_venda
    FROM produtos pr
    JOIN variacoes va ON va.produto_id = pr.id AND va.ativo = 1
    WHERE pr.ativo = 1
    GROUP BY pr.id
    HAVING estoque > 0 AND (ultima_venda IS NULL OR date(ultima_venda) < date('now','localtime', '-' || ? || ' days'))
    ORDER BY ultima_venda IS NOT NULL, ultima_venda
  `).all(dias);
  const valorParado = arred(linhas.reduce((s, l) => s + l.estoque * l.preco_venda, 0));
  return { ok: true, produtos: linhas, valor_parado: valorParado, dias };
}

// ---------- Relatório de Evento (pós-venda) ----------
// Taxas da maquininha (Mercado Pago Smart 2) — percentuais.
// Podem ser sobrescritas por venda/relatório via p.taxas.
const TAXAS_PADRAO = {
  pix_chave: 0,          // Pix direto na chave — sem taxa
  pix_maquina: 0.49,     // Pix lido na maquininha
  debito: 0.99,
  credito_vista: 3.05,
  credito_parcelado: 3.25, // 2x a 6x
  dinheiro: 0, crediario: 0, vale: 0
};

// Taxa (%) de um pagamento, conforme forma e nº de parcelas.
function taxaPagamento(forma, parcelas, taxas, pixNaMaquina) {
  const n = Number(parcelas) || 1;
  if (forma === 'debito') return Number(taxas.debito) || 0;
  if (forma === 'pix') return Number(pixNaMaquina ? taxas.pix_maquina : taxas.pix_chave) || 0;
  if (forma === 'credito') {
    return Number(n <= 1 ? taxas.credito_vista : taxas.credito_parcelado) || 0;
  }
  return 0; // dinheiro, crediario, vale
}

const _ROTULO_FORMA = {
  dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito',
  credito: 'Crédito', crediario: 'Crediário', vale: 'Vale-troca', cortesia: 'Cortesia'
};

// Relatório de um evento/plantão delimitado por DATA + HORA.
// O período pode atravessar a meia-noite (ex.: sábado 20:00 → domingo 04:00).
// p: { inicio:'YYYY-MM-DD HH:MM', fim:'YYYY-MM-DD HH:MM',
//      pix_maquina:bool, taxas:{...}, loja_id:number }
function relatorioEvento(db, p) {
  p = p || {};
  const RX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;
  const limpa = (s) => String(s || '').replace('T', ' ').trim();
  const agora = new Date();
  const dHoje = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
  let inicio = limpa(p.inicio), fim = limpa(p.fim);
  if (!RX.test(inicio)) inicio = dHoje + ' 00:00';
  if (!RX.test(fim)) fim = dHoje + ' 23:59';
  inicio = inicio.slice(0, 16) + ':00';
  fim = fim.slice(0, 16) + ':59';

  const taxas = Object.assign({}, TAXAS_PADRAO, p.taxas || {});
  const pixMaq = !!p.pix_maquina;
  const lojaId = Number(p.loja_id) || 0;
  const fLoja = lojaId ? 'AND v.loja_id = ?' : '';
  const ar = lojaId ? [inicio, fim, lojaId] : [inicio, fim];

  const vendas = db.prepare(`
    SELECT v.id, v.criado_em, v.subtotal, v.desconto, v.total,
           COALESCE(c.nome,'') cliente, COALESCE(u.nome,'') vendedor,
           ${_devSub} devolvido
    FROM vendas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ? ${fLoja}
    ORDER BY v.criado_em, v.id
  `).all(...ar);

  const itens = db.prepare(`
    SELECT vi.venda_id, vi.qtd, vi.preco_unit, vi.desconto, vi.total,
           pr.nome produto, COALESCE(pr.referencia,'') referencia,
           COALESCE(va.cor,'') cor, COALESCE(va.tamanho,'') tamanho
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ? ${fLoja}
    ORDER BY vi.venda_id, vi.id
  `).all(...ar);

  const pagtos = db.prepare(`
    SELECT vp.venda_id, vp.forma, vp.valor, vp.parcelas, vp.troco
    FROM venda_pagamentos vp
    JOIN vendas v ON v.id = vp.venda_id
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ? ${fLoja}
    ORDER BY vp.venda_id, vp.id
  `).all(...ar);

  const consig = db.prepare(`
    SELECT cg.venda_id, cg.qtd, cg.valor_venda, cg.valor_custo, cg.pct_fornecedor,
           cg.valor_fornecedor, cg.valor_loja, cg.status,
           f.id fornecedor_id, f.nome fornecedor, pr.nome produto
    FROM consignacoes cg
    JOIN vendas v ON v.id = cg.venda_id
    JOIN fornecedores f ON f.id = cg.fornecedor_id
    JOIN produtos pr ON pr.id = cg.produto_id
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ? ${fLoja}
    ORDER BY f.nome, cg.venda_id
  `).all(...ar);

  // Indexa filhos por venda
  const mapa = new Map();
  for (const v of vendas) {
    v.total = arred(v.total); v.subtotal = arred(v.subtotal);
    v.desconto = arred(v.desconto); v.devolvido = arred(v.devolvido);
    v.liquido = arred(v.total - v.devolvido);
    v.itens = []; v.pagamentos = []; v.consignados = [];
    v.pecas = 0; v.taxa_valor = 0; v.comissao = 0;
    v.data = String(v.criado_em).slice(0, 10);
    v.hora = String(v.criado_em).slice(11, 16);
    mapa.set(v.id, v);
  }
  for (const it of itens) {
    const v = mapa.get(it.venda_id); if (!v) continue;
    it.total = arred(it.total); it.preco_unit = arred(it.preco_unit);
    v.itens.push(it); v.pecas += Number(it.qtd) || 0;
  }

  // Pagamentos + taxa da maquininha
  const porForma = new Map();
  for (const g of pagtos) {
    const v = mapa.get(g.venda_id); if (!v) continue;
    const liq = arred((Number(g.valor) || 0) - (Number(g.troco) || 0));
    const pct = taxaPagamento(g.forma, g.parcelas, taxas, pixMaq);
    const tx = arred(liq * pct / 100);
    g.valor = arred(g.valor); g.liquido = liq; g.taxa_pct = pct; g.taxa_valor = tx;
    const par = Number(g.parcelas) || 1;
    g.rotulo = _ROTULO_FORMA[g.forma] || g.forma;
    if (g.forma === 'credito') g.rotulo += par > 1 ? ` ${par}x` : ' à vista';
    if (g.forma === 'pix') g.rotulo += pixMaq ? ' (maquininha)' : ' (chave)';
    v.pagamentos.push(g); v.taxa_valor = arred(v.taxa_valor + tx);

    const k = g.rotulo;
    const acc = porForma.get(k) || { forma: k, qtd: 0, valor: 0, taxa_pct: pct, taxa_valor: 0 };
    acc.qtd += 1; acc.valor = arred(acc.valor + liq); acc.taxa_valor = arred(acc.taxa_valor + tx);
    porForma.set(k, acc);
  }

  // Consignação
  const porFornecedor = new Map();
  for (const cg of consig) {
    const v = mapa.get(cg.venda_id);
    cg.valor_venda = arred(cg.valor_venda); cg.valor_fornecedor = arred(cg.valor_fornecedor);
    cg.valor_loja = arred(cg.valor_loja); cg.valor_custo = arred(cg.valor_custo);
    if (v) { v.consignados.push(cg); v.comissao = arred(v.comissao + cg.valor_fornecedor); }
    const g = porFornecedor.get(cg.fornecedor_id) ||
      { fornecedor_id: cg.fornecedor_id, fornecedor: cg.fornecedor,
        pecas: 0, venda: 0, comissao: 0, parte_loja: 0, pendente: 0 };
    g.pecas += Number(cg.qtd) || 0;
    g.venda = arred(g.venda + cg.valor_venda);
    g.comissao = arred(g.comissao + cg.valor_fornecedor);
    g.parte_loja = arred(g.parte_loja + cg.valor_loja);
    if (cg.status === 'pendente') g.pendente = arred(g.pendente + cg.valor_fornecedor);
    porFornecedor.set(cg.fornecedor_id, g);
  }

  // Agregados auxiliares
  const somaVend = new Map(), somaCat = new Map();
  for (const v of vendas) {
    const kv = v.vendedor || '—';
    const a = somaVend.get(kv) || { vendedor: kv, qtd: 0, pecas: 0, total: 0 };
    a.qtd += 1; a.pecas += v.pecas; a.total = arred(a.total + v.liquido);
    somaVend.set(kv, a);
  }
  const cats = db.prepare(`
    SELECT COALESCE(c.nome,'Sem categoria') categoria,
           SUM(vi.qtd) pecas, SUM(vi.total) total
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    LEFT JOIN categorias c ON c.id = pr.categoria_id
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ? ${fLoja}
    GROUP BY COALESCE(c.id,-1) ORDER BY total DESC
  `).all(...ar);
  for (const c of cats) c.total = arred(c.total);

  // Produtos vendidos no evento (consolidado por variação)
  const prods = db.prepare(`
    SELECT pr.nome produto, COALESCE(pr.referencia,'') referencia,
           COALESCE(va.cor,'') cor, COALESCE(va.tamanho,'') tamanho,
           SUM(vi.qtd) qtd, SUM(vi.total) total
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ? ${fLoja}
    GROUP BY va.id ORDER BY total DESC
  `).all(...ar);
  for (const x of prods) x.total = arred(x.total);

  // Cortesias do período: o que foi dado, para quem, quem autorizou e quanto
  // custou de verdade para a loja (preço de custo das peças que saíram do estoque).
  const cortesias = db.prepare(`
    SELECT v.id venda_id, v.criado_em, vp.autorizado_por, vp.beneficiario,
           vp.cortesia_valor,
           (SELECT GROUP_CONCAT(pr.nome || ' (' || CAST(vi.qtd AS INT) || ')', ', ')
              FROM venda_itens vi
              JOIN variacoes va ON va.id = vi.variacao_id
              JOIN produtos pr ON pr.id = va.produto_id
             WHERE vi.venda_id = v.id) produtos,
           (SELECT COALESCE(SUM(vi.qtd * pr.preco_custo),0)
              FROM venda_itens vi
              JOIN variacoes va ON va.id = vi.variacao_id
              JOIN produtos pr ON pr.id = va.produto_id
             WHERE vi.venda_id = v.id) custo,
           (SELECT COALESCE(SUM(vi.qtd),0) FROM venda_itens vi WHERE vi.venda_id = v.id) pecas
    FROM venda_pagamentos vp
    JOIN vendas v ON v.id = vp.venda_id
    WHERE vp.forma = 'cortesia' AND v.status = 'concluida'
      AND v.criado_em BETWEEN ? AND ? ${fLoja}
    ORDER BY v.criado_em
  `).all(...ar);
  for (const x of cortesias) {
    x.cortesia_valor = arred(x.cortesia_valor);
    x.custo = arred(x.custo);
    x.data = String(x.criado_em).slice(0, 10);
    x.hora = String(x.criado_em).slice(11, 16);
  }
  const cortesiaResumo = {
    qtd: cortesias.length,
    pecas: cortesias.reduce((s, x) => s + (Number(x.pecas) || 0), 0),
    valor: arred(cortesias.reduce((s, x) => s + x.cortesia_valor, 0)),
    custo: arred(cortesias.reduce((s, x) => s + x.custo, 0))
  };

  // Descontos avulsos do período (v3.3.0). Só entram os que o operador lançou
  // na mão — desconto de categoria e resgate de pontos não passam por aqui.
  // O nome de quem autorizou é campo livre: quem libera nem sempre tem login.
  const descontos = db.prepare(`
    SELECT v.id venda_id, v.criado_em, v.subtotal, v.desconto, v.total,
           v.desconto_autorizado_por autorizado_por, v.desconto_motivo motivo,
           COALESCE(u.nome, '—') operador,
           COALESCE(c.nome, '—') cliente
    FROM vendas v
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE v.status = 'concluida' AND v.desconto > 0
      AND v.desconto_autorizado_por IS NOT NULL
      AND v.criado_em BETWEEN ? AND ? ${fLoja}
    ORDER BY v.criado_em
  `).all(...ar);
  for (const d of descontos) {
    d.desconto = arred(d.desconto);
    d.subtotal = arred(d.subtotal);
    d.total = arred(d.total);
    d.percent = d.subtotal > 0 ? Math.round((d.desconto / d.subtotal) * 1000) / 10 : 0;
    d.data = String(d.criado_em).slice(0, 10);
    d.hora = String(d.criado_em).slice(11, 16);
  }
  const descontoResumo = {
    qtd: descontos.length,
    valor: arred(descontos.reduce((s, d) => s + d.desconto, 0))
  };

  const soma = (f) => arred(vendas.reduce((s, v) => s + (Number(f(v)) || 0), 0));
  const bruto = soma(v => v.total);
  const devolucoes = soma(v => v.devolvido);
  const liquido = arred(bruto - devolucoes);
  const taxaTotal = arred([...porForma.values()].reduce((s, g) => s + g.taxa_valor, 0));
  const comissaoTotal = arred([...porFornecedor.values()].reduce((s, g) => s + g.comissao, 0));
  const pecasTotal = vendas.reduce((s, v) => s + v.pecas, 0);

  return {
    ok: true, inicio, fim, pix_maquina: pixMaq, taxas,
    vendas, cortesias, descontos,
    por_produto: prods,
    por_forma: [...porForma.values()],
    por_fornecedor: [...porFornecedor.values()],
    por_vendedor: [...somaVend.values()].sort((a, b) => b.total - a.total),
    por_categoria: cats,
    resumo: {
      vendas: vendas.length, pecas: pecasTotal,
      bruto, devolucoes, liquido,
      taxas: taxaTotal, comissao: comissaoTotal,
      cortesias: cortesiaResumo,
      descontos: descontoResumo,
      // ticket médio só sobre vendas que geraram receita (ignora cortesias)
      ticket: (() => {
        const pagas = vendas.filter(v => v.liquido > 0);
        return arred(pagas.length ? pagas.reduce((s, v) => s + v.liquido, 0) / pagas.length : 0);
      })(),
      receber: arred(liquido - taxaTotal - comissaoTotal)
    }
  };
}

// ---------- Ranking de mais vendidos ----------
const _p2 = (n) => String(n).padStart(2, '0');
const _iso = (d) => `${d.getFullYear()}-${_p2(d.getMonth() + 1)}-${_p2(d.getDate())}`;
const _meiodia = (iso) => new Date(`${iso}T12:00:00`);
const _somaDias = (iso, n) => { const d = _meiodia(iso); d.setDate(d.getDate() + n); return _iso(d); };

// Segunda-feira da semana de `iso`
function _segunda(iso) {
  const d = _meiodia(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return _iso(d);
}

// Janelas de cada período + a janela equivalente anterior (para a variação de posição)
function _janelas(hoje) {
  const [a, m] = hoje.split('-').map(Number);
  const seg = _segunda(hoje);
  const segAnt = _somaDias(seg, -7);
  const mesIni = `${a}-${_p2(m)}-01`;
  const mesAntIni = m === 1 ? `${a - 1}-12-01` : `${a}-${_p2(m - 1)}-01`;
  return {
    dia:    { rotulo: 'Hoje',      de: hoje,   ate: hoje, ant: { de: _somaDias(hoje, -1), ate: _somaDias(hoje, -1) } },
    semana: { rotulo: 'Esta semana', de: seg,  ate: hoje, ant: { de: segAnt, ate: _somaDias(seg, -1) } },
    mes:    { rotulo: 'Este mês',  de: mesIni, ate: hoje, ant: { de: mesAntIni, ate: _somaDias(mesIni, -1) } },
    ano:    { rotulo: 'Este ano',  de: `${a}-01-01`, ate: hoje, ant: { de: `${a - 1}-01-01`, ate: `${a - 1}-12-31` } }
  };
}

// Produtos vendidos no intervalo (data + HORA), líquidos de devoluções
function _rankProdutos(db, de, ate) {
  const linhas = db.prepare(`
    SELECT pr.id, pr.nome, COALESCE(pr.referencia,'') referencia,
           COALESCE(c.nome,'Sem categoria') categoria,
           SUM(vi.qtd) - COALESCE(dev.dev_qtd,0) pecas,
           SUM(vi.total) - COALESCE(dev.dev_val,0) receita
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    LEFT JOIN categorias c ON c.id = pr.categoria_id
    LEFT JOIN (
      SELECT va2.produto_id, SUM(di.qtd) dev_qtd,
             SUM(di.qtd * CAST(vi2.total AS REAL) / vi2.qtd) dev_val
      FROM devolucao_itens di
      JOIN devolucoes d ON d.id = di.devolucao_id
      JOIN vendas vs ON vs.id = d.venda_id
      JOIN venda_itens vi2 ON vi2.venda_id = d.venda_id AND vi2.variacao_id = di.variacao_id
      JOIN variacoes va2 ON va2.id = di.variacao_id
      WHERE vs.status='concluida' AND vs.criado_em BETWEEN ? AND ?
      GROUP BY va2.produto_id
    ) dev ON dev.produto_id = pr.id
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ?
    GROUP BY pr.id HAVING pecas > 0
  `).all(de, ate, de, ate);
  for (const l of linhas) { l.pecas = arred(l.pecas); l.receita = arred(l.receita); }
  return linhas;
}

function _rankCategorias(db, de, ate) {
  const linhas = db.prepare(`
    SELECT COALESCE(c.nome,'Sem categoria') categoria,
           SUM(vi.qtd) pecas, SUM(vi.total) receita
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    LEFT JOIN categorias c ON c.id = pr.categoria_id
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ?
    GROUP BY COALESCE(c.id,-1) ORDER BY pecas DESC
  `).all(de, ate);
  for (const l of linhas) { l.pecas = arred(l.pecas); l.receita = arred(l.receita); }
  return linhas;
}

// O que mais sai por cor/tamanho — serve de guia para reposição
function _rankVariacoes(db, de, ate) {
  const linhas = db.prepare(`
    SELECT pr.nome produto, COALESCE(va.cor,'') cor, COALESCE(va.tamanho,'') tamanho,
           SUM(vi.qtd) pecas, SUM(vi.total) receita, va.estoque
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ?
    GROUP BY va.id ORDER BY pecas DESC LIMIT 30
  `).all(de, ate);
  for (const l of linhas) { l.pecas = arred(l.pecas); l.receita = arred(l.receita); }
  return linhas;
}

// Quem mais compra (ignora venda sem cliente identificado)
function _rankClientes(db, de, ate) {
  const linhas = db.prepare(`
    SELECT cl.id, cl.nome, COALESCE(cc.nome,'') categoria,
           COUNT(DISTINCT v.id) compras,
           SUM(v.total - ${_devSub}) gasto
    FROM vendas v
    JOIN clientes cl ON cl.id = v.cliente_id
    LEFT JOIN categorias_clientes cc ON cc.id = cl.categoria_id
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ?
      AND COALESCE(cl.generico,0) = 0
    GROUP BY cl.id HAVING gasto > 0
    ORDER BY gasto DESC LIMIT 30
  `).all(de, ate);
  for (const l of linhas) l.gasto = arred(l.gasto);
  return linhas;
}

// Em que horário a loja mais vende — ajuda a escalar equipe e planejar evento
function _porHora(db, de, ate) {
  return db.prepare(`
    SELECT CAST(strftime('%H', v.criado_em) AS INTEGER) hora,
           COUNT(*) vendas, COALESCE(SUM(v.total),0) receita
    FROM vendas v
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ?
    GROUP BY hora ORDER BY hora
  `).all(de, ate);
}

// ── Eventos (sessões de venda) detectados automaticamente ──────────────────
// A loja não abre todo dia: abre para evento (feijoada de domingo, sábado de
// samba…). Vendas separadas por mais de `horas` de intervalo são eventos
// diferentes. Assim o Marcio escolhe o evento em vez de digitar data e hora.
function eventosVenda(db, p) {
  p = p || {};
  const gapH = Number(p.horas) > 0 ? Number(p.horas) : 6;
  const limite = Number(p.limite) > 0 ? Number(p.limite) : 60;
  const vendas = db.prepare(`
    SELECT v.criado_em, v.total, ${_devSub} dev
    FROM vendas v
    WHERE v.status='concluida'
    ORDER BY v.criado_em
  `).all();

  const eventos = [];
  let atual = null, ultimoMs = 0;
  for (const v of vendas) {
    const ms = new Date(String(v.criado_em).replace(' ', 'T')).getTime();
    if (!atual || (ms - ultimoMs) > gapH * 3600000) {
      atual = { inicio: v.criado_em, fim: v.criado_em, vendas: 0, total: 0 };
      eventos.push(atual);
    }
    atual.fim = v.criado_em;
    atual.vendas += 1;
    atual.total = arred(atual.total + ((Number(v.total) || 0) - (Number(v.dev) || 0)));
    ultimoMs = ms;
  }
  // mais recentes primeiro; rótulo pronto para o seletor
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  eventos.reverse();
  for (const e of eventos) {
    const d1 = new Date(String(e.inicio).replace(' ', 'T'));
    const d2 = new Date(String(e.fim).replace(' ', 'T'));
    const dm = (d) => `${_p2(d.getDate())}/${_p2(d.getMonth() + 1)}`;
    const hm = (d) => `${_p2(d.getHours())}:${_p2(d.getMinutes())}`;
    const mesmoDia = _iso(d1) === _iso(d2);
    e.rotulo = mesmoDia
      ? `${DIAS[d1.getDay()]} ${dm(d1)} · ${hm(d1)}–${hm(d2)}`
      : `${DIAS[d1.getDay()]} ${dm(d1)} ${hm(d1)} → ${DIAS[d2.getDay()]} ${dm(d2)} ${hm(d2)}`;
    e.dias = mesmoDia ? 1 : 2;
  }
  return { ok: true, eventos: eventos.slice(0, limite), horas_gap: gapH };
}

// Ranking de uma janela escolhida (data + hora), comparada com outra janela.
// p: { inicio, fim, cmp_inicio, cmp_fim, rotulo }
// Sem inicio/fim, cai no mês corrente.
function rankingPeriodo(db, p) {
  p = p || {};
  const RX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;
  const limpa = (s) => String(s || '').replace('T', ' ').trim();
  const hoje = _iso(new Date());
  let de = limpa(p.inicio), ate = limpa(p.fim);
  if (!RX.test(de)) de = `${hoje.slice(0, 8)}01 00:00`;
  if (!RX.test(ate)) ate = `${hoje} 23:59`;
  de = de.slice(0, 16) + ':00';
  ate = ate.slice(0, 16) + ':59';

  const atual = _rankProdutos(db, de, ate);
  let cDe = limpa(p.cmp_inicio), cAte = limpa(p.cmp_fim);
  const temCmp = RX.test(cDe) && RX.test(cAte);
  if (temCmp) { cDe = cDe.slice(0, 16) + ':00'; cAte = cAte.slice(0, 16) + ':59'; }
  const antes = temCmp ? _rankProdutos(db, cDe, cAte) : [];

  const bloco = _montarRanking(db, { de, ate, rotulo: p.rotulo || '' }, atual, antes);
  return { ok: true, periodo: bloco, comparacao: temCmp ? { de: cDe, ate: cAte } : null };
}

// Monta o bloco de ranking a partir das listas atual/anterior
function _montarRanking(db, j, atual, antes) {
  const posAnt = { pecas: new Map(), receita: new Map() };
  [...antes].sort((a, b) => b.pecas - a.pecas || b.receita - a.receita)
    .forEach((x, i) => posAnt.pecas.set(x.id, i + 1));
  [...antes].sort((a, b) => b.receita - a.receita || b.pecas - a.pecas)
    .forEach((x, i) => posAnt.receita.set(x.id, i + 1));

  const porPecas = [...atual].sort((a, b) => b.pecas - a.pecas || b.receita - a.receita);
  const porReceita = [...atual].sort((a, b) => b.receita - a.receita || b.pecas - a.pecas);
  porPecas.forEach((x, i) => {
    x.pos = i + 1;
    const ant = posAnt.pecas.get(x.id);
    x.pos_ant = ant || null;
    x.delta = antes.length ? (ant ? ant - (i + 1) : null) : undefined;
  });
  porReceita.forEach((x, i) => {
    x.pos_receita = i + 1;
    const ant = posAnt.receita.get(x.id);
    x.delta_receita = antes.length ? (ant ? ant - (i + 1) : null) : undefined;
  });

  const totPecas = arred(atual.reduce((s, x) => s + x.pecas, 0));
  const totReceita = arred(atual.reduce((s, x) => s + x.receita, 0));
  const antPecas = arred(antes.reduce((s, x) => s + x.pecas, 0));
  const antReceita = arred(antes.reduce((s, x) => s + x.receita, 0));

  return {
    rotulo: j.rotulo || '', de: j.de, ate: j.ate,
    produtos: porPecas,
    categorias: _rankCategorias(db, j.de, j.ate),
    variacoes: _rankVariacoes(db, j.de, j.ate),
    clientes: _rankClientes(db, j.de, j.ate),
    por_hora: _porHora(db, j.de, j.ate),
    totais: {
      pecas: totPecas, receita: totReceita, itens: atual.length,
      pecas_ant: antPecas, receita_ant: antReceita,
      var_pecas: antPecas ? Math.round(((totPecas - antPecas) / antPecas) * 1000) / 10 : null,
      var_receita: antReceita ? Math.round(((totReceita - antReceita) / antReceita) * 1000) / 10 : null
    }
  };
}

// Ranking dos períodos de calendário (mês/ano). p: { hoje } opcional, para teste.
function ranking(db, p) {
  p = p || {};
  const agora = new Date();
  const hoje = /^\d{4}-\d{2}-\d{2}$/.test(p.hoje || '') ? p.hoje : _iso(agora);
  const janelas = _janelas(hoje);
  const saida = { ok: true, hoje, periodos: {} };

  for (const chave of Object.keys(janelas)) {
    const j = janelas[chave];
    const de = `${j.de} 00:00:00`, ate = `${j.ate} 23:59:59`;
    const atual = _rankProdutos(db, de, ate);
    const antes = _rankProdutos(db, `${j.ant.de} 00:00:00`, `${j.ant.ate} 23:59:59`);
    saida.periodos[chave] = Object.assign(
      _montarRanking(db, { de, ate, rotulo: j.rotulo }, atual, antes),
      { ant: j.ant, dia_de: j.de, dia_ate: j.ate });
  }
  return saida;
}

export { vendasPeriodo, curvaAbc, pecasParadas, receitaPorLoja, consignadosMensal,
  relatorioEvento, ranking, rankingPeriodo, eventosVenda, TAXAS_PADRAO };