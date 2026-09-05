// Importação de vendas anotadas fora do PDV (v3.25.40).
//
// As vendas do WhatsApp são anotadas numa planilha ao longo do dia e depois
// digitadas uma a uma no PDV. Este módulo lê a planilha já convertida em linhas
// (o front usa o xlsx que o app carrega) e grava tudo de uma vez.
//
// FORMATO: uma linha por ITEM. A coluna "Venda" agrupa itens da mesma venda —
// duas linhas com "Venda" = 1 são duas peças no mesmo pedido. Cliente, forma de
// pagamento e observação são lidos da PRIMEIRA linha de cada grupo.
//
// SEMPRE em dois tempos: `analisar()` confere tudo e devolve o que daria erro,
// `confirmar()` grava. Sem isso uma planilha com um código errado gravaria meia
// importação e deixaria o estoque torto.
import { auditar } from './util.js';
import * as estoques from './estoques.js';

const arred = (n) => Math.round((Number(n) || 0) * 100) / 100;
const FORMAS = ['dinheiro', 'pix', 'debito', 'credito', 'crediario', 'vale', 'cortesia'];

// Cabeçalhos aceitos → campo interno. Sem acento e minúsculo, porque cada um
// digita de um jeito ("Cód. barras", "codigo de barras", "CODIGO").
const COLUNAS = {
  venda: 'venda', pedido: 'venda', 'n venda': 'venda', 'numero da venda': 'venda',
  data: 'data',
  cliente: 'cliente', nome: 'cliente', 'nome da cliente': 'cliente',
  telefone: 'telefone', 'whatsapp': 'telefone', 'celular': 'telefone',
  'codigo de barras': 'codigo_barras', 'codigo': 'codigo_barras',
  'cod barras': 'codigo_barras', 'cod de barras': 'codigo_barras', 'ean': 'codigo_barras',
  produto: 'produto', 'nome do produto': 'produto', descricao: 'produto',
  referencia: 'referencia', ref: 'referencia',
  cor: 'cor', tamanho: 'tamanho', tam: 'tamanho',
  qtd: 'qtd', quantidade: 'qtd', qtde: 'qtd',
  'preco unit': 'preco_unit', 'preco unitario': 'preco_unit', preco: 'preco_unit',
  'valor unit': 'preco_unit', 'valor unitario': 'preco_unit',
  desconto: 'desconto', 'desconto rs': 'desconto',
  'forma de pagamento': 'forma', pagamento: 'forma', forma: 'forma',
  observacao: 'obs', obs: 'obs', observacoes: 'obs',
};

const APELIDO_FORMA = {
  dinheiro: 'dinheiro', 'espécie': 'dinheiro', especie: 'dinheiro',
  pix: 'pix',
  debito: 'debito', 'cartao debito': 'debito', 'cartao de debito': 'debito', 'db': 'debito',
  credito: 'credito', 'cartao credito': 'credito', 'cartao de credito': 'credito', 'cd': 'credito',
  crediario: 'crediario', fiado: 'crediario', 'a prazo': 'crediario',
  vale: 'vale', cortesia: 'cortesia', brinde: 'cortesia',
};

