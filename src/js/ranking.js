// Ranking — produtos mais vendidos numa janela escolhida (data + HORA).
// A loja abre por evento (feijoada de domingo, sábado de samba…), então o
// período é escolhido por EVENTO: o sistema detecta sozinho as sessões de venda
// (vendas separadas por mais de 6h viram eventos diferentes).
// Na tela: top 10. Na impressão/PDF e no Excel: a lista completa.
import { api, el, esc, moeda, toast, getConfig } from './app.js';

const TOPO = 10;
let eventos = [];       // sessões de venda detectadas
let dados = null;       // resposta de relatorios:rankingPeriodo
let ordenarPor = 'pecas';
let rotuloAtual = '';

const dataBr = (d) => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';
const horaBr = (d) => String(d || '').slice(11, 16);
const dtBr = (d) => `${dataBr(d)} ${horaBr(d)}`;
const _p2 = (n) => String(n).padStart(2, '0');
const dtLocal = (d) => `${d.getFullYear()}-${_p2(d.getMonth() + 1)}-${_p2(d.getDate())}` +
  `T${_p2(d.getHours())}:${_p2(d.getMinutes())}`;
const paraInput = (s) => String(s || '').slice(0, 16).replace(' ', 'T');

function estilo() {
  if (document.getElementById('estilo-ranking')) return;
  const st = document.createElement('style');
  st.id = 'estilo-ranking';
  st.textContent = `
    .rk-sel { display:flex; gap:14px; flex-wrap:wrap; align-items:end; padding:12px }
    .rk-sel label { display:flex; flex-direction:column; gap:4px; font-weight:600; font-size:13px }
    .rk-sel select, .rk-sel input { padding:7px 10px; border:1px solid var(--borda);
      border-radius:8px; font-weight:400 }
    .rk-sel select { min-width:290px }
    .rk-modo { display:flex; gap:6px; padding:0 12px 10px; flex-wrap:wrap }
    .rk-modo button.ativa { background:var(--primaria,#8B1E2D); color:#fff }
    .rk-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:14px }
    .rk-var { font-weight:700 }
    .rk-sobe { color:#15803d } .rk-desce { color:#b91c1c } .rk-igual { opacity:.45 }
    .rk-tab { width:100%; border-collapse:collapse }
    .rk-tab td, .rk-tab th { padding:6px 10px; border-bottom:1px solid var(--borda); font-size:13px }
    .rk-tab th { font-size:11px; text-transform:uppercase; opacity:.7; text-align:left }
    .rk-pos { display:inline-block; width:34px; text-align:center; font-weight:700 }
    .rk-m1 { color:#b8860b } .rk-m2 { color:#8c8c8c } .rk-m3 { color:#a0522d }
    .rk-nome small { display:block; opacity:.6; font-size:11px }
    .rk-per { font-size:11px; opacity:.65; font-weight:400; margin-left:6px }
    .rk-hora { display:flex; align-items:flex-end; gap:3px; height:70px; padding:10px 12px 26px }
    .rk-hora div { flex:1; background:var(--primaria,#8B1E2D); opacity:.75;
      border-radius:3px 3px 0 0; position:relative; min-height:2px }
    .rk-hora span { position:absolute; bottom:-16px; left:0; right:0; text-align:center; font-size:9px; opacity:.6 }
    .num { text-align:right }
    @media print { .rk-nao-imprime { display:none !important } }`;
  document.head.appendChild(st);
}

function medalha(pos) {
  if (pos === 1) return '<span class="rk-pos rk-m1">🥇</span>';
  if (pos === 2) return '<span class="rk-pos rk-m2">🥈</span>';
  if (pos === 3) return '<span class="rk-pos rk-m3">🥉</span>';
  return `<span class="rk-pos">${pos}º</span>`;
}

function variacao(d) {
  if (d === undefined) return '';                       // sem comparação escolhida
  if (d === null) return '<span class="rk-var rk-igual" title="Não vendeu no período comparado">novo</span>';
  if (d > 0) return `<span class="rk-var rk-sobe" title="Subiu ${d} posição(ões)">▲${d}</span>`;
  if (d < 0) return `<span class="rk-var rk-desce" title="Caiu ${-d} posição(ões)">▼${-d}</span>`;
  return '<span class="rk-var rk-igual">—</span>';
}

