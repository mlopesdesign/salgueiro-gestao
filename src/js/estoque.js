// Módulo Estoque — movimentação, kardex, reposição e etiquetas
import { api, el, esc, moeda, toast, modal, getConfig, ehAdmin } from './app.js';
const dataBrH = (s) => s ? `${String(s).slice(0, 10).split('-').reverse().join('/')} ${String(s).slice(11, 16)}` : '—';

// ---------- EAN-13 em SVG (sem dependências) ----------
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PARIDADE = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

export function ean13Svg(codigo) {
  const d = String(codigo).replace(/\D/g, '');
  if (d.length !== 13) return '';
  let bits = '101';
  const par = PARIDADE[Number(d[0])];
  for (let i = 1; i <= 6; i++) bits += (par[i - 1] === 'L' ? L : G)[Number(d[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[Number(d[i])];
  bits += '101';
  let barras = '';
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') barras += `<rect x="${i}" y="0" width="1" height="60"/>`;
  }
  return `<svg viewBox="0 0 ${bits.length} 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${barras}</svg>`;
}

// ---------- Exportação estoque ----------
async function exportarEstoquePdf() {
  const r = await api('estoque:listarCompleto');
  if (!r.ok) { toast(r.erro, true); return; }
  const cfg = (await api('config:obter')).config || {};
  const loja = cfg.loja_nome || 'Estoque';
  const data = new Date().toLocaleDateString('pt-BR');
  const moedaFmt = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  let linhas = r.variacoes.map(v => `
    <tr>
      <td>${esc(v.nome)}</td><td>${esc(v.referencia || '')}</td>
      <td>${esc(v.categoria)}</td><td>${esc(v.cor || '')}</td>
      <td>${esc(v.tamanho || '')}</td><td>${esc(v.codigo_barras || '')}</td>
      <td class="num">${v.estoque}</td>
      <td class="num">${moedaFmt(v.preco_venda || 0)}</td>
      <td class="num">${moedaFmt((v.estoque || 0) * (v.preco_venda || 0))}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Estoque — ${esc(loja)}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:10px;margin:10mm 8mm}
      h2{margin:0 0 4px;font-size:14px}
      p.sub{margin:0 0 8px;color:#666;font-size:9px}
      table{width:100%;border-collapse:collapse}
      th{background:#8B1A1C;color:#fff;padding:4px 3px;text-align:left;font-size:9px}
      td{padding:3px;border-bottom:1px solid #ddd;vertical-align:top}
      tr:nth-child(even) td{background:#f9f9f9}
      .num{text-align:right}
      tfoot td{font-weight:700;background:#eee;border-top:2px solid #8B1A1C}
      @media print{body{margin:5mm}}
    </style></head><body>
    <h2>${esc(loja)} — Relatório de Estoque</h2>
    <p class="sub">Gerado em ${data} · ${r.variacoes.length} variações · ${r.totalPecas} peças</p>
    <table>
      <thead><tr><th>Produto</th><th>Ref</th><th>Categoria</th><th>Cor</th><th>Tam</th><th>Cód. barras</th><th class="num">Qtd</th><th class="num">Preço</th><th class="num">Total</th></tr></thead>
      <tbody>${linhas}</tbody>
      <tfoot><tr><td colspan="6">TOTAIS</td><td class="num">${r.totalPecas}</td><td></td><td class="num">${moedaFmt(r.totalVenda)}</td></tr></tfoot>
    </table></body></html>`;
  const w = window.open('', '_blank', 'width=1000,height=700');
  if (!w) { toast('Permita popups para exportar PDF.', true); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

async function exportarEstoqueXlsx() {
  toast('Gerando Excel…');
  const r = await api('estoque:exportarXlsx');
  if (!r.ok) { toast(r.erro || 'Erro ao gerar Excel.', true); return; }
  const bin = atob(r.buffer);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `estoque-${new Date().toISOString().slice(0,10)}.xlsx`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  toast('Excel baixado com sucesso.');
}

// ---------- Tela Estoque ----------
export async function viewEstoque(alvo) {
  const tela = el(`
    <div>
      <div class="pagina-topo">
        <h1>Estoque</h1>
        <div class="acoes">
          <button id="est-pdf" class="btn-secundario">📄 Exportar PDF</button>
          <button id="est-xlsx" class="btn-secundario">📊 Exportar Excel</button>
        </div>
      </div>
      <div class="abas">
        <button data-aba="mov" class="ativa">Movimentar</button>
        <button data-aba="kardex">Histórico (Kardex)</button>
        <button data-aba="repo">Reposição</button>
      </div>
      <div id="aba-conteudo"></div>
    </div>`);
  const corpo = tela.querySelector('#aba-conteudo');
  const abas = { mov: abaMovimentar, kardex: abaKardex, repo: abaReposicao };
  tela.querySelectorAll('.abas button').forEach(b => {
    b.onclick = () => {
      tela.querySelectorAll('.abas button').forEach(x => x.classList.toggle('ativa', x === b));
      corpo.innerHTML = '';
      abas[b.dataset.aba](corpo);
    };
  });
  alvo.appendChild(tela);
  tela.querySelector('#est-pdf').onclick = exportarEstoquePdf;
  tela.querySelector('#est-xlsx').onclick = exportarEstoqueXlsx;
  abaMovimentar(corpo);
}

// ---------- Aba: Movimentar ----------
function abaMovimentar(corpo) {
  // Entrada, saída manual e ajuste passaram a ser exclusivos do administrador
  // (v3.8.0). Quem não é admin continua consultando o saldo e bipando o código
  // — só não vê os botões que o backend recusaria.
  const admin = ehAdmin();
  const painel = el(`
    <div class="painel">
      <div class="barra">
        <input type="text" id="mov-busca" placeholder="${admin ? 'Bipe o código de barras ou digite nome/referência…' : 'Bipe o código de barras ou digite nome/referência para consultar o saldo…'}">
      </div>
      ${admin ? '' : `<p style="margin:0 12px 10px;font-size:12.5px;color:var(--texto-suave)">
        🔒 Só o administrador altera a quantidade em estoque. Aqui você consulta o saldo.</p>`}
      <table>
        <thead><tr><th>Produto</th><th>Cor / Tamanho</th><th>Código</th>
          <th class="num">Estoque</th>${admin ? '<th style="width:230px"></th>' : ''}</tr></thead>
        <tbody><tr><td colspan="${admin ? 5 : 4}" class="vazio">Busque um produto para ${admin ? 'movimentar' : 'consultar'}.</td></tr></tbody>
      </table>
    </div>`);
  const tbody = painel.querySelector('tbody');
  const busca = painel.querySelector('#mov-busca');

  async function pesquisar() {
    const termo = busca.value.trim();
    if (!termo) return;
    const r = await api('estoque:buscar', { termo });
    tbody.innerHTML = '';
    const lista = r.ok ? r.variacoes : [];
    if (!lista.length) {
      tbody.appendChild(el(`<tr><td colspan="${admin ? 5 : 4}" class="vazio">Nada encontrado para "${esc(termo)}".</td></tr>`));
      return;
    }
    // leitor de código de barras: 1 resultado exato → abre direto a entrada
    // (só para o admin; para os demais o bip é consulta de saldo)
    if (admin && lista.length === 1 && lista[0].codigo_barras === termo) {
      formMovimento(lista[0], 'entrada', pesquisar);
    }
    for (const v of lista) {
      const tr = el(`<tr>
        <td><b>${esc(v.produto)}</b>${v.referencia ? ` <small style="color:var(--texto-suave)">Ref. ${esc(v.referencia)}</small>` : ''}</td>
        <td>${esc(v.cor)} / ${esc(v.tamanho)}</td>
        <td style="font-family:Consolas,monospace">${esc(v.codigo_barras || '')}</td>
        <td class="num"><b>${v.estoque}</b></td>
        ${admin ? `<td class="acoes-linha">
          <button data-a="entrada" style="color:var(--verde)">+ Entrada</button>
          <button data-a="saida" style="color:var(--vermelho)">− Saída</button>
          <button data-a="ajuste">Ajustar</button>
        </td>` : ''}</tr>`);
      if (admin) {
        for (const acao of ['entrada', 'saida', 'ajuste']) {
          tr.querySelector(`[data-a=${acao}]`).onclick = () => formMovimento(v, acao, pesquisar);
        }
      }
      tbody.appendChild(tr);
    }
  }
  let debounce;
  busca.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(pesquisar, 300); });
  busca.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(debounce); pesquisar(); } });
  corpo.appendChild(painel);
  busca.focus();
}