const limpar = (v) => String(v == null ? '' : v).trim();
const chave  = (v) => limpar(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// "1.234,56" e "1234.56" viram 1234.56. Planilha brasileira mistura os dois.
function numero(v) {
  if (typeof v === 'number') return v;
  let t = limpar(v).replace(/[R$\s]/g, '');
  if (!t) return 0;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

// Renomeia as chaves da linha crua para os campos internos.
function normalizarLinha(bruta) {
  const out = {};
  for (const [k, v] of Object.entries(bruta || {})) {
    const campo = COLUNAS[chave(k)];
    if (campo && limpar(v) !== '') out[campo] = v;
  }
  return out;
}

// Acha a variação por código de barras (preferido) ou por produto+cor+tamanho.
function acharVariacao(db, l) {
  const cod = limpar(l.codigo_barras);
  if (cod) {
    const v = db.prepare(`
      SELECT va.id, va.estoque, va.cor, va.tamanho, pr.nome AS produto, pr.preco_venda
      FROM variacoes va JOIN produtos pr ON pr.id = va.produto_id
      WHERE va.codigo_barras = ? AND va.ativo = 1 AND pr.ativo = 1 LIMIT 1
    `).get(cod);
    if (v) return { v };
    return { erro: `Código de barras "${cod}" não existe no cadastro.` };
  }

  const nome = limpar(l.produto), ref = limpar(l.referencia);
  if (!nome && !ref) return { erro: 'Sem código de barras nem nome do produto.' };

  const cands = db.prepare(`
    SELECT va.id, va.estoque, va.cor, va.tamanho, pr.nome AS produto, pr.preco_venda
    FROM variacoes va JOIN produtos pr ON pr.id = va.produto_id
    WHERE va.ativo = 1 AND pr.ativo = 1
      AND (${ref ? 'pr.referencia = ?' : 'pr.nome = ?'})
  `).all(ref || nome);

  if (!cands.length) return { erro: `Produto "${ref || nome}" não encontrado no cadastro.` };

  const cor = chave(l.cor), tam = chave(l.tamanho);
  let lista = cands;
  if (cor) lista = lista.filter(v => chave(v.cor) === cor);
  if (tam) lista = lista.filter(v => chave(v.tamanho) === tam);

  if (lista.length === 1) return { v: lista[0] };
  if (!lista.length) return { erro: `"${ref || nome}" existe, mas não na cor/tamanho informados.` };
  return { erro: `"${ref || nome}" tem ${lista.length} variações — informe cor e tamanho, ou o código de barras.` };
}

function acharCliente(db, l) {
  const tel = limpar(l.telefone).replace(/\D/g, '');
  if (tel.length >= 8) {
    const c = db.prepare(
      "SELECT id, nome FROM clientes WHERE REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(telefone,''),'(',''),')',''),'-',''),' ','') LIKE ?"
    ).get('%' + tel.slice(-8));
    if (c) return c;
  }
  const nome = limpar(l.cliente);
  if (nome) {
    const c = db.prepare('SELECT id, nome FROM clientes WHERE nome = ? COLLATE NOCASE LIMIT 1').get(nome);
    if (c) return c;
  }
  return null;
}

// Agrupa as linhas por venda e confere tudo. NÃO grava nada.
function analisar(db, p) {
  const linhas = Array.isArray(p && p.linhas) ? p.linhas : [];
  if (!linhas.length) return { ok: false, erro: 'A planilha está vazia.' };

  const grupos = new Map();
  linhas.forEach((bruta, ix) => {
    const l = normalizarLinha(bruta);
    // Linha em branco (só formatação da planilha) é ignorada, não vira erro.
    if (!limpar(l.codigo_barras) && !limpar(l.produto) && !limpar(l.referencia)) return;
    const ref = limpar(l.venda) || `linha ${ix + 2}`;  // sem coluna Venda: 1 venda por linha
    if (!grupos.has(ref)) grupos.set(ref, { ref, linhas: [] });
    grupos.get(ref).linhas.push({ ...l, _linha: ix + 2 });
  });
  if (!grupos.size) return { ok: false, erro: 'Nenhuma linha com produto na planilha.' };

  const vendas = [];
  for (const g of grupos.values()) {
    const cab = g.linhas[0];
    const cliente = acharCliente(db, cab);
    const formaBruta = chave(cab.forma);
    const forma = APELIDO_FORMA[formaBruta] || (FORMAS.includes(formaBruta) ? formaBruta : null);

    const itens = [];
    const erros = [];
    if (cab.forma && !forma) {
      erros.push(`Forma de pagamento "${limpar(cab.forma)}" não é aceita (use dinheiro, pix, débito, crédito, crediário).`);
    }

    for (const l of g.linhas) {
      const { v, erro } = acharVariacao(db, l);
      if (erro) { erros.push(`Linha ${l._linha}: ${erro}`); continue; }
      const qtd = Math.round(numero(l.qtd) || 1);
      if (qtd <= 0) { erros.push(`Linha ${l._linha}: quantidade inválida.`); continue; }
      if (v.estoque < qtd) {
        erros.push(`Linha ${l._linha}: ${v.produto} — estoque insuficiente (tem ${v.estoque}, pedido ${qtd}).`);
        continue;
      }
      const preco = l.preco_unit != null ? arred(numero(l.preco_unit)) : arred(v.preco_venda || 0);
      const desc  = arred(numero(l.desconto));
      const bruto = arred(qtd * preco);
      if (desc > bruto) { erros.push(`Linha ${l._linha}: desconto maior que o valor do item.`); continue; }
      itens.push({
        variacao_id: v.id, produto: v.produto, cor: v.cor, tamanho: v.tamanho,
        qtd, preco_unit: preco, desconto: desc, total: arred(bruto - desc), linha: l._linha,
      });
    }

    const subtotal = arred(itens.reduce((s, i) => s + i.qtd * i.preco_unit, 0));
    const desconto = arred(itens.reduce((s, i) => s + i.desconto, 0));
    vendas.push({
      ref: g.ref,
      cliente_id: cliente ? cliente.id : null,
      cliente: cliente ? cliente.nome : (limpar(cab.cliente) || null),
      cliente_novo: !cliente && !!limpar(cab.cliente),
      forma: forma || 'dinheiro',
      obs: limpar(cab.obs) || null,
      itens, erros,
      subtotal, desconto, total: arred(subtotal - desconto),
      pode: itens.length > 0 && erros.length === 0,
    });
  }

  const prontas = vendas.filter(v => v.pode);
  return {
    ok: true,
    vendas,
    resumo: {
      vendas: vendas.length,
      prontas: prontas.length,
      com_erro: vendas.length - prontas.length,
      pecas: prontas.reduce((s, v) => s + v.itens.reduce((a, i) => a + i.qtd, 0), 0),
      total: arred(prontas.reduce((s, v) => s + v.total, 0)),
    },
  };
}

// Grava as vendas que passaram na análise. Reanalisa antes de gravar: entre a
// conferência na tela e o clique em confirmar, o estoque pode ter mudado (outro
// terminal vendeu a mesma peça).
function confirmar(db, p, quem) {
  const a = analisar(db, p);
  if (!a.ok) return a;
  const prontas = a.vendas.filter(v => v.pode);
  if (!prontas.length) return { ok: false, erro: 'Nenhuma venda pronta para importar. Corrija a planilha e tente de novo.' };

  const caixa = db.prepare(
    'SELECT id, loja_id FROM caixas WHERE fechado_em IS NULL ORDER BY id DESC LIMIT 1'
  ).get();
  if (!caixa) return { ok: false, erro: 'Nenhum caixa aberto. Abra o caixa antes de importar.' };

  // Loja escolhida na tela (a do WhatsApp) ou, se não vier, a do caixa.
  const lojaId = Number(p.loja_id) || caixa.loja_id || null;
  if (Number(p.loja_id)) {
    const l = db.prepare('SELECT id FROM lojas WHERE id=? AND ativo=1').get(Number(p.loja_id));
    if (!l) return { ok: false, erro: 'Loja inválida ou inativa.' };
  }
  const local = estoques.daLoja(db, lojaId);
  const localId = local ? local.id : null;

  db.exec('BEGIN');
  try {
    const insVenda = db.prepare(`
      INSERT INTO vendas (caixa_id, loja_id, cliente_id, usuario_id, subtotal, desconto, total, obs, status)
      VALUES (?,?,?,?,?,?,?,?,'concluida')`);
    const insItem = db.prepare(
      'INSERT INTO venda_itens (venda_id, variacao_id, qtd, preco_unit, desconto, total) VALUES (?,?,?,?,?,?)');
    const insPag = db.prepare(
      'INSERT INTO venda_pagamentos (venda_id, forma, valor, parcelas, troco) VALUES (?,?,?,?,0)');
    const insMov = db.prepare(
      'INSERT INTO movimentos_estoque (variacao_id, tipo, qtd, motivo, usuario_id, estoque_id) VALUES (?,?,?,?,?,?)');
    const baixa = db.prepare('UPDATE variacoes SET estoque=estoque-? WHERE id=?');

    const criadas = [];
    for (const v of prontas) {
      const obs = [`Importado da planilha (${v.ref})`, v.obs,
                   !v.cliente_id && v.cliente ? `Cliente: ${v.cliente}` : null]
        .filter(Boolean).join(' · ');
      const rv = insVenda.run(caixa.id, lojaId, v.cliente_id, quem?.id || null,
                              v.subtotal, v.desconto, v.total, obs);
      const vendaId = Number(rv.lastInsertRowid);
      for (const i of v.itens) {
        insItem.run(vendaId, i.variacao_id, i.qtd, i.preco_unit, i.desconto, i.total);
        baixa.run(i.qtd, i.variacao_id);
        insMov.run(i.variacao_id, 'venda', -i.qtd, `Venda importada #${vendaId}`, quem?.id || null, localId);
        if (localId) estoques.aplicar(db, localId, i.variacao_id, -i.qtd);
      }
      if (v.total > 0) insPag.run(vendaId, v.forma, v.total, 1);
      criadas.push({ ref: v.ref, venda_id: vendaId, total: v.total });
    }

    db.exec('COMMIT');
    auditar(db, quem, 'vendas_importadas',
      `${criadas.length} venda(s) · ${a.resumo.pecas} peça(s) · R$ ${a.resumo.total.toFixed(2)}`);
    return {
      ok: true, criadas,
      resumo: { vendas: criadas.length, pecas: a.resumo.pecas, total: a.resumo.total },
      ignoradas: a.vendas.filter(v => !v.pode).map(v => ({ ref: v.ref, erros: v.erros })),
    };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export { analisar, confirmar, COLUNAS };
