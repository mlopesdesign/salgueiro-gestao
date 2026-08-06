// Relatórios — vendas, curva ABC, peças paradas, exportação CSV/PDF/impressão
import { api, el, esc, moeda, toast, getConfig, pode } from './app.js';

// Impressão / PDF: monta uma folha limpa e chama a impressão do sistema
// (no destino, o usuário escolhe a impressora ou "Salvar como PDF"). Funciona
// offline e também nos terminais em rede (navegador).
function garantirEstiloImpressao() {
  if (document.getElementById('estilo-impressao-rel')) return;
  const st = document.createElement('style');
  st.id = 'estilo-impressao-rel';
  st.textContent = `
    #area-impressao-rel { display:none; }
    #area-impressao-rel h1 { font-size:18px; margin:0 0 2px; }
    #area-impressao-rel .cab-print { border-bottom:2px solid #333; margin-bottom:12px; padding-bottom:6px; }
    #area-impressao-rel table { width:100%; border-collapse:collapse; margin:8px 0; font-size:12px; }
    #area-impressao-rel th, #area-impressao-rel td { border:1px solid #999; padding:4px 6px; text-align:left; }
    #area-impressao-rel .num { text-align:right; }
    @media print {
      body > *:not(#area-impressao-rel) { display:none !important; }
      #area-impressao-rel { display:block !important; }
    }`;
  document.head.appendChild(st);
}
function imprimirRelatorio(titulo, htmlInterno) {
  garantirEstiloImpressao();
  const cfg = (getConfig && getConfig()) || {};
  document.getElementById('area-impressao-rel')?.remove();
  const area = el(`<div id="area-impressao-rel"></div>`);
  area.innerHTML = `<div class="cab-print">
      <h1>${esc(cfg.loja_nome || 'Relatório')}</h1>
      <div>${esc(titulo)} · ${new Date().toLocaleString('pt-BR')}</div>
    </div>${htmlInterno}`;
  document.body.appendChild(area);
  window.print();
  setTimeout(() => area.remove(), 800);
}

const hoje = () => new Date().toISOString().slice(0, 10);
const inicioMes = () => hoje().slice(0, 8) + '01';
const dataBr = (d) => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';