const ordenados = () => {
  const arr = [...dados.periodo.produtos];
  if (ordenarPor === 'receita') arr.sort((a, b) => b.receita - a.receita || b.pecas - a.pecas);
  return arr;
};
const posDe = (x) => ordenarPor === 'receita' ? x.pos_receita : x.pos;
const deltaDe = (x) => ordenarPor === 'receita' ? x.delta_receita : x.delta;

function tabelaSimples(titulo, cabs, linhas) {
  return `<div class="painel" style="margin-top:14px">
    <div class="barra"><b>${titulo}</b></div>
    <table class="rk-tab"><thead><tr>${cabs}</tr></thead>
    <tbody>${linhas || '<tr><td class="vazio">Sem dados no período.</td></tr>'}</tbody></table></div>`;
}

function blocoHoras(per) {
  if (!per.por_hora || !per.por_hora.length) return '';
  const max = Math.max(...per.por_hora.map(h => h.vendas)) || 1;
  const mapa = new Map(per.por_hora.map(h => [h.hora, h]));
  const barras = [];
  for (let h = 0; h < 24; h++) {
    const d = mapa.get(h);
    barras.push(`<div style="height:${d ? Math.round((d.vendas / max) * 100) : 0}%"
      title="${h}h — ${d ? d.vendas : 0} venda(s)"><span>${h % 3 === 0 ? h : ''}</span></div>`);
  }
  const pico = per.por_hora.reduce((a, h) => h.vendas > (a?.vendas || 0) ? h : a, null);
  return `<div class="painel" style="margin-top:14px">
    <div class="barra"><b>⏰ Movimento por hora</b>
      <span class="rk-per">${pico ? `pico às ${pico.hora}h com ${pico.vendas} venda(s)` : ''}</span></div>
    <div class="rk-hora">${barras.join('')}</div></div>`;
}

function pintarResultado(corpo) {
  const per = dados.periodo;
  const lista = ordenados();
  const t = per.totais;
  const varTot = ordenarPor === 'receita' ? t.var_receita : t.var_pecas;
  const setaTot = varTot === null || varTot === undefined ? ''
    : `<span class="rk-var ${varTot > 0 ? 'rk-sobe' : varTot < 0 ? 'rk-desce' : 'rk-igual'}">
        ${varTot > 0 ? '▲' : varTot < 0 ? '▼' : ''}${Math.abs(varTot)}%</span>`;

  const linhas = lista.length
    ? lista.slice(0, TOPO).map(x => `<tr>
        <td>${medalha(posDe(x))}</td>
        <td class="rk-nome">${esc(x.nome)}<small>${esc(x.categoria)}${x.referencia ? ' · ' + esc(x.referencia) : ''}</small></td>
        <td class="num"><b>${x.pecas}</b></td>
        <td class="num">${moeda(x.receita)}</td>
        <td class="num">${variacao(deltaDe(x))}</td></tr>`).join('')
    : '<tr><td colspan="5" class="vazio">Nenhuma venda nesse período.</td></tr>';

  const cat = per.categorias.map((c, i) => `<tr><td>${medalha(i + 1)}</td><td>${esc(c.categoria)}</td>
    <td class="num"><b>${c.pecas}</b></td><td class="num">${moeda(c.receita)}</td></tr>`).join('');
  const varc = per.variacoes.map((v, i) => `<tr><td>${medalha(i + 1)}</td>
    <td class="rk-nome">${esc(v.produto)}<small>${esc([v.cor, v.tamanho].filter(x => x && x !== 'Única' && x !== 'U').join(' · ') || '—')}</small></td>
    <td class="num"><b>${v.pecas}</b></td><td class="num">${moeda(v.receita)}</td>
    <td class="num" style="${v.estoque <= 0 ? 'color:#b91c1c;font-weight:700' : ''}">${v.estoque}</td></tr>`).join('');
  const cli = per.clientes.map((c, i) => `<tr><td>${medalha(i + 1)}</td>
    <td class="rk-nome">${esc(c.nome)}${c.categoria ? `<small>${esc(c.categoria)}</small>` : ''}</td>
    <td class="num">${c.compras}</td><td class="num"><b>${moeda(c.gasto)}</b></td></tr>`).join('');

  corpo.innerHTML = `
    <div class="cards rk-cards">
      <div class="card"><div class="rotulo">Peças vendidas</div><div class="valor">${t.pecas}</div></div>
      <div class="card"><div class="rotulo">Receita</div><div class="valor">${moeda(t.receita)}</div></div>
      <div class="card"><div class="rotulo">Produtos diferentes</div><div class="valor">${t.itens}</div></div>
      ${setaTot ? `<div class="card"><div class="rotulo">vs. comparação</div><div class="valor">${setaTot}</div></div>` : ''}
    </div>
    <div class="painel">
      <div class="barra"><b>🏆 Mais vendidos</b>
        <span class="rk-per">${esc(rotuloAtual)} · ${dtBr(per.de)} até ${dtBr(per.ate)}</span></div>
      <table class="rk-tab"><thead><tr>
        <th></th><th>Produto</th><th class="num">Peças</th><th class="num">Receita</th><th class="num">Pos.</th>
      </tr></thead><tbody>${linhas}</tbody></table>
      ${lista.length > TOPO ? `<div style="padding:6px 12px;font-size:11px;opacity:.6">
        Mostrando os ${TOPO} primeiros de ${lista.length}. A impressão e o Excel trazem a lista completa.</div>` : ''}
    </div>
    ${tabelaSimples('🏷️ Categorias mais vendidas',
      '<th></th><th>Categoria</th><th class="num">Peças</th><th class="num">Receita</th>', cat)}
    ${tabelaSimples('📐 Cor e tamanho que mais saem <span class="rk-per">— estoque em vermelho = zerado</span>',
      '<th></th><th>Produto</th><th class="num">Peças</th><th class="num">Receita</th><th class="num">Estoque</th>', varc)}
    ${tabelaSimples('👑 Melhores clientes',
      '<th></th><th>Cliente</th><th class="num">Compras</th><th class="num">Total gasto</th>', cli)}
    ${blocoHoras(per)}`;
}

