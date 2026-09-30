// Ajuste fino da impressão do cupom (v3.27.0)
// ---------------------------------------------------------------------------
// Até aqui as medidas do cupom viviam em dois lugares diferentes e com valores
// diferentes:
//   • impressão SILENCIOSA (computador principal, backend/servidor.js):
//     body 76mm, folga de 4mm à esquerda e 5mm à direita — sai certo.
//   • impressão pelo DIÁLOGO (terminal em rede, window.print + app.css):
//     @page 80mm e .cupom 72mm, SEM folga nenhuma — o conteúdo encostava na
//     borda física da térmica e a coluna da direita saía cortada.
// Agora as duas usam as MESMAS medidas, que passam a ser editáveis em
// Configurações → Impressoras, sem depender de versão nova do app.
//
// Guardado em dois níveis:
//   1. Padrão da loja  → tabela config (vale para todo mundo)
//   2. Só nesta máquina → localStorage do próprio terminal (vence o padrão)
// O nível 2 existe porque cada terminal pode ter uma térmica de modelo
// diferente: o caixa acerta a dele sem desregular a do estoque.
// ---------------------------------------------------------------------------

const PADRAO = { papel: 80, largura: 76, margem: 2, esq: 4, dir: 5, fonte: 11 };

// Limites de segurança — evita salvar um valor que simplesmente não imprime.
const LIMITES = {
  papel:   [40, 120],
  largura: [30, 120],
  margem:  [0, 10],
  esq:     [0, 20],
  dir:     [0, 20],
  fonte:   [7, 20]
};

const CHAVE_LOCAL = 'salg_ajuste_cupom';

function num(v, padrao, faixa) {
  // Vazio/ausente NÃO é zero: Number('') dá 0 e isso viraria uma medida
  // mínima em vez do padrão. Só converte quando há mesmo algo escrito.
  if (v == null || String(v).trim() === '') return padrao;
  const n = Number(String(v).replace(',', '.'));
  if (!isFinite(n)) return padrao;
  if (!faixa) return n;
  return Math.min(faixa[1], Math.max(faixa[0], n));
}

// Ajuste gravado só nesta máquina (null = seguir o padrão da loja).
function lerAjusteLocal() {
  try {
    const bruto = localStorage.getItem(CHAVE_LOCAL);
    if (!bruto) return null;
    const o = JSON.parse(bruto);
    return o && typeof o === 'object' ? o : null;
  } catch (_) { return null; }
}

// obj = null apaga o ajuste local e volta a valer o padrão da loja.
function salvarAjusteLocal(obj) {
  try {
    if (obj) localStorage.setItem(CHAVE_LOCAL, JSON.stringify(obj));
    else localStorage.removeItem(CHAVE_LOCAL);
    return true;
  } catch (_) { return false; }
}

// Medidas do padrão da loja (o que está salvo na config).
function medidasDaLoja(cfg) {
  const c = cfg || {};
  return {
    papel:   num(c.cupom_papel_mm,   PADRAO.papel,   LIMITES.papel),
    largura: num(c.cupom_largura_mm, PADRAO.largura, LIMITES.largura),
    margem:  num(c.cupom_margem_mm,  PADRAO.margem,  LIMITES.margem),
    esq:     num(c.cupom_esq_mm,     PADRAO.esq,     LIMITES.esq),
    dir:     num(c.cupom_dir_mm,     PADRAO.dir,     LIMITES.dir),
    fonte:   num(c.cupom_fonte_px,   PADRAO.fonte,   LIMITES.fonte)
  };
}

// Medidas que valem AGORA nesta máquina: padrão da loja + ajuste local, se houver.
function medidasAtivas(cfg) {
  const base = medidasDaLoja(cfg);
  const loc = lerAjusteLocal();
  if (!loc) return base;
  const m = { ...base };
  for (const k of Object.keys(PADRAO)) {
    if (loc[k] != null && loc[k] !== '') m[k] = num(loc[k], base[k], LIMITES[k]);
  }
  return m;
}

