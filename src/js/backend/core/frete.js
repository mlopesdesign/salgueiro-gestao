// Frete das vendas com entrega (v3.31.0)
// ---------------------------------------------------------------------------
// Pedido do Marcio: a loja WhatsApp vende pela internet — "preciso de um campo
// valor de frete, e o resultado disso tem que entrar em todo o sistema; e
// também como foi o frete: Mercado Envios, se veio retirar no balcão".
//
// COMO FICA GRAVADO: `vendas.frete` (valor cobrado da cliente) e
// `vendas.frete_tipo` (como foi). O frete SOMA no `vendas.total` — é dinheiro
// que entrou, então a gaveta, as formas de pagamento e o faturamento batem com
// a maquininha sem mexer em nenhuma consulta. O que muda é que toda tela que
// mostra dinheiro mostra também, em linha própria, quanto daquilo é frete
// (regra única: `freteDoPeriodo` abaixo). E o LUCRO não conta o frete: ele é
// repassado a quem entrega, não é margem de peça.
//
// Só aparece no PDV das lojas marcadas em Configurações → Lojas → "vende com
// entrega (frete)".

export const FRETE_TIPOS = [
  ['retirada', 'Retirada no balcão'],
  ['mercado_envios', 'Mercado Envios'],
  ['correios', 'Correios'],
  ['motoboy', 'Motoboy / entrega própria'],
  ['transportadora', 'Transportadora'],
  ['outro', 'Outro'],
];
const _ROTULO = Object.fromEntries(FRETE_TIPOS);
export const rotuloFrete = (tipo) => _ROTULO[tipo] || (tipo ? String(tipo) : 'Sem entrega');
export const tipoFreteValido = (tipo) => Object.prototype.hasOwnProperty.call(_ROTULO, tipo);

const arred = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Frete das vendas concluídas que atendem `onde(alias)` (mesma ideia do
// trocasDoPeriodo). Devolve { qtd, valor, por_tipo: [{tipo, rotulo, qtd, valor}] }.
// `qtd` conta as vendas COM entrega registrada (inclui retirada no balcão,
// que tem frete zero mas é informação de como a peça saiu).
export function freteDoPeriodo(db, onde, params = []) {
  const linhas = db.prepare(`
    SELECT v.frete_tipo tipo, COUNT(*) qtd, COALESCE(SUM(v.frete),0) valor
      FROM vendas v
     WHERE v.status = 'concluida' AND (v.frete_tipo IS NOT NULL OR COALESCE(v.frete,0) > 0)
       AND ${onde('v')}
     GROUP BY v.frete_tipo ORDER BY valor DESC, qtd DESC
  `).all(...params);
  const por_tipo = linhas.map(l => ({ tipo: l.tipo || 'outro', rotulo: rotuloFrete(l.tipo || 'outro'), qtd: l.qtd, valor: arred(l.valor) }));
  return {
    qtd: por_tipo.reduce((s, x) => s + x.qtd, 0),
    valor: arred(por_tipo.reduce((s, x) => s + x.valor, 0)),
    por_tipo
  };
}
