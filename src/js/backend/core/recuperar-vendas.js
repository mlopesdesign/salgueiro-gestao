// RECUPERAR VENDAS PELA CONTAGEM DO ESTOQUE (v3.34.0)
//
// Em 25/10/2026 o computador principal desligou de repente e o banco ficou
// zerado; a loja voltou para a cópia de 23/10 13:52 e as vendas de 23/10 a
// 25/10 sumiram. O que sobrou de prova foi o ESTOQUE FÍSICO: contando as peças,
// a diferença entre o que o sistema diz que tem e o que está na loja é o que
// saiu nesses dias — produto por produto e, nos consignados, fornecedor por
// fornecedor (é o que paga o fornecedor).
//
// Fluxo: a loja conta (bipando ou digitando) → prévia com a diferença →
// lançamento datado (ex.: evento de 23/10, depois evento de 24/10 20h → 25/10
// 03h12). Cada lançamento vira UMA venda normal, feita pelo pdv.registrarVenda
// (estoque, consignação, relatórios — tudo pelo caminho de sempre), num caixa
// próprio já fechado, com a data escolhida e a marca "recuperada" no obs.
// A contagem continua valendo entre um lançamento e outro: o que já foi
// lançado sai do saldo, e a diferença que resta vai para o próximo.
import { auditar } from './util.js';
import * as estoques from './estoques.js';
import * as pdv from './pdv.js';

const arred = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const OBS_RECUPERADA = 'VENDA RECUPERADA pela contagem de estoque';

// Peças do local de estoque da loja, com o saldo do sistema.
function posicao(db, p) {
  const lojaId = Number((p || {}).loja_id) || 0;
  const loja = db.prepare('SELECT id, nome, COALESCE(usa_frete,0) usa_frete FROM lojas WHERE id=?').get(lojaId);
  if (!loja) return { ok: false, erro: 'Escolha a loja.' };
  const local = estoques.daLoja(db, lojaId);
  const linhas = db.prepare(`
    SELECT va.id variacao_id, pr.id produto_id, pr.nome produto, COALESCE(pr.referencia,'') referencia,
           COALESCE(va.cor,'') cor, COALESCE(va.tamanho,'') tamanho, COALESCE(va.codigo_barras,'') codigo_barras,
           COALESCE(pr.preco_venda,0) preco_venda, COALESCE(pr.consignado,0) consignado,
           pr.fornecedor_id, COALESCE(fo.nome,'') fornecedor,
           ${local ? 'COALESCE(es.qtd,0)' : 'va.estoque'} sistema
      FROM variacoes va
      JOIN produtos pr ON pr.id = va.produto_id
      LEFT JOIN fornecedores fo ON fo.id = pr.fornecedor_id
      ${local ? 'LEFT JOIN estoque_saldos es ON es.variacao_id = va.id AND es.estoque_id = ?' : ''}
     WHERE va.ativo = 1 AND pr.ativo = 1
     ORDER BY pr.nome, va.cor, va.tamanho
  `).all(...(local ? [local.id] : []));
  return { ok: true, loja, local: local ? { id: local.id, nome: local.nome } : null,
           itens: linhas.map(l => ({ ...l, sistema: Number(l.sistema) || 0 })) };
}

// contagem = { variacao_id: qtd contada } — só entra o que foi contado.
// lancar   = { variacao_id: qtd a lançar } (opcional) — para dividir entre eventos.
function previa(db, p) {
  const pos = posicao(db, p);
  if (!pos.ok) return pos;
  const cont = (p && p.contagem) || {};
  const lancar = (p && p.lancar) || null;
  const itens = [], sobras = [];
  for (const v of pos.itens) {
    if (!(String(v.variacao_id) in cont)) continue;
    const contado = Math.max(0, Math.floor(Number(cont[v.variacao_id]) || 0));
    const dif = v.sistema - contado;
    if (dif > 0) {
      let qtd = dif;
      if (lancar && String(v.variacao_id) in lancar) qtd = Math.max(0, Math.min(dif, Math.floor(Number(lancar[v.variacao_id]) || 0)));
      itens.push({ ...v, contado, saiu: dif, qtd, valor: arred(qtd * v.preco_venda) });
    } else if (dif < 0) sobras.push({ ...v, contado, sobra: -dif });
  }
  const aLancar = itens.filter(i => i.qtd > 0);
  const porForn = new Map();
  for (const i of aLancar.filter(x => x.consignado)) {
    const k = i.fornecedor_id || 0;
    const a = porForn.get(k) || { fornecedor_id: k, fornecedor: i.fornecedor || 'Sem fornecedor', pecas: 0, valor: 0 };
    a.pecas += i.qtd; a.valor = arred(a.valor + i.valor); porForn.set(k, a);
  }
  const soma = (l, f) => l.reduce((a, x) => a + f(x), 0);
  return {
    ok: true, loja: pos.loja, local: pos.local, itens, sobras,
    contados: Object.keys(cont).length,
    total: {
      pecas: soma(aLancar, x => x.qtd),
      valor: arred(soma(aLancar, x => x.valor)),
      consignado: { pecas: soma(aLancar.filter(x => x.consignado), x => x.qtd), valor: arred(soma(aLancar.filter(x => x.consignado), x => x.valor)) },
      proprio: { pecas: soma(aLancar.filter(x => !x.consignado), x => x.qtd), valor: arred(soma(aLancar.filter(x => !x.consignado), x => x.valor)) }
    },
    por_fornecedor: [...porForn.values()].sort((a, b) => b.valor - a.valor)
  };
}

