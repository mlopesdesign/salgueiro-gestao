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
        ${pode('dashboard.financeiro') ? '<button data-aba="lojas">🏬 Por loja</button>' : ''}
        <button data-aba="abc">Curva ABC</button>
        <button data-aba="paradas">Peças paradas</button>
      </div>
      <div id="aba-conteudo"></div>
    </div>`);
  const corpo = tela.querySelector('#aba-conteudo');
  const periodo = () => ({ de: tela.querySelector('#r-de').value, ate: tela.querySelector('#r-ate').value });
  const abas = { vendas: abaVendas, lojas: abaPorLoja, abc: abaAbc, paradas: abaParadas };
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
  tela.querySelectorAll('#r-de, #r-ate').forEach(c => c.addEventListener('change', () => trocar(abaAtiva)));
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