function formMovimento(v, tipo, aoConcluir) {
  const titulos = { entrada: 'Entrada de mercadoria', saida: 'Saída manual', ajuste: 'Ajuste de estoque (inventário)' };
  modal(titulos[tipo], `
    <p style="margin-bottom:14px"><b>${esc(v.produto)}</b> — ${esc(v.cor)} / ${esc(v.tamanho)}
      &nbsp;·&nbsp; estoque atual: <b>${v.estoque}</b></p>
    <div class="linha-2">
      <div class="campo">
        <label>${tipo === 'ajuste' ? 'Estoque correto (contagem)' : 'Quantidade'}</label>
        <input id="m-qtd" type="number" min="0" step="1" value="${tipo === 'ajuste' ? v.estoque : 1}">
      </div>
      ${tipo === 'entrada' ? `
      <div class="campo"><label>Custo unitário (R$) — opcional</label>
        <input id="m-custo" type="number" min="0" step="0.01" placeholder="${v.preco_custo || ''}"></div>` : ''}
    </div>
    <div class="campo"><label>Motivo / observação</label>
      <input id="m-motivo" placeholder="${tipo === 'entrada' ? 'Compra fornecedor X' : tipo === 'saida' ? 'Perda, defeito, uso interno…' : 'Contagem de inventário'}"></div>
    <div class="erro" id="m-erro"></div>
  `, async (m, fechar) => {
    const r = await api('estoque:movimentar', {
      variacao_id: v.id,
      tipo,
      qtd: Number(m.querySelector('#m-qtd').value),
      custo_unit: tipo === 'entrada' ? Number(m.querySelector('#m-custo')?.value) || null : null,
      motivo: m.querySelector('#m-motivo').value.trim() || null
    });
    if (!r.ok) { m.querySelector('#m-erro').textContent = r.erro; return; }
    toast(`Estoque atualizado: ${r.estoque} un.`);
    fechar(); aoConcluir();
  }, 'Confirmar');
}

