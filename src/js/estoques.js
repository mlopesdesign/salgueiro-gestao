// Estoques — almoxarifado central, loja(s), pessoa que pegou peças, venda online.
// O total do Salgueiro continua sendo o estoque geral; aqui você vê onde cada
// peça está e move entre os locais por romaneio (imprimível e em PDF).
import { api, el, esc, moeda, toast, modal, getConfig, pode } from './app.js';

const TIPOS = [
  ['almoxarifado', '🏢 Almoxarifado'],
  ['loja', '🏪 Loja'],
  ['pessoa', '🧍 Pessoa (levou peças)'],
  ['online', '📱 Venda online / WhatsApp'],
  ['outro', '📦 Outro']
];
const rotuloTipo = (t) => (TIPOS.find(x => x[0] === t) || [, t])[1];
const dataBrH = (s) => `${String(s || '').slice(0, 10).split('-').reverse().join('/')} ${String(s || '').slice(11, 16)}`;

let locais = [];
let selecionado = null;

function estilo() {
  if (document.getElementById('estilo-estoques')) return;
  const st = document.createElement('style');
  st.id = 'estilo-estoques';
  st.textContent = `
    .es-locais { display:grid; grid-template-columns:repeat(auto-fill,minmax(215px,1fr)); gap:12px; margin-bottom:16px }
    .es-card { border:1px solid var(--borda); border-radius:10px; padding:12px 14px; cursor:pointer;
      background:var(--fundo); transition:border-color .12s }
    .es-card:hover { border-color:var(--primaria,#8B1E2D) }
    .es-card.ativo { border-color:var(--primaria,#8B1E2D); border-width:2px; padding:11px 13px }
    .es-card .es-tipo { font-size:11px; opacity:.6 }
    .es-card .es-nome { font-weight:700; font-size:14px; margin:2px 0 6px }
    .es-card .es-qtd { font-size:22px; font-weight:700; color:var(--primaria,#8B1E2D) }
    .es-card .es-sub { font-size:11px; opacity:.6 }
    .es-badge { font-size:10px; padding:1px 6px; border-radius:20px; background:#fef3c7; color:#b45309; font-weight:700 }
    .es-tab { width:100%; border-collapse:collapse }
    .es-tab th, .es-tab td { padding:6px 10px; border-bottom:1px solid var(--borda); font-size:13px }
    .es-tab th { font-size:11px; text-transform:uppercase; opacity:.7; text-align:left }
    .es-itens-tr td { padding:4px 10px }
    .num { text-align:right }
    .es-busca-res { border:1px solid var(--borda); border-radius:8px; max-height:200px; overflow-y:auto; margin-top:4px }
    .es-busca-res div { padding:7px 10px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--borda) }
    .es-busca-res div:hover { background:rgba(0,0,0,.05) }
    @media print { .es-nao-imprime { display:none !important } }`;
  document.head.appendChild(st);
}

