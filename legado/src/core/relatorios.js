// Relatórios — vendas por período, curva ABC, peças paradas
const arred = (n) => Math.round(n * 100) / 100;

// p: { de: 'YYYY-MM-DD', ate: 'YYYY-MM-DD' }
function vendasPeriodo(db, p) {
  const de = p.de || new Date().toISOString().slice(0, 8) + '01';
  const ate = p.ate || new Date().toISOString().slice(0, 10);
  const lojaId = Number(p.loja_id) || 0; // 0 = todas as lojas
  const fLoja = lojaId ? 'AND loja_id = ?' : '';
  const fLojaV = lojaId ? 'AND v.loja_id = ?' : '';
  const ar = lojaId ? [de, ate, lojaId] : [de, ate];

  const resumo = db.prepare(`
    SELECT COUNT(*) qtd, COALESCE(SUM(total),0) total, COALESCE(AVG(total),0) ticket
    FROM vendas WHERE status='concluida' AND date(criado_em) BETWEEN ? AND ? ${fLoja}
  `).get(...ar);

  const porDia = db.prepare(`
    SELECT date(criado_em) dia, COUNT(*) qtd, SUM(total) total
    FROM vendas WHERE status='concluida' AND date(criado_em) BETWEEN ? AND ? ${fLoja}
    GROUP BY dia ORDER BY dia
  `).all(...ar);

  const porVendedor = db.prepare(`
    SELECT u.nome vendedor, COUNT(*) qtd, SUM(v.total) total
    FROM vendas v LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ? ${fLojaV}
    GROUP BY v.usuario_id ORDER BY total DESC
  `).all(...ar);

  const porCategoria = db.prepare(`
    SELECT COALESCE(c.nome,'Sem categoria') categoria, SUM(vi.qtd) pecas, SUM(vi.total) total
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos p ON p.id = va.produto_id
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ? ${fLojaV}
    GROUP BY categoria ORDER BY total DESC
  `).all(...ar);

  return { ok: true, de, ate,
    resumo: { qtd: resumo.qtd, total: arred(resumo.total), ticket: arred(resumo.ticket) },
    por_dia: porDia, por_vendedor: porVendedor, por_categoria: porCategoria };
}

// Receita separada por loja no período (com total consolidado)
function receitaPorLoja(db, p) {
  const de = p.de || new Date().toISOString().slice(0, 8) + '01';
  const ate = p.ate || new Date().toISOString().slice(0, 10);
  const linhas = db.prepare(`
    SELECT l.id loja_id, l.nome loja,
           COUNT(v.id) qtd,
           COALESCE(SUM(v.total),0) total,
           COALESCE(AVG(v.total),0) ticket
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
function curvaAbc(db, p) {
  const de = p.de || '2000-01-01';
  const ate = p.ate || new Date().toISOString().slice(0, 10);
  const linhas = db.prepare(`
    SELECT pr.id, pr.nome, pr.referencia, SUM(vi.qtd) pecas, SUM(vi.total) receita,
           SUM(vi.qtd * pr.preco_custo) custo
    FROM venda_itens vi
    JOIN vendas v ON v.id = vi.venda_id
    JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    WHERE v.status='concluida' AND date(v.criado_em) BETWEEN ? AND ?
    GROUP BY pr.id ORDER BY receita DESC
  `).all(de, ate);
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

module.exports = { vendasPeriodo, curvaAbc, pecasParadas, receitaPorLoja };
