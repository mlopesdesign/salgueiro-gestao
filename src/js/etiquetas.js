// Impressão de etiquetas em lote — código de barras (EAN-13) ou QR Code
import { api, el, esc, moeda, toast, modal, getConfig, EM_REDE } from './app.js';
import { ean13Svg } from './estoque.js';
import { qrSvg } from './vendor/qrcode.js';
/* global Neutralino, NL_PATH */

// CSS da etiqueta 60×40mm (sincronizar com cssEtq em servidor.js)
// Layout: esquerda=nome/cor/barcode · direita=badge tamanho em destaque
const CSS_ETQ = `*{box-sizing:border-box;margin:0;padding:0}@page{size:60mm 40mm;margin:0}body{background:#fff}.etq-grid{display:flex;flex-direction:column}.etiqueta{width:60mm;height:40mm;padding:2mm 2mm 2mm 5mm;font-family:Arial,Helvetica,sans-serif;overflow:hidden;display:flex;flex-direction:row;gap:2mm;page-break-after:always;break-after:page}.et-left{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}.et-nome{font-size:13px;font-weight:700;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex-shrink:0}.et-cor,.et-info{font-size:11px;color:#000;margin-top:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}.et-ref{font-size:9px;color:#555;margin-top:.5mm;flex-shrink:0}.et-preco{font-size:12px;font-weight:700;margin-top:1mm;flex-shrink:0}.et-bc-wrap{margin-top:auto;flex-shrink:0}.et-bc-wrap>svg{width:100%;max-width:35mm;height:10mm;display:block}.et-bc-wrap .qrbox{display:flex}.et-bc-wrap .qrbox svg{width:14mm;height:14mm}.et-num{font-family:Consolas,monospace;font-size:7px;letter-spacing:.03em;margin-top:.5mm}.et-right{width:15mm;flex-shrink:0;display:flex;align-items:center;justify-content:center}.et-tam-badge{width:13mm;height:26mm;border:2px solid #000;border-radius:2.5mm;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;line-height:1;text-align:center;word-break:break-all;overflow:hidden}`;

// itens: [{ produto, variacoes: [...] }, ...]
export function abrirEtiquetasLote(itens) {
  if (!itens || !itens.length) { toast('Selecione ao menos um produto.', true); return; }
  const totalVar = itens.reduce((s, it) => s + it.variacoes.length, 0);
  const totalEstoque = itens.reduce((s, it) =>
    s + it.variacoes.reduce((a, v) => a + Math.max(0, Math.round(v.estoque)), 0), 0);

  const corpo = `
    <p style="margin-bottom:14px">Etiquetas para <b>${itens.length} produto(s)</b> · ${totalVar} variação(ões).</p>
    <div class="linha-2">
      <div class="campo"><label>Tipo de código</label>
        <select id="et-tipo">
          <option value="barras">Código de barras (EAN-13)</option>
          <option value="qr">QR Code</option>
        </select></div>
      <div class="campo"><label>Quantidade de etiquetas</label>
        <select id="et-qtd">
          <option value="estoque">1 por peça em estoque (${totalEstoque})</option>
          <option value="variacao">1 por variação (${totalVar})</option>
          <option value="fixa">Quantidade fixa por variação…</option>
        </select></div>
    </div>
    <div class="campo" id="et-fixa-wrap" style="display:none;max-width:220px">
      <label>Etiquetas por variação</label>
      <input id="et-fixa" type="number" min="1" value="1">
    </div>
    <div class="campo"><label>Mostrar na etiqueta</label>
      <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:4px">
        <label class="chk-inline"><input type="checkbox" id="et-preco"> Preço</label>
        <label class="chk-inline"><input type="checkbox" id="et-ref" checked> Referência</label>
        <label class="chk-inline"><input type="checkbox" id="et-var" checked> Cor / Tamanho</label>
      </div>
    </div>
    <p class="dica-qr" style="display:none;color:var(--texto-suave);font-size:12px;margin-top:6px">
      ⚠️ O QR Code só é lido por leitores 2D (de imagem). Leitores de laser comuns leem apenas código de barras.</p>
    <div class="erro" id="et-erro"></div>`;

  const m = modal('Imprimir etiquetas em lote', corpo, (mm, fechar) => {
    const tipo = mm.querySelector('#et-tipo').value;
    const modo = mm.querySelector('#et-qtd').value;
    const fixa = Math.max(1, Number(mm.querySelector('#et-fixa').value) || 1);
    const mostrar = {
      preco: mm.querySelector('#et-preco').checked,
      ref: mm.querySelector('#et-ref').checked,
      variacao: mm.querySelector('#et-var').checked
    };
    const total = calcularTotal(itens, modo, fixa);
    if (!total) { mm.querySelector('#et-erro').textContent = 'Nada para imprimir (verifique o estoque).'; return; }
    if (total > 800 && !confirm(`Você vai gerar ${total} etiquetas. Continuar?`)) return;
    imprimirFolha(itens, { tipo, modo, fixa, mostrar });
    fechar();
  }, 'Imprimir');

  const selQtd = m.querySelector('#et-qtd');
  const fixaWrap = m.querySelector('#et-fixa-wrap');
  selQtd.addEventListener('change', () => { fixaWrap.style.display = selQtd.value === 'fixa' ? '' : 'none'; });
  const selTipo = m.querySelector('#et-tipo');
  const dica = m.querySelector('.dica-qr');
  selTipo.addEventListener('change', () => { dica.style.display = selTipo.value === 'qr' ? '' : 'none'; });
}