// ---------- Romaneio (impressão / PDF) ----------
function imprimirRomaneio(r) {
  const cfg = (getConfig && getConfig()) || {};
  const t = r.transferencia;
  document.getElementById('area-romaneio')?.remove();
  const area = el('<div id="area-romaneio"></div>');
  area.innerHTML = `
    <div class="rom-cab">
      <h1>${esc(cfg.loja_nome || 'Romaneio')}</h1>
      <h2>ROMANEIO DE TRANSFERÊNCIA Nº ${t.id}</h2>
      <table class="rom-info"><tbody>
        <tr><td><b>De:</b> ${esc(t.origem)}</td><td><b>Para:</b> ${esc(t.destino)}</td></tr>
        <tr><td><b>Data:</b> ${dataBrH(t.criado_em)}</td><td><b>Responsável:</b> ${esc(t.usuario || '—')}</td></tr>
        ${t.obs ? `<tr><td colspan="2"><b>Observação:</b> ${esc(t.obs)}</td></tr>` : ''}
      </tbody></table>
    </div>
    <table><thead><tr><th>Produto</th><th>Ref.</th><th>Cor / Tam.</th>
      <th>Código de barras</th><th class="num">Qtd</th><th class="num">Conferido</th></tr></thead>
      <tbody>${r.itens.map(i => `<tr><td>${esc(i.produto)}</td><td>${esc(i.referencia || '—')}</td>
        <td>${esc([i.cor, i.tamanho].filter(x => x && x !== 'Única' && x !== 'U').join(' · ') || '—')}</td>
        <td>${esc(i.codigo_barras || '—')}</td><td class="num"><b>${i.qtd}</b></td><td></td></tr>`).join('')}
        <tr><td colspan="4"><b>TOTAL DE PEÇAS</b></td><td class="num"><b>${r.pecas}</b></td><td></td></tr>
      </tbody></table>
    <div class="rom-ass">
      <div>Entregue por<br><br>______________________________</div>
      <div>Recebido por<br><br>______________________________</div>
    </div>`;
  if (!document.getElementById('estilo-romaneio')) {
    const st = document.createElement('style');
    st.id = 'estilo-romaneio';
    st.textContent = `
      #area-romaneio { display:none }
      #area-romaneio h1 { font-size:17px; margin:0 }
      #area-romaneio h2 { font-size:13px; margin:2px 0 8px; letter-spacing:1px }
      #area-romaneio .rom-cab { border-bottom:2px solid #333; margin-bottom:10px; padding-bottom:6px }
      #area-romaneio .rom-info td { border:0; padding:2px 0; font-size:12px }
      #area-romaneio table { width:100%; border-collapse:collapse; font-size:11.5px }
      #area-romaneio th, #area-romaneio td { border:1px solid #999; padding:4px 6px; text-align:left }
      #area-romaneio .num { text-align:right }
      #area-romaneio .rom-ass { display:flex; gap:40px; margin-top:38px; font-size:11px; text-align:center }
      #area-romaneio .rom-ass > div { flex:1 }
      @media print {
        body > *:not(#area-romaneio) { display:none !important }
        #area-romaneio { display:block !important }
      }`;
    document.head.appendChild(st);
  }
  document.body.appendChild(area);
  window.print();
  setTimeout(() => area.remove(), 900);
}

