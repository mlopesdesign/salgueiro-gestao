// Relatórios — vendas por período, curva ABC, peças paradas
const arred = (n) => Math.round(n * 100) / 100;

// Subquery que retorna o total já devolvido de uma venda (alias v)
const _devSub = `COALESCE((SELECT SUM(d.valor_devolvido) FROM devolucoes d WHERE d.venda_id=v.id),0)`;

// O QUE A VENDA TROUXE DE DINHEIRO (v3.27.3) — expressão única do relatório.
//
// REGRA DO MARCIO: numa troca, entra só a DIFERENÇA. Trocando uma peça de R$ 80
// por uma de R$ 250, a cliente paga R$ 170 — é isso que é faturamento, não os
// R$ 250 da peça que saiu.
//
// A troca grava a peça nova em `vendas` com o total CHEIO (R$ 250) de propósito:
// `venda_itens`, devolução em cadeia e desconto herdado dependem desse formato.
// Quem separa dinheiro de crédito é esta expressão: para a venda de troca soma
// os pagamentos que NÃO são crédito de troca; para qualquer outra venda continua
// sendo o total menos o devolvido — nada do que já estava certo muda.
//
// Usar em TODO lugar do relatório que fala em faturamento. Não recalcular
// `v.total - devolvido` solto numa consulta nova: é assim que o furo volta.
const _recebido = `CASE WHEN COALESCE(v.tipo_venda,'normal') = 'troca'
       THEN COALESCE((SELECT SUM(vp.valor - vp.troco) FROM venda_pagamentos vp
                       WHERE vp.venda_id = v.id AND vp.forma <> 'troca'),0)
       ELSE v.total - ${_devSub} END`;

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
    SELECT COUNT(CASE WHEN (${_recebido}) > 0 THEN 1 END) qtd,
           COALESCE(SUM(${_recebido}),0) total,
           COALESCE(AVG(CASE WHEN (${_recebido}) > 0 THEN (${_recebido}) END),0) ticket
    FROM vendas v WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ? ${fLoja}
  `).get(...ar);

  const porDia = db.prepare(`
    SELECT date(v.criado_em) dia,
           COUNT(CASE WHEN (${_recebido}) > 0 THEN 1 END) qtd,
           SUM(${_recebido}) total
    FROM vendas v WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ? ${fLoja}
    GROUP BY dia ORDER BY dia
  `).all(...ar);

  const porVendedor = db.prepare(`
    SELECT u.nome vendedor,
           COUNT(CASE WHEN (${_recebido}) > 0 THEN 1 END) qtd,
           SUM(${_recebido}) total
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

  // Vendido de peça CONSIGNADA × peça do SALGUEIRO (v3.11.1).
  //
  // A separação é feita pelo produto (`produtos.consignado`), não pela tabela
  // `consignacoes`: a consignação só é gerada quando a peça é vendida.
  //
  // O valor é o RECEBIDO, não o preço de tabela: `vi.total` × (total da venda ÷
  // subtotal da venda). Esse fator distribui por item o desconto dado no
  // fechamento e zera a cortesia (venda vale 0). É o mesmo rateio usado em
  // devoluções (v2.0.48) e trocas (v3.2.1).
  //
  // Assim `proprio + consignado = faturamento bruto`. A primeira versão destes
  // cartões somava preço de tabela e mostrava "Vendas do Salgueiro" MAIOR que o
  // faturamento — dois números conflitantes no mesmo topo, exatamente o que a
  // v3.9.0 tinha acabado de eliminar. `tabela` fica à parte, para conferência.
  // O que voltou de cada item, para o valor ficar líquido de devolução como o
  // cartão de faturamento desta aba já é.
  const _devItem = `COALESCE((
        SELECT SUM(di.qtd) * (CAST(vi.total AS REAL) / vi.qtd)
          FROM devolucao_itens di
          JOIN devolucoes d ON d.id = di.devolucao_id
         WHERE d.venda_id = vi.venda_id AND di.variacao_id = vi.variacao_id), 0)`;
  const split = db.prepare(`
    SELECT COALESCE(p.consignado,0) consignado,
           SUM(vi.qtd) pecas,
           SUM(vi.total) tabela,
           SUM((vi.total - ${_devItem})
               * CASE WHEN v.subtotal > 0 THEN CAST((${_recebido}) AS REAL) / v.subtotal ELSE 0 END) recebido
      FROM venda_itens vi
      JOIN vendas v ON v.id = vi.venda_id
      JOIN variacoes va ON va.id = vi.variacao_id
      JOIN produtos p ON p.id = va.produto_id
     WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ? ${fLoja}
     GROUP BY COALESCE(p.consignado,0)
  `).all(...ar);
  const acha = (c) => split.find(x => x.consignado === c) || { pecas: 0, tabela: 0, recebido: 0 };
  const origem = {
    consignado: { pecas: acha(1).pecas || 0, total: arred(acha(1).recebido || 0), tabela: arred(acha(1).tabela || 0) },
    proprio: { pecas: acha(0).pecas || 0, total: arred(acha(0).recebido || 0), tabela: arred(acha(0).tabela || 0) }
  };
  const _difO = arred(arred(resumo.total) - origem.proprio.total - origem.consignado.total);
  if (Math.abs(_difO) > 0.005) origem.proprio.total = arred(origem.proprio.total + _difO);

  return { ok: true, de, ate,
    resumo: { qtd: resumo.qtd, total: arred(resumo.total), ticket: arred(resumo.ticket), origem },
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
           COALESCE(SUM(${_recebido}),0) total,
           COALESCE(AVG(${_recebido}),0) ticket
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

// Taxas configuradas pela loja (v3.12.0). Precedência, do mais fraco ao mais
// forte: TAXAS_PADRAO → o que está gravado em `config` → `p.taxas` da chamada.
// Valor em branco ou inválido cai no padrão, para uma digitação errada em
// Configurações não zerar a taxa e inflar o líquido a receber sem ninguém ver.
function taxasDaConfig(cfg) {
  const num = (v, padrao) => {
    // ATENÇÃO: `Number('')` é 0, não NaN. Sem testar o vazio antes, um campo em
    // branco em Configurações zeraria a taxa e o líquido a receber apareceria
    // maior do que é — erro caro e silencioso.
    const txt = String(v == null ? '' : v).replace(',', '.').trim();
    if (txt === '') return padrao;
    const n = Number(txt);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : padrao;
  };
  if (!cfg) return { ...TAXAS_PADRAO };
  return {
    ...TAXAS_PADRAO,
    pix_chave: num(cfg.taxa_pix_chave, TAXAS_PADRAO.pix_chave),
    pix_maquina: num(cfg.taxa_pix_maquina, TAXAS_PADRAO.pix_maquina),
    debito: num(cfg.taxa_debito, TAXAS_PADRAO.debito),
    credito_vista: num(cfg.taxa_credito_vista, TAXAS_PADRAO.credito_vista),
    credito_parcelado: num(cfg.taxa_credito_parcelado, TAXAS_PADRAO.credito_parcelado)
  };
}

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
  credito: 'Crédito', crediario: 'Crediário', vale: 'Vale-troca', cortesia: 'Cortesia',
  // v3.27.0 — 'troca' existia nos dados desde a v3.2.0 mas não tinha nome aqui:
  // saía como "troca" cru no relatório. Não é dinheiro recebido, é o crédito da
  // peça que a cliente devolveu abatendo a peça nova.
  troca: 'Crédito de troca'
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

  // Lê as taxas gravadas em Configurações → PDV. `p.taxas` (se vier) ainda
  // manda, para simular um cenário sem mexer no que está salvo.
  let _cfgTaxas = null;
  try { _cfgTaxas = db.prepare("SELECT chave, valor FROM config WHERE chave LIKE 'taxa_%'").all(); } catch { _cfgTaxas = null; }
  const _cfg = {};
  for (const l of (_cfgTaxas || [])) _cfg[l.chave] = l.valor;
  const taxas = Object.assign({}, taxasDaConfig(_cfg), p.taxas || {});
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
    SELECT vi.venda_id, vi.variacao_id, vi.qtd, vi.preco_unit, vi.desconto, vi.total,
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
           pr.preco_venda,
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
    it.desconto = arred(it.desconto);
    v.itens.push(it); v.pecas += Number(it.qtd) || 0;
  }

  // Desconto POR PRODUTO (v3.14.0).
  //
  // Antes a coluna de desconto do relatório mostrava só `venda_itens.desconto`
  // — o abatimento lançado na linha. O desconto dado no FECHAMENTO da venda
  // (categoria do cliente, automático à vista, o que o admin autoriza) não
  // aparecia em item nenhum: a venda saía com "—" em todas as linhas e um
  // total menor que a soma delas. Quando o operador lançava o abatimento numa
  // linha só, parecia que aquele produto tinha levado o desconto inteiro.
  //
  // Agora o desconto do fechamento é rateado entre as peças, proporcional ao
  // valor de cada uma, e cada linha mostra quanto foi tirado dela e quanto
  // entrou de fato. A soma dos `recebido` fecha com o total da venda.
  //
  // A sobra de centavo do rateio vai para o item de maior valor — sem isso as
  // linhas não somariam exatamente o total, que é o ponto de tudo isto.
  for (const v of mapa.values()) {
    if (!v.itens.length) continue;
    const somaItens = arred(v.itens.reduce((s, i) => s + i.total, 0));
    const fator = somaItens > 0 ? v.total / somaItens : 0;
    let acumulado = 0;
    for (const it of v.itens) {
      it.recebido = arred(it.total * fator);
      it.desconto_venda = arred(it.total - it.recebido); // a parte do fechamento
      it.desconto_total = arred(it.desconto + it.desconto_venda);
      it.tabela = arred(it.total + it.desconto);         // preço cheio da linha
      acumulado = arred(acumulado + it.recebido);
    }
    const sobra = arred(v.total - acumulado);
    if (Math.abs(sobra) > 0.005) {
      const maior = v.itens.reduce((a, b) => (b.recebido > a.recebido ? b : a), v.itens[0]);
      maior.recebido = arred(maior.recebido + sobra);
      maior.desconto_venda = arred(maior.total - maior.recebido);
      maior.desconto_total = arred(maior.desconto + maior.desconto_venda);
    }
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

    // Efeito do desconto do FECHAMENTO sobre a peça consignada (v3.14.0).
    //
    // `valor_venda` foi gravado na hora da venda com o valor do item — que já
    // é líquido do desconto lançado NA LINHA, mas não do desconto dado no
    // total da venda. Ou seja: quando a venda fecha com desconto, a loja
    // recebe menos pela peça mas o repasse ao fornecedor continua calculado
    // sobre o valor cheio. Quem paga o desconto inteiro é a loja.
    //
    // Aqui isso deixa de ser invisível: `recebido` é o que entrou de fato,
    // `desconto` é quanto a peça levou, e `fornecedor_ajustado` mostra quanto
    // seria o repasse se a base fosse o recebido. A REGRA NÃO MUDOU — o valor
    // a pagar continua sendo `valor_fornecedor`. O relatório só passou a
    // mostrar a diferença para o dono decidir.
    // NÃO reaplicar o fator do desconto aqui (v3.25.30): o `valor_venda` gravado
    // na consignação JÁ é o valor PAGO, líquido de todo desconto — pdv.js grava
    // `i.total × fator` no ato da venda. Multiplicar por outro fator aqui
    // descontava o MESMO desconto duas vezes (na compra e no relatório).
    //   • Valor de tabela = preço CHEIO do cadastro × qtd (sem desconto)
    //   • Recebido        = valor_venda (o que a loja recebeu de fato)
    //   • Desconto        = tabela − recebido
    //   • Repasse/Sobra   = valores JÁ calculados certo na venda (valor_fornecedor,
    //                       valor_loja) — usados como estão, sem recalcular.
    cg.tabela   = arred((Number(cg.qtd) || 0) * (Number(cg.preco_venda) || 0));
    cg.recebido = arred(cg.valor_venda);
    cg.desconto = arred(cg.tabela - cg.recebido);
    cg.fornecedor_ajustado = arred(cg.valor_fornecedor);
    cg.dif_desconto = 0;
    if (v) { v.consignados.push(cg); v.comissao = arred(v.comissao + cg.valor_fornecedor); }
    const g = porFornecedor.get(cg.fornecedor_id) ||
      { fornecedor_id: cg.fornecedor_id, fornecedor: cg.fornecedor,
        pecas: 0, venda: 0, custo: 0, comissao: 0, parte_loja: 0, pendente: 0,
        desconto: 0, recebido: 0, comissao_ajustada: 0 };
    g.pecas += Number(cg.qtd) || 0;
    g.venda = arred(g.venda + cg.tabela);   // "Valor de tabela" = preço cheio do cadastro
    g.custo = arred(g.custo + cg.valor_custo);
    g.comissao = arred(g.comissao + cg.valor_fornecedor);
    g.parte_loja = arred(g.parte_loja + cg.valor_loja);
    g.desconto = arred(g.desconto + cg.desconto);
    g.recebido = arred(g.recebido + cg.recebido);
    g.comissao_ajustada = arred(g.comissao_ajustada + cg.fornecedor_ajustado);
    if (cg.status === 'pendente') g.pendente = arred(g.pendente + cg.fornecedor_ajustado);
    porFornecedor.set(cg.fornecedor_id, g);
  }
  // Discriminação do repasse (v3.8.0): o fornecedor recebe o CUSTO da peça
  // MAIS a fatia dele no lucro — nunca uma porcentagem do preço de venda.
  // Sem estes dois campos a tabela mostrava "vendido R$ 510 · comissão R$ 415,50"
  // e o leitor concluía, errado, que a comissão era de 81%.
  for (const g of porFornecedor.values()) {
    // Fatia do lucro e repasse calculados sobre o RECEBIDO (v3.21.1).
    // Antes usava g.comissao (= valor_fornecedor gravado, base tabela em vendas
    // pré-v3.14.0). Agora usa comissao_ajustada = custo + pct%×(recebido-custo).
    g.lucro_fornecedor = arred(g.comissao_ajustada - g.custo);  // fatia do lucro sobre recebido
    g.lucro_total = arred(g.venda - g.custo);                   // lucro gerado pela peça
    // Diferença informativa entre o repasse gravado e o calculado sobre recebido.
    g.dif_desconto = arred(g.comissao - g.comissao_ajustada);
    // O que sobra para a loja depois do repasse calculado sobre recebido.
    g.loja_real = arred(g.recebido - g.comissao_ajustada);
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
  // A lista de produtos identifica a peça consignada e o percentual combinado
  // com o fornecedor (v3.11.0): sem isso não dá para saber, olhando a lista,
  // quanto daquele total vai embora no acerto.
  const prods = db.prepare(`
    SELECT va.id variacao_id,
           pr.nome produto, COALESCE(pr.referencia,'') referencia,
           COALESCE(va.cor,'') cor, COALESCE(va.tamanho,'') tamanho,
           COALESCE(pr.consignado,0) consignado,
           COALESCE(pr.pct_fornecedor,0) pct_fornecedor,
           COALESCE(fo.nome,'') fornecedor,
           SUM(vi.qtd) qtd, SUM(vi.total) total
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    LEFT JOIN fornecedores fo ON fo.id = pr.fornecedor_id
    WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ? ${fLoja}
    GROUP BY va.id ORDER BY total DESC
  `).all(...ar);
  for (const x of prods) x.total = arred(x.total);
  // Desconto e valor recebido por peça na lista consolidada (v3.14.0): vêm do
  // rateio já feito item a item, para a coluna somar exatamente o faturamento.
  const _porVar = new Map();
  for (const it of itens) {
    const a = _porVar.get(it.variacao_id) || { desconto: 0, desc_item: 0, recebido: 0, tabela: 0 };
    a.desconto = arred(a.desconto + (it.desconto_total || 0));
    a.desc_item = arred(a.desc_item + (it.desconto || 0));
    a.recebido = arred(a.recebido + (it.recebido || 0));
    a.tabela = arred(a.tabela + (it.tabela || 0));
    _porVar.set(it.variacao_id, a);
  }
  for (const x of prods) {
    const a = _porVar.get(x.variacao_id) || { desconto: 0, desc_item: 0, recebido: x.total, tabela: x.total };
    x.desconto = a.desconto;      // total abatido daquela peça
    x.desc_item = a.desc_item;    // só o lançado na linha da venda
    x.recebido = a.recebido;
    x.tabela = a.tabela;          // preço cheio
  }

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

  // Descontos dados no FECHAMENTO da venda (v3.9.0).
  //
  // Até a 3.8.0 esta lista só trazia o desconto AVULSO — aquele em que o
  // operador preencheu "autorizado por". Só que desconto de categoria de
  // cliente, desconto automático à vista e arredondamento de balcão também
  // reduzem `vendas.total` sem passar por autorização nenhuma. Eles sumiam do
  // relatório e reapareciam como uma diferença sem nome entre o total das
  // peças e o faturamento. Agora TODO desconto de fechamento é listado, com a
  // origem marcada.
  //
  // A cortesia fica de fora: nela o desconto é o valor inteiro da venda
  // (regra da v2.2.0) e ela já tem seção própria. Contá-la aqui dobraria o
  // abatimento na conciliação.
  const descontos = db.prepare(`
    SELECT v.id venda_id, v.criado_em, v.subtotal, v.desconto, v.total,
           v.desconto_autorizado_por autorizado_por, v.desconto_motivo motivo,
           COALESCE(u.nome, '—') operador,
           COALESCE(c.nome, '—') cliente
    FROM vendas v
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE v.status = 'concluida' AND v.desconto > 0
      AND v.criado_em BETWEEN ? AND ? ${fLoja}
      AND NOT EXISTS (SELECT 1 FROM venda_pagamentos vp
                       WHERE vp.venda_id = v.id AND vp.forma = 'cortesia')
    ORDER BY v.criado_em
  `).all(...ar);
  for (const d of descontos) {
    d.desconto = arred(d.desconto);
    d.subtotal = arred(d.subtotal);
    d.total = arred(d.total);
    d.percent = d.subtotal > 0 ? Math.round((d.desconto / d.subtotal) * 1000) / 10 : 0;
    d.data = String(d.criado_em).slice(0, 10);
    d.hora = String(d.criado_em).slice(11, 16);
    // Sem "autorizado por" o desconto não veio do modal de autorização:
    // é da tabela (categoria do cliente, à vista) ou foi acerto no fechamento.
    d.autorizado = !!(d.autorizado_por && String(d.autorizado_por).trim());
    d.origem = d.autorizado ? 'Autorizado' : 'Automático / tabela';
  }
  const descontoResumo = {
    qtd: descontos.length,
    valor: arred(descontos.reduce((s, d) => s + d.desconto, 0)),
    autorizados: arred(descontos.filter(d => d.autorizado).reduce((s, d) => s + d.desconto, 0)),
    automaticos: arred(descontos.filter(d => !d.autorizado).reduce((s, d) => s + d.desconto, 0))
  };

  // ── Vendas a PREÇO DE CUSTO (v3.19.0) ─────────────────────────────────────
  // Seção própria, como as cortesias e os descontos. É dinheiro que a loja
  // deixou de ganhar por decisão de alguém, então tem de ter nome, motivo e
  // valor — sem isso não há como auditar depois.
  //
  // A margem aberta mão é calculada pela DIFERENÇA ENTRE O PREÇO DE TABELA
  // ATUAL e o que foi cobrado. Fica a ressalva de que, se o preço de venda da
  // peça mudar depois, essa diferença muda junto — o que foi cobrado está
  // gravado em venda_itens e não muda; o preço cheio não é histórico.
  const vendasCusto = db.prepare(`
    SELECT v.id venda_id, v.criado_em, v.total,
           v.desconto_autorizado_por autorizado_por, v.desconto_motivo motivo,
           COALESCE(u.nome, '—') operador,
           COALESCE(c.nome, '—') cliente,
           (SELECT COALESCE(SUM(vi.qtd), 0) FROM venda_itens vi WHERE vi.venda_id = v.id) pecas,
           (SELECT COALESCE(SUM(vi.qtd * p.preco_venda), 0)
              FROM venda_itens vi
              JOIN variacoes va ON va.id = vi.variacao_id
              JOIN produtos  p  ON p.id  = va.produto_id
             WHERE vi.venda_id = v.id) tabela
    FROM vendas v
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE v.status = 'concluida' AND v.tipo_venda = 'custo'
      AND v.criado_em BETWEEN ? AND ? ${fLoja}
    ORDER BY v.criado_em
  `).all(...ar);
  for (const c of vendasCusto) {
    c.total = arred(c.total);
    c.tabela = arred(c.tabela);
    c.margem_aberta = arred(c.tabela - c.total);   // o que a loja deixou de ganhar
    c.percent = c.tabela > 0 ? Math.round((c.margem_aberta / c.tabela) * 1000) / 10 : 0;
    c.data = String(c.criado_em).slice(0, 10);
    c.hora = String(c.criado_em).slice(11, 16);
  }
  const custoResumo = {
    qtd: vendasCusto.length,
    pecas: vendasCusto.reduce((s, c) => s + (Number(c.pecas) || 0), 0),
    cobrado: arred(vendasCusto.reduce((s, c) => s + c.total, 0)),
    tabela: arred(vendasCusto.reduce((s, c) => s + c.tabela, 0)),
    margem_aberta: arred(vendasCusto.reduce((s, c) => s + c.margem_aberta, 0))
  };

  const soma = (f) => arred(vendas.reduce((s, v) => s + (Number(f(v)) || 0), 0));
  const bruto = soma(v => v.total);
  const devolucoes = soma(v => v.devolvido);
  const liquido = arred(bruto - devolucoes);

  // ── Conciliação da lista de produtos com o faturamento (v3.9.0) ───────────
  // Exigência do Marcio: "o total do faturamento bruto tem que ser idêntico ao
  // total de peças que aparece no final".
  //
  // A lista de produtos soma `venda_itens` a preço de tabela; o faturamento
  // soma `vendas.total`. Os dois só se separam por dois motivos, e agora os
  // dois são nomeados e abatidos na própria seção:
  //
  //   valor de tabela  −  cortesias  −  desconto de fechamento  =  bruto
  //
  // Quem calcula é o core, não a tela: se a diferença fosse obtida por
  // subtração na interface, qualquer motivo novo de divergência apareceria
  // disfarçado de "desconto" e ninguém perceberia. Aqui cada parcela vem da
  // sua própria origem e `confere` denuncia quando a conta não fecha.
  // `tabela` é o preço CHEIO de cada peça (v3.14.0) — o mesmo número que a
  // coluna "Valor de tabela" da lista mostra. Antes partia de `venda_itens.total`,
  // que já vinha líquido do desconto lançado na linha: a seção acabava com dois
  // valores diferentes chamados "valor de tabela". Como o preço cheio entra na
  // conta, o desconto lançado no item também precisa ser abatido — daí a
  // parcela `desc_itens`, que antes não existia.
  const tabelaTotal = arred(prods.reduce((s, x) => s + (Number(x.tabela ?? x.total) || 0), 0));
  const descItens = arred(prods.reduce((s, x) => s + (Number(x.desc_item) || 0), 0));
  const cortesiaTabela = arred(cortesiaResumo.valor);
  const descontoFechamento = arred(descontoResumo.valor);
  const conciliacao = {
    tabela: tabelaTotal,
    desc_itens: descItens,
    cortesias: cortesiaTabela,
    descontos: descontoFechamento,
    bruto,
    // sobra: o que a conta não explicou. Tem de ser zero — se não for, há um
    // caminho novo mexendo em vendas.total que o relatório ainda não conhece.
    sobra: arred(tabelaTotal - descItens - cortesiaTabela - descontoFechamento - bruto)
  };
  conciliacao.confere = Math.abs(conciliacao.sobra) < 0.005;

  // Vendido de peça CONSIGNADA × peça do SALGUEIRO no evento (v3.11.1).
  // O valor é o RECEBIDO: cada item entra pelo fator (total ÷ subtotal) da sua
  // venda, o que rateia o desconto do fechamento e zera a cortesia. Com isso
  // `proprio + consignado = faturamento bruto` — os cartões do topo somam o
  // mesmo número do cartão ao lado, e não o valor de tabela.
  // `tabela` fica junto para quem quiser conferir com a lista de produtos.
  const splitEv = db.prepare(`
    SELECT COALESCE(pr.consignado,0) consignado,
           SUM(vi.qtd) pecas,
           SUM(vi.total + vi.desconto) tabela,
           SUM(vi.total * CASE WHEN v.subtotal > 0 THEN CAST((${_recebido}) AS REAL) / v.subtotal ELSE 0 END) recebido
      FROM venda_itens vi
      JOIN vendas v ON v.id = vi.venda_id
      JOIN variacoes va ON va.id = vi.variacao_id
      JOIN produtos pr ON pr.id = va.produto_id
     WHERE v.status='concluida' AND v.criado_em BETWEEN ? AND ? ${fLoja}
     GROUP BY COALESCE(pr.consignado,0)
  `).all(...ar);
  const achaEv = (c) => splitEv.find(x => x.consignado === c) || { pecas: 0, tabela: 0, recebido: 0 };
  // Total do card de consignados: somatório de g.recebido do porFornecedor
  // (v3.21.1). Antes usava splitEv.recebido, que em vendas pré-v3.14.0 com
  // v.total=v.subtotal devolvia o valor de tabela em vez do recebido, fazendo
  // o card divergir da soma da tabela de comissões.
  const consigRecebidoCard = arred([...porFornecedor.values()].reduce((s, g) => s + g.recebido, 0));
  const origem = {
    consignado: { pecas: achaEv(1).pecas || 0, total: consigRecebidoCard, tabela: arred(achaEv(1).tabela || 0) },
    proprio: { pecas: achaEv(0).pecas || 0, total: arred(achaEv(0).recebido || 0), tabela: arred(achaEv(0).tabela || 0) }
  };

  // ── Peça consignada que NÃO gerou repasse (v3.20.1) ───────────────────────
  // O cartão "Vendas de consignados" conta toda peça com `produtos.consignado=1`.
  // A seção de comissão lê a tabela `consignacoes`, e ela só é gravada quando a
  // peça tem FORNECEDOR e PERCENTUAL > 0 (`core/pdv.js:371`). Peça marcada como
  // consignada sem fornecedor — ou com 0% — aparece no cartão e some da seção,
  // e as duas somas deixam de bater sem explicação nenhuma.
  //
  // Em vez de esconder, o relatório NOMEIA as peças: é cadastro incompleto, e
  // alguém precisa arrumar antes de acertar com o fornecedor.
  const semRepasse = db.prepare(`
    SELECT pr.id, pr.nome, pr.fornecedor_id, COALESCE(pr.pct_fornecedor,0) pct,
           SUM(vi.qtd) pecas,
           SUM(vi.total + vi.desconto) tabela,
           SUM(vi.total * CASE WHEN v.subtotal > 0 THEN CAST((${_recebido}) AS REAL) / v.subtotal ELSE 0 END) recebido
      FROM venda_itens vi
      JOIN vendas v ON v.id = vi.venda_id
      JOIN variacoes va ON va.id = vi.variacao_id
      JOIN produtos pr ON pr.id = va.produto_id
     WHERE v.status='concluida' AND COALESCE(pr.consignado,0) = 1
       AND (pr.fornecedor_id IS NULL OR COALESCE(pr.pct_fornecedor,0) <= 0)
       AND v.criado_em BETWEEN ? AND ? ${fLoja}
     GROUP BY pr.id
     ORDER BY pr.nome
  `).all(...ar);
  for (const s of semRepasse) {
    s.tabela = arred(s.tabela);
    s.recebido = arred(s.recebido);
    s.motivo = !s.fornecedor_id ? 'sem fornecedor definido' : 'percentual do fornecedor está em 0%';
  }
  origem.consignado.sem_repasse = {
    qtd: semRepasse.length,
    pecas: semRepasse.reduce((s, x) => s + (Number(x.pecas) || 0), 0),
    tabela: arred(semRepasse.reduce((s, x) => s + x.tabela, 0)),
    recebido: arred(semRepasse.reduce((s, x) => s + x.recebido, 0)),
    itens: semRepasse
  };
  // Centavo de arredondamento pode sobrar no rateio: joga na peça própria,
  // que é a maior fatia, para os dois cartões somarem o bruto exato.
  const _difOrig = arred(bruto - origem.proprio.total - origem.consignado.total);
  if (Math.abs(_difOrig) > 0.005) origem.proprio.total = arred(origem.proprio.total + _difOrig);
  const taxaTotal = arred([...porForma.values()].reduce((s, g) => s + g.taxa_valor, 0));
  const comissaoTotal = arred([...porFornecedor.values()].reduce((s, g) => s + g.comissao_ajustada, 0));
  const pecasTotal = vendas.reduce((s, v) => s + v.pecas, 0);

  return {
    ok: true, inicio, fim, pix_maquina: pixMaq, taxas,
    vendas, cortesias, descontos, vendas_custo: vendasCusto,
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
      vendas_custo: custoResumo,
      conciliacao, origem,
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
           SUM(${_recebido}) gasto
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
           COUNT(*) vendas, COALESCE(SUM(${_recebido}),0) receita
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


// ── Relatório de estoque (v3.4.0) ───────────────────────────────────────────
// Pedido do Marcio: a tela de Estoque lista variação por variação, numa lista
// plana — não agrupa por produto nem soma nada. Aqui o estoque sai organizado:
//   PRODUTO  →  suas variações  →  total do produto  →  ... →  TOTAL GERAL
// com uma coluna por local (Almoxarifado, Loja…) para ver ONDE a peça está.
//
// Filtros: categoria, situação do estoque, fornecedor e o período de CADASTRO
// do produto — é assim que se confere uma remessa que acabou de entrar.
//
// REGRA DE OURO respeitada: `variacoes.estoque` é o TOTAL; `estoque_saldos`
// apenas reparte. Por isso a coluna Total vem de v.estoque e não da soma dos
// locais — se as duas divergirem, o relatório mostra a divergência em vez de
// escondê-la (campo `divergencia` no resumo).
function estoqueDetalhado(db, p) {
  p = p || {};
  const catId = p.categoria_id ? Number(p.categoria_id) : null;
  const fornId = p.fornecedor_id ? Number(p.fornecedor_id) : null;
  const situacao = ['todos', 'com', 'sem'].includes(p.situacao) ? p.situacao : 'todos';
  const de = String(p.de || '').trim();   // 'AAAA-MM-DD' — data de cadastro
  const ate = String(p.ate || '').trim();

  const locais = db.prepare(
    "SELECT id, nome, tipo FROM estoques WHERE ativo=1 ORDER BY principal DESC, nome"
  ).all();

  const cond = [], arg = [];
  if (catId)  { cond.push('p.categoria_id = ?'); arg.push(catId); }
  if (fornId) { cond.push('p.fornecedor_id = ?'); arg.push(fornId); }
  if (de)     { cond.push("date(p.criado_em) >= date(?)"); arg.push(de); }
  if (ate)    { cond.push("date(p.criado_em) <= date(?)"); arg.push(ate); }
  const filtro = cond.length ? ' AND ' + cond.join(' AND ') : '';

  const linhas = db.prepare(`
    SELECT p.id AS produto_id, p.nome AS produto, p.referencia, p.criado_em,
           COALESCE(c.nome, 'Sem categoria') AS categoria,
           COALESCE(f.nome, '') AS fornecedor,
           p.preco_custo, p.preco_venda, p.consignado,
           v.id AS variacao_id, v.cor, v.tamanho, v.codigo_barras, v.estoque,
           v.estoque_minimo AS min_var, p.estoque_minimo AS min_prod
    FROM variacoes v
    JOIN produtos p ON p.id = v.produto_id
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN fornecedores f ON f.id = p.fornecedor_id
    WHERE v.ativo = 1 AND p.ativo = 1${filtro}
    ORDER BY p.nome, v.cor, v.tamanho
  `).all(...arg);

  // ── Movimentação do período (v3.4.1) ──────────────────────────────────────
  // Para BATER o estoque: quanto entrou, quanto vendeu e o que deveria sobrar.
  // A fonte é `movimentos_estoque` — o livro do estoque, que registra tudo com
  // data. `venda` entra com qtd NEGATIVA, por isso o sinal invertido.
  // TRANSFERÊNCIA fica de fora: ela só muda a peça de lugar, o total não muda.
  const mov = {};
  const usarMov = !!(p.mov_de || p.mov_ate || p.movimentacao);
  if (usarMov) {
    const cm = [], am = [];
    if (p.mov_de)  { cm.push("date(criado_em) >= date(?)"); am.push(p.mov_de); }
    if (p.mov_ate) { cm.push("date(criado_em) <= date(?)"); am.push(p.mov_ate); }
    const wm = cm.length ? 'WHERE ' + cm.join(' AND ') : '';
    for (const m of db.prepare(`
      SELECT variacao_id,
             SUM(CASE WHEN tipo='entrada'    THEN qtd ELSE 0 END) AS entrou,
             SUM(CASE WHEN tipo='venda'      THEN -qtd ELSE 0 END) AS vendeu,
             SUM(CASE WHEN tipo='devolucao'  THEN qtd ELSE 0 END) AS devolveu,
             SUM(CASE WHEN tipo IN ('ajuste','saida','inventario') THEN qtd ELSE 0 END) AS outros,
             MAX(CASE WHEN tipo='venda' THEN criado_em END) AS ultima_venda,
             MIN(CASE WHEN tipo='venda' THEN criado_em END) AS primeira_venda
      FROM movimentos_estoque ${wm} GROUP BY variacao_id
    `).all(...am)) mov[m.variacao_id] = m;
  }

  // saldos por local, indexados por variação
  const saldos = {};
  for (const s of db.prepare('SELECT estoque_id, variacao_id, qtd FROM estoque_saldos').all()) {
    (saldos[s.variacao_id] || (saldos[s.variacao_id] = {}))[s.estoque_id] = s.qtd;
  }

  const zeraLocais = () => { const o = {}; for (const l of locais) o[l.id] = 0; return o; };
  const produtos = [];
  let atual = null;

  for (const l of linhas) {
    const qtd = Number(l.estoque) || 0;
    if (situacao === 'com' && qtd <= 0) continue;
    if (situacao === 'sem' && qtd > 0) continue;

    if (!atual || atual.id !== l.produto_id) {
      atual = {
        id: l.produto_id, nome: l.produto, referencia: l.referencia || '',
        categoria: l.categoria, fornecedor: l.fornecedor,
        consignado: !!l.consignado,
        cadastrado_em: String(l.criado_em || '').slice(0, 10),
        preco_custo: arred(l.preco_custo), preco_venda: arred(l.preco_venda),
        variacoes: [], total: 0, valor_custo: 0, valor_venda: 0, por_local: zeraLocais(),
        entrou: 0, vendeu: 0, devolveu: 0, outros: 0, esperado: 0, dif_mov: 0
      };
      produtos.push(atual);
    }

    const porLocal = zeraLocais();
    let somaLocais = 0;
    for (const l2 of locais) {
      const q = Number((saldos[l.variacao_id] || {})[l2.id]) || 0;
      porLocal[l2.id] = q;
      somaLocais += q;
      atual.por_local[l2.id] += q;
    }
    const minimo = Number(l.min_var) || Number(l.min_prod) || 0;
    const vCusto = arred(qtd * (Number(l.preco_custo) || 0));
    const vVenda = arred(qtd * (Number(l.preco_venda) || 0));

    // conciliação: o que os movimentos dizem que deveria haver
    const mv = mov[l.variacao_id] || {};
    const entrou = Number(mv.entrou) || 0;
    const vendeu = Number(mv.vendeu) || 0;
    const devolveu = Number(mv.devolveu) || 0;
    const outros = Number(mv.outros) || 0;
    const esperado = arred(entrou - vendeu + devolveu + outros);

    atual.variacoes.push({
      id: l.variacao_id,
      cor: l.cor, tamanho: l.tamanho, codigo_barras: l.codigo_barras || '',
      total: qtd, por_local: porLocal,
      entrou, vendeu, devolveu, outros, esperado,
      // sobra/falta que os movimentos NÃO explicam — é o que o Marcio procura
      // quando bate o começo dos trabalhos com o estoque de hoje
      dif_mov: arred(qtd - esperado),
      ultima_venda: mv.ultima_venda ? String(mv.ultima_venda).slice(0, 10) : '',
      primeira_venda: mv.primeira_venda ? String(mv.primeira_venda).slice(0, 10) : '',
      sem_local: arred(qtd - somaLocais),   // parte que ainda não foi distribuída
      minimo, abaixo: minimo > 0 && qtd < minimo,
      valor_custo: vCusto, valor_venda: vVenda
    });
    atual.total += qtd;
    atual.entrou = arred((atual.entrou || 0) + entrou);
    atual.vendeu = arred((atual.vendeu || 0) + vendeu);
    atual.devolveu = arred((atual.devolveu || 0) + devolveu);
    atual.outros = arred((atual.outros || 0) + outros);
    atual.esperado = arred((atual.esperado || 0) + esperado);
    atual.dif_mov = arred(atual.total - atual.esperado);
    atual.valor_custo = arred(atual.valor_custo + vCusto);
    atual.valor_venda = arred(atual.valor_venda + vVenda);
  }

  // produtos que ficaram sem nenhuma variação depois do filtro
  const lista = produtos.filter(pr => pr.variacoes.length);

  const resumo = {
    produtos: lista.length,
    variacoes: lista.reduce((s, pr) => s + pr.variacoes.length, 0),
    pecas: lista.reduce((s, pr) => s + pr.total, 0),
    valor_custo: arred(lista.reduce((s, pr) => s + pr.valor_custo, 0)),
    valor_venda: arred(lista.reduce((s, pr) => s + pr.valor_venda, 0)),
    abaixo_minimo: lista.reduce((s, pr) => s + pr.variacoes.filter(v => v.abaixo).length, 0),
    entrou: arred(lista.reduce((s, pr) => s + (pr.entrou || 0), 0)),
    vendeu: arred(lista.reduce((s, pr) => s + (pr.vendeu || 0), 0)),
    devolveu: arred(lista.reduce((s, pr) => s + (pr.devolveu || 0), 0)),
    outros: arred(lista.reduce((s, pr) => s + (pr.outros || 0), 0)),
    esperado: arred(lista.reduce((s, pr) => s + (pr.esperado || 0), 0)),
    com_movimentacao: usarMov,
    por_local: (() => {
      const o = zeraLocais();
      for (const pr of lista) for (const l of locais) o[l.id] += pr.por_local[l.id];
      return o;
    })()
  };
  // total das colunas de local tem que fechar com o total geral
  resumo.divergencia = arred(
    resumo.pecas - locais.reduce((s, l) => s + resumo.por_local[l.id], 0)
  );

  resumo.dif_mov = arred(resumo.pecas - resumo.esperado);
  return { ok: true, locais, produtos: lista, resumo,
    filtros: { catId, fornId, situacao, de, ate, mov_de: p.mov_de || '', mov_ate: p.mov_ate || '' } };
}


// ---------- Compras acompanhadas (v3.10.0) ----------
// Para que serve: a loja dá desconto a funcionários e sócios. De vez em quando
// alguém usa esse desconto para comprar em quantidade e revender. Este
// relatório mostra o que cada pessoa dessas categorias levou no período —
// tipo de peça, quantas e quanto pagou — para o dono perceber o padrão.
//
// Quem entra: SÓ as categorias marcadas com `monitorar` em Configurações →
// Categorias de clientes. Nenhuma categoria é acompanhada por conta própria.
//
// p: { de, ate, categoria_id?, min_pecas?, loja_id? }
function comprasAcompanhadas(db, p) {
  p = p || {};
  const RXD = /^\d{4}-\d{2}-\d{2}$/;
  const hoje = new Date();
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const de = RXD.test(p.de || '') ? p.de : iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const ate = RXD.test(p.ate || '') ? p.ate : iso(hoje);
  // O período vai de 00:00:00 a 23:59:59 — comparar só a data cortaria o
  // último dia, que é a armadilha registrada na v2.4.0.
  const ini = `${de} 00:00:00`, fim = `${ate} 23:59:59`;

  const catFiltro = Number(p.categoria_id) || 0;
  const lojaId = Number(p.loja_id) || 0;
  const cond = [];
  const args = [ini, fim];
  if (catFiltro) { cond.push('AND cl.categoria_id = ?'); args.push(catFiltro); }
  if (lojaId) { cond.push('AND v.loja_id = ?'); args.push(lojaId); }
  const extra = cond.join(' ');

  // Categorias disponíveis para o filtro da tela (só as acompanhadas)
  const categorias = db.prepare(`SELECT id, nome, COALESCE(desconto_percent,0) desconto_percent
                                   FROM categorias_clientes
                                  WHERE ativo=1 AND COALESCE(monitorar,0)=1
                                  ORDER BY nome`).all();
  if (!categorias.length) {
    return { ok: true, de, ate, categorias: [], clientes: [], por_produto: [],
             resumo: { clientes: 0, compras: 0, pecas: 0, tabela: 0, desconto: 0, pago: 0 },
             sem_categoria_marcada: true };
  }

  // Uma linha por item vendido a cliente de categoria acompanhada.
  // `generico=1` (Consumidor final) fica de fora: não é pessoa a acompanhar.
  const itens = db.prepare(`
    SELECT cl.id cliente_id, cl.nome cliente,
           COALESCE(cc.nome,'—') categoria, cc.id categoria_id,
           COALESCE(cc.desconto_percent,0) pct,
           v.id venda_id, v.criado_em, v.subtotal, v.desconto, v.total,
           pr.id produto_id, pr.nome produto, COALESCE(pr.referencia,'') referencia,
           COALESCE(va.cor,'') cor, COALESCE(va.tamanho,'') tamanho,
           vi.qtd, vi.preco_unit, vi.total item_total
      FROM venda_itens vi
      JOIN vendas v ON v.id = vi.venda_id
      JOIN clientes cl ON cl.id = v.cliente_id
      JOIN categorias_clientes cc ON cc.id = cl.categoria_id
      JOIN variacoes va ON va.id = vi.variacao_id
      JOIN produtos pr ON pr.id = va.produto_id
     WHERE v.status='concluida'
       AND v.criado_em BETWEEN ? AND ?
       AND COALESCE(cc.monitorar,0) = 1
       AND COALESCE(cl.generico,0) = 0
       ${extra}
     ORDER BY cl.nome, v.criado_em, vi.id
  `).all(...args);

  // Agrupa por cliente e, dentro dele, por tipo de peça.
  const porCliente = new Map();
  const porProduto = new Map();
  for (const it of itens) {
    let c = porCliente.get(it.cliente_id);
    if (!c) {
      c = { cliente_id: it.cliente_id, cliente: it.cliente, categoria: it.categoria,
            categoria_id: it.categoria_id, pct: it.pct,
            vendas: new Set(), compras: 0, pecas: 0, tabela: 0, pago: 0, desconto: 0,
            primeira: it.criado_em, ultima: it.criado_em, produtos: new Map() };
      porCliente.set(it.cliente_id, c);
    }
    const qtd = Number(it.qtd) || 0;
    const tot = arred(Number(it.item_total) || 0);
    c.vendas.add(it.venda_id);
    c.pecas += qtd;
    c.tabela = arred(c.tabela + tot);
    if (it.criado_em < c.primeira) c.primeira = it.criado_em;
    if (it.criado_em > c.ultima) c.ultima = it.criado_em;

    const chave = `${it.produto_id}|${it.cor}|${it.tamanho}`;
    const rot = { produto: it.produto, referencia: it.referencia, cor: it.cor, tamanho: it.tamanho };
    const pc = c.produtos.get(chave) || { ...rot, qtd: 0, total: 0 };
    pc.qtd += qtd; pc.total = arred(pc.total + tot);
    c.produtos.set(chave, pc);

    const pg = porProduto.get(chave) || { ...rot, qtd: 0, total: 0, clientes: new Set() };
    pg.qtd += qtd; pg.total = arred(pg.total + tot); pg.clientes.add(it.cliente_id);
    porProduto.set(chave, pg);
  }

  // O que a pessoa PAGOU vem da venda, não da soma dos itens: o desconto de
  // categoria é dado no fechamento e não aparece na linha do item. Somar item
  // a item mostraria o preço de tabela e esconderia justamente o benefício.
  const vendasIds = [...new Set(itens.map(i => i.venda_id))];
  if (vendasIds.length) {
    const marcas = vendasIds.map(() => '?').join(',');
    const vs = db.prepare(`SELECT v.id, v.cliente_id, v.subtotal, v.desconto, v.total
                             FROM vendas v WHERE v.id IN (${marcas})`).all(...vendasIds);
    for (const v of vs) {
      const c = porCliente.get(v.cliente_id);
      if (!c) continue;
      c.pago = arred(c.pago + (Number(v.total) || 0));
      c.desconto = arred(c.desconto + (Number(v.desconto) || 0));
    }
  }

  const minPecas = Number(p.min_pecas) || 0;
  const clientes = [...porCliente.values()]
    .map(c => ({
      cliente_id: c.cliente_id, cliente: c.cliente, categoria: c.categoria,
      categoria_id: c.categoria_id, pct: c.pct,
      compras: c.vendas.size, pecas: c.pecas,
      tabela: c.tabela, desconto: c.desconto, pago: c.pago,
      ticket: c.vendas.size ? arred(c.pago / c.vendas.size) : 0,
      media_pecas: c.vendas.size ? Math.round((c.pecas / c.vendas.size) * 10) / 10 : 0,
      primeira: String(c.primeira).slice(0, 10), ultima: String(c.ultima).slice(0, 10),
      produtos: [...c.produtos.values()].sort((a, b) => b.qtd - a.qtd || b.total - a.total)
    }))
    .filter(c => c.pecas >= minPecas)
    .sort((a, b) => b.pecas - a.pecas || b.pago - a.pago);

  const resumo = {
    clientes: clientes.length,
    compras: clientes.reduce((s, c) => s + c.compras, 0),
    pecas: clientes.reduce((s, c) => s + c.pecas, 0),
    tabela: arred(clientes.reduce((s, c) => s + c.tabela, 0)),
    desconto: arred(clientes.reduce((s, c) => s + c.desconto, 0)),
    pago: arred(clientes.reduce((s, c) => s + c.pago, 0))
  };

  // Ranking de tipo de peça no período inteiro (todas as pessoas juntas):
  // é o que denuncia a peça levada em quantidade.
  const ids = new Set(clientes.map(c => c.cliente_id));
  const por_produto = [...porProduto.values()]
    .map(g => ({ produto: g.produto, referencia: g.referencia, cor: g.cor, tamanho: g.tamanho,
                 qtd: g.qtd, total: g.total, clientes: [...g.clientes].filter(i => ids.has(i)).length }))
    .filter(g => g.clientes > 0)
    .sort((a, b) => b.qtd - a.qtd || b.total - a.total);

  return { ok: true, de, ate, categorias, clientes, por_produto, resumo, sem_categoria_marcada: false };
}

export {
  estoqueDetalhado, vendasPeriodo, curvaAbc, pecasParadas, receitaPorLoja, consignadosMensal,
  relatorioEvento, ranking, rankingPeriodo, eventosVenda, comprasAcompanhadas,
  TAXAS_PADRAO, taxasDaConfig };