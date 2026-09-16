// PDV — caixa, vendas, pagamentos, crediário e cupom
import { auditar } from './util.js';
import * as valesTroca from './vales_troca.js';
import * as pontos from './pontos.js';
import * as estoques from './estoques.js';

const FORMAS = ['dinheiro', 'pix', 'debito', 'credito', 'crediario', 'vale', 'cortesia'];
const arred = (n) => Math.round(n * 100) / 100;

// ---------- Caixa ----------
function caixaAtual(db) {
  const caixa = db.prepare(`
    SELECT cx.*, u.nome AS aberto_por, lj.nome AS loja FROM caixas cx
    LEFT JOIN usuarios u ON u.id = cx.usuario_abertura
    LEFT JOIN lojas lj ON lj.id = cx.loja_id
    WHERE cx.fechado_em IS NULL ORDER BY cx.id DESC LIMIT 1
  `).get();
  return { ok: true, caixa: caixa || null };
}

function abrirCaixa(db, p, quem) {
  if (caixaAtual(db).caixa) return { ok: false, erro: 'Já existe um caixa aberto.' };
  const valor = Number(p.valor_abertura);
  if (!Number.isFinite(valor) || valor < 0) return { ok: false, erro: 'Valor de abertura inválido.' };
  // Loja do caixa: usa a informada (validada) ou a loja padrão.
  let lojaId = Number(p.loja_id) || 0;
  if (lojaId) {
    const l = db.prepare('SELECT id FROM lojas WHERE id=? AND ativo=1').get(lojaId);
    if (!l) return { ok: false, erro: 'Loja inválida ou inativa.' };
  } else {
    const lp = db.prepare('SELECT id FROM lojas WHERE ativo=1 ORDER BY id LIMIT 1').get();
    lojaId = lp ? lp.id : null;
  }
  const r = db.prepare('INSERT INTO caixas (usuario_abertura, valor_abertura, loja_id) VALUES (?,?,?)')
    .run(quem.id, arred(valor), lojaId);
  auditar(db, quem, 'caixa_aberto', `R$ ${valor.toFixed(2)} (loja ${lojaId || '—'})`);
  return { ok: true, id: Number(r.lastInsertRowid), loja_id: lojaId };
}

// Troca a loja do caixa ABERTO sem fechar nada (v3.25.39).
//
// Cada venda grava a própria `vendas.loja_id`, então o que já foi vendido
// continua contando para a loja em que foi feito — o fechamento segue separando
// certo. Só as PRÓXIMAS vendas passam a baixar do estoque da nova loja.
function trocarLoja(db, p, quem) {
  const cx = caixaAtual(db).caixa;
  if (!cx) return { ok: false, erro: 'Nenhum caixa aberto.' };
  const lojaId = Number(p && p.loja_id) || 0;
  if (!lojaId) return { ok: false, erro: 'Informe a loja.' };
  if (lojaId === cx.loja_id) return { ok: false, erro: 'O caixa já está nesta loja.' };
  const l = db.prepare('SELECT id, nome FROM lojas WHERE id=? AND ativo=1').get(lojaId);
  if (!l) return { ok: false, erro: 'Loja inválida ou inativa.' };

  db.prepare('UPDATE caixas SET loja_id=? WHERE id=?').run(lojaId, cx.id);
  auditar(db, quem, 'caixa_troca_loja', `caixa #${cx.id}: ${cx.loja || '—'} → ${l.nome}`);

  const est = estoques.daLoja(db, lojaId);
  return { ok: true, loja_id: lojaId, loja: l.nome, estoque: est ? est.nome : null };
}

function movimentoCaixa(db, p, quem) {
  const cx = caixaAtual(db).caixa;
  if (!cx) return { ok: false, erro: 'Nenhum caixa aberto.' };
  const valor = Number(p.valor);
  if (!['sangria', 'suprimento'].includes(p.tipo)) return { ok: false, erro: 'Tipo inválido.' };
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, erro: 'Valor inválido.' };
  db.prepare('INSERT INTO caixa_movimentos (caixa_id, tipo, valor, motivo, usuario_id) VALUES (?,?,?,?,?)')
    .run(cx.id, p.tipo, arred(valor), p.motivo || null, quem.id);
  auditar(db, quem, `caixa_${p.tipo}`, `R$ ${valor.toFixed(2)} ${p.motivo || ''}`);
  return { ok: true };
}