// Abre tela de visualização do romaneio com botões imprimir e baixar PDF
async function viewRomaneio(id) {
  const r = await api('estoques:romaneio', { id });
  if (!r.ok) { toast(r.erro, true); return; }
  const cfg = (typeof getConfig === 'function' && getConfig()) || {};
  const t = r.transferencia;
  const dataBrH = s => `${String(s||'').slice(0,10).split('-').reverse().join('/')} ${String(s||'').slice(11,16)}`;
  const corTam = i => [i.cor,i.tamanho].filter(x=>x&&x!=='Única'&&x!=='U').join(' · ')||'—';
  const linhas = r.itens.map(i => `<tr>
    <td>${esc(i.produto)}</td><td>${esc(i.referencia||'—')}</td>
    <td>${esc(corTam(i))}</td><td>${esc(i.codigo_barras||'—')}</td>
    <td class="num"><b>${i.qtd}</b></td>
    <td style="min-width:50px"></td>
  </tr>`).join('');

  document.getElementById('rom-overlay')?.remove();
  const overlay = el(`<div id="rom-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px">
    <div style="background:#fff;border-radius:12px;width:100%;max-width:820px;padding:24px;position:relative">
      <div id="rom-barra" style="display:flex;gap:8px;margin-bottom:16px;justify-content:space-between;align-items:center">
        <b style="font-size:16px">Romaneio #${t.id}</b>
        <div style="display:flex;gap:8px">
          <button class="btn btn-suave" id="rom-btn-print">🖨️ Imprimir</button>
          <button class="btn btn-suave" id="rom-btn-pdf">📄 Baixar PDF</button>
          <button class="btn btn-suave" id="rom-fechar" style="padding:4px 12px;font-size:18px;line-height:1">×</button>
        </div>
      </div>
      <div id="rom-conteudo">
        <div style="border-bottom:2px solid #333;margin-bottom:10px;padding-bottom:8px">
          <b style="font-size:15px">${esc(cfg.loja_nome||'Boutique do Salgueiro')}</b><br>
          <span style="font-size:11px;letter-spacing:1px;color:#666;font-weight:600">ROMANEIO DE TRANSFERÊNCIA Nº ${t.id}</span>
          <table style="border-collapse:collapse;width:100%;margin-top:6px">
            <tr><td style="padding:2px 4px;font-size:12px"><b>De:</b> ${esc(t.origem)}</td>
                <td style="padding:2px 4px;font-size:12px"><b>Para:</b> ${esc(t.destino)}</td></tr>
            <tr><td style="padding:2px 4px;font-size:12px"><b>Data:</b> ${dataBrH(t.criado_em)}</td>
                <td style="padding:2px 4px;font-size:12px"><b>Responsável:</b> ${esc(t.usuario||'—')}</td></tr>
            ${t.obs?`<tr><td colspan="2" style="padding:2px 4px;font-size:12px"><b>Obs:</b> ${esc(t.obs)}</td></tr>`:''}
          </table>
        </div>
        <table class="es-tab" style="margin-top:8px">
          <thead><tr><th>Produto</th><th>Ref.</th><th>Cor/Tam.</th>
            <th>Cód. barras</th><th class="num">Qtd</th><th>Conferido</th></tr></thead>
          <tbody>
            ${linhas||'<tr><td colspan="6" class="vazio">Sem itens.</td></tr>'}
            <tr style="font-weight:700;background:#f8f8f8">
              <td colspan="4">TOTAL DE PEÇAS</td>
              <td class="num">${r.pecas}</td><td></td>
            </tr>
          </tbody>
        </table>
        <div style="display:flex;gap:60px;margin-top:40px;font-size:11px;text-align:center">
          <div style="flex:1"><div style="border-bottom:1px solid #555;margin:32px 0 5px"></div>Entregue por</div>
          <div style="flex:1"><div style="border-bottom:1px solid #555;margin:32px 0 5px"></div>Recebido por</div>
        </div>
      </div>
    </div>
  </div>`);

  overlay.querySelector('#rom-fechar').onclick = () => overlay.remove();
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#rom-btn-print').onclick = () => {
    overlay.remove();
    imprimirRomaneio(r);
  };

  overlay.querySelector('#rom-btn-pdf').onclick = async () => {
    const btn = overlay.querySelector('#rom-btn-pdf');
    btn.disabled = true; btn.textContent = '⏳ Gerando…';
    const res = await api('estoques:romaneio-pdf', { id });
    btn.disabled = false; btn.textContent = '📄 Baixar PDF';
    if (!res.ok) { toast((res.erro||'Erro ao gerar PDF'), true); return; }
    const bin = atob(res.buffer);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    a.download = `romaneio-${id}.pdf`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('PDF baixado — pronto para enviar pelo WhatsApp!');
  };

  document.body.appendChild(overlay);
}

// Mantido para compatibilidade — abre a tela de visualização
async function abrirRomaneio(id) {
  await viewRomaneio(id);
}

