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
  return `AND COALESCE(${a}tipo_venda,'normal') <> 'troca'`;
}

// Expressão de DINHEIRO recebido por uma venda:
//  · venda de troca → só os pagamentos que NÃO são crédito de troca
//  · qualquer outra → total menos o que foi devolvido
// Uso: `SUM(${RECEBIDO('v')})`.
function RECEBIDO(alias = 'v') {
  const a = alias ? `${alias}.` : '';
  const id = alias ? `${alias}.id` : 'id';
  return `CASE WHEN COALESCE(${a}tipo_venda,'normal') = 'troca'
       THEN COALESCE((SELECT SUM(vp.valor - vp.troco) FROM venda_pagamentos vp
                       WHERE vp.venda_id = ${id} AND vp.forma <> 'troca'),0)
       ELSE ${a}total - COALESCE((SELECT SUM(d.valor_devolvido) FROM devolucoes d
                                   WHERE d.venda_id = ${id}),0) END`;
}

// Igual a RECEBIDO, mas sem descontar devolução — para onde a devolução já é
// subtraída à parte (painel, que mostra "devolvido" em linha própria).
function RECEBIDO_BRUTO(alias = 'v') {
  const a = alias ? `${alias}.` : '';
  const id = alias ? `${alias}.id` : 'id';
  return `CASE WHEN COALESCE(${a}tipo_venda,'normal') = 'troca'
       THEN COALESCE((SELECT SUM(vp.valor - vp.troco) FROM venda_pagamentos vp
                       WHERE vp.venda_id = ${id} AND vp.forma <> 'troca'),0)
       ELSE ${a}total END`;
}

export { NAO_TROCA, RECEBIDO, RECEBIDO_BRUTO };
