// REGRA ÚNICA: TROCA NÃO É VENDA (v3.27.4)
// ---------------------------------------------------------------------------
// Ordem do Marcio, repetida até virar este arquivo:
//
//   "troca não é venda"
//   "se eu troco um produto de 80,00 por um de 250, entrou apenas 170"
//   "se os valores forem iguais, nada deve mudar, apenas ter no relatório o
//    registro da troca"
//
// Duas consequências, e as duas valem em TODA tela do sistema:
//
//   1. CONTAGEM — a troca NÃO conta como venda. Não entra em "1 venda(s)",
//      nem em ticket médio, nem em número de vendas do dia/mês/caixa.
//   2. DINHEIRO — da troca entra só a DIFERENÇA que a cliente pagou. Nunca o
//      valor cheio da peça que saiu.
//
// POR QUE A TROCA GRAVA UMA VENDA COM O VALOR CHEIO:
// a peça nova precisa existir em `vendas`/`venda_itens` pelo preço de tabela —
// é disso que dependem o kardex, a devolução em cadeia e o desconto herdado.
// Mudar o INSERT quebraria tudo isso. Quem separa dinheiro de crédito é a
// LEITURA, e a leitura mora aqui.
//
// COMO USAR: qualquer consulta nova que conte ou some venda importa daqui.
// NUNCA escrever `SUM(v.total)` nem `COUNT(*) FROM vendas` solto — foi assim
// que o furo apareceu no caixa, depois no relatório e depois no painel, um de
// cada vez, três reprovações seguidas.

// Filtro para CONTAGEM de vendas: a troca fica de fora.
// Uso: `WHERE ... ${NAO_TROCA('v')}`  ou, sem alias, `${NAO_TROCA()}`.
function NAO_TROCA(alias = 'v') {
  const a = alias ? `${alias}.` : '';
  // Desde a v3.28.0 a troca tem status 'troca' e as consultas que filtram
  // 'concluida' ja a ignoram. O filtro fica como segunda trava.
  return `AND COALESCE(${a}tipo_venda,'normal') <> 'troca' AND ${a}status <> 'troca'`;
}

// Expressão de DINHEIRO recebido por uma venda:
//  · venda de troca → só os pagamentos que NÃO são crédito de troca
//  · qualquer outra → total menos o que foi devolvido
// Uso: `SUM(${RECEBIDO('v')})`.
function RECEBIDO(alias = 'v') {
  const a = alias ? `${alias}.` : '';
  const id = alias ? `${alias}.id` : 'id';
  return `CASE WHEN COALESCE(${a}tipo_venda,'normal') = 'troca' OR ${a}status = 'troca'
       THEN COALESCE((SELECT SUM(vp.valor - vp.troco) FROM venda_pagamentos vp
                       WHERE vp.venda_id = ${id} AND vp.forma <> 'troca'),0)
       ELSE ${a}total - COALESCE((SELECT SUM(d.valor_devolvido) FROM devolucoes d
                                   WHERE COALESCE(d.tipo,'') <> 'troca' AND d.venda_id = ${id}),0) END`;
}

// Igual a RECEBIDO, mas sem descontar devolução — para onde a devolução já é
// subtraída à parte (painel, que mostra "devolvido" em linha própria).
function RECEBIDO_BRUTO(alias = 'v') {
  const a = alias ? `${alias}.` : '';
  const id = alias ? `${alias}.id` : 'id';
  return `CASE WHEN COALESCE(${a}tipo_venda,'normal') = 'troca' OR ${a}status = 'troca'
       THEN COALESCE((SELECT SUM(vp.valor - vp.troco) FROM venda_pagamentos vp
                       WHERE vp.venda_id = ${id} AND vp.forma <> 'troca'),0)
       ELSE ${a}total END`;
}

// ── Diferença da troca, positiva ou negativa (v3.28.0) ──────────────────────
// "tem que entrar apenas a diferença, se positiva ou negativa" (Marcio).
//
//   positiva  = o que a cliente pagou a mais nas trocas (pagamentos da venda de
//               troca que NÃO são o crédito da peça que voltou)
//   negativa  = o que a loja devolveu quando a peça levada era mais barata e o
//               troco saiu em DINHEIRO ou ESTORNO. Vale-troca e "nada" não
//               tiram dinheiro da loja, então não entram.
//   saldo     = positiva − negativa. É ESTE número que entra no total, em
//               linha própria, identificado como troca — nunca dentro de vendas.
//
// `onde` filtra as tabelas da troca: recebe o alias ('v' para vendas, 'd' para
// devolucoes) e devolve a condição SQL — ex.: (a) => `${a}.caixa_id = ?`.
// Os parâmetros entram DUAS vezes (uma por subconsulta), na ordem.
function SQL_TROCAS(onde) {
  return `SELECT
    (SELECT COUNT(*) FROM devolucoes d
      WHERE d.tipo = 'troca' AND ${onde('d')})                                    AS qtd,
    (SELECT COALESCE(SUM(d.valor_devolvido),0) FROM devolucoes d
      WHERE d.tipo = 'troca' AND ${onde('d')})                                    AS credito,
    (SELECT COALESCE(SUM(vp.valor - vp.troco),0)
       FROM venda_pagamentos vp JOIN vendas v ON v.id = vp.venda_id
      WHERE v.status = 'troca' AND vp.forma <> 'troca' AND ${onde('v')})         AS recebido,
    (SELECT COALESCE(SUM(d.excedente),0) FROM devolucoes d
      WHERE d.tipo = 'troca' AND d.forma_reembolso IN ('dinheiro','estorno')
        AND ${onde('d')})                                                         AS devolvido`;
}
// Executa e já devolve o objeto pronto. `params` = parâmetros de UMA condição;
// eles são repetidos para as quatro subconsultas.
function trocasDoPeriodo(db, onde, params = []) {
  const r = db.prepare(SQL_TROCAS(onde)).get(...params, ...params, ...params, ...params) || {};
  const a = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const recebido = a(r.recebido), devolvido = a(r.devolvido);
  return { qtd: r.qtd || 0, credito: a(r.credito), recebido, devolvido, saldo: a(recebido - devolvido) };
}

export { NAO_TROCA, RECEBIDO, RECEBIDO_BRUTO, SQL_TROCAS, trocasDoPeriodo };