// ---------- Modal: novo/editar local ----------
function formLocal(local, aoSalvar) {
  const ed = !!local;
  modal(ed ? 'Editar estoque' : 'Novo estoque', `
    <div class="campo"><label>Nome *</label>
      <input id="es-nome" value="${esc(local?.nome || '')}" placeholder="Ex.: Maria (levou peças), WhatsApp"></div>
    <div class="campo"><label>Tipo</label>
      <select id="es-tipo">${TIPOS.map(([v, n]) =>
        `<option value="${v}" ${local?.tipo === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="campo"><label>Responsável (opcional)</label>
      <input id="es-resp" value="${esc(local?.responsavel || '')}" placeholder="quem responde por este estoque"></div>
    <div class="erro" id="es-erro"></div>
    ${local?.loja_id ? '<p style="font-size:12px;color:var(--texto-suave)">Este estoque pertence a uma loja.</p>' : ''}
  `, async (m, fechar) => {
    const r = await api('estoques:salvar', {
      id: local?.id, nome: m.querySelector('#es-nome').value,
      tipo: m.querySelector('#es-tipo').value, responsavel: m.querySelector('#es-resp').value
    });
    if (!r.ok) { m.querySelector('#es-erro').textContent = r.erro; return; }
    fechar(); toast(ed ? 'Estoque atualizado.' : 'Estoque criado.'); aoSalvar();
  }, ed ? 'Salvar' : 'Criar estoque');
}

// ---------- Modal: transferir ----------
function formTransferir(origemId, aoConcluir) {
  const itens = [];
  const opts = (sel) => locais.map(l =>
    `<option value="${l.id}" ${l.id === sel ? 'selected' : ''}>${esc(l.nome)} (${l.pecas} peças)</option>`).join('');
  const destinoPadrao = locais.find(l => l.id !== origemId)?.id;

  modal('📥 Transferir peças (gera romaneio)', `
    <div class="linha-2">
      <div class="campo"><label>De (origem)</label><select id="tr-origem">${opts(origemId)}</select></div>
      <div class="campo"><label>Para (destino)</label><select id="tr-destino">${opts(destinoPadrao)}</select></div>
    </div>
    <div class="campo"><label>Buscar peça</label>
      <input id="tr-busca" placeholder="digite o nome ou bipe o código de barras" autocomplete="off">
      <div class="es-busca-res" id="tr-res" style="display:none"></div></div>
    <table class="es-tab"><thead><tr><th>Peça</th><th class="num" style="width:90px">Qtd</th>
      <th style="width:36px"></th></tr></thead><tbody id="tr-itens">
      <tr><td colspan="3" class="vazio">Nenhuma peça adicionada.</td></tr></tbody></table>
    <div class="campo" style="margin-top:10px"><label>Observação (aparece no romaneio)</label>
      <input id="tr-obs" placeholder="Ex.: descida para a feijoada de domingo"></div>
    <div class="erro" id="tr-erro"></div>
  `, async (m, fechar) => {
    if (!itens.length) { m.querySelector('#tr-erro').textContent = 'Adicione ao menos uma peça.'; return; }
    const r = await api('estoques:transferir', {
      origem_id: Number(m.querySelector('#tr-origem').value),
      destino_id: Number(m.querySelector('#tr-destino').value),
      obs: m.querySelector('#tr-obs').value,
      itens: itens.map(i => ({ variacao_id: i.variacao_id, qtd: i.qtd }))
    });
    if (!r.ok) { m.querySelector('#tr-erro').textContent = r.erro; return; }
    fechar();
    const romId = r.id;
    aoConcluir();
    toast(`Romaneio #${romId} criado — clique para ver`, false, () => viewRomaneio(romId));
  }, 'Transferir e gerar romaneio');

  const m = document.querySelector('.modal-caixa') || document;
  const $busca = m.querySelector('#tr-busca');
  const $res = m.querySelector('#tr-res');
  const $itens = m.querySelector('#tr-itens');

  function desenhar() {
    $itens.innerHTML = itens.length ? '' : '<tr><td colspan="3" class="vazio">Nenhuma peça adicionada.</td></tr>';
    itens.forEach((i, idx) => {
      const tr = el(`<tr><td>${esc(i.rotulo)}</td>
        <td class="num"><input type="number" min="1" step="1" value="${i.qtd}" style="width:70px;text-align:right"></td>
        <td><button class="btn btn-suave" style="padding:4px 8px;color:var(--vermelho)">✕</button></td></tr>`);
      tr.querySelector('input').addEventListener('input', e => { i.qtd = Number(e.target.value) || 1; });
      tr.querySelector('button').onclick = () => { itens.splice(idx, 1); desenhar(); };
      $itens.appendChild(tr);
    });
  }

  let deb;
  $busca.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(async () => {
      const termo = $busca.value.trim();
      if (termo.length < 2) { $res.style.display = 'none'; return; }
      const r = await api('estoque:buscar', { termo });
      const lista = r.ok ? r.variacoes : [];
      if (!lista.length) { $res.style.display = 'none'; return; }
      $res.style.display = 'block';
      $res.innerHTML = '';
      for (const v of lista.slice(0, 10)) {
        const rot = `${v.produto}${v.cor !== 'Única' ? ` — ${v.cor}/${v.tamanho}` : ''}`;
        const d = el(`<div><b>${esc(rot)}</b> <small style="opacity:.6">(total: ${v.estoque})</small></div>`);
        d.onclick = () => {
          const ja = itens.find(x => x.variacao_id === v.id);
          if (ja) ja.qtd += 1; else itens.push({ variacao_id: v.id, rotulo: rot, qtd: 1 });
          $busca.value = ''; $res.style.display = 'none'; desenhar();
        };
        $res.appendChild(d);
      }
    }, 250);
  });
}