function qtdPara(v, modo, fixa) {
  if (modo === 'estoque') return Math.max(0, Math.round(v.estoque));
  if (modo === 'fixa') return fixa;
  return 1; // uma por variação
}
function calcularTotal(itens, modo, fixa) {
  let t = 0;
  for (const it of itens) for (const v of it.variacoes) t += qtdPara(v, modo, fixa);
  return t;
}
function codigoSvg(tipo, v) {
  if (tipo === 'qr') return `<div class="qrbox">${qrSvg(v.codigo_barras, { ecc: 'M', margin: 1 })}</div>`;
  return ean13Svg(v.codigo_barras);
}

async function imprimirFolha(itens, opts) {
  let area = document.getElementById('area-impressao');
  if (!area) { area = document.createElement('div'); area.id = 'area-impressao'; document.body.appendChild(area); }
  const loja = (getConfig().loja_nome || 'MINHA LOJA').toUpperCase();
  const etiquetas = [];
  for (const it of itens) {
    const p = it.produto;
    for (const v of it.variacoes) {
      const n = qtdPara(v, opts.modo, opts.fixa);
      if (!n) continue;
      const html = `
        <div class="etiqueta">
          <div class="et-left">
            <div class="et-nome">${esc(p.nome)}</div>
            ${opts.mostrar.variacao && v.cor && v.cor !== 'Única' ? `<div class="et-cor">${esc(v.cor)}</div>` : ''}
            ${opts.mostrar.ref && p.referencia ? `<div class="et-ref">Ref. ${esc(p.referencia)}</div>` : ''}
            ${opts.mostrar.preco ? `<div class="et-preco">${moeda(p.preco_venda)}</div>` : ''}
            <div class="et-bc-wrap">
              ${codigoSvg(opts.tipo, v)}
              <div class="et-num">${esc(v.codigo_barras)}</div>
            </div>
          </div>
          ${opts.mostrar.variacao && v.tamanho && v.tamanho !== 'U' ? `<div class="et-right"><div class="et-tam-badge">${esc(v.tamanho)}</div></div>` : ''}
        </div>`;
      for (let i = 0; i < n; i++) etiquetas.push(html);
    }
  }
  if (!etiquetas.length) { toast('Nenhuma etiqueta gerada.', true); return; }
  area.innerHTML = `<div class="etq-grid">${etiquetas.join('')}</div>`;

  // Carregar logo como data URI (para uso no fallback e no caminho silencioso)
  let logoUri = '';
  try {
    const buf = await Neutralino.filesystem.readBinaryFile(`${NL_PATH}/src/img/logo-etq.jpeg`);
    const bytes = new Uint8Array(buf);
    let bin = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK)
      bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
    logoUri = `data:image/jpeg;base64,${btoa(bin)}`;
  } catch { /* sem logo */ }

  // Terminal em rede: imprime pelo diálogo do navegador (impressora desta máquina)
  if (EM_REDE) { window.print(); return; }

  // Computador principal: impressão silenciosa via extensão
  const r = await api('config:imprimir', { tipo: 'etiqueta' });
  if (!r.ok) {
    // Fallback: abre janela com CSS correto (60×40mm, @page configurado)
    // Garante layout correto mesmo sem impressão silenciosa
    const htmlFinal = area.innerHTML.replace(/__LOGO_URI__/g, logoUri);
    const w = window.open('about:blank', '_blank', 'width=640,height=480,toolbar=0,menubar=0');
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS_ETQ}</style></head><body>${htmlFinal}</body></html>`);
      w.document.close();
      setTimeout(() => { try { w.print(); } catch { /* ok */ } }, 350);
    }
  }
}