function resumoCaixa(db, caixaId) {
  const cx = db.prepare('SELECT * FROM caixas WHERE id=?').get(caixaId);
  if (!cx) return { ok: false, erro: 'Caixa não encontrado.' };

  const porForma = db.prepare(`
    SELECT vp.forma, SUM(vp.valor - vp.troco) AS total, COUNT(DISTINCT v.id) AS vendas
    FROM venda_pagamentos vp JOIN vendas v ON v.id = vp.venda_id
    WHERE v.caixa_id = ? AND v.status = 'concluida'
    GROUP BY vp.forma
  `).all(caixaId);

  const movs = db.prepare(`
    SELECT tipo, SUM(valor) AS total FROM caixa_movimentos WHERE caixa_id=? GROUP BY tipo
  `).all(caixaId);

  const nVendas = db.prepare(
    "SELECT COUNT(*) n, COALESCE(SUM(total),0) t FROM vendas WHERE caixa_id=? AND status='concluida'"
  ).get(caixaId);

  // Vendas por loja neste caixa
  const porLoja = db.prepare(`
    SELECT COALESCE(l.nome, 'Loja Principal') AS loja, COUNT(*) AS qtd, COALESCE(SUM(v.total),0) AS total
    FROM vendas v LEFT JOIN lojas l ON l.id = v.loja_id
    WHERE v.caixa_id = ? AND v.status = 'concluida'
    GROUP BY v.loja_id ORDER BY total DESC
  `).all(caixaId);

  // Consignados vendidos neste caixa: custo discriminado e as partes
  const consig = db.prepare(`
    SELECT COALESCE(SUM(c.qtd),0) AS pecas,
           COALESCE(SUM(c.valor_venda),0) AS venda,
           COALESCE(SUM(c.valor_custo),0) AS custo,
           COALESCE(SUM(c.valor_fornecedor),0) AS fornecedor,
           COALESCE(SUM(c.valor_loja),0) AS loja
    FROM consignacoes c JOIN vendas v ON v.id = c.venda_id
    WHERE v.caixa_id = ? AND v.status = 'concluida'
  `).get(caixaId);
  const consignados = {
    pecas: consig.pecas || 0,
    venda: arred(consig.venda), custo: arred(consig.custo),
    fornecedor: arred(consig.fornecedor), loja: arred(consig.loja),
    lucro_fornecedor: arred(consig.fornecedor - consig.custo)
  };

  const soma = (arr, chave, valor) => (arr.find(x => x[chave] === valor) || {}).total || 0;
  const dinheiroVendas = soma(porForma, 'forma', 'dinheiro');
  const sangrias = soma(movs, 'tipo', 'sangria');
  const suprimentos = soma(movs, 'tipo', 'suprimento');
  const esperadoDinheiro = arred(cx.valor_abertura + dinheiroVendas + suprimentos - sangrias);

  return {
    ok: true,
    caixa: cx,
    por_forma: porForma,
    por_loja: porLoja,
    consignados,
    sangrias, suprimentos,
    qtd_vendas: nVendas.n,
    total_vendas: arred(nVendas.t),
    esperado_dinheiro: esperadoDinheiro
  };
}

function fecharCaixa(db, p, quem) {
  const cx = caixaAtual(db).caixa;
  if (!cx) return { ok: false, erro: 'Nenhum caixa aberto.' };
  const resumo = resumoCaixa(db, cx.id);
  const informado = Number(p.valor_informado);
  if (!Number.isFinite(informado) || informado < 0) return { ok: false, erro: 'Informe o valor contado na gaveta.' };
  db.prepare(`UPDATE caixas SET fechado_em = datetime('now','localtime'), usuario_fechamento=?,
              valor_fechamento_informado=?, valor_fechamento_calculado=?, obs=? WHERE id=?`)
    .run(quem.id, arred(informado), resumo.esperado_dinheiro, p.obs || null, cx.id);
  auditar(db, quem, 'caixa_fechado',
    `esperado R$ ${resumo.esperado_dinheiro.toFixed(2)} / contado R$ ${informado.toFixed(2)}`);
  return { ok: true, esperado: resumo.esperado_dinheiro, informado: arred(informado),
           diferenca: arred(informado - resumo.esperado_dinheiro) };
}

// ---------- Taxa da maquininha por forma de pagamento ----------
// Mesmas chaves de Configurações → PDV (v3.12.0). Repetidas aqui porque o core
// do PDV não importa o de relatórios; se um dia divergirem, a fonte de verdade
// é `config`, lida abaixo em `taxasDoBanco`.
const TAXAS_PDV_PADRAO = {
  pix_chave: 0, pix_maquina: 0.49, debito: 0.99,
  credito_vista: 3.05, credito_parcelado: 3.25
};