// ---------- Tela ----------
export async function viewEstoques(alvo) {
  estilo();
  const tela = el(`
    <div>
      <div class="pagina-topo"><h1>🏢 Estoques</h1></div>
      <div class="painel es-nao-imprime" style="margin-bottom:16px"><div class="barra">
        <b>Onde estão as peças</b>
        <span style="font-size:12px;opacity:.65">O total do Salgueiro é a soma de todos os locais.</span>
        ${pode('estoque.movimentar') ? `
          <button class="btn" id="es-transferir" style="margin-left:auto">📥 Transferir peças</button>
          <button class="btn btn-suave" id="es-novo">+ Novo estoque</button>` : ''}
      </div>
      <div style="padding:0 12px 12px"><div class="es-locais" id="es-cards"></div></div></div>
      <div id="es-detalhe"></div>
      <div class="painel es-nao-imprime" style="margin-top:16px">
        <div class="barra"><b>📄 Romaneios</b>
          <span style="font-size:12px;opacity:.65">Clique em "Ver" para visualizar, imprimir ou baixar PDF</span>
          <button class="btn btn-suave" id="es-rel-pdf" style="margin-left:auto;font-size:12px">📊 Relatório PDF</button>
        </div>
        <div id="es-romaneios"><div class="vazio">Carregando…</div></div>
      </div>
    </div>`);
  const $cards = tela.querySelector('#es-cards');
  const $det = tela.querySelector('#es-detalhe');

  async function carregarLocais() {
    const r = await api('estoques:listar', {});
    locais = r.ok ? r.estoques : [];
    if (!selecionado || !locais.some(l => l.id === selecionado)) {
      selecionado = locais.find(l => l.principal)?.id || locais[0]?.id || null;
    }
    $cards.innerHTML = '';
    for (const l of locais) {
      const c = el(`<div class="es-card ${l.id === selecionado ? 'ativo' : ''}">
        <div class="es-tipo">${rotuloTipo(l.tipo)} ${l.principal ? '<span class="es-badge">central</span>' : ''}</div>
        <div class="es-nome">${esc(l.nome)}</div>
        <div class="es-qtd">${l.pecas}</div>
        <div class="es-sub">peça(s) · ${l.itens} tipo(s)${l.responsavel ? ' · ' + esc(l.responsavel) : ''}</div>
      </div>`);
      c.onclick = () => { selecionado = l.id; carregarLocais(); };
      if (pode('estoque.movimentar')) {
        c.oncontextmenu = (e) => { e.preventDefault(); formLocal(l, carregarLocais); };
        c.title = 'Clique para ver o conteúdo · clique com o botão direito para editar';
      }
      $cards.appendChild(c);
    }
    await carregarDetalhe();
  }

  async function carregarDetalhe() {
    if (!selecionado) { $det.innerHTML = ''; return; }
    $det.innerHTML = '<div class="painel"><div class="vazio">Carregando…</div></div>';
    const r = await api('estoques:conteudo', { estoque_id: selecionado });
    if (!r.ok) { $det.innerHTML = `<div class="painel"><div class="vazio">${esc(r.erro)}</div></div>`; return; }
    const linhas = r.itens.map(i => `<tr>
      <td>${esc(i.produto)}<br><small style="opacity:.6">${esc(i.categoria)}${i.referencia ? ' · ' + esc(i.referencia) : ''}</small></td>
      <td>${esc([i.cor, i.tamanho].filter(x => x && x !== 'Única' && x !== 'U').join(' · ') || '—')}</td>
      <td class="num"><b>${i.qtd}</b></td>
      <td class="num" style="opacity:.6">${i.total_geral}</td>
      <td class="num">${moeda(i.qtd * (i.preco_venda || 0))}</td></tr>`).join('');
    const bloco = el(`<div class="painel">
      <div class="barra"><b>${esc(r.estoque.nome)}</b>
        <span style="font-size:12px;opacity:.65">${r.totais.itens} tipo(s) · ${r.totais.pecas} peça(s) ·
          custo ${moeda(r.totais.custo)} · venda ${moeda(r.totais.venda)}</span>
        <button class="btn btn-suave es-nao-imprime" id="es-print" style="margin-left:auto">🖨️ Imprimir balanço</button>
        <button class="btn btn-suave es-nao-imprime" id="es-xlsx">📊 Excel</button>
      </div>
      <table class="es-tab"><thead><tr>
        <th>Produto</th><th>Cor / Tam.</th><th class="num">Neste estoque</th>
        <th class="num">Total Salgueiro</th><th class="num">Valor de venda</th>
      </tr></thead><tbody>${linhas || '<tr><td colspan="5" class="vazio">Este estoque está vazio.</td></tr>'}</tbody></table>
    </div>`);
    bloco.querySelector('#es-print').onclick = () => {
      toast('Para enviar por WhatsApp ou e-mail, escolha "Salvar como PDF".');
      window.print();
    };
    bloco.querySelector('#es-xlsx').onclick = async () => {
      toast('Gerando Excel…');
      const x = await api('estoques:conteudoXlsx', { estoque_id: selecionado });
      if (!x.ok) { toast(x.erro, true); return; }
      const bin = atob(x.buffer);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = `balanco-${r.estoque.nome.replace(/\s+/g, '-').toLowerCase()}.xlsx`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast('Excel baixado.');
    };
    $det.innerHTML = ''; $det.appendChild(bloco);
  }

  async function carregarRomaneios() {
    const r = await api('estoques:transferencias', { limite: 30 });
    const alvoR = tela.querySelector('#es-romaneios');
    if (!r.ok || !r.transferencias.length) {
      alvoR.innerHTML = '<div class="vazio">Nenhuma transferência registrada ainda.</div>';
      return;
    }
    alvoR.innerHTML = `<table class="es-tab"><thead><tr>
      <th>Nº</th><th>Data</th><th>De → Para</th><th>Responsável</th>
      <th class="num">Peças</th><th>Observação</th><th></th></tr></thead><tbody>
      ${r.transferencias.map(t => `<tr>
        <td><b>#${t.id}</b></td><td>${dataBrH(t.criado_em)}</td>
        <td>${esc(t.origem)} → <b>${esc(t.destino)}</b></td>
        <td>${esc(t.usuario || '—')}</td><td class="num"><b>${t.pecas}</b></td>
        <td style="font-size:12px;opacity:.75">${esc(t.obs || '—')}</td>
        <td><button class="btn btn-suave" data-rom="${t.id}" style="padding:4px 10px">📋 Ver</button></td>
      </tr>`).join('')}</tbody></table>`;
    alvoR.querySelectorAll('[data-rom]').forEach(b => {
      b.onclick = () => abrirRomaneio(Number(b.dataset.rom));
    });
  }

  if (pode('estoque.movimentar')) {
    tela.querySelector('#es-transferir').onclick = () =>
      formTransferir(selecionado, async () => { await carregarLocais(); await carregarRomaneios(); });
    tela.querySelector('#es-novo').onclick = () => formLocal(null, carregarLocais);
  }
  tela.querySelector('#es-rel-pdf').onclick = async () => {
    const btn = tela.querySelector('#es-rel-pdf');
    btn.disabled = true; btn.textContent = '⏳ Gerando…';
    const res = await api('estoques:relatorio-transferencias-pdf', {});
    btn.disabled = false; btn.textContent = '📊 Relatório PDF';
    if (!res.ok) { toast(res.erro || 'Erro ao gerar relatório', true); return; }
    const bin = atob(res.buffer);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    a.download = 'relatorio-transferencias.pdf';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Relatório PDF baixado!');
  };
  alvo.appendChild(tela);
  await carregarLocais();
  await carregarRomaneios();
}