function baixarCsv(nome, cabecalho, linhas) {
  const escCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [cabecalho, ...linhas].map(l => l.map(escCsv).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${nome}-${hoje()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV exportado (abre no Excel).');
}

export async function viewRelatorios(alvo) {
  const tela = el(`
    <div>
      <div class="pagina-topo"><h1>Relatórios</h1></div>
      <div class="painel" style="margin-bottom:16px"><div class="barra">
        <label style="font-weight:600">De</label>
        <input id="r-de" type="date" value="${inicioMes()}" style="padding:7px 10px;border:1px solid var(--borda);border-radius:8px">
        <label style="font-weight:600">até</label>
        <input id="r-ate" type="date" value="${hoje()}" style="padding:7px 10px;border:1px solid var(--borda);border-radius:8px">
        <button class="btn btn-suave" id="r-imprimir" style="margin-left:auto">🖨️ Imprimir</button>
        <button class="btn btn-suave" id="r-pdf">📄 PDF</button>
      </div></div>
      <div class="abas">
        <button data-aba="vendas" class="ativa">Vendas</button>
        <button data-aba="evento">🎪 Evento / Pós-venda</button>
        ${pode('dashboard.financeiro') ? '<button data-aba="lojas">🏬 Por loja</button>' : ''}
        <button data-aba="consignados">Consignados</button>
        <button data-aba="abc">Curva ABC</button>
        <button data-aba="paradas">Peças paradas</button>
        ${pode('estoque.ver') ? '<button data-aba="estoque">📦 Estoque</button>' : ''}
      </div>
      <div id="aba-conteudo"></div>
    </div>`);
  const corpo = tela.querySelector('#aba-conteudo');
  const periodo = () => ({ de: tela.querySelector('#r-de').value, ate: tela.querySelector('#r-ate').value });
  const abas = { vendas: abaVendas, evento: abaEvento, lojas: abaPorLoja, consignados: abaConsignados, abc: abaAbc, paradas: abaParadas, estoque: abaEstoque };
  const rotuloAba = () => (tela.querySelector('.abas button.ativa')?.textContent || 'Relatório').trim();
  tela.querySelector('#r-imprimir').onclick = () => imprimirRelatorio(
    `${rotuloAba()} — ${tela.querySelector('#r-de').value} a ${tela.querySelector('#r-ate').value}`, corpo.innerHTML);
  tela.querySelector('#r-pdf').onclick = () => {
    toast('Na janela de impressão, escolha "Salvar como PDF".');
    imprimirRelatorio(`${rotuloAba()} — ${tela.querySelector('#r-de').value} a ${tela.querySelector('#r-ate').value}`, corpo.innerHTML);
  };
  let abaAtiva = 'vendas';
  function trocar(aba) {
    abaAtiva = aba;
    tela.querySelectorAll('.abas button').forEach(x => x.classList.toggle('ativa', x.dataset.aba === aba));
    corpo.innerHTML = ''; abas[aba](corpo, periodo());
  }
  tela.querySelectorAll('.abas button').forEach(b => { b.onclick = () => trocar(b.dataset.aba); });
  // A aba Evento tem período próprio (com hora) — não reage ao De/até geral
  tela.querySelectorAll('#r-de, #r-ate').forEach(c => c.addEventListener('change', () => {
    if (abaAtiva !== 'evento') trocar(abaAtiva);
  }));
  alvo.appendChild(tela);
  abaVendas(corpo, periodo());
}

// ---------- Vendas ----------
async function abaVendas(corpo, per) {
  const r = await api('relatorios:vendas', per);
  if (!r.ok) { toast(r.erro, true); return; }
  const linhasDia = r.por_dia.map(d => `<tr><td>${dataBr(d.dia)}</td>
    <td class="num">${d.qtd}</td><td class="num"><b>${moeda(d.total)}</b></td></tr>`).join('');
  const linhasVend = r.por_vendedor.map(v => `<tr><td>${esc(v.vendedor || '—')}</td>
    <td class="num">${v.qtd}</td><td class="num"><b>${moeda(v.total)}</b></td></tr>`).join('');
  const linhasCat = r.por_categoria.map(c => `<tr><td>${esc(c.categoria)}</td>
    <td class="num">${c.pecas}</td><td class="num"><b>${moeda(c.total)}</b></td></tr>`).join('');

  const bloco = el(`
    <div>
      <div class="cards">
        <div class="card"><div class="rotulo">Vendas</div><div class="valor">${r.resumo.qtd}</div></div>
        <div class="card"><div class="rotulo">Faturamento</div><div class="valor">${moeda(r.resumo.total)}</div></div>
        <div class="card"><div class="rotulo">Ticket médio</div><div class="valor">${moeda(r.resumo.ticket)}</div></div>
      </div>
      <div class="linha-2" style="align-items:start">
        <div class="painel"><div class="barra"><b>Por dia</b>
          <button class="btn btn-suave" id="exp-dia" style="margin-left:auto">Exportar CSV</button></div>
          <table><tbody>${linhasDia || '<tr><td class="vazio">Sem vendas no período.</td></tr>'}</tbody></table></div>
        <div>
          <div class="painel" style="margin-bottom:14px"><div class="barra"><b>Por vendedor(a)</b></div>
            <table><tbody>${linhasVend || '<tr><td class="vazio">—</td></tr>'}</tbody></table></div>
          <div class="painel"><div class="barra"><b>Por categoria</b></div>
            <table><tbody>${linhasCat || '<tr><td class="vazio">—</td></tr>'}</tbody></table></div>
        </div>
      </div>
    </div>`);
  bloco.querySelector('#exp-dia').onclick = () =>
    baixarCsv('vendas-por-dia', ['Dia', 'Vendas', 'Total (R$)'],
      r.por_dia.map(d => [dataBr(d.dia), d.qtd, d.total.toFixed(2).replace('.', ',')]));
  corpo.appendChild(bloco);
}

// ---------- Evento / Pós-venda ----------
// Período por DATA + HORA: a loja abre num dia e fecha no outro
// (ex.: sábado 20:00 → domingo 04:00).
const _pad2 = (n) => String(n).padStart(2, '0');
const _dtLocal = (d) => `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}` +
  `T${_pad2(d.getHours())}:${_pad2(d.getMinutes())}`;
const _horaBr = (s) => String(s || '').slice(11, 16);
const _dtBr = (s) => `${dataBr(s)} ${_horaBr(s)}`;

// Sábado 20:00 mais recente (se ainda não chegou, o da semana passada)
function _inicioEventoPadrao() {
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
  if (d.getTime() > Date.now()) d.setDate(d.getDate() - 7);
  return d;
}

const _SECOES = [
  ['resumo', 'Resumo do evento', true],
  ['produtos', 'Produtos vendidos', true],
  ['vendas', 'Lista de vendas', true],
  ['itens', 'Itens de cada venda', true],
  ['pagamentos', 'Formas de pagamento e taxas', true],
  ['consignado', 'Comissão de consignados', true],
  ['cortesias', 'Cortesias (brindes)', true],
  ['descontos', 'Descontos autorizados', true],
  ['vendedor', 'Por vendedor(a)', false],
  ['categoria', 'Por categoria', false]
];

function _estiloEvento() {
  if (document.getElementById('estilo-evento-rel')) return;
  const st = document.createElement('style');
  st.id = 'estilo-evento-rel';
  st.textContent = `
    .ev-grid { display:flex; gap:14px; flex-wrap:wrap; margin:10px 0 4px; }
    .ev-grid label { display:flex; flex-direction:column; gap:4px; font-weight:600; font-size:13px; }
    .ev-grid input, .ev-grid select { padding:7px 10px; border:1px solid var(--borda); border-radius:8px; font-weight:400; }
    .ev-atalhos { display:flex; gap:8px; flex-wrap:wrap; margin:8px 0; }
    .ev-secoes { display:flex; gap:12px 18px; flex-wrap:wrap; margin-top:10px;
      padding-top:10px; border-top:1px solid var(--borda); }
    .ev-chk { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; }
    .ev-dica { font-size:12px; opacity:.7; font-weight:400; }
    .ev-tot td { padding:5px 8px; }
    .ev-tot .num { text-align:right; }
    .ev-neg td { color:#b45309; }
    .ev-final td { border-top:2px solid var(--borda); font-size:15px; }
    .ev-vendas .ev-linha { cursor:pointer; }
    .ev-vendas .ev-linha:hover { background:rgba(0,0,0,.04); }
    .ev-seta { display:inline-block; width:14px; opacity:.6; }
    .ev-sub { width:100%; border-collapse:collapse; margin:4px 0; font-size:12px; }
    .ev-sub th, .ev-sub td { padding:3px 6px; border-bottom:1px solid var(--borda); }
    .ev-itens > td { background:rgba(0,0,0,.03); padding:6px 12px !important; }
    .ev-consig { font-size:12px; margin-top:4px; opacity:.85; }
    .num { text-align:right; }`;
  document.head.appendChild(st);
}

async function abaEvento(corpo) {
  _estiloEvento();
  const ini = _inicioEventoPadrao();
  const fim = new Date(ini.getTime() + 8 * 3600 * 1000);
  const chks = _SECOES.map(([k, rot, on]) =>
    `<label class="ev-chk"><input type="checkbox" data-sec="${k}"${on ? ' checked' : ''}> ${esc(rot)}</label>`).join('');

  const bloco = el(`
    <div>
      <div class="painel" style="margin-bottom:14px">
        <div class="barra"><b>🎪 Período do evento</b>
          <span class="ev-dica">A loja abre num dia e fecha no outro — informe data <b>e</b> hora.</span></div>
        <div class="ev-grid">
          <label>Início<input id="ev-ini" type="datetime-local" value="${_dtLocal(ini)}"></label>
          <label>Fim<input id="ev-fim" type="datetime-local" value="${_dtLocal(fim)}"></label>
          <label>Pix recebido<select id="ev-pix">
            <option value="0">Na chave — sem taxa</option>
            <option value="1">Na maquininha — 0,49%</option>
          </select></label>
        </div>
        <div class="ev-atalhos">
          <button class="btn btn-suave" data-atalho="sab">Sáb 20h → Dom 4h</button>
          <button class="btn btn-suave" data-atalho="ontem">Ontem 18h → hoje 2h</button>
        </div>
        <div class="ev-secoes"><b style="width:100%;font-size:13px">Dados que entram no relatório:</b>${chks}</div>
        <div class="barra" style="margin-top:12px">
          <button class="btn" id="ev-gerar">Gerar relatório</button>
          <button class="btn btn-suave" id="ev-print" style="margin-left:auto" disabled>🖨️ Imprimir / PDF</button>
          <button class="btn btn-suave" id="ev-xlsx" disabled>📊 Excel</button>
        </div>
      </div>
      <div id="ev-res"></div>
    </div>`);

  const res = bloco.querySelector('#ev-res');
  const q = (s) => bloco.querySelector(s);
  const secoes = () => {
    const o = {};
    bloco.querySelectorAll('[data-sec]').forEach(c => { o[c.dataset.sec] = c.checked; });
    return o;
  };
  const params = () => ({
    inicio: q('#ev-ini').value, fim: q('#ev-fim').value,
    pix_maquina: q('#ev-pix').value === '1'
  });
  let dados = null;

  const tabela = (titulo, cabs, linhas, extra, cls) => linhas
    ? `<div class="painel" style="margin-bottom:14px">
         <div class="barra"><b>${esc(titulo)}</b>${extra || ''}</div>
         <table${cls ? ` class="${cls}"` : ''}><thead><tr>${cabs}</tr></thead>
         <tbody>${linhas}</tbody></table></div>`
    : '';

  function render(r, s) {
    const t = r.resumo;
    let h = '';

    if (s.resumo) {
      h += `<div class="cards">
        <div class="card"><div class="rotulo">Vendas</div><div class="valor">${t.vendas}</div></div>
        <div class="card"><div class="rotulo">Peças</div><div class="valor">${t.pecas}</div></div>
        <div class="card"><div class="rotulo">Faturamento bruto</div><div class="valor">${moeda(t.bruto)}</div></div>
        <div class="card"><div class="rotulo">Ticket médio</div><div class="valor">${moeda(t.ticket)}</div></div>
      </div>
      <div class="painel" style="margin-bottom:14px">
        <div class="barra"><b>Fechamento do evento</b>
          <span class="ev-dica">${_dtBr(r.inicio)} até ${_dtBr(r.fim)}</span></div>
        <table class="ev-tot"><tbody>
          <tr><td>Faturamento bruto</td><td class="num">${moeda(t.bruto)}</td></tr>
          ${t.devolucoes ? `<tr class="ev-neg"><td>(–) Devoluções</td><td class="num">${moeda(t.devolucoes)}</td></tr>` : ''}
          <tr><td>Faturamento líquido</td><td class="num"><b>${moeda(t.liquido)}</b></td></tr>
          <tr class="ev-neg"><td>(–) Taxas da maquininha</td><td class="num">${moeda(t.taxas)}</td></tr>
          ${t.comissao ? `<tr class="ev-neg"><td>(–) Comissão de consignados</td><td class="num">${moeda(t.comissao)}</td></tr>` : ''}
          <tr class="ev-final"><td><b>Líquido a receber</b></td><td class="num"><b>${moeda(t.receber)}</b></td></tr>
          ${t.cortesias && t.cortesias.qtd ? `<tr class="ev-neg"><td>Cortesias — ${t.cortesias.pecas} peça(s),
            valor de tabela ${moeda(t.cortesias.valor)}</td>
            <td class="num">custo ${moeda(t.cortesias.custo)}</td></tr>` : ''}
        </tbody></table></div>`;
    }

    if (s.vendas) {
      const linhas = r.vendas.map(v => {
        const temItens = s.itens && v.itens.length;
        const sub = temItens ? `<tr class="ev-itens" data-de="${v.id}"><td colspan="8">
          <table class="ev-sub"><thead><tr>
            <th>Produto</th><th>Ref.</th><th>Cor / Tam.</th><th class="num">Qtd</th>
            <th class="num">Unit.</th><th class="num">Desc.</th><th class="num">Total</th></tr></thead>
          <tbody>${v.itens.map(it => `<tr>
            <td>${esc(it.produto)}</td><td>${esc(it.referencia || '—')}</td>
            <td>${esc([it.cor, it.tamanho].filter(x => x && x !== 'Única' && x !== 'U').join(' · ') || '—')}</td>
            <td class="num">${it.qtd}</td><td class="num">${moeda(it.preco_unit)}</td>
            <td class="num">${it.desconto ? moeda(it.desconto) : '—'}</td>
            <td class="num"><b>${moeda(it.total)}</b></td></tr>`).join('')}</tbody></table>
          ${v.consignados.length ? `<div class="ev-consig"><b>Consignado:</b> ${v.consignados.map(c =>
            `${esc(c.produto)} — ${esc(c.fornecedor)} (${c.pct_fornecedor}% = ${moeda(c.valor_fornecedor)})`).join(' · ')}</div>` : ''}
        </td></tr>` : '';
        return `<tr class="ev-linha" data-venda="${v.id}">
          <td>${temItens ? '<span class="ev-seta">▾</span>' : ''}#${v.id}</td>
          <td>${dataBr(v.data)} <small>${esc(v.hora)}</small></td>
          <td>${esc(v.cliente || '—')}</td><td>${esc(v.vendedor || '—')}</td>
          <td class="num">${v.pecas}</td>
          <td>${v.pagamentos.map(g => esc(g.rotulo)).join('<br>') || '—'}</td>
          <td class="num">${v.taxa_valor ? moeda(v.taxa_valor) : '—'}</td>
          <td class="num"><b>${moeda(v.liquido)}</b></td></tr>${sub}`;
      }).join('');
      h += tabela('Vendas do período',
        `<th>Venda</th><th>Data / hora</th><th>Cliente</th><th>Vendedor(a)</th>
         <th class="num">Peças</th><th>Pagamento</th><th class="num">Taxa</th><th class="num">Líquido</th>`,
        linhas || '<tr><td colspan="8" class="vazio">Nenhuma venda nesse período.</td></tr>',
        s.itens ? '<span class="ev-dica" style="margin-left:auto">Clique numa venda para recolher/abrir os itens</span>' : '',
        'ev-vendas');
    }

    if (s.pagamentos) {
      h += tabela('Formas de pagamento e taxas',
        `<th>Forma</th><th class="num">Qtd</th><th class="num">Valor</th>
         <th class="num">Taxa %</th><th class="num">Taxa R$</th><th class="num">Líquido</th>`,
        r.por_forma.map(g => `<tr><td>${esc(g.forma)}</td><td class="num">${g.qtd}</td>
          <td class="num">${moeda(g.valor)}</td>
          <td class="num">${String(g.taxa_pct).replace('.', ',')}%</td>
          <td class="num">${moeda(g.taxa_valor)}</td>
          <td class="num"><b>${moeda(g.valor - g.taxa_valor)}</b></td></tr>`).join('')
        || '<tr><td colspan="6" class="vazio">—</td></tr>');
    }

    if (s.consignado && r.por_fornecedor.length) {
      h += tabela('Comissão de consignados',
        `<th>Fornecedor</th><th class="num">Peças</th><th class="num">Vendido</th>
         <th class="num">Comissão</th><th class="num">Fica com a loja</th><th class="num">A pagar</th>`,
        r.por_fornecedor.map(g => `<tr><td>${esc(g.fornecedor)}</td><td class="num">${g.pecas}</td>
          <td class="num">${moeda(g.venda)}</td><td class="num"><b>${moeda(g.comissao)}</b></td>
          <td class="num">${moeda(g.parte_loja)}</td><td class="num">${moeda(g.pendente)}</td></tr>`).join(''));
    }

    if (s.cortesias && r.cortesias.length) {
      const c = r.resumo.cortesias;
      h += tabela('🎁 Cortesias (brindes)',
        `<th>Venda</th><th>Data / hora</th><th>Produto</th><th>Para quem</th>
         <th>Autorizado por</th><th class="num">Peças</th>
         <th class="num">Valor de tabela</th><th class="num">Custo p/ loja</th>`,
        r.cortesias.map(x => `<tr><td>#${x.venda_id}</td>
          <td>${dataBr(x.data)} <small>${esc(x.hora)}</small></td>
          <td>${esc(x.produtos || '—')}</td>
          <td><b>${esc(x.beneficiario || '—')}</b></td>
          <td>${esc(x.autorizado_por || '—')}</td>
          <td class="num">${x.pecas}</td>
          <td class="num">${moeda(x.cortesia_valor)}</td>
          <td class="num"><b>${moeda(x.custo)}</b></td></tr>`).join('')
        + `<tr class="ev-final"><td colspan="5"><b>Total (${c.qtd} cortesia${c.qtd > 1 ? 's' : ''})</b></td>
           <td class="num"><b>${c.pecas}</b></td><td class="num"><b>${moeda(c.valor)}</b></td>
           <td class="num"><b>${moeda(c.custo)}</b></td></tr>`,
        '<span class="ev-dica" style="margin-left:auto">Saíram do estoque · não entram no faturamento</span>');
    }

    if (s.descontos && r.descontos && r.descontos.length) {
      const d = r.resumo.descontos;
      h += tabela('🏷️ Descontos autorizados',
        `<th>Venda</th><th>Data / hora</th><th>Cliente</th><th>Quem lançou</th>
         <th>Autorizado por</th><th>Motivo</th>
         <th class="num">Tabela</th><th class="num">Desconto</th><th class="num">Pago</th>`,
        r.descontos.map(x => `<tr><td>#${x.venda_id}</td>
          <td>${dataBr(x.data)} <small>${esc(x.hora)}</small></td>
          <td>${esc(x.cliente || '—')}</td>
          <td>${esc(x.operador || '—')}</td>
          <td><b>${esc(x.autorizado_por || '—')}</b></td>
          <td>${esc(x.motivo || '—')}</td>
          <td class="num">${moeda(x.subtotal)}</td>
          <td class="num"><b style="color:var(--vermelho)">−${moeda(x.desconto)}</b>
            <small>(${x.percent}%)</small></td>
          <td class="num">${moeda(x.total)}</td></tr>`).join('')
        + `<tr class="ev-final"><td colspan="7"><b>Total (${d.qtd} desconto${d.qtd > 1 ? 's' : ''})</b></td>
           <td class="num"><b>−${moeda(d.valor)}</b></td><td></td></tr>`,
        '<span class="ev-dica" style="margin-left:auto">Só os lançados na mão · categoria e pontos não entram</span>');
    }

    if (s.vendedor) {
      h += tabela('Por vendedor(a)',
        `<th>Vendedor(a)</th><th class="num">Vendas</th><th class="num">Peças</th><th class="num">Total</th>`,
        r.por_vendedor.map(g => `<tr><td>${esc(g.vendedor)}</td><td class="num">${g.qtd}</td>
          <td class="num">${g.pecas}</td><td class="num"><b>${moeda(g.total)}</b></td></tr>`).join('')
        || '<tr><td colspan="4" class="vazio">—</td></tr>');
    }

    if (s.categoria) {
      h += tabela('Por categoria',
        `<th>Categoria</th><th class="num">Peças</th><th class="num">Total</th>`,
        r.por_categoria.map(c => `<tr><td>${esc(c.categoria)}</td><td class="num">${c.pecas}</td>
          <td class="num"><b>${moeda(c.total)}</b></td></tr>`).join('')
        || '<tr><td colspan="3" class="vazio">—</td></tr>');
    }

    // No fim: lista consolidada do que saiu no evento, com a quantidade de cada produto
    if (s.produtos) {
      const tp = r.por_produto.reduce((a, x) => ({ qtd: a.qtd + x.qtd, total: a.total + x.total }),
        { qtd: 0, total: 0 });
      h += tabela('📦 Produtos vendidos no evento',
        `<th>Produto</th><th>Ref.</th><th>Cor / Tam.</th><th class="num">Qtd vendida</th>
         <th class="num">Preço unit.</th><th class="num">Total</th>`,
        (r.por_produto.map(x => `<tr><td>${esc(x.produto)}</td><td>${esc(x.referencia || '—')}</td>
          <td>${esc([x.cor, x.tamanho].filter(y => y && y !== 'Única' && y !== 'U').join(' · ') || '—')}</td>
          <td class="num"><b>${x.qtd}</b></td>
          <td class="num">${moeda(x.qtd ? x.total / x.qtd : 0)}</td>
          <td class="num"><b>${moeda(x.total)}</b></td></tr>`).join('')
          + (r.por_produto.length ? `<tr class="ev-final"><td colspan="3"><b>Total de peças</b></td>
             <td class="num"><b>${tp.qtd}</b></td><td></td>
             <td class="num"><b>${moeda(tp.total)}</b></td></tr>` : ''))
        || '<tr><td colspan="6" class="vazio">Nenhum produto vendido no período.</td></tr>');
    }

    res.innerHTML = h || '<div class="painel"><div class="vazio">Nenhuma seção selecionada.</div></div>';
    res.querySelectorAll('.ev-linha').forEach(tr => {
      tr.onclick = () => {
        const alvo = res.querySelector(`.ev-itens[data-de="${tr.dataset.venda}"]`);
        if (!alvo) return;
        const abrir = alvo.hasAttribute('hidden');
        if (abrir) alvo.removeAttribute('hidden'); else alvo.setAttribute('hidden', '');
        const seta = tr.querySelector('.ev-seta');
        if (seta) seta.textContent = abrir ? '▾' : '▸';
      };
    });
  }

  async function gerar() {
    const p = params();
    if (!p.inicio || !p.fim) { toast('Informe início e fim do evento.', true); return; }
    if (p.fim <= p.inicio) { toast('O fim precisa ser depois do início.', true); return; }
    res.innerHTML = '<div class="painel"><div class="vazio">Carregando…</div></div>';
    const r = await api('relatorios:evento', p);
    if (!r.ok) { toast(r.erro || 'Erro ao gerar o relatório.', true); res.innerHTML = ''; return; }
    dados = r;
    render(r, secoes());
    q('#ev-print').disabled = false;
    q('#ev-xlsx').disabled = false;
  }

  q('#ev-gerar').onclick = gerar;
  bloco.querySelectorAll('[data-sec]').forEach(c => {
    c.onchange = () => { if (dados) render(dados, secoes()); };
  });
  bloco.querySelectorAll('[data-atalho]').forEach(b => {
    b.onclick = () => {
      let a, z;
      if (b.dataset.atalho === 'sab') { a = _inicioEventoPadrao(); z = new Date(a.getTime() + 8 * 3600e3); }
      else {
        a = new Date(); a.setDate(a.getDate() - 1); a.setHours(18, 0, 0, 0);
        z = new Date(a.getTime() + 8 * 3600e3);
      }
      q('#ev-ini').value = _dtLocal(a); q('#ev-fim').value = _dtLocal(z);
      gerar();
    };
  });

  q('#ev-print').onclick = () => {
    const c = res.cloneNode(true);
    c.querySelectorAll('[hidden]').forEach(x => x.removeAttribute('hidden'));
    c.querySelectorAll('.ev-seta').forEach(x => x.remove());
    const p = params();
    toast('Na janela de impressão, escolha "Salvar como PDF" para gerar o arquivo.');
    imprimirRelatorio(`Relatório do evento — ${_dtBr(p.inicio)} até ${_dtBr(p.fim)}`, c.innerHTML);
  };

  q('#ev-xlsx').onclick = async () => {
    toast('Gerando Excel…');
    const p = Object.assign({}, params(), { secoes: secoes() });
    const r = await api('relatorios:eventoXlsx', p);
    if (!r.ok) { toast(r.erro || 'Erro ao gerar o Excel.', true); return; }
    const bin = atob(r.buffer);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `evento-${String(p.inicio).slice(0, 10)}.xlsx`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Excel baixado.');
  };

  corpo.appendChild(bloco);
  gerar();
}

// ---------- Receita por loja ----------
async function abaPorLoja(corpo, per) {
  const r = await api('relatorios:receitaPorLoja', per);
  if (!r.ok) { toast(r.erro, true); return; }
  const maxTotal = Math.max(1, ...r.lojas.map(l => l.total));
  const linhas = r.lojas.map(l => {
    const pct = r.total > 0 ? Math.round((l.total / r.total) * 100) : 0;
    const largura = Math.round((l.total / maxTotal) * 100);
    return `<tr>
      <td><b>${esc(l.loja)}</b></td>
      <td class="num">${l.qtd}</td>
      <td class="num">${moeda(l.ticket)}</td>
      <td class="num"><b>${moeda(l.total)}</b></td>
      <td style="width:34%">
        <div style="background:var(--fundo);border-radius:6px;overflow:hidden;height:16px">
          <div style="width:${largura}%;background:var(--vinho);height:16px"></div>
        </div>
        <small style="color:var(--texto-suave)">${pct}% do total</small>
      </td></tr>`;
  }).join('');

  const bloco = el(`
    <div>
      <div class="cards">
        <div class="card"><div class="rotulo">Lojas ativas</div><div class="valor">${r.lojas.length}</div></div>
        <div class="card"><div class="rotulo">Vendas (todas)</div><div class="valor">${r.qtd}</div></div>
        <div class="card"><div class="rotulo">Receita TOTAL</div><div class="valor" style="color:var(--verde)">${moeda(r.total)}</div></div>
      </div>
      <div class="painel"><div class="barra"><b>Receita por loja</b>
        <button class="btn btn-suave" id="exp-loja" style="margin-left:auto">Exportar CSV</button></div>
        <table>
          <thead><tr><th>Loja</th><th class="num">Vendas</th><th class="num">Ticket médio</th>
            <th class="num">Receita</th><th>Participação</th></tr></thead>
          <tbody>${linhas || '<tr><td colspan="5" class="vazio">Nenhuma venda no período.</td></tr>'}</tbody>
          <tfoot><tr style="border-top:2px solid var(--borda)">
            <td><b>TOTAL</b></td><td class="num"><b>${r.qtd}</b></td><td></td>
            <td class="num"><b>${moeda(r.total)}</b></td><td></td></tr></tfoot>
        </table></div>
    </div>`);
  bloco.querySelector('#exp-loja').onclick = () =>
    baixarCsv('receita-por-loja', ['Loja', 'Vendas', 'Ticket medio (R$)', 'Receita (R$)'],
      r.lojas.map(l => [l.loja, l.qtd, l.ticket.toFixed(2).replace('.', ','), l.total.toFixed(2).replace('.', ',')]));
  corpo.appendChild(bloco);
}

// ---------- Consignados (mensal, para pagamento aos fornecedores) ----------
async function abaConsignados(corpo) {
  const mesAtual = new Date().toISOString().slice(0, 7);
  const bloco = el(`
    <div>
      <div class="painel" style="margin-bottom:14px"><div class="barra">
        <label style="font-weight:600">Mês de referência</label>
        <input type="month" id="cs-mes" value="${mesAtual}"
          style="padding:7px 10px;border:1px solid var(--borda);border-radius:8px">
        <button class="btn btn-suave" id="cs-exp" style="margin-left:auto">Exportar CSV</button>
      </div></div>
      <div class="cards" id="cs-cards"></div>
      <div class="painel"><div class="barra"><b>Pagamento aos consignados</b>
        <small style="color:var(--texto-suave)">parte do fornecedor = custo da peça + fatia do lucro</small></div>
        <table>
          <thead><tr><th>Fornecedor</th><th class="num">Peças</th><th class="num">Venda</th>
            <th class="num">Custo</th><th class="num">Parte fornecedor</th><th class="num">Parte loja</th>
            <th class="num">Já acertado</th><th class="num">A PAGAR</th></tr></thead>
          <tbody id="cs-tbody"></tbody>
          <tfoot id="cs-tfoot"></tfoot>
        </table></div>
    </div>`);
  let dados = null;
  async function carregar() {
    const r = await api('relatorios:consignados', { mes: bloco.querySelector('#cs-mes').value });
    if (!r.ok) { toast(r.erro, true); return; }
    dados = r;
    const t = r.totais;
    bloco.querySelector('#cs-cards').innerHTML = `
      <div class="card"><div class="rotulo">Peças consignadas vendidas</div><div class="valor">${t.pecas}</div></div>
      <div class="card"><div class="rotulo">Venda total</div><div class="valor">${moeda(t.venda)}</div></div>
      <div class="card"><div class="rotulo">Parte da loja</div><div class="valor" style="color:var(--verde)">${moeda(t.parte_loja)}</div></div>
      <div class="card"><div class="rotulo">A PAGAR aos fornecedores</div><div class="valor" style="color:var(--vermelho)">${moeda(t.a_pagar)}</div></div>`;
    const tbody = bloco.querySelector('#cs-tbody');
    tbody.innerHTML = '';
    if (!r.fornecedores.length) {
      tbody.appendChild(el('<tr><td colspan="8" class="vazio">Nenhuma venda de consignado neste mês.</td></tr>'));
    }
    for (const f of r.fornecedores) {
      tbody.appendChild(el(`<tr>
        <td><b>${esc(f.fornecedor)}</b></td>
        <td class="num">${f.pecas}</td>
        <td class="num">${moeda(f.venda)}</td>
        <td class="num">${moeda(f.custo)}</td>
        <td class="num">${moeda(f.parte_fornecedor)} <small style="color:var(--texto-suave)">(custo + ${moeda(f.lucro_fornecedor)})</small></td>
        <td class="num" style="color:var(--verde)">${moeda(f.parte_loja)}</td>
        <td class="num">${moeda(f.ja_acertado)}</td>
        <td class="num"><b style="color:var(--vermelho)">${moeda(f.a_pagar)}</b></td>
      </tr>`));
    }
    bloco.querySelector('#cs-tfoot').innerHTML = `<tr style="border-top:2px solid var(--borda)">
      <td><b>TOTAL</b></td><td class="num"><b>${t.pecas}</b></td>
      <td class="num"><b>${moeda(t.venda)}</b></td><td class="num"><b>${moeda(t.custo)}</b></td>
      <td class="num"><b>${moeda(t.parte_fornecedor)}</b></td><td class="num"><b>${moeda(t.parte_loja)}</b></td>
      <td class="num"><b>${moeda(t.ja_acertado)}</b></td><td class="num"><b>${moeda(t.a_pagar)}</b></td></tr>`;
  }
  bloco.querySelector('#cs-mes').addEventListener('change', carregar);
  bloco.querySelector('#cs-exp').onclick = () => {
    if (!dados) return;
    baixarCsv('consignados-' + dados.mes,
      ['Fornecedor', 'Pecas', 'Venda (R$)', 'Custo (R$)', 'Parte fornecedor (R$)', 'Parte loja (R$)', 'Ja acertado (R$)', 'A pagar (R$)'],
      dados.fornecedores.map(f => [f.fornecedor, f.pecas,
        f.venda.toFixed(2).replace('.', ','), f.custo.toFixed(2).replace('.', ','),
        f.parte_fornecedor.toFixed(2).replace('.', ','), f.parte_loja.toFixed(2).replace('.', ','),
        f.ja_acertado.toFixed(2).replace('.', ','), f.a_pagar.toFixed(2).replace('.', ',')]));
  };
  corpo.appendChild(bloco);
  carregar();
}

// ---------- Curva ABC ----------
async function abaAbc(corpo, per) {
  const r = await api('relatorios:abc', per);
  if (!r.ok) { toast(r.erro, true); return; }
  const cor = { A: 'var(--verde)', B: '#9A6B15', C: 'var(--vermelho)' };
  const linhas = r.produtos.map(p => `<tr>
    <td><b style="color:${cor[p.classe]}">${p.classe}</b></td>
    <td><b>${esc(p.nome)}</b>${p.referencia ? ` <small style="color:var(--texto-suave)">${esc(p.referencia)}</small>` : ''}</td>
    <td class="num">${p.pecas}</td>
    <td class="num"><b>${moeda(p.receita)}</b></td>
    <td class="num">${p.pct}%</td>
    <td class="num" style="color:${p.margem >= 0 ? 'var(--verde)' : 'var(--vermelho)'}">${moeda(p.margem)}</td>
  </tr>`).join('');
  const bloco = el(`
    <div class="painel">
      <div class="barra"><b>Curva ABC por receita</b> <small style="color:var(--texto-suave)">
        A = top 80% · B = 80–95% · C = resto</small>
        <button class="btn btn-suave" id="exp" style="margin-left:auto">Exportar CSV</button></div>
      <table><thead><tr><th></th><th>Produto</th><th class="num">Peças</th>
        <th class="num">Receita</th><th class="num">% do total</th><th class="num">Margem</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="6" class="vazio">Sem vendas no período.</td></tr>'}</tbody></table>
    </div>`);
  bloco.querySelector('#exp').onclick = () =>
    baixarCsv('curva-abc', ['Classe', 'Produto', 'Referência', 'Peças', 'Receita (R$)', '% total', 'Margem (R$)'],
      r.produtos.map(p => [p.classe, p.nome, p.referencia || '', p.pecas,
        p.receita.toFixed(2).replace('.', ','), p.pct + '%', p.margem.toFixed(2).replace('.', ',')]));
  corpo.appendChild(bloco);
}

// ---------- Peças paradas ----------
async function abaParadas(corpo) {
  const bloco = el(`
    <div>
      <div class="painel" style="margin-bottom:14px"><div class="barra">
        <label style="font-weight:600">Sem venda há</label>
        <select id="pp-dias" style="padding:7px 10px;border:1px solid var(--borda);border-radius:8px">
          <option value="30">30 dias</option><option value="60" selected>60 dias</option>
          <option value="90">90 dias</option><option value="180">180 dias</option></select>
        <b id="pp-valor" style="margin-left:auto;color:var(--vermelho)"></b>
      </div></div>
      <div class="painel"><table>
        <thead><tr><th>Produto</th><th class="num">Estoque</th><th class="num">Preço</th>
          <th class="num">Parado (R$)</th><th>Última venda</th></tr></thead>
        <tbody></tbody></table></div>
    </div>`);
  const tbody = bloco.querySelector('tbody');
  async function carregar() {
    const r = await api('relatorios:paradas', { dias: Number(bloco.querySelector('#pp-dias').value) });
    if (!r.ok) { toast(r.erro, true); return; }
    bloco.querySelector('#pp-valor').textContent = `${moeda(r.valor_parado)} parados na loja`;
    tbody.innerHTML = '';
    if (!r.produtos.length) { tbody.appendChild(el(`<tr><td colspan="5" class="vazio">Nada parado. 🎉</td></tr>`)); return; }
    for (const p of r.produtos) {
      tbody.appendChild(el(`<tr>
        <td><b>${esc(p.nome)}</b>${p.referencia ? ` <small style="color:var(--texto-suave)">${esc(p.referencia)}</small>` : ''}</td>
        <td class="num">${p.estoque}</td>
        <td class="num">${moeda(p.preco_venda)}</td>
        <td class="num"><b>${moeda(p.estoque * p.preco_venda)}</b></td>
        <td>${p.ultima_venda ? dataBr(p.ultima_venda) : '<span class="pill pill-baixo">nunca vendeu</span>'}</td>
      </tr>`));
    }
  }
  bloco.querySelector('#pp-dias').addEventListener('change', carregar);
  corpo.appendChild(bloco);
  carregar();
}


// ── Aba: Estoque (v3.4.0) ───────────────────────────────────────────────────
// Serve para três coisas que o Marcio faz na prática:
//   1. ver o estoque organizado (produto → variações → total), que a tela de
//      Estoque não faz: lá é uma lista plana, sem soma nenhuma
//   2. BATER O ESTOQUE COM O FÍSICO — por isso a coluna "Contado" em branco
//   3. CONFERIR RECEBIMENTO — por isso o filtro por data de cadastro
// O período do topo da tela não vale aqui: estoque é uma foto de AGORA.
async function abaEstoque(corpo) {
  _estiloEstoqueRel();
  const [cats, forns] = await Promise.all([
    api('categorias:listar'), api('fornecedores:listar', {})
  ]);
  const optCats = '<option value="">Todas as categorias</option>' +
    ((cats.ok && cats.categorias) || []).map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  const optForns = '<option value="">Todos os fornecedores</option>' +
    ((forns.ok && forns.fornecedores) || []).map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join('');

  const painel = el(`
    <div class="painel">
      <div class="est-filtros">
        <div class="campo"><label>Categoria</label><select id="es-cat">${optCats}</select></div>
        <div class="campo"><label>Fornecedor</label><select id="es-forn">${optForns}</select></div>
        <div class="campo"><label>Situação</label>
          <select id="es-sit">
            <option value="com">Só com estoque</option>
            <option value="todos">Todos</option>
            <option value="sem">Só zerados</option>
          </select></div>
        <div class="campo"><label>Cadastrados de</label><input id="es-de" type="date"></div>
        <div class="campo"><label>até</label><input id="es-ate" type="date"></div>
        <div class="campo"><label>Agrupar por</label>
          <select id="es-grupo">
            <option value="produto">Produto</option>
            <option value="data">Data de cadastro (recebimento)</option>
            <option value="categoria">Categoria</option>
          </select></div>
      </div>
      <div class="est-opcoes">
        <label><input type="checkbox" id="es-locais" checked> Colunas por local</label>
        <label><input type="checkbox" id="es-codigo"> Código de barras</label>
        ${pode('produtos.custo') ? '<label><input type="checkbox" id="es-custo" checked> Valor de custo</label>' : ''}
        <label><input type="checkbox" id="es-venda" checked> Valor de venda</label>
        <label title="Coluna vazia para escrever a contagem à mão"><input type="checkbox" id="es-contado"> Coluna “Contado” (conferência)</label>
        <button class="btn btn-primario" id="es-gerar">Gerar relatório</button>
        <button class="btn btn-suave" id="es-xlsx" disabled>📊 Excel</button>
      </div>
      <p class="est-dica">
        Para <b>bater o estoque com o físico</b>, marque “Contado”, imprima e conte peça por peça.
        Para <b>conferir uma remessa</b>, preencha o período em “Cadastrados de/até”.
      </p>
      <div id="es-saida"><div class="vazio">Escolha os filtros e clique em <b>Gerar relatório</b>.</div></div>
    </div>`);
  corpo.appendChild(painel);

  const q = (sel) => painel.querySelector(sel);
  let ultimo = null;

  async function gerar() {
    q('#es-saida').innerHTML = '<div class="vazio">Carregando…</div>';
    const r = await api('relatorios:estoque', {
      categoria_id: q('#es-cat').value || null,
      fornecedor_id: q('#es-forn').value || null,
      situacao: q('#es-sit').value,
      de: q('#es-de').value || '',
      ate: q('#es-ate').value || ''
    });
    if (!r.ok) { q('#es-saida').innerHTML = `<div class="vazio">${esc(r.erro || 'Erro ao gerar.')}</div>`; return; }
    ultimo = r;
    q('#es-xlsx').disabled = !r.produtos.length;
    q('#es-saida').innerHTML = montarHtml(r, opcoes());
  }

  const opcoes = () => ({
    grupo: q('#es-grupo').value,
    locais: q('#es-locais').checked,
    codigo: q('#es-codigo').checked,
    custo: !!q('#es-custo')?.checked,
    venda: q('#es-venda').checked,
    contado: q('#es-contado').checked
  });

  q('#es-gerar').onclick = gerar;
  // marcar/desmarcar coluna redesenha na hora, sem ir ao banco de novo
  ['#es-locais', '#es-codigo', '#es-custo', '#es-venda', '#es-contado', '#es-grupo'].forEach(sel => {
    q(sel)?.addEventListener('change', () => { if (ultimo) q('#es-saida').innerHTML = montarHtml(ultimo, opcoes()); });
  });

  q('#es-xlsx').onclick = () => {
    if (!ultimo) return;
    const o = opcoes();
    const cab = ['Produto', 'Referência', 'Categoria', 'Cadastrado em', 'Cor', 'Tamanho'];
    if (o.codigo) cab.push('Cód. barras');
    if (o.locais) for (const l of ultimo.locais) cab.push(l.nome);
    cab.push('Total');
    if (o.contado) cab.push('Contado', 'Diferença');
    if (o.custo) cab.push('Valor custo');
    if (o.venda) cab.push('Valor venda');

    const linhas = [];
    for (const p of ultimo.produtos) {
      for (const v of p.variacoes) {
        const li = [p.nome, p.referencia, p.categoria, dataBr(p.cadastrado_em), v.cor, v.tamanho];
        if (o.codigo) li.push(v.codigo_barras);
        if (o.locais) for (const l of ultimo.locais) li.push(v.por_local[l.id]);
        li.push(v.total);
        if (o.contado) li.push('', '');
        if (o.custo) li.push(v.valor_custo);
        if (o.venda) li.push(v.valor_venda);
        linhas.push(li);
      }
      // linha de subtotal do produto
      const sub = [`TOTAL — ${p.nome}`, '', '', '', '', ''];
      if (o.codigo) sub.push('');
      if (o.locais) for (const l of ultimo.locais) sub.push(p.por_local[l.id]);
      sub.push(p.total);
      if (o.contado) sub.push('', '');
      if (o.custo) sub.push(p.valor_custo);
      if (o.venda) sub.push(p.valor_venda);
      linhas.push(sub);
    }
    const fim = ['TOTAL GERAL', '', '', '', '', ''];
    if (o.codigo) fim.push('');
    if (o.locais) for (const l of ultimo.locais) fim.push(ultimo.resumo.por_local[l.id]);
    fim.push(ultimo.resumo.pecas);
    if (o.contado) fim.push('', '');
    if (o.custo) fim.push(ultimo.resumo.valor_custo);
    if (o.venda) fim.push(ultimo.resumo.valor_venda);
    linhas.push(fim);

    baixarCsv(`estoque-${hoje()}`, cab, linhas);
  };

  function montarHtml(r, o) {
    if (!r.produtos.length) return '<div class="vazio">Nenhum produto com esses filtros.</div>';
    const nLoc = o.locais ? r.locais.length : 0;
    let cols = 2 + (o.codigo ? 1 : 0) + nLoc + 1 + (o.contado ? 2 : 0) + (o.custo ? 1 : 0) + (o.venda ? 1 : 0);

    const cab = `<tr>
      <th>Cor</th><th>Tamanho</th>
      ${o.codigo ? '<th>Cód. barras</th>' : ''}
      ${o.locais ? r.locais.map(l => `<th class="num">${esc(l.nome)}</th>`).join('') : ''}
      <th class="num">Total</th>
      ${o.contado ? '<th class="num est-branco">Contado</th><th class="num est-branco">Dif.</th>' : ''}
      ${o.custo ? '<th class="num">Custo</th>' : ''}
      ${o.venda ? '<th class="num">Venda</th>' : ''}
    </tr>`;

    let h = `<div class="est-resumo">
      <span><b>${r.resumo.produtos}</b> produto(s)</span>
      <span><b>${r.resumo.variacoes}</b> variação(ões)</span>
      <span><b>${r.resumo.pecas}</b> peça(s)</span>
      ${o.custo ? `<span>Custo <b>${moeda(r.resumo.valor_custo)}</b></span>` : ''}
      ${o.venda ? `<span>Venda <b>${moeda(r.resumo.valor_venda)}</b></span>` : ''}
      ${r.resumo.abaixo_minimo ? `<span class="est-alerta">${r.resumo.abaixo_minimo} abaixo do mínimo</span>` : ''}
    </div>`;

    if (r.resumo.divergencia) {
      h += `<div class="est-divergencia">⚠️ ${Math.abs(r.resumo.divergencia)} peça(s) sem local definido —
        aparecem no Total mas não estão em nenhum estoque. Use 🏢 Estoques para distribuir.</div>`;
    }

    // Agrupamento: "data" junta tudo que foi cadastrado no mesmo dia — é assim
    // que se confere uma remessa recebida dias atrás. "categoria" agrupa por
    // seção da loja. "produto" (padrão) não quebra nada.
    const blocos = agrupar(r.produtos, o.grupo);

    for (const bloco of blocos) {
      if (bloco.rotulo) {
        const pecas = bloco.itens.reduce((s2, x) => s2 + x.total, 0);
        h += `<div class="est-bloco">
          <span>${esc(bloco.rotulo)}</span>
          <span class="est-bloco-tot">${bloco.itens.length} produto(s) · ${pecas} peça(s)</span>
        </div>`;
      }
      for (const p of bloco.itens) {
      h += `<table class="est-tabela">
        <thead>
          <tr class="est-prod"><th colspan="${cols}">
            ${esc(p.nome)}
            ${p.referencia ? `<span class="est-ref">Ref. ${esc(p.referencia)}</span>` : ''}
            <span class="est-cat">${esc(p.categoria)}</span>
            ${p.consignado ? '<span class="est-consig">consignado</span>' : ''}
            <span class="est-data">cadastrado em ${dataBr(p.cadastrado_em)}</span>
          </th></tr>
          ${cab}
        </thead>
        <tbody>
          ${p.variacoes.map(v => `<tr${v.abaixo ? ' class="est-baixo"' : ''}>
            <td>${esc(v.cor)}</td><td>${esc(v.tamanho)}</td>
            ${o.codigo ? `<td class="est-cod">${esc(v.codigo_barras)}</td>` : ''}
            ${o.locais ? r.locais.map(l => `<td class="num">${v.por_local[l.id] || '—'}</td>`).join('') : ''}
            <td class="num"><b>${v.total}</b>${v.abaixo ? ` <small title="mínimo ${v.minimo}">▼</small>` : ''}</td>
            ${o.contado ? '<td class="est-branco"></td><td class="est-branco"></td>' : ''}
            ${o.custo ? `<td class="num">${moeda(v.valor_custo)}</td>` : ''}
            ${o.venda ? `<td class="num">${moeda(v.valor_venda)}</td>` : ''}
          </tr>`).join('')}
          <tr class="est-subtotal">
            <td colspan="${2 + (o.codigo ? 1 : 0)}"><b>Total do produto</b></td>
            ${o.locais ? r.locais.map(l => `<td class="num"><b>${p.por_local[l.id]}</b></td>`).join('') : ''}
            <td class="num"><b>${p.total}</b></td>
            ${o.contado ? '<td class="est-branco"></td><td class="est-branco"></td>' : ''}
            ${o.custo ? `<td class="num"><b>${moeda(p.valor_custo)}</b></td>` : ''}
            ${o.venda ? `<td class="num"><b>${moeda(p.valor_venda)}</b></td>` : ''}
          </tr>
        </tbody>
      </table>`;
      }
    }

    h += `<table class="est-tabela est-geral"><tbody><tr>
      <td><b>TOTAL GERAL</b> — ${r.resumo.produtos} produto(s), ${r.resumo.variacoes} variação(ões)</td>
      ${o.locais ? r.locais.map(l => `<td class="num"><b>${r.resumo.por_local[l.id]}</b><small>${esc(l.nome)}</small></td>`).join('') : ''}
      <td class="num est-total-final"><b>${r.resumo.pecas}</b><small>peças</small></td>
      ${o.custo ? `<td class="num"><b>${moeda(r.resumo.valor_custo)}</b><small>custo</small></td>` : ''}
      ${o.venda ? `<td class="num"><b>${moeda(r.resumo.valor_venda)}</b><small>venda</small></td>` : ''}
    </tr></tbody></table>`;
    return h;
  }

  gerar();
}

// Quebra a lista de produtos em blocos conforme o agrupamento escolhido.
// Sem agrupamento devolve um bloco único e sem rótulo.
function agrupar(produtos, modo) {
  if (modo !== 'data' && modo !== 'categoria') return [{ rotulo: '', itens: produtos }];
  const mapa = new Map();
  for (const p of produtos) {
    const chave = modo === 'data' ? (p.cadastrado_em || 'sem data') : (p.categoria || 'Sem categoria');
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(p);
  }
  const chaves = [...mapa.keys()].sort();
  if (modo === 'data') chaves.reverse();   // recebimento mais recente primeiro
  return chaves.map(k => ({
    rotulo: modo === 'data'
      ? `📅 Cadastrados em ${dataBr(k)}`
      : `🏷️ ${k}`,
    itens: mapa.get(k)
  }));
}

function _estiloEstoqueRel() {
  if (document.getElementById('estilo-estoque-rel')) return;
  const st = document.createElement('style');
  st.id = 'estilo-estoque-rel';
  st.textContent = `
    .est-filtros{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:10px}
    .est-filtros .campo{margin:0}
    .est-opcoes{display:flex;flex-wrap:wrap;gap:14px;align-items:center;padding:10px 0;border-top:1px solid var(--borda)}
    .est-opcoes label{display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer}
    .est-opcoes .btn{margin-left:auto}
    .est-dica{font-size:11.5px;color:var(--texto-suave);margin:0 0 12px}
    .est-resumo{display:flex;flex-wrap:wrap;gap:16px;background:var(--creme);border-radius:8px;padding:9px 14px;margin-bottom:12px;font-size:12.5px}
    .est-alerta{color:var(--vermelho,#dc2626);font-weight:600}
    .est-divergencia{background:#FDF8EC;border-left:3px solid var(--destaque,#F2C14E);padding:7px 12px;margin-bottom:12px;font-size:12px;border-radius:4px}
    .est-bloco{display:flex;justify-content:space-between;align-items:center;background:var(--creme);border-left:4px solid var(--vinho);padding:7px 12px;margin:16px 0 8px;font-weight:700;font-size:13px;color:var(--vinho);border-radius:0 6px 6px 0}
    .est-bloco-tot{font-weight:600;font-size:11.5px;color:var(--texto-suave)}
    .est-tabela{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px;page-break-inside:avoid}
    .est-tabela th,.est-tabela td{border:1px solid var(--borda);padding:4px 7px}
    .est-prod th{background:var(--vinho);color:#fff;text-align:left;font-size:13px;padding:6px 9px}
    .est-ref,.est-cat,.est-consig,.est-data{font-weight:400;font-size:11px;opacity:.85;margin-left:10px}
    .est-tabela thead tr:not(.est-prod) th{background:#F6E9E9;color:var(--vinho);font-size:11px}
    .est-subtotal td{background:var(--creme)}
    .est-baixo td{background:#FFF6F6}
    .est-cod{font-family:monospace;font-size:10.5px}
    .est-branco{background:#fff !important;min-width:62px}
    .est-geral td{background:var(--vinho);color:#fff;font-size:13px;padding:9px}
    .est-geral small{display:block;font-size:10px;opacity:.8;font-weight:400}
    .est-total-final{font-size:15px}
    @media print{
      .est-opcoes,.est-filtros,.est-dica{display:none !important}
      .est-prod th{background:#7E1114 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .est-geral td{background:#7E1114 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .est-subtotal td,.est-resumo{background:#F6E9E9 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }`;
  document.head.appendChild(st);
}
