// Códigos de barras internos (v3.35.2)
//
// O PROBLEMA QUE ISTO RESOLVE: o código interno era o número da variação
// (codigoInterno(id)). Quando um banco mais antigo é restaurado, o banco volta
// a contar a partir do último número que ele conhecia — e os próximos produtos
// recebem números que JÁ estavam impressos em etiquetas de peças cadastradas
// no período perdido. Foi o que aconteceu depois da restauração de 25/10: o
// backup de 23/10 13:52 ia até a variação 600, e as variações 601 em diante
// ganharam de novo os códigos 2000000006017… já colados em outras roupas.
//
// A REGRA NOVA:
//   1. O código não depende mais do número da variação. Sai de um contador
//      próprio que só sobe, começando em 10000 (bem longe dos códigos antigos).
//   2. O contador é guardado em DOIS lugares: no banco (config codigo_seq) e num
//      arquivo fora do banco (dados/codigos-maior.txt). Restaurar um banco
//      antigo volta o do banco, mas não o do arquivo — e vale o MAIOR.
//   3. Mesmo formato de sempre: EAN-13 interno começando em 2. Um código por
//      variação (cor + tamanho). A etiqueta continua igual.
//
// A CORREÇÃO ÚNICA (migrarPosRestauracao): as variações criadas depois da
// restauração (número > 600) que ainda têm o código automático antigo recebem
// um código novo do contador. Os códigos antigos ficam "aposentados": bipar
// uma etiqueta antiga avisa em vez de vender a peça errada. A lista do que
// mudou fica guardada para a tela "Etiquetas a trocar".
import { codigoInterno, dvEan13, auditar } from './util.js';

export const SEQ_INICIAL = 10000;
// Maior variação do backup de 23/10 13:52 usado na restauração (provado no
// banco restaurado: MAX(id) = 600). Tudo acima disso nasceu depois dela.
export const LIMITE_RESTAURACAO = 600;
export const MIGR_CHAVE = 'migr_codigos_v3352';
const CH_SEQ = 'codigo_seq';
const CH_LISTA = 'codigos_trocados';
const CH_CONFERIDAS = 'etiquetas_trocadas';

let _marcaExterna = 0;
// Valor lido de dados/codigos-maior.txt no boot (sobrevive a restauração)
export function definirMarcaExterna(n) { _marcaExterna = Math.max(_marcaExterna, Number(n) || 0); }
// Só para os testes simularem "app reaberto" (no app, restaurar reinicia tudo)
export function _zerarMarcaTeste() { _marcaExterna = 0; }

function lerCfg(db, chave) {
  const r = db.prepare('SELECT valor FROM config WHERE chave=?').get(chave);
  return r ? r.valor : null;
}
function gravarCfg(db, chave, valor) {
  db.prepare('INSERT OR REPLACE INTO config (chave, valor) VALUES (?,?)').run(chave, String(valor));
}
function lerJson(db, chave, padrao) {
  try { const v = JSON.parse(lerCfg(db, chave) || 'null'); return v == null ? padrao : v; }
  catch { return padrao; }
}

// Número sequencial de um código interno válido (2 + 11 dígitos + DV), ou null
export function seqDoCodigo(codigo) {
  const c = String(codigo || '').trim();
  if (!/^2\d{12}$/.test(c)) return null;
  if (dvEan13(c.slice(0, 12)) !== c[12]) return null;
  return Number(c.slice(1, 12));
}

export function maiorSeqNoBanco(db) {
  let maior = 0;
  const linhas = db.prepare("SELECT codigo_barras FROM variacoes WHERE codigo_barras LIKE '2%' AND length(codigo_barras)=13").all();
  for (const l of linhas) {
    const s = seqDoCodigo(l.codigo_barras);
    if (s != null && s > maior) maior = s;
  }
  return maior;
}

// Último número já usado: o maior entre banco, config, arquivo externo e 10000
export function seqAtual(db) {
  return Math.max(SEQ_INICIAL, Number(lerCfg(db, CH_SEQ)) || 0, maiorSeqNoBanco(db), _marcaExterna);
}

// Próximo código livre. Grava o contador no banco (o servidor grava o arquivo).
export function proximoCodigo(db) {
  let seq = seqAtual(db) + 1;
  const existe = db.prepare('SELECT 1 AS x FROM variacoes WHERE codigo_barras=?');
  while (existe.get(codigoInterno(seq))) seq++;
  gravarCfg(db, CH_SEQ, seq);
  _marcaExterna = Math.max(_marcaExterna, seq);
  return codigoInterno(seq);
}