// ---------- Aba: Kardex ----------
async function abaKardex(corpo) {
  const r = await api('estoque:kardex', {});
  const painel = el(`
    <div class="painel"><table>
      <thead><tr><th>Data</th><th>Produto</th><th>Var.</th><th>Tipo</th>
        <th class="num">Qtd</th><th>Motivo</th><th>Usuário</th></tr></thead>
      <tbody></tbody>
    </table></div>`);
  const tbody = painel.querySelector('tbody');
  const nomes = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', venda: 'Venda', devolucao: 'Devolução', inventario: 'Inventário' };
  const lista = r.ok ? r.movimentos : [];
  if (!lista.length) tbody.appendChild(el(`<tr><td colspan="7" class="vazio">Nenhum movimento registrado.</td></tr>`));
  for (const m of lista) {
    tbody.appendChild(el(`<tr>
      <td>${esc(dataBrH(m.criado_em))}</td>
      <td>${esc(m.produto)}</td>
      <td>${esc(m.cor)} / ${esc(m.tamanho)}</td>
      <td>${nomes[m.tipo] || esc(m.tipo)}</td>
      <td class="num" style="color:${m.qtd >= 0 ? 'var(--verde)' : 'var(--vermelho)'};font-weight:700">
        ${m.qtd > 0 ? '+' : ''}${m.qtd}</td>
      <td>${esc(m.motivo || '—')}</td>
      <td>${esc(m.usuario || '—')}</td>
    </tr>`));
  }
  corpo.appendChild(painel);
}

// ---------- Aba: Reposição ----------
async function abaReposicao(corpo) {
  const r = await api('estoque:reposicao');
  const painel = el(`
    <div class="painel"><table>
      <thead><tr><th>Produto</th><th>Cor</th><th>Tamanho</th><th>Categoria</th>
        <th class="num">Estoque</th><th class="num">Mínimo</th><th class="num">Repor</th></tr></thead>
      <tbody></tbody>
    </table></div>`);
  const tbody = painel.querySelector('tbody');
  const lista = r.ok ? r.produtos : [];
  if (!lista.length) tbody.appendChild(el(`<tr><td colspan="7" class="vazio">Nenhuma variação abaixo do mínimo. 🎉</td></tr>`));
  for (const v of lista) {
    const repor = Math.max(0, v.minimo_efetivo - v.estoque + 1);
    tbody.appendChild(el(`<tr>
      <td><b>${esc(v.nome)}</b>${v.referencia ? ` <small style="color:var(--texto-suave)">Ref. ${esc(v.referencia)}</small>` : ''}</td>
      <td>${esc(v.cor || '—')}</td>
      <td>${esc(v.tamanho || '—')}</td>
      <td>${esc(v.categoria || '—')}</td>
      <td class="num">${v.estoque}</td>
      <td class="num">${v.minimo_efetivo}</td>
      <td class="num"><span class="pill pill-baixo">${repor}+</span></td>
    </tr>`));
  }
  corpo.appendChild(painel);
}