function taxasDoBanco(db) {
  const t = { ...TAXAS_PDV_PADRAO };
  let linhas = [];
  try { linhas = db.prepare("SELECT chave, valor FROM config WHERE chave LIKE 'taxa_%'").all(); }
  catch { return t; }
  const num = (v, padrao) => {
    // `Number('')` é 0, não NaN: campo em branco tem de cair no padrão, senão
    // a taxa vira zero e a loja absorve o custo sem perceber.
    const txt = String(v == null ? '' : v).replace(',', '.').trim();
    if (txt === '') return padrao;
    const n = Number(txt);
    return Number.isFinite(n) && n >= 0 && n < 100 ? n : padrao;
  };
  const map = {};
  for (const l of linhas) map[l.chave] = l.valor;
  t.pix_chave        = num(map.taxa_pix_chave,        t.pix_chave);
  t.pix_maquina      = num(map.taxa_pix_maquina,      t.pix_maquina);
  t.debito           = num(map.taxa_debito,           t.debito);
  t.credito_vista    = num(map.taxa_credito_vista,    t.credito_vista);
  t.credito_parcelado = num(map.taxa_credito_parcelado, t.credito_parcelado);
  return t;
}

// Percentual cobrado pela maquininha naquela forma.
// PIX usa a taxa da CHAVE (0% por padrão): na loja o pix é lido no celular,
// não na maquininha. Quem cobra pix na maquininha ajusta em Configurações.
function taxaDaForma(forma, parcelas, taxas) {
  const n = Number(parcelas) || 1;
  switch (forma) {
    case 'debito':  return taxas.debito;
    case 'credito': return n > 1 ? taxas.credito_parcelado : taxas.credito_vista;
    case 'pix':     return taxas.pix_chave;
    default:        return 0;   // dinheiro, crediário, vale, cortesia, troca
  }
}