// CSS usado pela impressão silenciosa (arquivo HTML temporário) — o servidor
// monta o documento do zero, então aqui vai o corpo inteiro.
function cssCupomArquivo(m) {
  return '*{box-sizing:border-box;margin:0;padding:0}'
    + `body{background:#fff;width:${m.largura}mm;padding-left:${m.esq}mm;padding-right:${m.dir}mm}`
    + `@page{size:${m.papel}mm auto;margin:${m.margem}mm}`
    + `.cupom{width:100%;font-family:Consolas,'Courier New',monospace;font-size:${m.fonte}px;color:#000;word-break:break-word}`
    + '.cupom table{width:100%;border-collapse:collapse}'
    + `.cupom td{padding:1px 0;border:none;font-size:${m.fonte}px;vertical-align:top}`
    + '.cupom .c-centro{text-align:center}'
    + '.cupom .c-sep{border-top:1px dashed #000;margin:5px 0}'
    + '.cupom b{font-weight:700}';
}

// CSS injetado na própria página, para a impressão pelo diálogo (terminal em
// rede e também o app quando não há impressora silenciosa configurada).
// Fica de propósito preso ao `.cupom`: relatório e etiqueta não são afetados.
function cssCupomTela(m) {
  return `@page{size:${m.papel}mm auto;margin:${m.margem}mm}
@media print{
  .cupom{
    width:${m.largura}mm;
    padding-left:${m.esq}mm;
    padding-right:${m.dir}mm;
    box-sizing:border-box;
    font-size:${m.fonte}px;
    word-break:break-word;
  }
  .cupom td{font-size:${m.fonte}px;vertical-align:top}
}`;
}

// Injeta/atualiza o <style> de impressão. Entra DEPOIS do app.css, então
// prevalece sobre o @page fixo de lá sem precisar editar o CSS do sistema.
function aplicarEstiloImpressao(cfg) {
  const m = medidasAtivas(cfg);
  let st = document.getElementById('estilo-impressao');
  if (!st) {
    st = document.createElement('style');
    st.id = 'estilo-impressao';
    document.head.appendChild(st);
  }
  st.textContent = cssCupomTela(m);
  return m;
}

// ── Documento em folha A4 (v3.29.1) ─────────────────────────────────────────
// Ponto ÚNICO de impressão de documento: balanço de estoque, relatórios,
// ranking e romaneio passam por aqui.
//
// POR QUE EXISTE: o `app.css` esconde `#app` inteiro na impressão e tem
// `@page { size: 80mm auto }` global (é do cupom). Quem chamava `window.print()`
// direto na tela recebia FOLHA EM BRANCO (balanço de estoque) ou uma página
// estreita de cupom (relatório/ranking/romaneio). Aqui o documento vai para uma
// área própria, só ela aparece na impressão, e a página é A4.
function imprimirFolhaA4(area, { paisagem = false, margem = '12mm' } = {}) {
  if (!area.id) area.id = 'area-folha-a4';
  document.getElementById('estilo-folha-a4')?.remove();
  const st = document.createElement('style');
  st.id = 'estilo-folha-a4';
  st.textContent = `#${area.id}{display:none}
@page{size:A4 ${paisagem ? 'landscape' : 'portrait'};margin:${margem}}
@media print{
  body > *:not(#${area.id}){display:none !important}
  #${area.id}{display:block !important;position:static !important;width:auto !important}
  html,body{background:#fff !important;height:auto !important;overflow:visible !important}
}`;
  // Entra por ÚLTIMO no <head>: vence o @page do cupom (app.css e estilo-impressao).
  document.head.appendChild(st);
  if (!area.isConnected) document.body.appendChild(area);
  let feito = false;
  const limpar = () => {
    if (feito) return;
    feito = true;
    window.removeEventListener('afterprint', limpar);
    st.remove(); area.remove();
  };
  window.addEventListener('afterprint', limpar);
  window.print();
  // Segurança: se o `afterprint` não vier, limpa depois (a prévia já foi feita).
  setTimeout(limpar, 60000);
}

export {
  imprimirFolhaA4,
  PADRAO, LIMITES,
  lerAjusteLocal, salvarAjusteLocal,
  medidasDaLoja, medidasAtivas,
  cssCupomArquivo, cssCupomTela,
  aplicarEstiloImpressao
};
