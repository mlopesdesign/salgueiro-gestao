// Relatórios — vendas, curva ABC, peças paradas, exportação CSV/PDF/impressão
import { api, el, esc, moeda, toast, modal, getConfig, pode } from './app.js';
import { imprimirFolhaA4 } from './impressao.js';

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
  imprimirFolhaA4(area);   // A4, só o relatório na folha (v3.29.1)
}

const hoje = () => new Date().toISOString().slice(0, 10);
const inicioMes = () => hoje().slice(0, 8) + '01';
const dataBr = (d) => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';

// Baixa um arquivo que veio do backend em base64 (Excel gerado pelo XLSX).
function baixarBase64(base64, nome) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = nome;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

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
        <button data-aba="maisvendidos">🏆 Mais vendidos</button>
        <button data-aba="consignados">Consignados</button>
        <button data-aba="abc">Curva ABC</button>
        <button data-aba="paradas">Peças paradas</button>
        ${pode('estoque.ver') ? '<button data-aba="estoque">📦 Estoque</button>' : ''}
        <button data-aba="acompanhadas">👁️ Compras acompanhadas</button>
      </div>
      <div id="aba-conteudo"></div>
    </div>`);
  const corpo = tela.querySelector('#aba-conteudo');
  const periodo = () => ({ de: tela.querySelector('#r-de').value, ate: tela.querySelector('#r-ate').value });
  const abas = { vendas: abaVendas, evento: abaEvento, lojas: abaPorLoja, maisvendidos: abaMaisVendidos, consignados: abaConsignados, abc: abaAbc, paradas: abaParadas, estoque: abaEstoque, acompanhadas: abaAcompanhadas };
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
  const _subCard = (getConfig && getConfig() || {}).relatorio_cards_detalhe !== '0';
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
        ${(r.resumo.qtd_trocas || 0) > 0 ? `<div class="card"><div class="rotulo">Diferença de trocas</div>
          <div class="valor">${moeda(r.resumo.trocas || 0)}</div>
          <div class="card-rodape">${r.resumo.qtd_trocas} troca(s) · entra no total como troca</div></div>
        <div class="card"><div class="rotulo">Total recebido</div>
          <div class="valor">${moeda(r.resumo.total_geral || 0)}</div>
          <div class="card-rodape">vendas + diferença de trocas</div></div>` : ''}
        <div class="card ev-card-salgueiro"><div class="rotulo">Vendas do Salgueiro</div>
          <div class="valor">${moeda((r.resumo.origem || {}).proprio?.total || 0)}</div>
          ${_subCard ? `<div class="ev-card-sub">${(r.resumo.origem || {}).proprio?.pecas || 0} peça(s) próprias · tabela ${moeda((r.resumo.origem || {}).proprio?.tabela || 0)}</div>` : ''}</div>
        <div class="card ev-card-consig"><div class="rotulo">Vendas de consignados</div>
          <div class="valor">${moeda((r.resumo.origem || {}).consignado?.total || 0)}</div>
          ${_subCard ? `<div class="ev-card-sub">${(r.resumo.origem || {}).consignado?.pecas || 0} peça(s) de fornecedor · tabela ${moeda((r.resumo.origem || {}).consignado?.tabela || 0)}</div>` : ''}</div>
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
  ['descontos', 'Descontos no fechamento', true],
  ['vendas_custo', 'Vendas a preço de custo', true],
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
    .ev-orig { font-size:11px; padding:2px 7px; border-radius:10px; white-space:nowrap; }
    .ev-orig-aut { background:rgba(184,135,59,.18); color:#7a5716; }
    .ev-orig-auto { background:rgba(0,0,0,.07); color:#555; }
    /* Vendido por origem da peça (v3.11.0) */
    .ev-card-salgueiro { border-left:3px solid var(--vinho); }
    .ev-card-consig { border-left:3px solid #1D9E75; }
    .ev-card-consig .valor { color:#0F6E56; }
    /* Cartões de desconto e cortesia — o que sai do faturamento (v3.9.0) */
    .ev-card-abate { border-left:3px solid var(--dourado); }
    .ev-card-abate .valor { color:#b45309; }
    .ev-card-sub { font-size:11px; opacity:.7; margin-top:3px; }
    /* Peça consignada sem repasse: o que explica o cartão não bater com a
       seção de comissão. Fica em vermelho porque é cadastro para arrumar. */
    .ev-card-alerta { font-size:11px; margin-top:5px; color:#b3261e; font-weight:600; line-height:1.4; }
    .ev-sem-repasse { background:#FFF4F3; border:1px solid #f0c4c0; border-radius:8px;
      padding:10px 12px; margin:10px 0; font-size:12.5px; line-height:1.55; }
    .ev-sem-repasse b { color:#b3261e; }
    .ev-sem-repasse table { width:100%; margin-top:7px; border-collapse:collapse; font-size:12px; }
    .ev-sem-repasse td { padding:3px 6px; border-top:1px solid #f2d6d3; }
    /* Conciliação da lista de produtos com o faturamento (v3.9.0) */
    .ev-conc td { background:rgba(0,0,0,.03); font-size:13px; padding:7px 8px; }
    .ev-conc td:last-child { text-align:right; font-variant-numeric:tabular-nums; }
    .ev-conc-fim td { background:rgba(184,135,59,.14); font-size:15px;
      border-top:2px solid var(--dourado); border-bottom:2px solid var(--dourado); }
    .ev-vendas .ev-linha { cursor:pointer; }
    .ev-vendas .ev-linha:hover { background:rgba(0,0,0,.04); }
    .ev-seta { display:inline-block; width:14px; opacity:.6; }
    .ev-sub { width:100%; border-collapse:collapse; margin:4px 0; font-size:12px; }
    .ev-sub th, .ev-sub td { padding:3px 6px; border-bottom:1px solid var(--borda); }
    .ev-itens > td { background:rgba(0,0,0,.03); padding:6px 12px !important; }
    .ev-consig { font-size:12px; margin-top:4px; opacity:.85; }
    .num { text-align:right; }
    /* Menu suspenso de navegação por seção (v3.23.0) */
    .ev-nav { position:sticky; top:0; z-index:20; background:var(--fundo);
      border-bottom:1px solid var(--borda); padding:6px 0 5px; margin:0 0 12px; }
    .ev-nav-sel { font-size:13px; padding:5px 10px; border:1px solid var(--borda);
      border-radius:8px; background:var(--fundo); color:var(--texto); cursor:pointer;
      min-width:220px; max-width:320px; }
    .ev-nav-sel:focus { outline:2px solid var(--primaria); }
    @media print { .ev-nav { display:none } }
    /* scroll-margin para o dropdown não cobrir o topo da seção */
    .painel[id^="ev-s-"] { scroll-margin-top:44px }`;
  document.head.appendChild(st);
}