// ---------- Venda ----------
function registrarVenda(db, p, quem) {
  const cx = caixaAtual(db).caixa;
  if (!cx) return { ok: false, erro: 'Abra o caixa antes de vender.' };
  const itens = Array.isArray(p.itens) ? p.itens : [];
  const pagamentos = Array.isArray(p.pagamentos) ? p.pagamentos : [];
  if (!itens.length) return { ok: false, erro: 'A venda não tem itens.' };
  if (!pagamentos.length) return { ok: false, erro: 'Informe a forma de pagamento.' };

  // ── Venda a preço de custo (v3.19.0) ──────────────────────────────────────
  // A peça sai pelo `produtos.preco_custo` LIDO DO BANCO, nunca pelo preço que
  // a tela mandou: aceitar o valor do payload deixaria qualquer terminal em
  // rede montar a própria tabela de preço.
  //
  // Não aceita desconto de espécie nenhuma — custo já é o piso; abater de novo
  // faria a loja vender abaixo do que pagou.
  //
  // Peça sem custo cadastrado é RECUSADA, com o nome na mensagem. Se passasse,
  // `preco_custo` nulo viraria zero e a peça sairia de graça sem ninguém notar.
  const aCusto = String(p.tipo_venda || '') === 'custo';
  if (aCusto) {
    const semCusto = [];
    const buscaCusto = db.prepare(`SELECT p.nome, p.preco_custo
                                     FROM variacoes v JOIN produtos p ON p.id = v.produto_id
                                    WHERE v.id = ?`);
    for (const i of itens) {
      const pr = buscaCusto.get(i.variacao_id);
      if (!pr) return { ok: false, erro: 'Peça não encontrada no estoque.' };
      const custo = Number(pr.preco_custo);
      if (!Number.isFinite(custo) || custo <= 0) { semCusto.push(pr.nome); continue; }
      i.preco_unit = arred(custo);
      i.desconto = 0;                       // custo é o piso: não abate mais nada
    }
    if (semCusto.length) {
      return { ok: false, erro: 'Sem preço de custo cadastrado: ' +
        [...new Set(semCusto)].join(', ') + '. Cadastre o custo em Produtos antes.' };
    }
  }

  // totais
  let subtotal = 0;
  for (const i of itens) {
    const qtd = Number(i.qtd), preco = Number(i.preco_unit), desc = Number(i.desconto) || 0;
    if (!Number.isFinite(qtd) || qtd <= 0 || !Number.isFinite(preco) || preco < 0 || desc < 0) {
      return { ok: false, erro: 'Item com quantidade ou preço inválido.' };
    }
    i.total = arred(qtd * preco - desc);
    if (i.total < 0) return { ok: false, erro: 'Desconto maior que o valor do item.' };
    subtotal = arred(subtotal + i.total);
  }
  // Na venda a custo o desconto geral é ignorado, não recusado: a tela já não
  // oferece desconto nesse modo, e recusar quebraria o desconto automático de
  // categoria que o servidor aplica sozinho.
  const descontoGeral = aCusto ? 0 : arred(Number(p.desconto) || 0);

  // ── Acréscimo da taxa da maquininha na venda a custo (v3.20.0) ────────────
  // Vender a custo já é vender sem margem; se a loja ainda pagasse a taxa do
  // cartão, sairia no PREJUÍZO. Então a taxa é somada ao que o cliente paga.
  //
  // A conta é 1/(1−taxa), não (1+taxa): a maquininha cobra o percentual sobre
  // o valor COBRADO, não sobre o custo. Com R$ 100 de custo e 3,05%, somar
  // 3,05% cobraria 103,05 e a loja receberia 99,91 — ainda faltariam 9
  // centavos. Dividindo, cobra 103,15 e a loja recebe os 100,00 exatos.
  //
  // Dinheiro, PIX na chave, crediário e vale têm taxa zero: nada muda.
  let acrescimo = 0;
  if (aCusto) {
    const taxas = taxasDoBanco(db);
    const pagos = pagamentos.filter(pg => Number(pg.valor) > 0);
    const somaInformada = pagos.reduce((s, pg) => s + (Number(pg.valor) || 0), 0);
    if (somaInformada > 0) {
      for (const pg of pagos) {
        const tx = taxaDaForma(pg.forma, pg.parcelas, taxas) / 100;
        if (tx <= 0) continue;
        // parte do custo que está sendo paga nesta forma
        const fatia = arred(subtotal * (Number(pg.valor) / somaInformada));
        acrescimo = arred(acrescimo + arred(fatia / (1 - tx) - fatia));
      }
    }
  }

  // Cortesia: o valor não é recebido — vira desconto, então a venda entra com
  // total 0 (nada de faturamento nem de caixa), mas o estoque baixa normalmente.
  // Exige quem autorizou e para quem foi, e não vale para produto consignado.
  let cortesiaTotal = 0;
  for (const pg of pagamentos) {
    if (pg.forma !== 'cortesia') continue;
    const v = Number(pg.valor);
    if (!Number.isFinite(v) || v <= 0) return { ok: false, erro: 'Cortesia com valor inválido.' };
    pg.autorizado_por = String(pg.autorizado_por || '').trim();
    pg.beneficiario = String(pg.beneficiario || '').trim();
    if (!pg.autorizado_por) return { ok: false, erro: 'Informe quem autorizou a cortesia.' };
    if (!pg.beneficiario) return { ok: false, erro: 'Informe para quem foi a cortesia.' };
    cortesiaTotal = arred(cortesiaTotal + arred(v));
  }
  // Consignado também pode sair como cortesia: a loja não recebe nada, mas a
  // consignação é gerada normalmente — o fornecedor continua a receber a parte dele.
  // O acréscimo da taxa entra no que o cliente paga, mas NÃO no preço da peça:
  // a soma dos itens continua sendo o custo, e o total fica subtotal+acréscimo.
  const total = arred(subtotal - descontoGeral - cortesiaTotal + acrescimo);
  if (total < 0) return { ok: false, erro: 'Desconto geral maior que o subtotal.' };

  // pagamentos (a cortesia não entra na conta do que foi recebido)
  let pago = 0, dinheiro = 0;
  for (const pg of pagamentos) {
    if (!FORMAS.includes(pg.forma)) return { ok: false, erro: `Forma inválida: ${pg.forma}` };
    const v = Number(pg.valor);
    if (!Number.isFinite(v) || v <= 0) return { ok: false, erro: 'Pagamento com valor inválido.' };
    pg.valor = arred(v);
    pg.parcelas = Math.max(1, Number(pg.parcelas) || 1);
    if (pg.forma === 'cortesia') { pg.cortesia_valor = pg.valor; pg.valor = 0; continue; }
    pago = arred(pago + pg.valor);
    if (pg.forma === 'dinheiro') dinheiro = arred(dinheiro + pg.valor);
  }
  const naoDinheiro = arred(pago - dinheiro);
  if (naoDinheiro > total) return { ok: false, erro: 'Pagamentos (exceto dinheiro) excedem o total.' };
  if (pago < total) return { ok: false, erro: `Faltam ${(total - pago).toFixed(2)} para completar o pagamento.` };
  const troco = arred(pago - total);

  const temCrediario = pagamentos.some(pg => pg.forma === 'crediario');
  if (temCrediario && !p.cliente_id) return { ok: false, erro: 'Crediário exige cliente identificado.' };

  // pagamentos com vale-troca exigem código
  for (const pg of pagamentos) {
    if (pg.forma === 'vale' && !pg.codigo_vale) {
      return { ok: false, erro: 'Informe o código do vale-troca para pagamento com vale.' };
    }
  }

  // ── Estoque disponível (v3.26.0: confere o LOCAL, não só o total) ─────────
  //
  // O QUE ESTAVA ERRADO: esta validação olhava `variacoes.estoque`, que é o
  // total somado de TODOS os locais. Produto com 10 no total (5 na loja + 5 no
  // almoxarifado) passava numa venda de 7 na loja — e o saldo da loja ia para
  // −2. Depois, lá embaixo, o código detectava a falta, montava um aviso
  // "pegue no Almoxarifado" e aplicava a baixa assim mesmo.
  //
  // REGRA NOVA (decisão do Marcio, 15/09/2026): não existe saldo negativo em
  // hipótese alguma. Falta peça no local do caixa, a venda é RECUSADA — com o
  // nome da peça, o local e quanto tem. Se a peça está fisicamente na arara mas
  // não no sistema, alguém esqueceu de registrar a descida do almoxarifado: a
  // mensagem diz isso, e a descida se resolve em Estoques → Transferir.
  const localVenda = estoques.daLoja(db, cx.loja_id);
  const faltas = [];
  for (const i of itens) {
    const v = db.prepare('SELECT estoque FROM variacoes WHERE id=? AND ativo=1').get(i.variacao_id);
    if (!v) return { ok: false, erro: 'Item não encontrado no estoque.' };
    if (!localVenda) {
      // Loja sem estoque próprio: só resta o total geral (comportamento antigo).
      if (v.estoque < i.qtd) return { ok: false, erro: `Estoque insuficiente (disponível: ${v.estoque}).` };
      continue;
    }
    const c = estoques.conferirSaldo(db, localVenda.id, i.variacao_id, i.qtd);
    if (!c.ok) {
      const d = db.prepare(`SELECT pr.nome, va.cor, va.tamanho FROM variacoes va
        JOIN produtos pr ON pr.id = va.produto_id WHERE va.id=?`).get(i.variacao_id);
      const nome = d ? d.nome + (d.cor && d.cor !== 'Única' ? ` (${d.cor}/${d.tamanho})` : '') : 'Peça';
      faltas.push(`${nome}: ${c.saldo} em ${c.nome}, precisa de ${i.qtd}`);
    }
  }
  if (faltas.length) {
    return { ok: false, sem_estoque: true, erro:
      `Sem estoque em ${localVenda.nome}:\n· ${faltas.join('\n· ')}\n\n` +
      'Se a peça está na loja, a descida do Almoxarifado não foi registrada. ' +
      'Registre em Estoques → Transferir e refaça a venda.' };
  }

  db.exec('BEGIN');
  try {
    // Sem cliente identificado, a venda vai para o "Consumidor final"
    // (clientes.generico=1). Ele existe desde a v3.3.0 e é criado na migração.
    let clienteId = p.cliente_id || null;
    if (!clienteId) {
      const gen = db.prepare('SELECT id FROM clientes WHERE generico=1 AND ativo=1 LIMIT 1').get();
      if (gen) clienteId = gen.id;
    }
    // Desconto avulso: quem autorizou e por quê (v3.3.0). Só faz sentido quando
    // houve desconto manual — cortesia tem os campos próprios em venda_pagamentos.
    const descAutor = descontoGeral > 0 ? String(p.desconto_autorizado_por || '').trim() || null : null;
    const descMotivo = descontoGeral > 0 ? String(p.desconto_motivo || '').trim() || null : null;

    // Na venda a custo, quem autorizou e o motivo são obrigatórios e vêm do
    // mesmo par de colunas do desconto avulso — é a mesma natureza de registro.
    const autorFinal  = aCusto ? (String(p.desconto_autorizado_por || '').trim() || null) : descAutor;
    const motivoFinal = aCusto ? (String(p.desconto_motivo || '').trim() || null) : descMotivo;

    const rv = db.prepare(`INSERT INTO vendas (caixa_id, loja_id, cliente_id, usuario_id, subtotal, desconto, total, obs,
                                               desconto_autorizado_por, desconto_motivo, tipo_venda, acrescimo)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(cx.id, cx.loja_id || null, clienteId, quem.id, subtotal,
           arred(descontoGeral + cortesiaTotal), total, p.obs || null,
           autorFinal, motivoFinal, aCusto ? 'custo' : 'normal', acrescimo);
    const vendaId = Number(rv.lastInsertRowid);

    const insItem = db.prepare(`INSERT INTO venda_itens (venda_id, variacao_id, qtd, preco_unit, desconto, total)
                                VALUES (?,?,?,?,?,?)`);
    const updEstoque = db.prepare('UPDATE variacoes SET estoque = estoque - ? WHERE id=?');
    const insMov = db.prepare(`INSERT INTO movimentos_estoque (variacao_id, tipo, qtd, motivo, usuario_id, estoque_id)
                               VALUES (?,?,?,?,?,?)`);
    // A baixa sai do estoque da loja deste caixa (ou do central, se a loja não
    // tiver estoque próprio). A falta JÁ FOI RECUSADA lá em cima (v3.26.0):
    // aqui o saldo é garantido, e `aplicarEstrito` é só a última linha de
    // defesa contra um payload montado à mão por um terminal em rede.
    const local = estoques.daLoja(db, cx.loja_id);
    const localId = local ? local.id : null;
    const avisosEstoque = [];
    // Consignação: fornecedor recebe o CUSTO da peça + X% do LUCRO (venda − custo);
    // a loja fica com o restante do lucro. Tudo discriminado no extrato.
    const infoConsig = db.prepare(`SELECT p.id, p.consignado, p.pct_fornecedor, p.fornecedor_id, p.preco_custo
                                   FROM variacoes v JOIN produtos p ON p.id = v.produto_id WHERE v.id=?`);
    const insConsig = db.prepare(`INSERT INTO consignacoes
      (venda_id, produto_id, fornecedor_id, qtd, valor_venda, valor_custo, pct_fornecedor, valor_fornecedor, valor_loja)
      VALUES (?,?,?,?,?,?,?,?,?)`);
    for (const i of itens) {
      insItem.run(vendaId, i.variacao_id, i.qtd, arred(Number(i.preco_unit)), arred(Number(i.desconto) || 0), i.total);
      updEstoque.run(i.qtd, i.variacao_id);
      insMov.run(i.variacao_id, 'venda', -i.qtd, `Venda #${vendaId}`, quem.id, localId);
      if (localId) estoques.aplicarEstrito(db, localId, i.variacao_id, -i.qtd);
      const pr = infoConsig.get(i.variacao_id);
      if (pr && pr.consignado && pr.fornecedor_id && pr.pct_fornecedor > 0) {
        // O desconto do FECHAMENTO entra na base do repasse (v3.14.0).
        //
        // Até aqui a consignação era gravada com `i.total`, que já é líquido do
        // desconto lançado NA LINHA mas não do desconto dado no total da venda.
        // Resultado: numa venda com 10% de desconto, a loja recebia 10% a menos
        // pela peça e continuava repassando como se tivesse vendido pelo preço
        // cheio — o desconto saía inteiro do lado da loja.
        //
        // Decisão do Marcio (13/08/2026): "ambos, cada qual com seu percentual".
        // Aplicando o mesmo fator da venda ao valor do item, o desconto passa a
        // ser dividido na proporção já combinada com o fornecedor.
        //
        // A CORTESIA fica de fora do fator: nela `total` é zero e o fornecedor
        // continua recebendo o acerto cheio (regra da v2.2.0) — quem dá o
        // brinde é a loja, não ele.
        const baseVenda = arred(subtotal - descontoGeral);
        const fatorDesc = subtotal > 0 ? baseVenda / subtotal : 1;
        const valorConsig = arred(i.total * fatorDesc);
        const custoTotal = arred((Number(pr.preco_custo) || 0) * i.qtd);
        // VENDA A PREÇO DE CUSTO em peça consignada: a venda é exatamente o
        // custo, então o lucro é zero e a conta devolve `custoTotal` ao
        // fornecedor com R$ 0,00 para a loja. É o resultado correto e
        // intencional — vender a custo significa abrir mão da margem, e a
        // margem da peça consignada é justamente a parte da loja. O fornecedor
        // não perde nada: recebe de volta o que a peça vale para ele.
        const lucro = arred(valorConsig - custoTotal);
        const valorForn = arred(custoTotal + lucro * pr.pct_fornecedor / 100);
        insConsig.run(vendaId, pr.id, pr.fornecedor_id, i.qtd, valorConsig, custoTotal,
                      pr.pct_fornecedor, valorForn, arred(valorConsig - valorForn));
      }
    }

    const insPg = db.prepare(`INSERT INTO venda_pagamentos
      (venda_id, forma, valor, parcelas, troco, autorizado_por, beneficiario, cortesia_valor)
      VALUES (?,?,?,?,?,?,?,?)`);
    let trocoRestante = troco;
    for (const pg of pagamentos) {
      // troco sai do pagamento em dinheiro
      const trocoPg = pg.forma === 'dinheiro' ? Math.min(trocoRestante, pg.valor) : 0;
      trocoRestante = arred(trocoRestante - trocoPg);
      insPg.run(vendaId, pg.forma, pg.valor, pg.parcelas, trocoPg,
                pg.autorizado_por || null, pg.beneficiario || null, pg.cortesia_valor || 0);

      if (pg.forma === 'crediario') {
        const n = pg.parcelas;
        const base = Math.floor((pg.valor / n) * 100) / 100;
        let acumulado = 0;
        for (let k = 1; k <= n; k++) {
          const valorParcela = k === n ? arred(pg.valor - acumulado) : base;
          acumulado = arred(acumulado + valorParcela);
          db.prepare(`INSERT INTO crediario_parcelas (venda_id, cliente_id, numero, valor, vencimento)
                      VALUES (?,?,?,?, date('now','localtime','+' || ? || ' days'))`)
            .run(vendaId, p.cliente_id, k, valorParcela, k * 30);
        }
      }
    }

    // consumir vales-troca usados como pagamento
    for (const pg of pagamentos) {
      if (pg.forma === 'vale') {
        const rv = valesTroca.usar(db, { codigo: pg.codigo_vale, valorAplicado: pg.valor, vendaId }, quem);
        if (!rv.ok) { db.exec('ROLLBACK'); return rv; }
      }
    }

    // resgatar pontos (debitar dentro da transação, antes do COMMIT)
    if (p.pontos_resgatar && p.pontos_resgatar > 0 && p.cliente_id) {
      const rd = pontos.debitar(db, {
        clienteId: p.cliente_id, pontos: Math.round(p.pontos_resgatar),
        origem: 'resgate', origemId: vendaId, obs: `Resgate em venda #${vendaId}`
      }, quem);
      if (!rd.ok) { db.exec('ROLLBACK'); return rd; }
    }

    // creditar pontos ao cliente identificado (após resgate para não resgatar e recreditar)
    let pontosGanhos = 0;
    if (p.cliente_id) {
      pontosGanhos = pontos.calcularGanho(db, total);
      if (pontosGanhos > 0) {
        pontos.creditar(db, { clienteId: p.cliente_id, pontos: pontosGanhos, origem: 'venda', origemId: vendaId }, quem);
      }
    }

    db.exec('COMMIT');
    auditar(db, quem, 'venda', `#${vendaId} R$ ${total.toFixed(2)}`);
    const resultado = obterVenda(db, vendaId);
    resultado.pontos_ganhos = pontosGanhos;
    if (avisosEstoque.length) resultado.avisos_estoque = avisosEstoque;
    return resultado;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

function obterVenda(db, id) {
  const venda = db.prepare(`
    SELECT v.*, c.nome AS cliente, u.nome AS vendedor
    FROM vendas v LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN usuarios u ON u.id = v.usuario_id WHERE v.id=?
  `).get(id);
  if (!venda) return { ok: false, erro: 'Venda não encontrada.' };
  const itens = db.prepare(`
    SELECT vi.*, p.nome AS produto, p.referencia, va.cor, va.tamanho, va.codigo_barras
    FROM venda_itens vi JOIN variacoes va ON va.id = vi.variacao_id
    JOIN produtos p ON p.id = va.produto_id WHERE vi.venda_id=?
  `).all(id);
  const pagamentos = db.prepare('SELECT * FROM venda_pagamentos WHERE venda_id=?').all(id);
  const parcelas = db.prepare('SELECT * FROM crediario_parcelas WHERE venda_id=? ORDER BY numero').all(id);
  return { ok: true, venda, itens, pagamentos, parcelas };
}

function listarVendas(db, p) {
  const caixaId = p.caixa_id || (caixaAtual(db).caixa || {}).id;
  if (!caixaId) return { ok: true, vendas: [] };
  const vendas = db.prepare(`
    SELECT v.id, v.total, v.status, v.criado_em, c.nome AS cliente, u.nome AS vendedor,
           (SELECT GROUP_CONCAT(DISTINCT forma) FROM venda_pagamentos WHERE venda_id = v.id) AS formas,
           (SELECT COALESCE(SUM(valor_devolvido),0) FROM devolucoes WHERE venda_id=v.id) AS total_devolvido
    FROM vendas v LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE v.caixa_id = ? ORDER BY v.id DESC
  `).all(caixaId);
  return { ok: true, vendas };
}

function listarVendasGeral(db, p) {
  const dataIni = p.data_inicio || '';
  const dataFim = p.data_fim   || '';
  const termo   = p.termo      || '';
  let sql = `
    SELECT v.id, v.total, v.status, v.criado_em, c.nome AS cliente, u.nome AS vendedor,
           (SELECT GROUP_CONCAT(DISTINCT forma) FROM venda_pagamentos WHERE venda_id = v.id) AS formas,
           (SELECT COALESCE(SUM(valor_devolvido),0) FROM devolucoes WHERE venda_id=v.id) AS total_devolvido
    FROM vendas v LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE v.status != 'cancelada'
  `;
  const params = [];
  if (dataIni) { sql += ' AND DATE(v.criado_em) >= DATE(?)'; params.push(dataIni); }
  if (dataFim)  { sql += ' AND DATE(v.criado_em) <= DATE(?)'; params.push(dataFim); }
  if (termo)    { sql += ' AND (c.nome LIKE ? OR CAST(v.id AS TEXT) = ?)'; params.push('%'+termo+'%', termo); }
  sql += ' ORDER BY v.id DESC LIMIT 200';
  const vendas = db.prepare(sql).all(...params);
  return { ok: true, vendas };
}

function cancelarVenda(db, p, quem) {
  if (!quem || quem.perfil !== 'admin') return { ok: false, erro: 'Apenas administradores cancelam vendas.' };
  const d = obterVenda(db, p.venda_id);
  if (!d.ok) return d;
  if (d.venda.status !== 'concluida') return { ok: false, erro: 'Esta venda não está ativa.' };
  if (d.parcelas.some(x => x.pago_em)) return { ok: false, erro: 'Há parcelas de crediário já pagas.' };

  db.exec('BEGIN');
  try {
    // a peça volta para o mesmo local de onde saiu na venda
    const localCanc = estoques.daLoja(db, d.venda.loja_id);
    for (const i of d.itens) {
      db.prepare('UPDATE variacoes SET estoque = estoque + ? WHERE id=?').run(i.qtd, i.variacao_id);
      db.prepare(`INSERT INTO movimentos_estoque (variacao_id, tipo, qtd, motivo, usuario_id, estoque_id)
                  VALUES (?,?,?,?,?,?)`)
        .run(i.variacao_id, 'devolucao', i.qtd, `Cancelamento venda #${d.venda.id}: ${p.motivo || ''}`,
             quem.id, localCanc ? localCanc.id : null);
      if (localCanc) estoques.aplicar(db, localCanc.id, i.variacao_id, i.qtd);
    }
    db.prepare('DELETE FROM crediario_parcelas WHERE venda_id=?').run(d.venda.id);
    db.prepare("UPDATE consignacoes SET status='cancelado' WHERE venda_id=? AND status='pendente'").run(d.venda.id);
    db.prepare("UPDATE vendas SET status='cancelada', obs = COALESCE(obs,'') || ' [CANCELADA: ' || ? || ']' WHERE id=?")
      .run(p.motivo || 'sem motivo', d.venda.id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  auditar(db, quem, 'venda_cancelada', `#${d.venda.id} ${p.motivo || ''}`);
  return { ok: true };
}

export {
  caixaAtual, abrirCaixa, trocarLoja, movimentoCaixa, resumoCaixa, fecharCaixa,
  registrarVenda, obterVenda, listarVendas, listarVendasGeral, cancelarVenda
};