// Impressão / PDF: lista COMPLETA da janela escolhida
function imprimir() {
  const cfg = (getConfig && getConfig()) || {};
  const per = dados.periodo;
  const lista = ordenados();
  document.getElementById('area-impressao-rk')?.remove();
  const area = el('<div id="area-impressao-rk"></div>');
  area.innerHTML = `
    <div class="cab-print"><h1>${esc(cfg.loja_nome || 'Ranking')}</h1>
      <div><b>${esc(rotuloAtual || 'Ranking de produtos')}</b> — ${dtBr(per.de)} até ${dtBr(per.ate)}</div>
      <div>Ordenado por ${ordenarPor === 'receita' ? 'receita' : 'peças vendidas'} ·
        ${per.totais.pecas} peças · ${moeda(per.totais.receita)} ·
        ${lista.length} produtos · emitido ${new Date().toLocaleString('pt-BR')}</div></div>
    <table><thead><tr><th>#</th><th>Produto</th><th>Ref.</th><th>Categoria</th>
      <th class="num">Peças</th><th class="num">Receita</th></tr></thead><tbody>
      ${lista.length ? lista.map(x => `<tr><td>${posDe(x)}º</td><td>${esc(x.nome)}</td>
        <td>${esc(x.referencia || '—')}</td><td>${esc(x.categoria)}</td>
        <td class="num">${x.pecas}</td><td class="num">${moeda(x.receita)}</td></tr>`).join('')
        : '<tr><td colspan="6">Nenhuma venda nesse período.</td></tr>'}
      <tr><td colspan="4"><b>TOTAL</b></td><td class="num"><b>${per.totais.pecas}</b></td>
        <td class="num"><b>${moeda(per.totais.receita)}</b></td></tr>
    </tbody></table>
    <h2>Categorias</h2>
    <table><thead><tr><th>#</th><th>Categoria</th><th class="num">Peças</th><th class="num">Receita</th></tr></thead>
      <tbody>${per.categorias.map((c, i) => `<tr><td>${i + 1}º</td><td>${esc(c.categoria)}</td>
        <td class="num">${c.pecas}</td><td class="num">${moeda(c.receita)}</td></tr>`).join('')
        || '<tr><td colspan="4">—</td></tr>'}</tbody></table>
    <h2>Cor e tamanho (com estoque atual)</h2>
    <table><thead><tr><th>#</th><th>Produto</th><th>Cor / Tam.</th>
      <th class="num">Peças</th><th class="num">Estoque</th></tr></thead>
      <tbody>${per.variacoes.map((v, i) => `<tr><td>${i + 1}º</td><td>${esc(v.produto)}</td>
        <td>${esc([v.cor, v.tamanho].filter(x => x && x !== 'Única' && x !== 'U').join(' · ') || '—')}</td>
        <td class="num">${v.pecas}</td><td class="num">${v.estoque}</td></tr>`).join('')
        || '<tr><td colspan="5">—</td></tr>'}</tbody></table>`;
  if (!document.getElementById('estilo-impressao-rk')) {
    const st = document.createElement('style');
    st.id = 'estilo-impressao-rk';
    st.textContent = `
      #area-impressao-rk { display:none }
      #area-impressao-rk h1 { font-size:18px; margin:0 0 2px }
      #area-impressao-rk h2 { font-size:14px; margin:14px 0 4px; page-break-after:avoid }
      #area-impressao-rk .cab-print { border-bottom:2px solid #333; margin-bottom:10px; padding-bottom:6px }
      #area-impressao-rk table { width:100%; border-collapse:collapse; margin:4px 0 10px; font-size:11px }
      #area-impressao-rk th, #area-impressao-rk td { border:1px solid #999; padding:3px 5px; text-align:left }
      #area-impressao-rk .num { text-align:right }
      @media print {
        body > *:not(#area-impressao-rk) { display:none !important }
        #area-impressao-rk { display:block !important }
      }`;
    document.head.appendChild(st);
  }
  document.body.appendChild(area);
  window.print();
  setTimeout(() => area.remove(), 900);
}