// ---------- Etiquetas ----------
export async function abrirEtiquetas(produtoId) {
  const d = await api('produtos:obter', { id: produtoId });
  if (!d.ok) { toast(d.erro, true); return; }
  const { produto, variacoes } = d;

  const linhasHtml = variacoes.map(v => `
    <tr>
      <td>${esc(v.cor)} / ${esc(v.tamanho)}</td>
      <td style="font-family:Consolas,monospace">${esc(v.codigo_barras)}</td>
      <td class="num">estoque: ${v.estoque}</td>
      <td style="width:110px"><input data-v="${v.id}" type="number" min="0" value="${Math.max(1, v.estoque)}"
        style="width:90px;padding:5px 8px;border:1px solid var(--borda);border-radius:6px" min="1"></td>
    </tr>`).join('');

  modal(`Etiquetas — ${esc(produto.nome)}`, `
    <p style="margin-bottom:10px;color:var(--texto-suave)">Quantidade de etiquetas por variação:</p>
    <table><thead><tr><th>Variação</th><th>Código</th><th></th><th>Qtd</th></tr></thead>
      <tbody>${linhasHtml}</tbody></table>
    <div class="campo" style="margin-top:14px"><label>Mostrar na etiqueta</label>
      <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:4px">
        <label class="chk-inline"><input type="checkbox" id="et1-preco"> Preço</label>
        <label class="chk-inline"><input type="checkbox" id="et1-ref" checked> Referência</label>
        <label class="chk-inline"><input type="checkbox" id="et1-var" checked> Cor / Tamanho</label>
      </div>
    </div>
  `, (m, fechar) => {
    const qtds = {};
    m.querySelectorAll('input[data-v]').forEach(i => { qtds[i.dataset.v] = Number(i.value) || 0; });
    const total = Object.values(qtds).reduce((s, n) => s + n, 0);
    if (!total) { toast('Informe ao menos uma etiqueta.', true); return; }
    const mostrar = {
      preco: m.querySelector('#et1-preco').checked,
      ref: m.querySelector('#et1-ref').checked,
      variacao: m.querySelector('#et1-var').checked,
    };
    imprimirEtiquetas(produto, variacoes, qtds, mostrar);
    fechar();
  }, 'Imprimir');
}

function imprimirEtiquetas(produto, variacoes, qtds, mostrar = { preco: false, ref: true, variacao: true }) {
  let area = document.getElementById('area-impressao');
  if (!area) {
    area = document.createElement('div');
    area.id = 'area-impressao';
    document.body.appendChild(area);
  }
  const etiquetas = [];
  for (const v of variacoes) {
    for (let i = 0; i < (qtds[v.id] || 0); i++) {
      etiquetas.push(`
        <div class="etiqueta">
          <div class="et-left">
            <div class="et-nome">${esc(produto.nome)}</div>
            ${mostrar.variacao && v.cor && v.cor !== 'Única' ? `<div class="et-cor">${esc(v.cor)}</div>` : ''}
            ${mostrar.ref && produto.referencia ? `<div class="et-ref">Ref. ${esc(produto.referencia)}</div>` : ''}
            ${mostrar.preco ? `<div class="et-preco">${moeda(produto.preco_venda)}</div>` : ''}
            <div class="et-bc-wrap">
              ${ean13Svg(v.codigo_barras)}
              <div class="et-num">${esc(v.codigo_barras)}</div>
            </div>
          </div>
          ${mostrar.variacao && v.tamanho && v.tamanho !== 'U' ? `<div class="et-right"><div class="et-tam-badge">${esc(v.tamanho)}</div></div>` : ''}
        </div>`);
    }
  }
  area.innerHTML = `<div class="etq-grid">${etiquetas.join('')}</div>`;
  // Tentar impressão silenciosa; se impressora não configurada, cai no diálogo do browser
  api('config:imprimir', { tipo: 'etiqueta' }).then(r => {
    if (!r.ok) window.print();
  }).catch(() => window.print());
}
