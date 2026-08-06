// Impressão de etiquetas em lote — código de barras (EAN-13) ou QR Code
import { api, el, esc, moeda, toast, modal, getConfig, EM_REDE } from './app.js';
import { ean13Svg } from './estoque.js';
import { qrSvg } from './vendor/qrcode.js';

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
      const linhaVar = opts.mostrar.variacao
        ? `<div class="var">${esc(v.cor)} · Tam. ${esc(v.tamanho)}${opts.mostrar.ref && p.referencia ? ' · Ref. ' + esc(p.referencia) : ''}</div>`
        : (opts.mostrar.ref && p.referencia ? `<div class="var">Ref. ${esc(p.referencia)}</div>` : '');
      const html = `
        <div class="etiqueta ${opts.tipo === 'qr' ? 'et-qr' : ''}">
          <div class="loja">${esc(loja)}</div>
          <div class="prod">${esc(p.nome)}</div>
          ${linhaVar}
          ${opts.mostrar.preco ? `<div class="preco">${moeda(p.preco_venda)}</div>` : ''}
          ${codigoSvg(opts.tipo, v)}
          <div class="cod-num">${esc(v.codigo_barras)}</div>
        </div>`;
      for (let i = 0; i < n; i++) etiquetas.push(html);
    }
  }
  if (!etiquetas.length) { toast('Nenhuma etiqueta gerada.', true); return; }
  area.innerHTML = `<div class="etq-grid">${etiquetas.join('')}</div>`;
  // Terminal em rede: imprime direto pelo diálogo do navegador (impressora desta máquina).
  // Computador principal: usa a impressora configurada silenciosamente; fallback para diálogo.
  if (EM_REDE) { window.print(); return; }
  const r = await api('config:imprimir', { tipo: 'etiqueta' });
  if (!r.ok) window.print();
}