export async function viewRanking(alvo) {
  estilo();
  const tela = el(`
    <div>
      <div class="pagina-topo"><h1>🏆 Ranking</h1></div>
      <div class="painel rk-nao-imprime" style="margin-bottom:16px">
        <div class="barra"><b>Qual período você quer ver?</b>
          <span class="rk-per">A loja abre por evento — escolha o evento ou informe data e hora.</span></div>
        <div class="rk-modo">
          <button class="btn btn-suave ativa" data-modo="evento">🎪 Por evento</button>
          <button class="btn btn-suave" data-modo="livre">📅 Data e hora</button>
          <button class="btn btn-suave" data-modo="mes">Mês atual</button>
          <button class="btn btn-suave" data-modo="ano">Ano atual</button>
        </div>
        <div class="rk-sel" id="rk-campos"></div>
        <div class="barra" style="border-top:1px solid var(--borda)">
          <b style="font-size:13px">Ordenar por</b>
          <button class="btn btn-suave ativa" id="rk-pecas">Peças vendidas</button>
          <button class="btn btn-suave" id="rk-receita">Receita</button>
          <button class="btn btn-suave" id="rk-imprimir" style="margin-left:auto" disabled>🖨️ Imprimir / PDF</button>
          <button class="btn btn-suave" id="rk-excel" disabled>📊 Excel</button>
        </div>
      </div>
      <div id="rk-corpo"><div class="painel"><div class="vazio">Carregando eventos…</div></div></div>
    </div>`);
  const corpo = tela.querySelector('#rk-corpo');
  const campos = tela.querySelector('#rk-campos');
  let modo = 'evento';

  const q = (s) => tela.querySelector(s);
  const optEventos = (sel) => eventos.map((e, i) =>
    `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(e.rotulo)} · ${e.vendas} venda(s) · ${moeda(e.total)}</option>`).join('');

  function desenharCampos() {
    if (modo === 'evento') {
      if (!eventos.length) {
        campos.innerHTML = '<div class="vazio" style="padding:4px">Nenhuma venda registrada ainda.</div>';
        return;
      }
      campos.innerHTML = `
        <label>Evento
          <select id="rk-ev">${optEventos(0)}</select></label>
        <label>Comparar com
          <select id="rk-cmp">
            <option value="auto">Evento anterior (automático)</option>
            <option value="">Não comparar</option>
            ${eventos.map((e, i) => `<option value="${i}">${esc(e.rotulo)}</option>`).join('')}
          </select></label>
        <button class="btn" id="rk-gerar">Ver ranking</button>`;
    } else if (modo === 'livre') {
      const fim = new Date(); const ini = new Date(fim.getTime() - 8 * 3600e3);
      campos.innerHTML = `
        <label>Início<input id="rk-ini" type="datetime-local" value="${dtLocal(ini)}"></label>
        <label>Fim<input id="rk-fim" type="datetime-local" value="${dtLocal(fim)}"></label>
        <button class="btn" id="rk-gerar">Ver ranking</button>`;
    } else {
      campos.innerHTML = '<div style="padding:4px;font-size:13px;opacity:.7">Carregando…</div>';
    }
    campos.querySelector('#rk-gerar')?.addEventListener('click', gerar);
  }

  async function gerar() {
    let p = {}, rot = '';
    if (modo === 'evento') {
      const i = Number(q('#rk-ev')?.value ?? 0);
      const ev = eventos[i]; if (!ev) return;
      p = { inicio: ev.inicio, fim: ev.fim };
      rot = `Evento ${ev.rotulo}`;
      const cmp = q('#rk-cmp')?.value;
      if (cmp === 'auto') {
        const ant = eventos[i + 1];               // lista vem do mais recente ao mais antigo
        if (ant) { p.cmp_inicio = ant.inicio; p.cmp_fim = ant.fim; }
      } else if (cmp !== '') {
        const ant = eventos[Number(cmp)];
        if (ant) { p.cmp_inicio = ant.inicio; p.cmp_fim = ant.fim; }
      }
    } else if (modo === 'livre') {
      const a = q('#rk-ini').value, z = q('#rk-fim').value;
      if (!a || !z) { toast('Informe início e fim.', true); return; }
      if (z <= a) { toast('O fim precisa ser depois do início.', true); return; }
      p = { inicio: a, fim: z };
      rot = 'Período escolhido';
      // compara com uma janela de igual duração imediatamente anterior
      const dur = new Date(z).getTime() - new Date(a).getTime();
      p.cmp_fim = dtLocal(new Date(new Date(a).getTime() - 60000));
      p.cmp_inicio = dtLocal(new Date(new Date(a).getTime() - 60000 - dur));
    } else {
      const d = new Date();
      const ini = modo === 'mes'
        ? `${d.getFullYear()}-${_p2(d.getMonth() + 1)}-01 00:00`
        : `${d.getFullYear()}-01-01 00:00`;
      p = { inicio: ini, fim: `${dtLocal(d).slice(0, 10)} 23:59` };
      rot = modo === 'mes' ? 'Mês atual' : 'Ano atual';
    }
    rotuloAtual = rot;
    corpo.innerHTML = '<div class="painel"><div class="vazio">Carregando…</div></div>';
    const r = await api('relatorios:rankingPeriodo', p);
    if (!r.ok) { toast(r.erro || 'Erro ao gerar o ranking.', true); corpo.innerHTML = ''; return; }
    dados = r; dados._params = p;
    pintarResultado(corpo);
    q('#rk-imprimir').disabled = false;
    q('#rk-excel').disabled = false;
  }

  tela.querySelectorAll('[data-modo]').forEach(b => {
    b.onclick = () => {
      modo = b.dataset.modo;
      tela.querySelectorAll('[data-modo]').forEach(x => x.classList.toggle('ativa', x === b));
      desenharCampos();
      if (modo === 'mes' || modo === 'ano') gerar();
    };
  });
  q('#rk-pecas').onclick = () => {
    ordenarPor = 'pecas';
    q('#rk-pecas').classList.add('ativa'); q('#rk-receita').classList.remove('ativa');
    if (dados) pintarResultado(corpo);
  };
  q('#rk-receita').onclick = () => {
    ordenarPor = 'receita';
    q('#rk-receita').classList.add('ativa'); q('#rk-pecas').classList.remove('ativa');
    if (dados) pintarResultado(corpo);
  };
  q('#rk-imprimir').onclick = () => {
    if (!dados) return;
    toast('Na janela de impressão, escolha "Salvar como PDF" para gerar o arquivo.');
    imprimir();
  };
  q('#rk-excel').onclick = async () => {
    if (!dados) return;
    toast('Gerando Excel…');
    const r = await api('relatorios:rankingPeriodoXlsx', dados._params);
    if (!r.ok) { toast(r.erro || 'Erro ao gerar o Excel.', true); return; }
    const bin = atob(r.buffer);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `ranking-${String(dados.periodo.de).slice(0, 10)}.xlsx`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Excel baixado.');
  };

  alvo.appendChild(tela);

  const re = await api('relatorios:eventos', {});
  eventos = re.ok ? re.eventos : [];
  desenharCampos();
  if (eventos.length) gerar();
  else corpo.innerHTML = '<div class="painel"><div class="vazio">Nenhuma venda registrada ainda.</div></div>';
}