// Correção única das variações nascidas depois da restauração.
// `mapaConhecido` = lista gravada no arquivo dados/codigos-trocados.json. Se um
// banco antigo (sem a correção) for restaurado, a MESMA troca é refeita — as
// etiquetas novas já impressas continuam valendo. Sem isso o boot sortearia
// códigos novos de novo e as etiquetas reimpressas deixariam de bater.
export function migrarPosRestauracao(db, usuario, mapaConhecido) {
  if (lerCfg(db, MIGR_CHAVE)) return { ok: true, ja: true, trocados: lerJson(db, CH_LISTA, []) };
  const lista = [];
  db.exec('BEGIN');
  try {
    if (Array.isArray(mapaConhecido) && mapaConhecido.length) {
      const ver = db.prepare('SELECT codigo_barras FROM variacoes WHERE id=?');
      const livre = db.prepare('SELECT id FROM variacoes WHERE codigo_barras=?');
      for (const m of mapaConhecido) {
        const v = ver.get(m.variacao_id);
        if (!v || v.codigo_barras !== m.antigo) continue;
        const ocup = livre.get(m.novo);
        if (ocup && ocup.id !== m.variacao_id) continue;
        db.prepare('UPDATE variacoes SET codigo_barras=? WHERE id=?').run(m.novo, m.variacao_id);
        lista.push({ variacao_id: m.variacao_id, antigo: m.antigo, novo: m.novo });
      }
      const maior = Math.max(...mapaConhecido.map(m => seqDoCodigo(m.novo) || 0));
      if (maior > (Number(lerCfg(db, CH_SEQ)) || 0)) gravarCfg(db, CH_SEQ, maior);
    } else {
      const cands = db.prepare('SELECT id, codigo_barras FROM variacoes WHERE id > ? ORDER BY id').all(LIMITE_RESTAURACAO);
      for (const v of cands) {
        if (v.codigo_barras !== codigoInterno(v.id)) continue;   // código digitado/de fornecedor: não mexe
        const novo = proximoCodigo(db);
        db.prepare('UPDATE variacoes SET codigo_barras=? WHERE id=?').run(novo, v.id);
        lista.push({ variacao_id: v.id, antigo: v.codigo_barras, novo });
      }
    }
    gravarCfg(db, CH_LISTA, JSON.stringify(lista));
    gravarCfg(db, MIGR_CHAVE, new Date().toISOString());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return { ok: false, erro: e.message };
  }
  if (lista.length) {
    try { auditar(db, usuario || null, 'codigos.recodificar', `${lista.length} variação(ões) com código novo (pós-restauração)`); } catch { /* */ }
  }
  return { ok: true, ja: false, trocados: lista };
}

export function listaTrocados(db) { return lerJson(db, CH_LISTA, []); }

// Código antigo aposentado? (etiqueta que não vale mais)
export function codigoAposentado(db, termo) {
  const t = String(termo || '').trim();
  if (!/^\d{13}$/.test(t)) return null;
  const m = listaTrocados(db).find(x => x.antigo === t);
  if (!m) return null;
  // se algum produto tiver esse código hoje, ele vale (não é aposentado)
  if (db.prepare('SELECT 1 AS x FROM variacoes WHERE codigo_barras=?').get(t)) return null;
  return { antigo: m.antigo };
}

// Lista de etiquetas para trocar, por local, quantidade = saldo do local.
// Nem a mais nem a menos: só peças com saldo > 0 em variações ativas.
export function etiquetasATrocar(db) {
  const trocados = listaTrocados(db);
  const conferidas = lerJson(db, CH_CONFERIDAS, {});
  if (!trocados.length) return { ok: true, locais: [], total: 0, variacoes: 0, trocados: 0, conferidas: 0 };
  const porVar = new Map(trocados.map(t => [t.variacao_id, t]));
  const ids = [...porVar.keys()];
  const marcas = ids.map(() => '?').join(',');
  const linhas = db.prepare(`
    SELECT s.estoque_id, e.nome AS local, e.principal, s.variacao_id, s.qtd,
           v.cor, v.tamanho, v.codigo_barras, p.id AS produto_id, p.nome AS produto,
           p.referencia, p.preco_venda
      FROM estoque_saldos s
      JOIN estoques e ON e.id = s.estoque_id
      JOIN variacoes v ON v.id = s.variacao_id
      JOIN produtos p ON p.id = v.produto_id
     WHERE s.variacao_id IN (${marcas}) AND s.qtd > 0 AND v.ativo = 1
     ORDER BY e.principal DESC, e.nome, p.nome, v.cor, v.tamanho
  `).all(...ids);
  const locais = new Map();
  let total = 0, nConf = 0;
  const varsComSaldo = new Set();
  for (const l of linhas) {
    if (!locais.has(l.estoque_id)) locais.set(l.estoque_id, { estoque_id: l.estoque_id, nome: l.local, itens: [], pecas: 0, conferidas: 0 });
    const loc = locais.get(l.estoque_id);
    const qtd = Math.round(Number(l.qtd) || 0);
    if (qtd <= 0) continue;
    const t = porVar.get(l.variacao_id);
    const conf = !!conferidas[`${l.estoque_id}:${l.variacao_id}`];
    loc.itens.push({
      variacao_id: l.variacao_id, produto_id: l.produto_id, produto: l.produto, referencia: l.referencia,
      preco_venda: l.preco_venda, cor: l.cor, tamanho: l.tamanho, qtd,
      codigo_antigo: t.antigo, codigo_barras: l.codigo_barras, conferida: conf
    });
    loc.pecas += qtd; total += qtd;
    if (conf) { loc.conferidas += qtd; nConf += qtd; }
    varsComSaldo.add(l.variacao_id);
  }
  return { ok: true, locais: [...locais.values()].filter(l => l.itens.length), total,
           variacoes: varsComSaldo.size, trocados: trocados.length, conferidas: nConf };
}

// Marca/desmarca "etiqueta já trocada" de uma variação num local
export function marcarEtiquetaTrocada(db, p) {
  const chave = `${Number(p.estoque_id)}:${Number(p.variacao_id)}`;
  const mapa = lerJson(db, CH_CONFERIDAS, {});
  if (p.feito) mapa[chave] = new Date().toISOString(); else delete mapa[chave];
  gravarCfg(db, CH_CONFERIDAS, JSON.stringify(mapa));
  return { ok: true };
}