async function abaEvento(corpo) {
  _estiloEvento();
  const _subCard = (getConfig && getConfig() || {}).relatorio_cards_detalhe !== '0';
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

  const tabela = (titulo, cabs, linhas, extra, cls, id) => linhas
    ? `<div class="painel"${id ? ` id="${id}"` : ''} style="margin-bottom:14px">
         <div class="barra"><b>${esc(titulo)}</b>${extra || ''}</div>
         <table${cls ? ` class="${cls}"` : ''}><thead><tr>${cabs}</tr></thead>
         <tbody>${linhas}</tbody></table></div>`
    : '';

  function render(r, s) {
    const t = r.resumo;
    let topH = '', secH = '', _nav = [];
    const _addNav = (id, label) => _nav.push({ id, label });

    if (s.resumo) {
      // Cartões do topo. Descontos e cortesias ganharam cartão próprio (v3.9.0)
      // por pedido do Marcio: são exatamente os dois valores que separam o
      // faturamento bruto do total das peças no fim do relatório, então ficam
      // à vista desde o começo em vez de aparecerem só lá embaixo.
      const _cortesia = t.cortesias || { qtd: 0, pecas: 0, valor: 0, custo: 0 };
      const _desc = t.descontos || { qtd: 0, valor: 0 };
      const _custo = t.vendas_custo || { qtd: 0, pecas: 0, cobrado: 0, tabela: 0, margem_aberta: 0 };
      // Vendido por origem da peça (v3.11.0): os dois somam o valor de tabela
      // da conciliação no fim do relatório.
      const _orig = t.origem || { proprio: { pecas: 0, total: 0, tabela: 0 }, consignado: { pecas: 0, total: 0, tabela: 0 } };
      topH += `<div class="cards">
        <div class="card"><div class="rotulo">Vendas</div><div class="valor">${t.vendas}</div></div>
        <div class="card"><div class="rotulo">Peças vendidas</div><div class="valor">${t.pecas}</div></div>
        <div class="card"><div class="rotulo">Faturamento bruto</div><div class="valor">${moeda(t.bruto)}</div></div>
        ${(t.trocas || {}).qtd ? `<div class="card ev-card-troca"><div class="rotulo">Trocas</div>
          <div class="valor">${t.trocas.saldo < 0 ? '−' : ''}${moeda(Math.abs(t.trocas.saldo))}</div>
          ${_subCard ? `<div class="ev-card-sub">${t.trocas.qtd} troca(s) · não é venda · crédito ${moeda(t.trocas.credito)}</div>` : ''}</div>` : ''}
        <div class="card ev-card-abate"><div class="rotulo">Total em descontos</div>
          <div class="valor">${moeda(_desc.valor)}</div>
          ${_subCard ? `<div class="ev-card-sub">${_desc.qtd} venda(s) com desconto no fechamento</div>` : ''}</div>
        <div class="card ev-card-abate"><div class="rotulo">Total em cortesias</div>
          <div class="valor">${moeda(_cortesia.valor)}</div>
          ${_subCard ? `<div class="ev-card-sub">${_cortesia.pecas} peça(s) · custo ${moeda(_cortesia.custo)}</div>` : ''}</div>
        ${_custo.qtd ? `
        <div class="card ev-card-abate"><div class="rotulo">Vendido a preço de custo</div>
          <div class="valor">${moeda(_custo.cobrado)}</div>
          ${_subCard ? `<div class="ev-card-sub">${_custo.pecas} peça(s) · margem aberta ${moeda(_custo.margem_aberta)}</div>` : ''}</div>` : ''}
        <div class="card ev-card-salgueiro"><div class="rotulo">Vendas do Salgueiro</div>
          <div class="valor">${moeda(_orig.proprio.total)}</div>
          ${_subCard ? `<div class="ev-card-sub">${_orig.proprio.pecas} peça(s) próprias · tabela ${moeda(_orig.proprio.tabela)}</div>` : ''}</div>
        <div class="card ev-card-consig"><div class="rotulo">Vendas de consignados</div>
          <div class="valor">${moeda(_orig.consignado.total)}</div>
          ${_subCard ? `<div class="ev-card-sub">${_orig.consignado.pecas} peça(s) de fornecedor · tabela ${moeda(_orig.consignado.tabela)}</div>` : ''}
          ${(_orig.consignado.sem_repasse || {}).pecas
            ? `<div class="ev-card-alerta">⚠️ ${_orig.consignado.sem_repasse.pecas} peça(s)
                 (${moeda(_orig.consignado.sem_repasse.tabela)}) sem repasse — veja a seção de consignados</div>`
            : ''}</div>
      </div>`;
      _addNav('ev-s-fechamento', '📋 Fechamento');
      topH += `<div class="painel" id="ev-s-fechamento" style="margin-bottom:14px">
        <div class="barra"><b>Fechamento do evento</b>
          <span class="ev-dica">${_dtBr(r.inicio)} até ${_dtBr(r.fim)}</span></div>
        <table class="ev-tot"><tbody>
          <tr><td>Faturamento bruto</td><td class="num">${moeda(t.bruto)}</td></tr>
          <tr class="ev-neg"><td>(–) Devoluções${t.devolucoes ? '' : '<small style="display:block;opacity:.75">nenhuma peça foi devolvida neste período</small>'}</td>
            <td class="num">${moeda(t.devolucoes)}</td></tr>
          <tr><td>Faturamento líquido${t.devolucoes ? '' : '<small style="display:block;opacity:.75">igual ao bruto porque não houve devolução</small>'}</td>
            <td class="num"><b>${moeda(t.liquido)}</b></td></tr>
          <tr class="ev-neg"><td>(–) Taxas da maquininha</td><td class="num">${moeda(t.taxas)}</td></tr>
          ${t.comissao ? `<tr class="ev-neg"><td>(–) Comissão de consignados</td><td class="num">${moeda(t.comissao)}</td></tr>` : ''}
          ${(t.trocas || {}).qtd ? `
          <tr><td>Líquido das vendas</td><td class="num"><b>${moeda(t.receber_vendas)}</b></td></tr>
          <tr><td>(+) Diferença paga pelas clientes nas trocas (${t.trocas.qtd})
            <small style="display:block;opacity:.75">troca não é venda — entra aqui, separada</small></td>
            <td class="num">${moeda(t.trocas.recebido)}</td></tr>
          ${t.trocas.devolvido ? `<tr class="ev-neg"><td>(–) Troco devolvido nas trocas (dinheiro/estorno)</td>
            <td class="num">${moeda(t.trocas.devolvido)}</td></tr>` : ''}
          ${t.trocas.taxas ? `<tr class="ev-neg"><td>(–) Taxas da maquininha sobre as trocas</td>
            <td class="num">${moeda(t.trocas.taxas)}</td></tr>` : ''}` : ''}
          <tr class="ev-final"><td><b>Líquido a receber</b></td><td class="num"><b>${moeda(t.receber)}</b></td></tr>
          ${t.cortesias && t.cortesias.qtd ? `<tr class="ev-neg"><td>Cortesias — ${t.cortesias.pecas} peça(s),
            valor de tabela ${moeda(t.cortesias.valor)}</td>
            <td class="num">custo ${moeda(t.cortesias.custo)}</td></tr>` : ''}
        </tbody></table></div>`;
    }

    if (s.vendas) {
      const linhas = r.vendas.map(v => {
        const temItens = s.itens && v.itens.length;
        // Cada linha mostra o desconto que coube ÀQUELA peça — o lançado nela
        // mais a parte do desconto do fechamento. Antes o desconto da venda não
        // aparecia em item nenhum e a soma das linhas não batia com o total
        // cobrado (v3.14.0).
        const somaTabela = v.itens.reduce((a, i) => a + (i.tabela ?? i.total), 0);
        const somaDesc = v.itens.reduce((a, i) => a + (i.desconto_total ?? i.desconto ?? 0), 0);
        const somaRec = v.itens.reduce((a, i) => a + (i.recebido ?? i.total), 0);
        const sub = temItens ? `<tr class="ev-itens" data-de="${v.id}"><td colspan="8">
          <table class="ev-sub"><thead><tr>
            <th>Produto</th><th>Ref.</th><th>Cor / Tam.</th><th class="num">Qtd</th>
            <th class="num">Unit.</th><th class="num">Valor de tabela</th>
            <th class="num">Desconto</th><th class="num">Pagou</th></tr></thead>
          <tbody>${v.itens.map(it => {
            const tab = it.tabela ?? it.total;
            const dTot = it.desconto_total ?? it.desconto ?? 0;
            const dItem = it.desconto || 0;
            const dVenda = it.desconto_venda || 0;
            // Quando o abatimento veio dos dois lados, a origem aparece embaixo
            // do valor — senão o operador não sabe de onde saiu.
            const detalhe = (dItem > 0.005 && dVenda > 0.005)
              ? `<small style="display:block;opacity:.7">${moeda(dItem)} no item + ${moeda(dVenda)} da venda</small>`
              : (dVenda > 0.005 ? '<small style="display:block;opacity:.7">desconto da venda</small>' : '');
            return `<tr>
            <td>${esc(it.produto)}</td><td>${esc(it.referencia || '—')}</td>
            <td>${esc([it.cor, it.tamanho].filter(x => x && x !== 'Única' && x !== 'U').join(' · ') || '—')}</td>
            <td class="num">${it.qtd}</td><td class="num">${moeda(it.preco_unit)}</td>
            <td class="num">${moeda(tab)}</td>
            <td class="num">${dTot > 0.005 ? `<b style="color:var(--vermelho)">−${moeda(dTot)}</b>${detalhe}` : '—'}</td>
            <td class="num"><b>${moeda(it.recebido ?? it.total)}</b></td></tr>`;
          }).join('')}
          <tr class="ev-final"><td colspan="5"><b>Total da venda</b></td>
            <td class="num"><b>${moeda(somaTabela)}</b></td>
            <td class="num"><b style="color:var(--vermelho)">${somaDesc > 0.005 ? '−' + moeda(somaDesc) : '—'}</b></td>
            <td class="num"><b>${moeda(somaRec)}</b></td></tr>
          </tbody></table>
          ${v.consignados.length ? `<div class="ev-consig"><b>Consignado:</b> ${v.consignados.map(c =>
            // Antes saía "(65% = R$ 63,55)", que lia-se como 65% do preço de
            // venda — e não fecha. O repasse é custo + 65% do LUCRO; agora a
            // conta aparece inteira (v3.8.0).
            `${esc(c.produto)} — ${esc(c.fornecedor)}: repassar ${moeda(c.valor_fornecedor)} `
            + `<small>(custo ${moeda(c.valor_custo)} + ${c.pct_fornecedor}% do lucro `
            + `${moeda(c.valor_venda - c.valor_custo)})</small>`).join(' · ')}</div>` : ''}
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
      _addNav('ev-s-vendas', '🧾 Vendas');
      secH += tabela('Vendas do período',
        `<th>Venda</th><th>Data / hora</th><th>Cliente</th><th>Vendedor(a)</th>
         <th class="num">Peças</th><th>Pagamento</th><th class="num">Taxa</th><th class="num">Líquido</th>`,
        linhas || '<tr><td colspan="8" class="vazio">Nenhuma venda nesse período.</td></tr>',
        s.itens ? '<span class="ev-dica" style="margin-left:auto">Clique numa venda para recolher/abrir os itens</span>' : '',
        'ev-vendas', 'ev-s-vendas');
    }

    // Trocas (v3.28.0): seção própria. Troca não é venda — não aparece na lista
    // de vendas nem em produtos vendidos; aparece aqui, com o que voltou, o que
    // saiu e quanto entrou ou saiu de dinheiro.
    if ((r.trocas || []).length) {
      const _pecas = (lst) => lst.map(x => `${x.qtd > 1 ? x.qtd + '× ' : ''}${esc(x.produto)}`
        + `${x.cor || x.tamanho ? ` <small>${esc([x.cor, x.tamanho].filter(Boolean).join(' · '))}</small>` : ''}`).join('<br>') || '—';
      const linhasT = r.trocas.map(tr => `<tr>
          <td>${dataBr(tr.data)} <small>${esc(tr.hora)}</small></td>
          <td>${esc(tr.cliente || '—')}</td>
          <td>${_pecas(tr.voltou)}</td>
          <td>${_pecas(tr.saiu)}</td>
          <td class="num">${moeda(tr.credito)}</td>
          <td class="num">${tr.pagou ? moeda(tr.pagou) + (tr.pagamentos.length ? `<br><small>${tr.pagamentos.map(g => esc(g.forma)).join(', ')}</small>` : '') : '—'}</td>
          <td class="num">${tr.devolveu ? '−' + moeda(tr.devolveu) + `<br><small>${esc(tr.forma_reembolso)}</small>` : '—'}</td>
          <td class="num"><b>${tr.saldo < 0 ? '−' : ''}${moeda(Math.abs(tr.saldo))}</b></td></tr>`).join('');
      const tt = t.trocas || { credito: 0, recebido: 0, devolvido: 0, saldo: 0 };
      _addNav('ev-s-trocas', '🔁 Trocas');
      secH += tabela('Trocas do período',
        `<th>Data / hora</th><th>Cliente</th><th>Voltou</th><th>Levou</th>
         <th class="num">Crédito</th><th class="num">Pagou a mais</th><th class="num">Troco devolvido</th><th class="num">Saldo</th>`,
        linhasT + `<tr class="ev-final"><td colspan="4"><b>Total das trocas</b></td>
          <td class="num">${moeda(tt.credito)}</td><td class="num">${moeda(tt.recebido)}</td>
          <td class="num">${tt.devolvido ? '−' + moeda(tt.devolvido) : '—'}</td>
          <td class="num"><b>${tt.saldo < 0 ? '−' : ''}${moeda(Math.abs(tt.saldo))}</b></td></tr>`,
        '<span class="ev-dica" style="margin-left:auto">Troca não é venda: o crédito não é dinheiro; só o saldo entra no líquido a receber</span>',
        'ev-trocas', 'ev-s-trocas');
    }

    if (s.pagamentos) {
      _addNav('ev-s-pagamentos', '💳 Pagamentos');
      secH += tabela('Formas de pagamento e taxas',
        `<th>Forma</th><th class="num">Qtd</th><th class="num">Valor</th>
         <th class="num">Taxa %</th><th class="num">Taxa R$</th><th class="num">Líquido</th>`,
        r.por_forma.map(g => `<tr><td>${esc(g.forma)}</td><td class="num">${g.qtd}</td>
          <td class="num">${moeda(g.valor)}</td>
          <td class="num">${String(g.taxa_pct).replace('.', ',')}%</td>
          <td class="num">${moeda(g.taxa_valor)}</td>
          <td class="num"><b>${moeda(g.valor - g.taxa_valor)}</b></td></tr>`).join('')
        // Diferença paga nas trocas (v3.28.0): entra na maquininha/gaveta como
        // qualquer pagamento, então aparece aqui para a conferência bater — mas
        // em linha própria, marcada como troca, nunca somada a venda.
        + (() => {
          const ag = new Map();
          for (const tr of (r.trocas || [])) for (const pg of (tr.pagamentos || [])) {
            const g = ag.get(pg.forma) || { forma: pg.forma, qtd: 0, valor: 0, taxa: 0 };
            g.qtd++; g.valor += Number(pg.valor) || 0; ag.set(pg.forma, g);
          }
          for (const tr of (r.trocas || [])) {
            const tot = (tr.pagamentos || []).reduce((a, pg) => a + (Number(pg.valor) || 0), 0);
            for (const pg of (tr.pagamentos || [])) {
              const g = ag.get(pg.forma);
              if (g && tot > 0) g.taxa += (tr.taxa || 0) * (Number(pg.valor) || 0) / tot;
            }
          }
          return [...ag.values()].map(g => `<tr class="ev-linha-troca"><td>🔁 ${esc(g.forma)} <small>(diferença de troca)</small></td>
            <td class="num">${g.qtd}</td><td class="num">${moeda(g.valor)}</td>
            <td class="num">${g.valor ? (Math.round(g.taxa / g.valor * 10000) / 100).toFixed(2).replace('.', ',') : '0'}%</td>
            <td class="num">${moeda(g.taxa)}</td>
            <td class="num"><b>${moeda(g.valor - g.taxa)}</b></td></tr>`).join('');
        })()
        || '<tr><td colspan="6" class="vazio">—</td></tr>', '', '', 'ev-s-pagamentos');
    }

    if (s.consignado && r.por_fornecedor.length) {
      // O repasse NÃO é uma porcentagem do preço de venda: o fornecedor recebe
      // o custo da peça de volta MAIS a fatia dele no lucro. As colunas de
      // custo e lucro existem para que a conta feche à vista (v3.8.0).
      _addNav('ev-s-consignados', '🤝 Consignados');
      const _temDescCons = r.por_fornecedor.some(g => (g.desconto || 0) > 0.005);
      secH += tabela('Comissão de consignados',
        `<th>Fornecedor</th><th class="num">Peças</th><th class="num">Valor de tabela</th>
         <th class="num">Desconto</th><th class="num">Recebido</th>
         <th class="num">Custo das peças</th><th class="num">+ Fatia do lucro</th>
         <th class="num">= Repasse</th><th class="num">Sobra p/ a loja</th><th class="num">A pagar</th><th></th>`,
        r.por_fornecedor.map(g => `<tr><td>${esc(g.fornecedor)}</td><td class="num">${g.pecas}</td>
          <td class="num">${moeda(g.venda)}</td>
          <td class="num">${(g.desconto || 0) > 0.005 ? `<b style="color:var(--vermelho)">−${moeda(g.desconto)}</b>` : '—'}</td>
          <td class="num"><b>${moeda(g.recebido ?? g.venda)}</b></td>
          <td class="num">${moeda(g.custo)}</td>
          <td class="num">${moeda(g.lucro_fornecedor)}</td>
          <td class="num"><b>${moeda(g.comissao_ajustada)}</b></td>
          <td class="num">${moeda(g.loja_real ?? g.parte_loja)}</td>
          <td class="num">${moeda(g.pendente)}</td>
          <td><button class="btn-recibo-forn" data-fid="${g.fornecedor_id}"
            data-fnome="${esc(g.fornecedor)}"
            title="Imprimir recibo de prestação de contas"
            style="font-size:15px;padding:2px 7px;cursor:pointer;background:none;border:1px solid var(--borda);border-radius:6px;line-height:1">🖨️</button></td></tr>`).join('') +
        `<tr><td colspan="11" style="font-size:11.5px;color:var(--texto-suave);padding-top:8px;line-height:1.5">
          O fornecedor recebe o <b>custo da peça de volta</b> mais a fatia combinada
          <b>do lucro</b> (venda − custo) — não uma porcentagem do preço de venda.
          Por isso o repasse costuma ser maior que a porcentagem combinada.</td></tr>` +
        // Desde a 3.14.0 o desconto entra na base do repasse, então os dois
        // lados o dividem. Vendas gravadas ANTES disso ficaram com a base cheia
        // — a diferença aparece aqui em vez de passar despercebida.
        (r.por_fornecedor.some(g => (g.dif_desconto || 0) > 0.005)
          ? `<tr><td colspan="11" style="font-size:11.5px;padding-top:6px;line-height:1.5;
              background:rgba(184,135,59,.12)">
          ℹ️ <b>Período inclui vendas anteriores à v3.14.0.</b>
          Nelas o repasse foi originalmente gravado sobre o valor de tabela — o coluna
          "Repasse" já foi recalculada sobre o valor <b>recebido</b> (v3.21.1), igualando
          o critério das vendas novas.
          ${r.por_fornecedor.filter(g => (g.dif_desconto || 0) > 0.005).map(g =>
            `<br>${esc(g.fornecedor)}: gravado ${moeda(g.comissao)}; recalculado ${moeda(g.comissao_ajustada)}
             — ajuste de <b>${moeda(g.dif_desconto)}</b> a favor da loja.`).join('')}
          </td></tr>`
          : (_temDescCons ? `<tr><td colspan="11" style="font-size:11.5px;color:var(--texto-suave);padding-top:6px">
              Houve desconto em vendas com peça consignada. Desde a versão 3.14.0 o abatimento
              é dividido entre a loja e o fornecedor, na mesma proporção do acerto.</td></tr>` : '')),
        '', '', 'ev-s-consignados');

      // Peça consignada que não entrou em nenhum repasse (v3.20.1).
      // É o que explica o cartão do topo somar mais que esta tabela.
      const _sr = ((r.resumo.origem || {}).consignado || {}).sem_repasse;
      if (_sr && _sr.pecas) {
        secH += `<div class="ev-sem-repasse">
          <b>⚠️ ${_sr.pecas} peça(s) consignada(s) ficaram fora do repasse</b> —
          ${moeda(_sr.tabela)} de tabela, ${moeda(_sr.recebido)} recebidos.
          Elas estão marcadas como consignadas no cadastro, mas <b>sem fornecedor
          ou com percentual zerado</b>, então o sistema não teve como calcular o
          acerto. É por isso que o cartão “Vendas de consignados” soma mais do
          que esta tabela.
          <table>${_sr.itens.map(x => `<tr>
            <td>${esc(x.nome)}</td>
            <td style="color:#b3261e">${esc(x.motivo)}</td>
            <td class="num">${x.pecas} peça(s)</td>
            <td class="num">${moeda(x.tabela)}</td></tr>`).join('')}</table>
          <small>Arrume em 👗 Produtos (fornecedor e % do fornecedor) e gere o
          relatório de novo — os valores passados não mudam sozinhos.</small>
        </div>`;
      }
    }

    if (s.cortesias && r.cortesias.length) {
      _addNav('ev-s-cortesias', '🎁 Cortesias');
      const c = r.resumo.cortesias;
      secH += tabela('🎁 Cortesias (brindes)',
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
        '<span class="ev-dica" style="margin-left:auto">Saíram do estoque · não entram no faturamento</span>',
        '', 'ev-s-cortesias');
    }

    // Todo desconto dado no FECHAMENTO da venda, autorizado ou não (v3.9.0).
    // Antes só apareciam os autorizados na mão; os automáticos (categoria do
    // cliente, à vista) reduziam o faturamento sem constar em lugar nenhum.
    if (s.descontos && r.descontos && r.descontos.length) {
      _addNav('ev-s-descontos', '🏷️ Descontos');
      const d = r.resumo.descontos;
      secH += tabela('🏷️ Descontos no fechamento das vendas',
        `<th>Venda</th><th>Data / hora</th><th>Cliente</th><th>Quem lançou</th>
         <th>Origem</th><th>Autorizado por</th><th>Motivo</th>
         <th class="num">Tabela</th><th class="num">Desconto</th><th class="num">Pago</th>`,
        r.descontos.map(x => `<tr><td>#${x.venda_id}</td>
          <td>${dataBr(x.data)} <small>${esc(x.hora)}</small></td>
          <td>${esc(x.cliente || '—')}</td>
          <td>${esc(x.operador || '—')}</td>
          <td><span class="ev-orig ${x.autorizado ? 'ev-orig-aut' : 'ev-orig-auto'}">${esc(x.origem)}</span></td>
          <td><b>${esc(x.autorizado_por || '—')}</b></td>
          <td>${esc(x.motivo || '—')}</td>
          <td class="num">${moeda(x.subtotal)}</td>
          <td class="num"><b style="color:var(--vermelho)">−${moeda(x.desconto)}</b>
            <small>(${x.percent}%)</small></td>
          <td class="num">${moeda(x.total)}</td></tr>`).join('')
        + (d.autorizados > 0.005 && d.automaticos > 0.005 ? `
          <tr class="ev-conc"><td colspan="8">Autorizados na mão</td>
            <td class="num">−${moeda(d.autorizados)}</td><td></td></tr>
          <tr class="ev-conc"><td colspan="8">Automáticos ou de tabela (categoria, à vista)</td>
            <td class="num">−${moeda(d.automaticos)}</td><td></td></tr>` : '')
        + `<tr class="ev-final"><td colspan="8"><b>Total (${d.qtd} desconto${d.qtd > 1 ? 's' : ''})</b></td>
           <td class="num"><b>−${moeda(d.valor)}</b></td><td></td></tr>`,
        '<span class="ev-dica" style="margin-left:auto">É este valor que separa o total das peças do faturamento</span>',
        '', 'ev-s-descontos');
    }

    // Vendas a PREÇO DE CUSTO (v3.19.0). Seção própria, como as cortesias:
    // é margem que a loja abriu mão por decisão de alguém, então precisa de
    // nome, motivo e valor para poder ser auditada depois.
    if (s.vendas_custo && r.vendas_custo && r.vendas_custo.length) {
      _addNav('ev-s-custo', '💰 Custo');
      const c = r.resumo.vendas_custo;
      secH += tabela('🏷️ Vendas a preço de custo',
        `<th>Venda</th><th>Data / hora</th><th>Cliente</th><th>Quem lançou</th>
         <th>Autorizado por</th><th>Motivo</th><th class="num">Peças</th>
         <th class="num">Tabela</th><th class="num">Cobrado</th><th class="num">Margem aberta</th>`,
        r.vendas_custo.map(x => `<tr><td>#${x.venda_id}</td>
          <td>${dataBr(x.data)} <small>${esc(x.hora)}</small></td>
          <td>${esc(x.cliente || '—')}</td>
          <td>${esc(x.operador || '—')}</td>
          <td><b>${esc(x.autorizado_por || '—')}</b></td>
          <td>${esc(x.motivo || '—')}</td>
          <td class="num">${x.pecas}</td>
          <td class="num">${moeda(x.tabela)}</td>
          <td class="num"><b>${moeda(x.total)}</b></td>
          <td class="num"><b style="color:var(--vermelho)">−${moeda(x.margem_aberta)}</b>
            <small>(${x.percent}%)</small></td></tr>`).join('')
        + `<tr class="ev-final"><td colspan="6"><b>Total (${c.qtd} venda${c.qtd > 1 ? 's' : ''})</b></td>
           <td class="num"><b>${c.pecas}</b></td>
           <td class="num"><b>${moeda(c.tabela)}</b></td>
           <td class="num"><b>${moeda(c.cobrado)}</b></td>
           <td class="num"><b style="color:var(--vermelho)">−${moeda(c.margem_aberta)}</b></td></tr>`,
        '<span class="ev-dica" style="margin-left:auto">A peça saiu pelo custo cadastrado; a margem foi aberta mão com autorização</span>',
        '', 'ev-s-custo');
    }

    if (s.vendedor) {
      _addNav('ev-s-vendedor', '👤 Vendedor');
      secH += tabela('Por vendedor(a)',
        `<th>Vendedor(a)</th><th class="num">Vendas</th><th class="num">Peças</th><th class="num">Total</th>`,
        r.por_vendedor.map(g => `<tr><td>${esc(g.vendedor)}</td><td class="num">${g.qtd}</td>
          <td class="num">${g.pecas}</td><td class="num"><b>${moeda(g.total)}</b></td></tr>`).join('')
        || '<tr><td colspan="4" class="vazio">—</td></tr>', '', '', 'ev-s-vendedor');
    }

    if (s.categoria) {
      _addNav('ev-s-categoria', '🏪 Categoria');
      secH += tabela('Por categoria',
        `<th>Categoria</th><th class="num">Peças</th><th class="num">Total</th>`,
        r.por_categoria.map(c => `<tr><td>${esc(c.categoria)}</td><td class="num">${c.pecas}</td>
          <td class="num"><b>${moeda(c.total)}</b></td></tr>`).join('')
        || '<tr><td colspan="3" class="vazio">—</td></tr>', '', '', 'ev-s-categoria');
    }

    // No fim: lista consolidada do que saiu no evento, com a quantidade de cada produto
    if (s.produtos) {
      _addNav('ev-s-produtos', '📦 Produtos');
      const tp = r.por_produto.reduce((a, x) => ({ qtd: a.qtd + x.qtd, total: a.total + x.total }),
        { qtd: 0, total: 0 });
      secH += tabela('📦 Produtos vendidos no evento',
        `<th>Produto</th><th>Ref.</th><th>Cor / Tam.</th><th class="num">Qtd vendida</th>
         <th class="num">Preço unit.</th><th class="num">Valor de tabela</th>
         <th class="num">Desconto</th><th class="num">Recebido</th>`,
        (r.por_produto.map(x => `<tr><td>${esc(x.produto)}${
          // Peça de fornecedor: mostra de quem é e a fatia combinada, para
          // conferir o acerto sem sair da lista (v3.11.0).
          x.consignado ? `<br><small style="color:var(--dourado)">🤝 ${esc(x.fornecedor || 'consignado')}${
            x.pct_fornecedor ? ` · ${x.pct_fornecedor}% do lucro` : ''}</small>` : ''
        }</td><td>${esc(x.referencia || '—')}</td>
          <td>${esc([x.cor, x.tamanho].filter(y => y && y !== 'Única' && y !== 'U').join(' · ') || '—')}</td>
          <td class="num"><b>${x.qtd}</b></td>
          <td class="num">${moeda(x.qtd ? (x.tabela ?? x.total) / x.qtd : 0)}</td>
          <td class="num">${moeda(x.tabela ?? x.total)}</td>
          <td class="num">${(x.desconto || 0) > 0.005 ? `<b style="color:var(--vermelho)">−${moeda(x.desconto)}</b>` : '—'}</td>
          <td class="num"><b>${moeda(x.recebido ?? x.total)}</b></td></tr>`).join('')
          + (r.por_produto.length ? `<tr class="ev-final"><td colspan="3"><b>Total de peças</b></td>
             <td class="num"><b>${tp.qtd}</b></td><td></td>
             <td class="num"><b>${moeda(r.por_produto.reduce((a, x) => a + (x.tabela ?? x.total), 0))}</b></td>
             <td class="num"><b style="color:var(--vermelho)">${
               r.por_produto.reduce((a, x) => a + (x.desconto || 0), 0) > 0.005
                 ? '−' + moeda(r.por_produto.reduce((a, x) => a + (x.desconto || 0), 0)) : '—'}</b></td>
             <td class="num"><b>${moeda(r.por_produto.reduce((a, x) => a + (x.recebido ?? x.total), 0))}</b></td></tr>` : '')
          // Fechamento da seção (v3.9.0): a lista termina no MESMO valor do
          // faturamento bruto do topo. O que separa os dois números aparece
          // nomeado no meio do caminho, nunca como diferença silenciosa.
          + (() => {
            const c = r.resumo.conciliacao;
            if (!r.por_produto.length || !c) return '';
            const linha = (rot, val, sub) => `<tr class="ev-conc">
              <td colspan="7">${rot}${sub ? `<small style="display:block;color:var(--texto-suave);font-size:11px;margin-top:1px">${sub}</small>` : ''}</td>
              <td class="num">${val}</td></tr>`;
            let h = linha('Valor de tabela das peças', moeda(c.tabela),
                          'preço cheio de tudo que saiu da loja');
            if ((c.desc_itens || 0) > 0.005) {
              h += linha('(–) Descontos lançados nos itens', moeda(c.desc_itens),
                'abatimento dado peça a peça, na linha do produto');
            }
            if (c.cortesias > 0.005) {
              h += linha('(–) Cortesias', moeda(c.cortesias),
                `${r.resumo.cortesias.pecas} peça(s) em ${r.resumo.cortesias.qtd} venda(s) — saíram do estoque, a venda vale zero`);
            }
            if (c.descontos > 0.005) {
              const d = r.resumo.descontos;
              const detalhe = [
                d.autorizados > 0.005 ? `${moeda(d.autorizados)} autorizado` : '',
                d.automaticos > 0.005 ? `${moeda(d.automaticos)} automático ou de tabela` : ''
              ].filter(Boolean).join(' + ');
              h += linha('(–) Descontos no fechamento', moeda(c.descontos),
                `${d.qtd} venda(s)${detalhe ? ' — ' + detalhe : ''} · discriminadas na seção 🏷️ Descontos`);
            }
            h += `<tr class="ev-final ev-conc-fim"><td colspan="7"><b>= Faturamento bruto</b>
                    <small style="display:block;color:var(--texto-suave);font-size:11px;margin-top:1px">
                      o mesmo valor do cartão no topo deste relatório</small></td>
                  <td class="num"><b>${moeda(c.bruto)}</b></td></tr>`;
            if (!c.confere) {
              h += `<tr><td colspan="8" style="color:var(--vermelho);font-size:12px;padding-top:6px">
                ⚠️ Sobraram ${moeda(c.sobra)} sem explicação nesta conta. Avise o suporte:
                há um lançamento mexendo no total da venda que este relatório ainda não conhece.</td></tr>`;
            }
            return h;
          })()
          )
        || '<tr><td colspan="8" class="vazio">Nenhum produto vendido no período.</td></tr>',
        '', '', 'ev-s-produtos');
    }

    // Monta o menu suspenso de navegação entre topo e seções
    const _navBar = _nav.length > 1 ? `<div class="ev-nav"><select class="ev-nav-sel">
      <option value="">▾ Ir para seção…</option>${
      _nav.map(n => `<option value="${n.id}">${n.label}</option>`).join('')
    }</select></div>` : '';

    const h = topH + _navBar + secH;
    res.innerHTML = h || '<div class="painel"><div class="vazio">Nenhuma seção selecionada.</div></div>';

    // scroll suave via dropdown de navegação
    const navSel = res.querySelector('.ev-nav-sel');
    if (navSel) navSel.onchange = () => {
      const alvo = navSel.value && res.querySelector('#' + navSel.value);
      if (alvo) { alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }); navSel.value = ''; }
    };
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

    // Botão 🖨️ por fornecedor — modal de modo do recibo (v3.21.0)
    res.querySelectorAll('.btn-recibo-forn').forEach(btn => {
      btn.onclick = () => _modalRecibo(Number(btn.dataset.fid), btn.dataset.fnome || 'fornecedor');
    });

    function _modalRecibo(fornecedor_id, fnome) {
      const agora = new Date();
      const anoAtual = agora.getFullYear(); const mesAtual = agora.getMonth() + 1;
      const p = params();
      const _br = s => s ? String(s).slice(0,10).split('-').reverse().join('/') : '—';
      const _moeda = v => 'R$ ' + Number(v||0).toFixed(2).replace('.',',');

      const m = modal('Gerar recibo de consignado', `
        <style>
          .rec-modos { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap }
          .rec-modo  { flex:1; min-width:100px; border:2px solid var(--borda); border-radius:8px;
                       padding:10px 8px; text-align:center; cursor:pointer; font-size:13px;
                       transition:.15s; user-select:none }
          .rec-modo.ativo { border-color:var(--primaria); background:var(--primaria-fundo); font-weight:700 }
          .rec-campo { margin-top:8px }
          .rec-campo label { font-size:12px; color:var(--texto-leve); display:block; margin-bottom:4px }
          .rec-campo select { width:100%; padding:7px 10px; border:1px solid var(--borda); border-radius:6px; font-size:14px }
          #rec-info-evento { font-size:12px; color:var(--texto-leve); margin-top:6px; line-height:1.4 }
          #rec-lista-vendas { max-height:240px; overflow-y:auto; border:1px solid var(--borda); border-radius:6px; margin-top:8px }
          .rec-venda-item { display:flex; align-items:center; gap:8px; padding:8px 10px;
                            border-bottom:1px solid var(--borda-leve); cursor:pointer }
          .rec-venda-item:last-child { border-bottom:none }
          .rec-venda-item:hover { background:var(--primaria-fundo) }
          .rec-venda-item input[type=checkbox] { flex-shrink:0; width:16px; height:16px; cursor:pointer }
          .rec-venda-meta { flex:1; font-size:13px; line-height:1.4 }
          .rec-venda-meta b { display:block }
          .rec-venda-meta span { color:var(--texto-leve); font-size:11px }
          .rec-venda-val { font-size:13px; font-weight:700; white-space:nowrap }
          #rec-sel-info { font-size:12px; color:var(--texto-leve); margin-top:6px; text-align:right }
          .rec-seltodos { font-size:12px; padding:6px 10px; cursor:pointer; color:var(--primaria);
                          display:block; text-align:right; border-bottom:1px solid var(--borda-leve) }
        </style>
        <div style="font-size:13px;margin-bottom:12px">Fornecedor: <b>${esc(fnome)}</b></div>
        <div class="rec-modos">
          <div class="rec-modo ativo" data-modo="evento">📅<br>Este evento</div>
          <div class="rec-modo" data-modo="mes">🗓️<br>Por mês</div>
          <div class="rec-modo" data-modo="venda">🧾<br>Por venda</div>
        </div>
        <div id="rec-painel-evento">
          <div id="rec-info-evento">
            Período atual:<br><b>${p.inicio || '—'}</b> até <b>${p.fim || '—'}</b>
          </div>
        </div>
        <div id="rec-painel-mes" style="display:none">
          <div class="rec-campo">
            <label>Mês</label>
            <select id="rec-mes">
              ${['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
                .map((n,i) => `<option value="${i+1}"${i+1===mesAtual?' selected':''}>${n}</option>`).join('')}
            </select>
          </div>
          <div class="rec-campo" style="margin-top:8px">
            <label>Ano</label>
            <select id="rec-ano">
              ${[0,1,2].map(d => `<option value="${anoAtual-d}"${d===0?' selected':''}>${anoAtual-d}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="rec-painel-venda" style="display:none">
          <div id="rec-lista-vendas"><div style="padding:12px;color:var(--texto-leve);font-size:13px">Carregando vendas…</div></div>
          <div id="rec-sel-info"></div>
        </div>
      `, async (_, fechar) => {
        const modoEl = m.querySelector('.rec-modo.ativo');
        const modoSel = modoEl?.dataset.modo || 'evento';
        const payload = { fornecedor_id, modo: modoSel };
        if (modoSel === 'evento') {
          if (!p.inicio || !p.fim) { toast('Gere o relatório do evento primeiro.', true); return; }
          payload.de = p.inicio; payload.ate = p.fim;
        } else if (modoSel === 'mes') {
          payload.mes = m.querySelector('#rec-mes').value;
          payload.ano = m.querySelector('#rec-ano').value;
        } else {
          const sels = [...m.querySelectorAll('#rec-lista-vendas input[type=checkbox]:checked')].map(cb => Number(cb.value));
          if (!sels.length) { toast('Selecione ao menos uma venda.', true); return; }
          payload.venda_ids = sels;
        }
        fechar();
        const r = await api('relatorios:reciboConsignado', payload);
        if (!r.ok) { toast(r.erro || 'Erro ao gerar recibo.', true); return; }
        const bin = atob(r.buffer);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        a.download = `recibo-${fnome.replace(/[^a-z0-9]/gi, '-')}-${modoSel}.pdf`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        toast('Recibo gerado — pronto para imprimir ou enviar!');
      }, 'Gerar PDF');

      // função para carregar lista de vendas do fornecedor
      async function _carregarVendas() {
        const painel = m.querySelector('#rec-lista-vendas');
        painel.innerHTML = '<div style="padding:12px;color:var(--texto-leve);font-size:13px">Carregando vendas…</div>';
        const r = await api('relatorios:listarVendasFornecedor', { fornecedor_id });
        if (!r.ok || !r.vendas?.length) {
          painel.innerHTML = '<div style="padding:12px;color:var(--texto-leve);font-size:13px">Nenhuma venda encontrada para este fornecedor.</div>';
          return;
        }
        const atualizarInfo = () => {
          const n = painel.querySelectorAll('input:checked').length;
          m.querySelector('#rec-sel-info').textContent = n ? `${n} venda(s) selecionada(s)` : '';
        };
        painel.innerHTML = `<span class="rec-seltodos" id="rec-sel-todas">Selecionar todas</span>` +
          r.vendas.map(v => `
            <label class="rec-venda-item">
              <input type="checkbox" value="${v.id}">
              <div class="rec-venda-meta">
                <b>Venda #${v.id} — ${_br(v.criado_em)}</b>
                <span>${esc(v.cliente)} · ${v.pecas} peça(s)</span>
              </div>
              <div class="rec-venda-val">${_moeda(v.valor_tabela)}</div>
            </label>`).join('');
        painel.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', atualizarInfo));
        painel.querySelector('#rec-sel-todas').onclick = () => {
          const cbs = [...painel.querySelectorAll('input[type=checkbox]')];
          const todas = cbs.every(c => c.checked);
          cbs.forEach(c => { c.checked = !todas; });
          atualizarInfo();
        };
      }

      // troca de modo — carrega vendas ao entrar no painel
      m.querySelectorAll('.rec-modo').forEach(el => {
        el.onclick = () => {
          m.querySelectorAll('.rec-modo').forEach(x => x.classList.remove('ativo'));
          el.classList.add('ativo');
          m.querySelector('#rec-painel-evento').style.display = el.dataset.modo === 'evento' ? '' : 'none';
          m.querySelector('#rec-painel-mes').style.display    = el.dataset.modo === 'mes'    ? '' : 'none';
          m.querySelector('#rec-painel-venda').style.display  = el.dataset.modo === 'venda'  ? '' : 'none';
          if (el.dataset.modo === 'venda') _carregarVendas();
        };
      });
    }
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

// ---------- Produtos mais vendidos (v3.30.0) ----------
// Filtro: todas as lojas (total, com as peças de cada loja em colunas) ou uma
// loja só. A escolha fica guardada enquanto o usuário troca o período.
let _mvLoja = '';
async function abaMaisVendidos(corpo, per) {
  const r = await api('relatorios:maisVendidos', { ...per, loja_id: _mvLoja || null });
  if (!r.ok) { toast(r.erro, true); return; }
  const total = !r.loja_id;
  const cols = total && r.colunas.length > 1 ? r.colunas : [];
  const nf = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
  const linhas = r.produtos.map(x => `<tr>
    <td class="num" style="color:var(--texto-suave)">${x.pos}º</td>
    <td><b>${esc(x.nome)}</b>${x.referencia ? ` <small style="color:var(--texto-suave)">${esc(x.referencia)}</small>` : ''}
      <br><small style="color:var(--texto-suave)">${esc(x.categoria)}${x.consignado ? ' · 🤝 consignado' : ''}</small></td>
    ${cols.map(c => `<td class="num">${x.por_loja[c.id] ? nf(x.por_loja[c.id].pecas) : '<span style="opacity:.35">—</span>'}</td>`).join('')}
    <td class="num"><b>${nf(x.pecas)}</b></td>
    <td class="num">${moeda(x.receita)}</td>
    <td class="num" style="width:120px">
      <div style="background:var(--fundo);border-radius:6px;overflow:hidden;height:8px;margin-bottom:2px">
        <div style="width:${Math.min(100, x.pct)}%;background:var(--vinho);height:8px"></div></div>
      <small style="color:var(--texto-suave)">${String(x.pct).replace('.', ',')}%</small></td>
  </tr>`).join('');
  const nCols = 5 + cols.length;
  const bloco = el(`
    <div>
      <div class="cards">
        <div class="card"><div class="rotulo">Produtos vendidos</div><div class="valor">${r.totais.produtos}</div></div>
        <div class="card"><div class="rotulo">Peças</div><div class="valor">${nf(r.totais.pecas)}</div></div>
        <div class="card"><div class="rotulo">Receita</div><div class="valor" style="color:var(--verde)">${moeda(r.totais.receita)}</div></div>
      </div>
      <div class="painel"><div class="barra"><b>Produtos mais vendidos</b>
        <select id="mv-loja" style="min-width:220px;margin-left:12px">
          <option value="">Todas as lojas (total)</option>
          ${r.lojas.map(l => `<option value="${l.id}" ${String(l.id) === String(_mvLoja) ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}
        </select>
        <small style="color:var(--texto-suave)">ordem por peças · líquido de devoluções · troca não conta</small>
        <button class="btn btn-suave" id="mv-exp" style="margin-left:auto">Exportar CSV</button></div>
        <table>
          <thead><tr><th class="num" style="width:44px">#</th><th>Produto</th>
            ${cols.map(c => `<th class="num">${esc(c.nome)}</th>`).join('')}
            <th class="num">${cols.length ? 'Total peças' : 'Peças'}</th><th class="num">Receita</th><th class="num">% das peças</th></tr></thead>
          <tbody>${linhas || `<tr><td colspan="${nCols}" class="vazio">Nenhuma venda ${r.loja ? 'em ' + esc(r.loja) + ' ' : ''}no período.</td></tr>`}</tbody>
          ${r.produtos.length ? `<tfoot><tr style="border-top:2px solid var(--borda)">
            <td></td><td><b>TOTAL</b></td>
            ${cols.map(c => `<td class="num"><b>${nf(r.produtos.reduce((s, x) => s + (x.por_loja[c.id] ? x.por_loja[c.id].pecas : 0), 0))}</b></td>`).join('')}
            <td class="num"><b>${nf(r.totais.pecas)}</b></td><td class="num"><b>${moeda(r.totais.receita)}</b></td><td></td></tr></tfoot>` : ''}
        </table></div>
    </div>`);
  bloco.querySelector('#mv-loja').onchange = (e) => {
    _mvLoja = e.target.value;
    corpo.innerHTML = ''; abaMaisVendidos(corpo, per);
  };
  bloco.querySelector('#mv-exp').onclick = () =>
    baixarCsv(`mais-vendidos-${r.loja ? r.loja.toLowerCase().replace(/\s+/g, '-') : 'todas-as-lojas'}`,
      ['Posição', 'Produto', 'Referência', 'Categoria', ...cols.map(c => `Peças ${c.nome}`), 'Peças', 'Receita (R$)', '% das peças'],
      r.produtos.map(x => [x.pos, x.nome, x.referencia, x.categoria,
        ...cols.map(c => x.por_loja[c.id] ? nf(x.por_loja[c.id].pecas) : 0),
        nf(x.pecas), x.receita.toFixed(2).replace('.', ','), String(x.pct).replace('.', ',') + '%']));
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
//   2. BATER O ESTOQUE COM O FÍSICO — coluna "Contado" em branco para escrever
//   3. CONFERIR RECEBIMENTO — filtro e agrupamento por data de cadastro
// E, com a Movimentação ligada, faz a CONCILIAÇÃO: o que entrou, o que vendeu,
// o que deveria sobrar e o que o sistema diz que tem hoje.
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

      <div class="est-mov">
        <label class="est-mov-lig"><input type="checkbox" id="es-mov"> <b>Mostrar movimentação</b>
          — o que entrou, o que vendeu e o que deveria ter</label>
        <div class="est-mov-datas" id="es-mov-datas" style="display:none">
          <div class="campo"><label>Vendas de</label><input id="es-mov-de" type="date"></div>
          <div class="campo"><label>até</label><input id="es-mov-ate" type="date"></div>
          <span class="est-dica">Vazio = desde sempre. Para bater com o início dos trabalhos, deixe vazio.</span>
        </div>
      </div>

      <div class="est-opcoes">
        <label><input type="checkbox" id="es-locais" checked> Colunas por local</label>
        <label><input type="checkbox" id="es-codigo"> Código de barras</label>
        <label><input type="checkbox" id="es-datavenda"> Última venda</label>
        ${pode('produtos.custo') ? '<label><input type="checkbox" id="es-custo" checked> Valor de custo</label>' : ''}
        <label><input type="checkbox" id="es-venda" checked> Valor de venda</label>
        <label title="Coluna vazia para escrever a contagem à mão"><input type="checkbox" id="es-contado"> Coluna “Contado”</label>
        <label><input type="checkbox" id="es-detalhe" checked> Mostrar cada variação</label>
        <button class="btn btn-primario" id="es-gerar">Gerar relatório</button>
        <button class="btn btn-suave" id="es-xlsx" disabled>📊 Excel</button>
      </div>
      <p class="est-dica">
        Para <b>bater o estoque com o físico</b>, marque “Contado”, imprima e conte peça por peça.
        Para <b>conferir uma remessa</b>, use “Cadastrados de/até”.
        Para <b>bater o começo dos trabalhos com hoje</b>, ligue a Movimentação.
      </p>
      <div id="es-saida"><div class="vazio">Escolha os filtros e clique em <b>Gerar relatório</b>.</div></div>
    </div>`);
  corpo.appendChild(painel);

  const q = (sel) => painel.querySelector(sel);
  let ultimo = null;

  q('#es-mov').addEventListener('change', () => {
    q('#es-mov-datas').style.display = q('#es-mov').checked ? '' : 'none';
  });

  const opcoes = () => ({
    grupo: q('#es-grupo').value,
    locais: q('#es-locais').checked,
    codigo: q('#es-codigo').checked,
    dataVenda: q('#es-datavenda').checked,
    custo: !!q('#es-custo')?.checked,
    venda: q('#es-venda').checked,
    contado: q('#es-contado').checked,
    detalhe: q('#es-detalhe').checked,
    mov: q('#es-mov').checked
  });

  async function gerar() {
    q('#es-saida').innerHTML = '<div class="vazio">Carregando…</div>';
    const r = await api('relatorios:estoque', {
      categoria_id: q('#es-cat').value || null,
      fornecedor_id: q('#es-forn').value || null,
      situacao: q('#es-sit').value,
      de: q('#es-de').value || '',
      ate: q('#es-ate').value || '',
      movimentacao: q('#es-mov').checked,
      mov_de: q('#es-mov-de').value || '',
      mov_ate: q('#es-mov-ate').value || ''
    });
    if (!r.ok) { q('#es-saida').innerHTML = `<div class="vazio">${esc(r.erro || 'Erro ao gerar.')}</div>`; return; }
    ultimo = r;
    q('#es-xlsx').disabled = !r.produtos.length;
    q('#es-saida').innerHTML = montarHtml(r, opcoes());
  }

  q('#es-gerar').onclick = gerar;
  // marcar/desmarcar coluna redesenha na hora, sem ir ao banco de novo
  ['#es-locais', '#es-codigo', '#es-custo', '#es-venda', '#es-contado', '#es-grupo', '#es-detalhe', '#es-datavenda']
    .forEach(sel => q(sel)?.addEventListener('change', () => {
      if (ultimo) q('#es-saida').innerHTML = montarHtml(ultimo, opcoes());
    }));
  // ligar a movimentação exige ir ao banco de novo (os dados não vêm por padrão)
  q('#es-mov').addEventListener('change', () => { if (ultimo) gerar(); });

  q('#es-xlsx').onclick = () => {
    if (!ultimo) return;
    const o = opcoes();
    const cab = ['Produto', 'Referência', 'Categoria', 'Cadastrado em', 'Cor', 'Tamanho'];
    if (o.codigo) cab.push('Cód. barras');
    if (o.mov) cab.push('Entrou', 'Vendeu', 'Devolveu', 'Outros', 'Deveria ter');
    if (o.dataVenda) cab.push('Última venda');
    if (o.locais) for (const l of ultimo.locais) cab.push(l.nome);
    cab.push('Em estoque');
    if (o.mov) cab.push('Diferença');
    if (o.contado) cab.push('Contado', 'Dif. contagem');
    if (o.custo) cab.push('Valor custo');
    if (o.venda) cab.push('Valor venda');

    const linhas = [];
    const vazias = (n) => Array(n).fill('');
    for (const p of ultimo.produtos) {
      if (o.detalhe) for (const v of p.variacoes) {
        const li = [p.nome, p.referencia, p.categoria, dataBr(p.cadastrado_em), v.cor, v.tamanho];
        if (o.codigo) li.push(v.codigo_barras);
        if (o.mov) li.push(v.entrou, v.vendeu, v.devolveu, v.outros, v.esperado);
        if (o.dataVenda) li.push(v.ultima_venda ? dataBr(v.ultima_venda) : '');
        if (o.locais) for (const l of ultimo.locais) li.push(v.por_local[l.id]);
        li.push(v.total);
        if (o.mov) li.push(v.dif_mov);
        if (o.contado) li.push(...vazias(2));
        if (o.custo) li.push(v.valor_custo);
        if (o.venda) li.push(v.valor_venda);
        linhas.push(li);
      }
      const sub = [`TOTAL — ${p.nome}`, '', '', '', '', ''];
      if (o.codigo) sub.push('');
      if (o.mov) sub.push(p.entrou, p.vendeu, p.devolveu, p.outros, p.esperado);
      if (o.dataVenda) sub.push('');
      if (o.locais) for (const l of ultimo.locais) sub.push(p.por_local[l.id]);
      sub.push(p.total);
      if (o.mov) sub.push(p.dif_mov);
      if (o.contado) sub.push(...vazias(2));
      if (o.custo) sub.push(p.valor_custo);
      if (o.venda) sub.push(p.valor_venda);
      linhas.push(sub);
    }
    const R = ultimo.resumo;
    const fim = ['TOTAL GERAL', '', '', '', '', ''];
    if (o.codigo) fim.push('');
    if (o.mov) fim.push(R.entrou, R.vendeu, R.devolveu, R.outros, R.esperado);
    if (o.dataVenda) fim.push('');
    if (o.locais) for (const l of ultimo.locais) fim.push(R.por_local[l.id]);
    fim.push(R.pecas);
    if (o.mov) fim.push(R.dif_mov);
    if (o.contado) fim.push(...vazias(2));
    if (o.custo) fim.push(R.valor_custo);
    if (o.venda) fim.push(R.valor_venda);
    linhas.push(fim);

    baixarCsv(`estoque-${hoje()}`, cab, linhas);
  };

  // ── montagem da folha ─────────────────────────────────────────────────────
  function montarHtml(r, o) {
    if (!r.produtos.length) return '<div class="vazio">Nenhum produto com esses filtros.</div>';
    const L = o.locais ? r.locais : [];
    const nCols = 2 + (o.codigo ? 1 : 0) + (o.mov ? 5 : 0) + (o.dataVenda ? 1 : 0)
      + L.length + 1 + (o.mov ? 1 : 0) + (o.contado ? 2 : 0) + (o.custo ? 1 : 0) + (o.venda ? 1 : 0);

    const cab = `<tr>
      <th>Cor</th><th>Tamanho</th>
      ${o.codigo ? '<th>Cód. barras</th>' : ''}
      ${o.mov ? `<th class="num est-e">Entrou</th><th class="num est-s">Vendeu</th>
                 <th class="num">Devolv.</th><th class="num">Outros</th>
                 <th class="num est-esp">Deveria ter</th>` : ''}
      ${o.dataVenda ? '<th>Últ. venda</th>' : ''}
      ${L.map(l => `<th class="num">${esc(l.nome)}</th>`).join('')}
      <th class="num">Em estoque</th>
      ${o.mov ? '<th class="num">Dif.</th>' : ''}
      ${o.contado ? '<th class="num est-branco">Contado</th><th class="num est-branco">Dif.</th>' : ''}
      ${o.custo ? '<th class="num">Custo</th>' : ''}
      ${o.venda ? '<th class="num">Venda</th>' : ''}
    </tr>`;

    const celulasMov = (x) => o.mov ? `
      <td class="num est-e">${x.entrou || '—'}</td>
      <td class="num est-s">${x.vendeu || '—'}</td>
      <td class="num">${x.devolveu || '—'}</td>
      <td class="num">${x.outros || '—'}</td>
      <td class="num est-esp"><b>${x.esperado}</b></td>` : '';

    const celulaDif = (x) => o.mov ? `<td class="num ${x.dif_mov ? 'est-dif' : ''}">${
      x.dif_mov ? (x.dif_mov > 0 ? '+' : '') + x.dif_mov : '✓'}</td>` : '';

    // ── quadro de fechamento (o "agrupamento dos totais") ────────────────────
    const R = r.resumo;
    let h = `<div class="est-fechamento">
      <div class="est-fech-titulo">Fechamento</div>
      <div class="est-fech-grade">
        <div class="est-fech-item"><span>Produtos</span><b>${R.produtos}</b></div>
        <div class="est-fech-item"><span>Variações</span><b>${R.variacoes}</b></div>
        ${o.mov ? `
        <div class="est-fech-item est-e"><span>Entrou</span><b>${R.entrou}</b></div>
        <div class="est-fech-item est-s"><span>(−) Vendido</span><b>${R.vendeu}</b></div>
        <div class="est-fech-item"><span>(+) Devolvido</span><b>${R.devolveu}</b></div>
        <div class="est-fech-item"><span>(±) Ajustes</span><b>${R.outros}</b></div>
        <div class="est-fech-item est-esp"><span>= Deveria ter</span><b>${R.esperado}</b></div>` : ''}
        <div class="est-fech-item est-fech-forte"><span>Em estoque hoje</span><b>${R.pecas}</b></div>
        ${o.mov ? `<div class="est-fech-item ${R.dif_mov ? 'est-dif' : 'est-ok'}">
          <span>Diferença</span><b>${R.dif_mov ? (R.dif_mov > 0 ? '+' : '') + R.dif_mov : '✓ bate'}</b></div>` : ''}
        ${o.custo ? `<div class="est-fech-item"><span>Valor de custo</span><b>${moeda(R.valor_custo)}</b></div>` : ''}
        ${o.venda ? `<div class="est-fech-item"><span>Valor de venda</span><b>${moeda(R.valor_venda)}</b></div>` : ''}
        ${R.abaixo_minimo ? `<div class="est-fech-item est-dif"><span>Abaixo do mínimo</span><b>${R.abaixo_minimo}</b></div>` : ''}
      </div>
      ${o.mov && R.dif_mov ? `<div class="est-fech-nota">
        A diferença de ${Math.abs(R.dif_mov)} peça(s) não é explicada pelos movimentos registrados.
        Costuma ser estoque que já existia antes do período escolhido — deixe as datas de venda em branco para incluir tudo.
      </div>` : ''}
    </div>`;

    if (R.divergencia) {
      h += `<div class="est-divergencia">⚠️ ${Math.abs(R.divergencia)} peça(s) sem local definido —
        aparecem no Total mas não estão em nenhum estoque. Use 🏢 Estoques para distribuir.</div>`;
    }

    const blocos = agrupar(r.produtos, o.grupo);

    for (const bloco of blocos) {
      const tb = totaisDe(bloco.itens, r.locais);
      if (bloco.rotulo) {
        h += `<div class="est-bloco">
          <span>${esc(bloco.rotulo)}</span>
          <span class="est-bloco-tot">${bloco.itens.length} produto(s) · ${tb.pecas} peça(s)${
            o.mov ? ` · entrou ${tb.entrou} · vendeu ${tb.vendeu}` : ''}</span>
        </div>`;
      }

      for (const p of bloco.itens) {
        h += `<table class="est-tabela">
          <thead>
            <tr class="est-prod"><th colspan="${nCols}">
              ${esc(p.nome)}
              ${p.referencia ? `<span class="est-ref">Ref. ${esc(p.referencia)}</span>` : ''}
              <span class="est-cat">${esc(p.categoria)}</span>
              ${p.consignado ? '<span class="est-consig">consignado</span>' : ''}
              <span class="est-data">cadastrado em ${dataBr(p.cadastrado_em)}</span>
            </th></tr>
            ${o.detalhe ? cab : ''}
          </thead>
          <tbody>
            ${o.detalhe ? p.variacoes.map(v => `<tr${v.abaixo ? ' class="est-baixo"' : ''}>
              <td>${esc(v.cor)}</td><td>${esc(v.tamanho)}</td>
              ${o.codigo ? `<td class="est-cod">${esc(v.codigo_barras)}</td>` : ''}
              ${celulasMov(v)}
              ${o.dataVenda ? `<td>${v.ultima_venda ? dataBr(v.ultima_venda) : '—'}</td>` : ''}
              ${L.map(l => `<td class="num">${v.por_local[l.id] || '—'}</td>`).join('')}
              <td class="num"><b>${v.total}</b>${v.abaixo ? ` <small title="mínimo ${v.minimo}">▼</small>` : ''}</td>
              ${celulaDif(v)}
              ${o.contado ? '<td class="est-branco"></td><td class="est-branco"></td>' : ''}
              ${o.custo ? `<td class="num">${moeda(v.valor_custo)}</td>` : ''}
              ${o.venda ? `<td class="num">${moeda(v.valor_venda)}</td>` : ''}
            </tr>`).join('') : ''}
            <tr class="est-subtotal">
              <td colspan="${2 + (o.codigo ? 1 : 0)}"><b>Total do produto</b>
                ${o.detalhe ? '' : `<small>(${p.variacoes.length} variação(ões))</small>`}</td>
              ${celulasMov(p)}
              ${o.dataVenda ? '<td></td>' : ''}
              ${L.map(l => `<td class="num"><b>${p.por_local[l.id]}</b></td>`).join('')}
              <td class="num"><b>${p.total}</b></td>
              ${celulaDif(p)}
              ${o.contado ? '<td class="est-branco"></td><td class="est-branco"></td>' : ''}
              ${o.custo ? `<td class="num"><b>${moeda(p.valor_custo)}</b></td>` : ''}
              ${o.venda ? `<td class="num"><b>${moeda(p.valor_venda)}</b></td>` : ''}
            </tr>
          </tbody>
        </table>`;
      }

      // total do grupo — só faz sentido quando existe agrupamento
      if (bloco.rotulo) {
        h += `<table class="est-tabela est-grupo-total"><tbody><tr>
          <td><b>Total de ${esc(bloco.rotulo.replace(/^[^ ]+ /, ''))}</b></td>
          ${o.mov ? `<td class="num">entrou <b>${tb.entrou}</b></td>
                     <td class="num">vendeu <b>${tb.vendeu}</b></td>
                     <td class="num">deveria ter <b>${tb.esperado}</b></td>` : ''}
          ${L.map(l => `<td class="num"><b>${tb.por_local[l.id]}</b><small>${esc(l.nome)}</small></td>`).join('')}
          <td class="num"><b>${tb.pecas}</b><small>em estoque</small></td>
          ${o.custo ? `<td class="num"><b>${moeda(tb.valor_custo)}</b><small>custo</small></td>` : ''}
          ${o.venda ? `<td class="num"><b>${moeda(tb.valor_venda)}</b><small>venda</small></td>` : ''}
        </tr></tbody></table>`;
      }
    }

    h += `<table class="est-tabela est-geral"><tbody><tr>
      <td><b>TOTAL GERAL</b><small>${R.produtos} produto(s) · ${R.variacoes} variação(ões)</small></td>
      ${o.mov ? `<td class="num"><b>${R.entrou}</b><small>entrou</small></td>
                 <td class="num"><b>${R.vendeu}</b><small>vendeu</small></td>
                 <td class="num"><b>${R.esperado}</b><small>deveria ter</small></td>` : ''}
      ${L.map(l => `<td class="num"><b>${R.por_local[l.id]}</b><small>${esc(l.nome)}</small></td>`).join('')}
      <td class="num est-total-final"><b>${R.pecas}</b><small>em estoque</small></td>
      ${o.custo ? `<td class="num"><b>${moeda(R.valor_custo)}</b><small>custo</small></td>` : ''}
      ${o.venda ? `<td class="num"><b>${moeda(R.valor_venda)}</b><small>venda</small></td>` : ''}
    </tr></tbody></table>`;
    return h;
  }

  gerar();
}

// Soma um conjunto de produtos — usado no total de cada grupo
function totaisDe(produtos, locais) {
  const t = { pecas: 0, entrou: 0, vendeu: 0, devolveu: 0, esperado: 0,
              valor_custo: 0, valor_venda: 0, por_local: {} };
  for (const l of locais) t.por_local[l.id] = 0;
  for (const p of produtos) {
    t.pecas += p.total;
    t.entrou += p.entrou || 0;
    t.vendeu += p.vendeu || 0;
    t.devolveu += p.devolveu || 0;
    t.esperado += p.esperado || 0;
    t.valor_custo += p.valor_custo;
    t.valor_venda += p.valor_venda;
    for (const l of locais) t.por_local[l.id] += p.por_local[l.id];
  }
  t.valor_custo = Math.round(t.valor_custo * 100) / 100;
  t.valor_venda = Math.round(t.valor_venda * 100) / 100;
  return t;
}


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
    .est-mov{background:var(--creme);border-radius:8px;padding:9px 12px;margin-bottom:10px}
    .est-mov-lig{display:flex;align-items:center;gap:7px;font-size:12.5px;cursor:pointer}
    .est-mov-datas{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:8px}
    .est-mov-datas .campo{margin:0}
    .est-fechamento{border:2px solid var(--vinho);border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
    .est-fech-titulo{background:var(--vinho);color:#fff;padding:6px 12px;font-weight:700;font-size:12.5px}
    .est-fech-grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:1px;background:var(--borda)}
    .est-fech-item{background:#fff;padding:8px 11px;display:flex;flex-direction:column;gap:2px}
    .est-fech-item span{font-size:10.5px;color:var(--texto-suave)}
    .est-fech-item b{font-size:15px;color:var(--vinho)}
    .est-fech-forte{background:#F6E9E9}
    .est-fech-forte b{font-size:18px}
    .est-fech-nota{padding:7px 12px;font-size:11px;color:var(--texto-suave);background:#FDF8EC;border-top:1px solid var(--borda)}
    .est-e{color:#1a6e3a}
    .est-s{color:#B45309}
    .est-esp{background:#F6E9E9}
    .est-dif b,.est-dif{color:var(--vermelho,#dc2626);font-weight:700}
    .est-ok b{color:#1a6e3a}
    .est-grupo-total td{background:#F6E9E9;color:var(--vinho);font-weight:700;padding:7px 9px;font-size:12px}
    .est-grupo-total small{display:block;font-size:9.5px;opacity:.75;font-weight:400}
    .est-geral small{display:block;font-size:10px;opacity:.8;font-weight:400}
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
      .est-opcoes,.est-filtros,.est-dica,.est-mov{display:none !important}
      .est-fech-titulo{background:#7E1114 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .est-grupo-total td,.est-esp,.est-fech-forte{background:#F6E9E9 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .est-prod th{background:#7E1114 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .est-geral td{background:#7E1114 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .est-subtotal td,.est-resumo{background:#F6E9E9 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }`;
  document.head.appendChild(st);
}

// ---------- Aba: Compras acompanhadas (v3.10.0) ----------
// Mostra o que as pessoas de categorias marcadas com 👁️ levaram no período:
// tipo de peça, quantidade e valor. Serve para perceber quem está usando o
// desconto de funcionário para comprar em quantidade de revenda.
function _estiloAcomp() {
  if (document.getElementById('estilo-acomp-rel')) return;
  const st = document.createElement('style');
  st.id = 'estilo-acomp-rel';
  st.textContent = `
    .ac-filtros { display:flex; gap:14px; flex-wrap:wrap; align-items:flex-end; }
    .ac-filtros label { display:flex; flex-direction:column; gap:4px; font-weight:600; font-size:13px; }
    .ac-filtros input, .ac-filtros select { padding:7px 10px; border:1px solid var(--borda); border-radius:8px; font-weight:400; }
    .ac-pessoa { border:1px solid var(--borda); border-radius:10px; margin-bottom:12px; overflow:hidden; }
    .ac-cab { display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(0,0,0,.03); cursor:pointer; }
    .ac-cab:hover { background:rgba(0,0,0,.05); }
    .ac-nome { font-weight:700; font-size:14.5px; }
    .ac-tag { font-size:11px; padding:2px 8px; border-radius:10px; background:rgba(184,135,59,.18); color:#7a5716; white-space:nowrap; }
    .ac-num { margin-left:auto; display:flex; gap:18px; text-align:right; font-size:12.5px; }
    .ac-num b { display:block; font-size:15px; }
    .ac-alerta { background:rgba(196,60,60,.12); }
    .ac-alerta .ac-nome::after { content:' ⚠️'; }
    .ac-itens table { width:100%; border-collapse:collapse; font-size:12.5px; }
    .ac-itens th, .ac-itens td { padding:5px 14px; border-bottom:1px solid var(--borda); text-align:left; }
    .ac-itens th { background:rgba(0,0,0,.02); font-size:11.5px; text-transform:uppercase; letter-spacing:.03em; }
    .ac-itens .num { text-align:right; }
    .ac-vazio { padding:28px; text-align:center; color:var(--texto-suave); }
    @media print { .ac-nao-imprime { display:none !important; } .ac-itens { display:block !important; } }
  `;
  document.head.appendChild(st);
}

async function abaAcompanhadas(corpo, per) {
  _estiloAcomp();
  const tabela = (titulo, cabs, linhas) => linhas
    ? `<div class="painel" style="margin-bottom:14px">
         <div class="barra"><b>${esc(titulo)}</b></div>
         <table><thead><tr>${cabs}</tr></thead><tbody>${linhas}</tbody></table></div>`
    : '';
  const painel = el(`
    <div>
      <div class="painel ac-nao-imprime" style="margin-bottom:14px">
        <div class="barra"><b>👁️ Compras acompanhadas</b>
          <span class="ev-dica">Categorias marcadas em Configurações → Categorias de clientes</span>
        </div>
        <div style="padding:12px 14px">
          <div class="ac-filtros">
            <label>De<input type="date" id="ac-de" value="${esc((per && per.de) || '')}"></label>
            <label>até<input type="date" id="ac-ate" value="${esc((per && per.ate) || '')}"></label>
            <label>Categoria<select id="ac-cat"><option value="">Todas as acompanhadas</option></select></label>
            <label>A partir de<input type="number" id="ac-min" min="0" step="1" placeholder="0" style="width:110px"> </label>
            <span style="font-size:12px;color:var(--texto-suave);margin-bottom:9px">peça(s) no período</span>
            <button class="btn btn-primario" id="ac-gerar">Gerar</button>
            <button class="btn btn-suave" id="ac-xlsx">📊 Excel</button>
          </div>
        </div>
      </div>
      <div id="ac-res"><div class="painel"><div class="ac-vazio">Escolha o período e clique em <b>Gerar</b>.</div></div></div>
    </div>`);
  corpo.appendChild(painel);

  const $res = painel.querySelector('#ac-res');
  const $cat = painel.querySelector('#ac-cat');
  const filtros = () => ({
    de: painel.querySelector('#ac-de').value,
    ate: painel.querySelector('#ac-ate').value,
    categoria_id: Number($cat.value) || null,
    min_pecas: Number(painel.querySelector('#ac-min').value) || 0
  });

  async function gerar() {
    $res.innerHTML = '<div class="painel"><div class="ac-vazio">Carregando…</div></div>';
    const r = await api('relatorios:acompanhadas', filtros());
    if (!r.ok) { $res.innerHTML = `<div class="painel"><div class="ac-vazio">${esc(r.erro)}</div></div>`; return; }

    // combo de categorias (só as marcadas)
    if ($cat.options.length <= 1 && r.categorias.length) {
      for (const c of r.categorias) {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.desconto_percent > 0 ? `${c.nome} (${c.desconto_percent}%)` : c.nome;
        $cat.appendChild(o);
      }
    }

    if (r.sem_categoria_marcada) {
      $res.innerHTML = `<div class="painel"><div class="ac-vazio">
        Nenhuma categoria está sendo acompanhada ainda.<br><br>
        Vá em <b>Configurações → 👥 Categorias de clientes</b>, edite a categoria
        (por exemplo <b>Funcionários</b>) e marque <b>👁️ Acompanhar as compras desta categoria</b>.
      </div></div>`;
      return;
    }
    if (!r.clientes.length) {
      $res.innerHTML = `<div class="painel"><div class="ac-vazio">
        Ninguém das categorias acompanhadas comprou neste período${filtros().min_pecas ? ' com esse mínimo de peças' : ''}.
      </div></div>`;
      return;
    }

    const t = r.resumo;
    // "Compra grande" = o dobro da média de peças por compra do grupo. Não é
    // acusação, é o que merece um olhar — por isso a marca é discreta.
    const mediaGrupo = t.compras ? t.pecas / t.compras : 0;
    const corte = Math.max(5, mediaGrupo * 2);

    let h = `<div class="cards">
      <div class="card"><div class="rotulo">Pessoas</div><div class="valor">${t.clientes}</div></div>
      <div class="card"><div class="rotulo">Compras</div><div class="valor">${t.compras}</div></div>
      <div class="card"><div class="rotulo">Peças levadas</div><div class="valor">${t.pecas}</div></div>
      <div class="card"><div class="rotulo">Valor pago</div><div class="valor">${moeda(t.pago)}</div></div>
      <div class="card ev-card-abate"><div class="rotulo">Desconto concedido</div>
        <div class="valor">${moeda(t.desconto)}</div>
        <div class="ev-card-sub">sobre ${moeda(t.tabela)} de tabela</div></div>
    </div>`;

    h += '<div class="painel" style="margin-bottom:14px"><div class="barra"><b>Quem comprou</b>' +
      `<span class="ev-dica" style="margin-left:auto">${dataBr(r.de)} a ${dataBr(r.ate)} · clique na pessoa para ver as peças</span></div>` +
      '<div style="padding:12px 14px">';

    for (const c of r.clientes) {
      const grande = c.media_pecas >= corte;
      h += `<div class="ac-pessoa">
        <div class="ac-cab ${grande ? 'ac-alerta' : ''}" data-p="${c.cliente_id}">
          <span class="ac-nome">${esc(c.cliente)}</span>
          <span class="ac-tag">${esc(c.categoria)}${c.pct > 0 ? ` · ${c.pct}%` : ''}</span>
          <span class="ac-num">
            <span>compras<b>${c.compras}</b></span>
            <span>peças<b>${c.pecas}</b></span>
            <span>média/compra<b>${c.media_pecas}</b></span>
            <span>desconto<b>${moeda(c.desconto)}</b></span>
            <span>pagou<b>${moeda(c.pago)}</b></span>
          </span>
        </div>
        <div class="ac-itens" data-de="${c.cliente_id}">
          <table><thead><tr><th>Tipo de peça</th><th>Ref.</th><th>Cor / Tam.</th>
            <th class="num">Quantidade</th><th class="num">Total</th></tr></thead>
          <tbody>${c.produtos.map(x => `<tr>
            <td>${esc(x.produto)}</td><td>${esc(x.referencia || '—')}</td>
            <td>${esc([x.cor, x.tamanho].filter(y => y && y !== 'Única' && y !== 'U').join(' · ') || '—')}</td>
            <td class="num"><b>${x.qtd}</b></td><td class="num">${moeda(x.total)}</td></tr>`).join('')}
            <tr><td colspan="3"><b>Total de ${c.pecas} peça(s) em ${c.compras} compra(s)</b>
              <small style="color:var(--texto-suave)"> · de ${dataBr(c.primeira)} a ${dataBr(c.ultima)}</small></td>
              <td class="num"><b>${c.pecas}</b></td><td class="num"><b>${moeda(c.tabela)}</b></td></tr>
          </tbody></table>
        </div>
      </div>`;
    }
    h += '</div></div>';

    h += tabela('Peças mais levadas no período',
      `<th>Tipo de peça</th><th>Ref.</th><th>Cor / Tam.</th>
       <th class="num">Quantidade</th><th class="num">Total</th><th class="num">Pessoas</th>`,
      r.por_produto.map(x => `<tr><td>${esc(x.produto)}</td><td>${esc(x.referencia || '—')}</td>
        <td>${esc([x.cor, x.tamanho].filter(y => y && y !== 'Única' && y !== 'U').join(' · ') || '—')}</td>
        <td class="num"><b>${x.qtd}</b></td><td class="num">${moeda(x.total)}</td>
        <td class="num">${x.clientes}</td></tr>`).join(''));

    $res.innerHTML = h;
    // abre e fecha a lista de peças de cada pessoa
    $res.querySelectorAll('.ac-cab').forEach(cab => {
      const alvo = $res.querySelector(`.ac-itens[data-de="${cab.dataset.p}"]`);
      alvo.style.display = 'none';
      cab.onclick = () => { alvo.style.display = alvo.style.display === 'none' ? '' : 'none'; };
    });
  }

  painel.querySelector('#ac-gerar').onclick = gerar;
  painel.querySelector('#ac-xlsx').onclick = async () => {
    const r = await api('relatorios:acompanhadasXlsx', filtros());
    if (!r.ok) { toast(r.erro, true); return; }
    baixarBase64(r.buffer, `compras-acompanhadas-${filtros().de}-a-${filtros().ate}.xlsx`);
  };
  gerar();
}