const RX_DATA = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;

function confirmar(db, p, quem) {
  if (!quem) return { ok: false, erro: 'Sessão expirada.' };
  if (!RX_DATA.test(String(p.data_venda || ''))) return { ok: false, erro: 'Informe a data e a hora das vendas.' };
  const data = String(p.data_venda).replace('T', ' ').slice(0, 16) + ':00';
  const pv = previa(db, p);
  if (!pv.ok) return pv;
  const itens = pv.itens.filter(i => i.qtd > 0);
  if (!itens.length) return { ok: false, erro: 'Nada a lançar: nenhuma peça contada saiu do estoque.' };
  const pags = (Array.isArray(p.pagamentos) ? p.pagamentos : [])
    .map(g => ({ forma: g.forma, valor: arred(g.valor), parcelas: Number(g.parcelas) || 1 }))
    .filter(g => g.valor > 0);
  const somaPag = arred(pags.reduce((a, g) => a + g.valor, 0));
  // O que a loja RECEBEU de verdade vem do extrato da maquininha e do caixa.
  // Se for menos que o valor de tabela das peças, a diferença entra como
  // DESCONTO da venda (v3.34.1): o relatório mostra o desconto, o faturamento
  // fica igual ao recebido e o repasse dos consignados é calculado sobre o
  // valor com desconto — a mesma regra de uma venda normal. As taxas da
  // maquininha saem das formas de pagamento informadas, como sempre.
  if (somaPag <= 0) return { ok: false, erro: 'Informe quanto foi recebido em cada forma de pagamento.' };
  if (somaPag - pv.total.valor > 0.01) {
    return { ok: false, erro: `Recebido R$ ${somaPag.toFixed(2)} é MAIOR que o valor de tabela das peças (R$ ${pv.total.valor.toFixed(2)}). Confira a contagem ou os valores.` };
  }
  const desconto = arred(pv.total.valor - somaPag);
  if (desconto > 0.009 && db.prepare('SELECT COALESCE(sem_desconto,0) s FROM lojas WHERE id=?').get(pv.loja.id).s) {
    return { ok: false, erro: `A loja ${pv.loja.nome} não aceita desconto: o recebido tem de ser igual ao valor de tabela (R$ ${pv.total.valor.toFixed(2)}).` };
  }
  const terminal = `RECUPERACAO-${Date.now()}`;
  const maxMov = (db.prepare('SELECT COALESCE(MAX(id),0) n FROM movimentos_estoque').get() || {}).n || 0;
  const cx = db.prepare(`INSERT INTO caixas (loja_id, aberto_em, usuario_abertura, valor_abertura, terminal, terminal_desc)
                         VALUES (?,?,?,0,?,?)`)
    .run(pv.loja.id, data, quem.id, terminal, 'Recuperação de vendas pela contagem');
  const caixaId = Number(cx.lastInsertRowid);
  const r = pdv.registrarVenda(db, {
    _terminal: terminal,
    itens: itens.map(i => ({ variacao_id: i.variacao_id, qtd: i.qtd, preco_unit: i.preco_venda, desconto: 0 })),
    pagamentos: pags,
    ...(desconto > 0.009 ? {
      desconto,
      desconto_autorizado_por: `${quem.nome || 'admin'} (recuperação)`,
      desconto_motivo: 'Recuperação: diferença entre o valor de tabela das peças contadas e o recebido no extrato'
    } : {}),
    obs: `${OBS_RECUPERADA}${p.descricao ? ' — ' + String(p.descricao).slice(0, 120) : ''}`,
    ...(pv.loja.usa_frete ? { frete: 0, frete_tipo: 'retirada' } : {})
  }, quem);
  if (!r.ok) {
    try { db.prepare('DELETE FROM caixas WHERE id=?').run(caixaId); } catch { /* */ }
    return r;
  }
  const vendaId = r.venda.id;
  db.prepare('UPDATE vendas SET criado_em=? WHERE id=?').run(data, vendaId);
  try { db.prepare('UPDATE consignacoes SET criado_em=? WHERE venda_id=?').run(data, vendaId); } catch { /* */ }
  db.prepare(`UPDATE movimentos_estoque SET criado_em=?, motivo=? WHERE id > ? AND tipo='venda'`)
    .run(data, `Venda recuperada #${vendaId} (contagem)`, maxMov);
  db.prepare(`UPDATE caixas SET fechado_em=?, usuario_fechamento=?, valor_fechamento_calculado=?, obs=? WHERE id=?`)
    .run(data, quem.id, pv.total.valor, 'Caixa da recuperação de vendas pela contagem', caixaId);
  auditar(db, quem, 'vendas.recuperar', `venda #${vendaId} · ${pv.loja.nome} · ${data} · ${pv.total.pecas} peças · R$ ${pv.total.valor.toFixed(2)}`);
  return { ok: true, venda_id: vendaId, caixa_id: caixaId, data, total: pv.total, desconto, recebido: somaPag, por_fornecedor: pv.por_fornecedor };
}

export { posicao, previa, confirmar };
