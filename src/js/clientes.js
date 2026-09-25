// Clientes + Crediário + Categorias + Importação/Exportação
import { api, el, esc, moeda, toast, modal, setorAtivo } from './app.js';

const dataBr  = (s) => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—';
const dataBrH  = (s) => s ? `${String(s).slice(0, 10).split('-').reverse().join('/')} ${String(s).slice(11, 16)}` : '—';
const fone = (t) => String(t || '').replace(/\D/g, '');
const linkZap = (tel, msg) => `https://wa.me/55${fone(tel)}?text=${encodeURIComponent(msg)}`;

export async function viewClientes(alvo) {
  const tela = el(`
    <div>
      <div class="pagina-topo"><h1>Clientes</h1>
        <button class="btn btn-primario" id="novo">+ Novo cliente</button></div>
      <div class="abas">
        <button data-aba="lista" class="ativa">Clientes</button>
        ${setorAtivo('crediario') ? '<button data-aba="crediario">Crediário</button>' : ''}
        <button data-aba="niver">Aniversariantes 🎂</button>
        <button data-aba="categorias">Categorias</button>
        <button data-aba="importexport">Importar / Exportar</button>
      </div>
      <div id="aba-conteudo"></div>
    </div>`);
  const corpo = tela.querySelector('#aba-conteudo');
  const abas = { lista: abaLista, crediario: abaCrediario, niver: abaNiver, categorias: abaCategorias, importexport: abaImportExport };
  tela.querySelectorAll('.abas button').forEach(b => {
    b.onclick = () => {
      tela.querySelectorAll('.abas button').forEach(x => x.classList.toggle('ativa', x === b));
      corpo.innerHTML = ''; abas[b.dataset.aba](corpo);
    };
  });
  tela.querySelector('#novo').onclick = () => formCliente(null, () => { corpo.innerHTML = ''; abaLista(corpo); });
  alvo.appendChild(tela);
  abaLista(corpo);
}

// ---------- Aba: lista ----------
async function abaLista(corpo) {
  const catR = await api('clientes:listarCategorias');
  const categorias = catR.ok ? catR.categorias : [];
  const optsCat = `<option value="">Todas as categorias</option>` +
    categorias.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');

  const painel = el(`
    <div class="painel">
      <div class="barra" style="gap:8px">
        <input type="text" id="cl-busca" placeholder="Buscar por nome, CPF ou telefone…" style="flex:1">
        <select id="cl-cat" style="width:180px">${optsCat}</select>
      </div>
      <table><thead><tr><th>Nome</th><th>Categoria</th><th>Função</th><th>Telefone</th><th>CPF</th>
        <th class="num">Deve (crediário)</th><th class="num">🎁 Pontos</th><th style="width:200px"></th></tr></thead>
        <tbody></tbody></table>
    </div>`);
  const tbody = painel.querySelector('tbody');

  async function carregar() {
    const r = await api('clientes:listar', {
      busca: painel.querySelector('#cl-busca').value,
      categoria_id: painel.querySelector('#cl-cat').value || null
    });
    tbody.innerHTML = '';
    const lista = r.ok ? r.clientes : [];
    if (!lista.length) { tbody.appendChild(el(`<tr><td colspan="8" class="vazio">Nenhum cliente.</td></tr>`)); return; }
    // guarda as funções já usadas para o formulário sugerir
    _funcoesConhecidas = [...new Set(lista.map(x => x.funcao).filter(Boolean))].sort();
    for (const c of lista) {
      const tr = el(`<tr>
        <td><b>${esc(c.nome)}</b>${c.generico
          ? ' <span class="pill" style="background:var(--creme);font-size:10px;color:var(--texto-suave)" title="Cliente do sistema: recebe as vendas sem identificação">do sistema</span>'
          : ''}</td>
        <td><span class="pill" style="background:var(--creme)">${esc(c.categoria || '—')}</span></td>
        <td>${c.funcao ? esc(c.funcao) : '<span style="color:var(--texto-suave)">—</span>'}</td>
        <td>${esc(c.telefone || '—')}</td>
        <td>${esc(c.cpf || '—')}</td>
        <td class="num">${c.saldo_devedor > 0 ? `<b style="color:var(--vermelho)">${moeda(c.saldo_devedor)}</b>` : '—'}</td>
        <td class="num">${c.pontos > 0 ? `<b style="color:var(--verde-escuro,#1a6e3a)">${c.pontos} pts</b>` : '—'}</td>
        <td class="acoes-linha">
          <button data-a="hist">Histórico</button>
          <button data-a="editar">Editar</button>
          ${c.generico ? '' : '<button data-a="excluir" style="color:var(--vermelho)">Excluir</button>'}
        </td></tr>`);
      tr.querySelector('[data-a=hist]').onclick = () => modalHistorico(c.id);
      tr.querySelector('[data-a=editar]').onclick = async () => {
        const d = await api('clientes:obter', { id: c.id });
        if (d.ok) formCliente(d.cliente, carregar); else toast(d.erro, true);
      };
      tr.querySelector('[data-a=excluir]')?.addEventListener('click', async () => {
        if (!confirm(`Excluir "${c.nome}"?`)) return;
        const r2 = await api('clientes:excluir', { id: c.id });
        r2.ok ? (toast('Cliente excluído.'), carregar()) : toast(r2.erro, true);
      });
      tbody.appendChild(tr);
    }
  }
  let deb;
  painel.querySelector('#cl-busca').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(carregar, 250); });
  painel.querySelector('#cl-cat').addEventListener('change', carregar);
  corpo.appendChild(painel);
  carregar();
}

// Funções já cadastradas, para o campo sugerir em vez de o operador digitar
// "PORTEIRO", "Porteiro " e "porteiro" e virarem três coisas diferentes.
let _funcoesConhecidas = [];

// ---------- Formulário de cliente ----------
async function formCliente(c, aoConcluir) {
  const catR = await api('clientes:listarCategorias');
  const categorias = catR.ok ? catR.categorias : [];
  const optsCat = `<option value="">Sem categoria</option>` +
    categorias.map(cat => `<option value="${cat.id}" ${c?.categoria_id == cat.id ? 'selected' : ''}>${esc(cat.nome)}</option>`).join('');

  modal(c ? 'Editar cliente' : 'Novo cliente', `
    <div class="linha-2">
      <div class="campo"><label>Nome *</label><input id="c-nome" value="${esc(c?.nome || '')}"></div>
      <div class="campo"><label>Categoria</label><select id="c-cat">${optsCat}</select></div>
    </div>
    <div class="linha-2">
      <div class="campo"><label>CPF</label><input id="c-cpf" value="${esc(c?.cpf || '')}"></div>
      <div class="campo"><label>Telefone/WhatsApp</label><input id="c-tel" value="${esc(c?.telefone || '')}"></div>
    </div>
    <div class="campo"><label>E-mail</label><input id="c-email" value="${esc(c?.email || '')}"></div>
    <div class="campo"><label>Endereço</label><input id="c-end" value="${esc(c?.endereco || '')}"></div>
    <div class="linha-2">
      <div class="campo"><label>Nascimento</label><input id="c-nasc" type="date" value="${esc(c?.nascimento || '')}"></div>
      <div class="campo"><label>Função / cargo</label>
        <input id="c-funcao" list="lista-funcoes" value="${esc(c?.funcao || '')}"
          placeholder="ex.: Almoxarifado, Porteiro, Financeiro"></div>
    </div>
    <div class="campo"><label>Limite de crédito (R$)</label>
      <input id="c-lim" type="number" min="0" step="0.01" value="${c?.limite_credito ?? 0}" style="max-width:200px"></div>
    <datalist id="lista-funcoes">${(_funcoesConhecidas || []).map(f => `<option value="${esc(f)}">`).join('')}</datalist>
    <div class="campo"><label>Observações</label><input id="c-obs" value="${esc(c?.obs || '')}"></div>
    <div class="erro" id="c-erro"></div>
  `, async (m, fechar) => {
    const r = await api('clientes:salvar', {
      id: c?.id,
      nome: m.querySelector('#c-nome').value,
      cpf: m.querySelector('#c-cpf').value,
      telefone: m.querySelector('#c-tel').value,
      email: m.querySelector('#c-email').value,
      endereco: m.querySelector('#c-end').value,
      nascimento: m.querySelector('#c-nasc').value || null,
      funcao: m.querySelector('#c-funcao').value,
      limite_credito: Number(m.querySelector('#c-lim').value) || 0,
      obs: m.querySelector('#c-obs').value,
      categoria_id: m.querySelector('#c-cat').value ? Number(m.querySelector('#c-cat').value) : null
    });
    if (!r.ok) { m.querySelector('#c-erro').textContent = r.erro; return; }
    toast('Cliente salvo.'); fechar(); aoConcluir();
  });
}

// ---------- Histórico ----------
async function modalHistorico(id) {
  const d = await api('clientes:obter', { id });
  if (!d.ok) { toast(d.erro, true); return; }
  const compras = d.compras.map(v => `
    <tr><td>#${v.id}</td><td>${esc(dataBrH(v.criado_em))}</td><td>${v.itens} item(ns)</td>
      <td class="num">${moeda(v.total)}</td>
      <td>${v.status === 'cancelada' ? '<span class="pill pill-baixo">cancelada</span>'
          : v.status === 'troca' ? '<span class="pill" style="background:#2563eb;color:#fff">troca</span>' : ''}</td></tr>`).join('');
  const parcelas = d.parcelas.map(p => `
    <tr><td>Venda #${p.venda_id} — parc. ${p.numero}</td><td>${dataBr(p.vencimento)}</td>
      <td class="num">${moeda(p.valor)}</td>
      <td>${p.pago_em ? '<span class="pill pill-ok">paga</span>'
          : `<span class="pill pill-baixo">aberta${p.valor_pago ? ` (${moeda(p.valor_pago)} pago)` : ''}</span>`}</td></tr>`).join('');
  const histPontos = await api('pontos:historico', { cliente_id: id });
  const cfgPts = await api('pontos:config');
  const saldoPts = d.cliente.pontos || 0;
  const ptsRows = (histPontos.ok && histPontos.historico.length)
    ? histPontos.historico.map(h => `<tr>
        <td>${dataBr(h.criado_em)}</td>
        <td>${h.tipo === 'credito' ? '▲ <b style="color:var(--verde-escuro,#1a6e3a)">+' + h.pontos + '</b>'
            : '▼ <span style="color:var(--vermelho)">−' + h.pontos + '</span>'} pts</td>
        <td style="color:var(--texto-suave);font-size:0.85em">${esc(h.obs || h.origem || '')}</td>
      </tr>`).join('')
    : '<tr><td colspan="3" class="vazio">Nenhuma movimentação.</td></tr>';
  const ptsBadge = cfgPts.ativo
    ? `<span style="background:var(--creme);padding:4px 10px;border-radius:20px;font-weight:700">🎁 ${saldoPts} pontos</span>` : '';
  modal(`Histórico — ${esc(d.cliente.nome)}`, `
    <p style="font-weight:600;margin-bottom:6px">Compras</p>
    <table><tbody>${compras || '<tr><td class="vazio">Nenhuma compra.</td></tr>'}</tbody></table>
    <p style="font-weight:600;margin:14px 0 6px">Crediário</p>
    <table><tbody>${parcelas || '<tr><td class="vazio">Nenhuma parcela.</td></tr>'}</tbody></table>
    ${cfgPts.ativo ? `<p style="font-weight:600;margin:14px 0 6px">Pontos de fidelidade ${ptsBadge}</p>
    <table><thead><tr><th>Data</th><th>Movimentação</th><th>Observação</th></tr></thead>
    <tbody>${ptsRows}</tbody></table>` : ''}
  `, (m, fechar) => fechar(), 'Fechar');
}

// ---------- Aba: categorias ----------
async function abaCategorias(corpo) {
  const painel = el(`
    <div class="painel">
      <div class="barra" style="justify-content:flex-end">
        <button class="btn btn-primario" id="nova-cat">+ Nova categoria</button></div>
      <table><thead><tr><th>Nome</th><th class="num" style="width:110px">Desconto</th><th style="width:120px"></th></tr></thead>
        <tbody></tbody></table>
    </div>`);
  const tbody = painel.querySelector('tbody');

  async function carregar() {
    const r = await api('clientes:listarCategorias');
    tbody.innerHTML = '';
    const lista = r.ok ? r.categorias : [];
    if (!lista.length) { tbody.appendChild(el(`<tr><td colspan="3" class="vazio">Nenhuma categoria cadastrada.</td></tr>`)); return; }
    for (const cat of lista) {
      const tr = el(`<tr>
        <td><b>${esc(cat.nome)}</b></td>
        <td class="num">${cat.desconto_percent > 0
          ? `<span style="color:var(--vinho);font-weight:700">${cat.desconto_percent}%</span>`
          : '<span style="color:var(--texto-suave)">—</span>'}</td>
        <td class="acoes-linha">
          <button data-a="editar">Editar</button>
          <button data-a="excluir" style="color:var(--vermelho)">Excluir</button>
        </td></tr>`);
      tr.querySelector('[data-a=editar]').onclick = () => formCategoria(cat, carregar);
      tr.querySelector('[data-a=excluir]').onclick = async () => {
        if (!confirm(`Excluir a categoria "${cat.nome}"?`)) return;
        const r2 = await api('clientes:excluirCategoria', { id: cat.id });
        r2.ok ? (toast('Categoria excluída.'), carregar()) : toast(r2.erro, true);
      };
      tbody.appendChild(tr);
    }
  }

  painel.querySelector('#nova-cat').onclick = () => formCategoria(null, carregar);
  corpo.appendChild(painel);
  carregar();
}

function formCategoria(cat, aoConcluir) {
  // ATENÇÃO: o campo de desconto é OBRIGATÓRIO neste formulário.
  // Até a v3.2.1 esta tela mandava só { id, nome } e o core fazia
  // `Number(undefined) || 0`, gravando desconto_percent = 0 — quem editasse o
  // nome de uma categoria VIP aqui perdia os 10% sem nenhum aviso.
  modal(cat ? 'Editar categoria' : 'Nova categoria', `
    <div class="campo"><label>Nome *</label><input id="cat-nome" value="${esc(cat?.nome || '')}"></div>
    <div class="campo"><label>Desconto automático (%)</label>
      <input id="cat-desc" type="number" min="0" max="100" step="0.5"
        value="${cat ? (cat.desconto_percent || 0) : 0}">
      <small style="color:var(--texto-suave);font-size:11px">
        Aplicado sozinho no PDV quando o cliente desta categoria é identificado. 0 = sem desconto.
      </small>
    </div>
    <div class="erro" id="cat-erro"></div>
  `, async (m, fechar) => {
    const desc = Number(m.querySelector('#cat-desc').value) || 0;
    if (desc < 0 || desc > 100) {
      m.querySelector('#cat-erro').textContent = 'O desconto deve ficar entre 0% e 100%.'; return;
    }
    const r = await api('clientes:salvarCategoria', {
      id: cat?.id, nome: m.querySelector('#cat-nome').value, desconto_percent: desc
    });
    if (!r.ok) { m.querySelector('#cat-erro').textContent = r.erro; return; }
    toast('Categoria salva.'); fechar(); aoConcluir();
  });
}

// ---------- Aba: importar / exportar ----------
async function abaImportExport(corpo) {
  const painel = el(`
    <div class="painel">
      <h3 style="margin-bottom:16px">Importar / Exportar Clientes</h3>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

        <!-- IMPORTAR -->
        <div style="border:1px solid var(--borda,#ddd);border-radius:8px;padding:20px">
          <h4 style="margin:0 0 8px">📥 Importar clientes</h4>
          <p style="color:var(--texto-suave);font-size:0.9em;margin-bottom:12px">
            Aceita Excel (.xlsx) ou CSV (;). Colunas: <b>nome</b>, cpf, telefone, email, endereco, nascimento (AAAA-MM-DD), categoria, <b>funcao</b>, limite_credito, obs.
            Clientes com mesmo CPF ou nome exato são <em>atualizados</em>, não duplicados.
          </p>
          <div style="margin-bottom:12px">
            <button class="btn" id="baixar-modelo-xlsx" style="margin-right:6px">⬇ Modelo Excel</button>
            <button class="btn" id="baixar-modelo-csv">⬇ Modelo CSV</button>
          </div>
          <div class="campo">
            <label>Selecionar arquivo (.xlsx ou .csv)</label>
            <input type="file" id="imp-arquivo" accept=".xlsx,.csv" style="margin-top:4px">
          </div>
          <div id="imp-preview" style="margin:10px 0;font-size:0.9em;color:var(--texto-suave)"></div>
          <button class="btn btn-primario" id="imp-btn" disabled>Importar</button>
          <div id="imp-resultado" style="margin-top:10px"></div>
        </div>

        <!-- EXPORTAR -->
        <div style="border:1px solid var(--borda,#ddd);border-radius:8px;padding:20px">
          <h4 style="margin:0 0 8px">📤 Exportar clientes</h4>
          <p style="color:var(--texto-suave);font-size:0.9em;margin-bottom:16px">
            Exporta todos os clientes ativos com nome, cpf, telefone, email, endereço, nascimento, categoria, limite de crédito, observações e pontos.
          </p>
          <button class="btn btn-primario" id="exp-xlsx" style="margin-right:8px;margin-bottom:8px">⬇ Exportar Excel (.xlsx)</button>
          <button class="btn" id="exp-csv">⬇ Exportar CSV</button>
          <div id="exp-resultado" style="margin-top:10px"></div>
        </div>
      </div>
    </div>`);

  // --- Modelo Excel ---
  //
  // ATENÇÃO: até a v3.15.0 este botão gerava um CSV e apenas TROCAVA a extensão
  // para .xlsx. O Excel recusa o arquivo — ele espera um pacote ZIP (começa com
  // "PK"), não texto. O modelo não abria em computador nenhum.
  //
  // Agora o arquivo é montado com a SheetJS, a mesma biblioteca que o backend
  // usa nas outras exportações (`js/vendor/xlsx.full.min.js`, carregada no
  // index.html como global).
  painel.querySelector('#baixar-modelo-xlsx').onclick = () => {
    const dados = [
      ['nome','cpf','telefone','email','endereco','nascimento','categoria','funcao','limite_credito','obs'],
      ['Maria da Silva','123.456.789-00','87 99999-0000','maria@email.com','Rua das Flores 1','1985-03-15','Componente','',0,''],
      ['João Santos','987.654.321-00','87 98888-1111','','','1990-07-20','Funcionários','Porteiro',500,''],
      ['Ana Lima','','','','Rua B 200','','Visitante','',0,'']
    ];
    const XL = window.XLSX;
    if (!XL) {
      // Sem a biblioteca, entrega um CSV DE VERDADE em vez de um .xlsx quebrado.
      const csv = dados.map(l => l.join(';')).join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'modelo-clientes.csv'; a.click();
      toast('O modelo saiu em CSV — abre no Excel do mesmo jeito.');
      return;
    }
    const ws = XL.utils.aoa_to_sheet(dados);
    ws['!cols'] = [{ wch: 26 }, { wch: 17 }, { wch: 15 }, { wch: 24 }, { wch: 22 },
                   { wch: 13 }, { wch: 16 }, { wch: 18 }, { wch: 15 }, { wch: 20 }];
    const wb = XL.utils.book_new();
    XL.utils.book_append_sheet(wb, ws, 'Clientes');
    const bin = XL.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([bin], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'modelo-clientes.xlsx'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // --- Modelo CSV ---
  painel.querySelector('#baixar-modelo-csv').onclick = () => {
    const linhas = [
      'nome;cpf;telefone;email;endereco;nascimento;categoria;funcao;limite_credito;obs',
      'Maria da Silva;123.456.789-00;87 99999-0000;maria@email.com;Rua das Flores 1;1985-03-15;Componente;;0;',
      'João Santos;987.654.321-00;87 98888-1111;;;1990-07-20;Funcionários;Porteiro;500;'
    ].join('\r\n');
    const blob = new Blob(['﻿' + linhas], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'modelo-clientes.csv'; a.click();
  };

  // --- Arquivo selecionado ---
  let arquivoSelecionado = null;
  painel.querySelector('#imp-arquivo').addEventListener('change', (e) => {
    const f = e.target.files[0];
    arquivoSelecionado = f || null;
    const prev = painel.querySelector('#imp-preview');
    if (f) {
      prev.textContent = `Arquivo: ${f.name} (${(f.size/1024).toFixed(1)} KB)`;
      painel.querySelector('#imp-btn').disabled = false;
    } else {
      prev.textContent = '';
      painel.querySelector('#imp-btn').disabled = true;
    }
    painel.querySelector('#imp-resultado').innerHTML = '';
  });

  // --- Importar ---
  painel.querySelector('#imp-btn').onclick = async () => {
    if (!arquivoSelecionado) return;
    const btn = painel.querySelector('#imp-btn');
    btn.disabled = true; btn.textContent = 'Importando…';
    const result = painel.querySelector('#imp-resultado');
    result.innerHTML = '';
    try {
      const ext = arquivoSelecionado.name.toLowerCase().split('.').pop();
      const isXlsx = ext === 'xlsx';
      const buf = await arquivoSelecionado.arrayBuffer();
      let dados, formato;
      if (isXlsx) {
        dados = btoa(String.fromCharCode(...new Uint8Array(buf)));
        formato = 'xlsx';
      } else {
        dados = new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '');
        formato = 'csv';
      }
      const r = await api('clientes:importar', { dados, formato });
      if (r.ok) {
        result.innerHTML = `<div style="color:green;font-weight:700">✅ ${r.importados} cliente(s) importados!`
          + (r.erros?.length ? `<br><span style="color:orange">${r.erros.length} linha(s) com erro.</span>` : '')
          + '</div>';
        toast(`${r.importados} clientes importados!`);
      } else {
        result.innerHTML = `<div style="color:var(--vermelho)">❌ ${esc(r.erro)}</div>`;
      }
    } catch(e) {
      result.innerHTML = `<div style="color:var(--vermelho)">Erro ao ler o arquivo: ${esc(e.message)}</div>`;
    }
    btn.disabled = false; btn.textContent = 'Importar';
  };

  // --- Exportar XLSX ---
  painel.querySelector('#exp-xlsx').onclick = async () => {
    const res = painel.querySelector('#exp-resultado');
    res.textContent = 'Gerando…';
    const r = await api('clientes:exportar');
    if (!r.ok) { res.textContent = r.erro; return; }
    const binStr = atob(r.buffer);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clientes.xlsx'; a.click();
    res.textContent = `✅ ${r.total} cliente(s) exportados.`;
  };

  // --- Exportar CSV ---
  painel.querySelector('#exp-csv').onclick = async () => {
    const res = painel.querySelector('#exp-resultado');
    res.textContent = 'Gerando…';
    const r = await api('clientes:exportarDados');
    if (!r.ok) { res.textContent = r.erro; return; }
    const cols = ['nome','cpf','telefone','email','endereco','nascimento','categoria','funcao','limite_credito','obs','pontos'];
    const linhas = [cols.join(';'), ...r.clientes.map(cl =>
      cols.map(k => String(cl[k] ?? '').replace(/;/g,',')).join(';')
    )];
    const blob = new Blob(['\uFEFF' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clientes.csv'; a.click();
    res.textContent = `✅ ${r.clientes.length} cliente(s) exportados.`;
  };

  corpo.appendChild(painel);
}

// ---------- Aba: crediário ----------
async function abaCrediario(corpo) {
  const painel = el(`
    <div>
      <div class="cards" id="cr-cards"></div>
      <div class="painel">
        <div class="barra"><input type="text" id="cr-busca" placeholder="Filtrar por cliente…"></div>
        <table><thead><tr><th>Cliente</th><th>Parcela</th><th>Vencimento</th>
          <th class="num">Restante</th><th style="width:210px"></th></tr></thead>
          <tbody></tbody></table>
      </div>
    </div>`);
  const tbody = painel.querySelector('tbody');
  const cards = painel.querySelector('#cr-cards');

  async function carregar() {
    const r = await api('crediario:abertas', { busca: painel.querySelector('#cr-busca').value });
    if (!r.ok) { toast(r.erro, true); return; }
    cards.innerHTML = `
      <div class="card"><div class="rotulo">Total em aberto</div><div class="valor">${moeda(r.total_aberto)}</div></div>
      <div class="card"><div class="rotulo">Vencido (inadimplência)</div>
        <div class="valor" style="color:var(--vermelho)">${moeda(r.total_vencido)}</div></div>
      <div class="card"><div class="rotulo">Parcelas em aberto</div><div class="valor">${r.parcelas.length}</div></div>`;
    tbody.innerHTML = '';
    if (!r.parcelas.length) { tbody.appendChild(el(`<tr><td colspan="5" class="vazio">Nenhuma parcela em aberto. 🎉</td></tr>`)); return; }
    for (const p of r.parcelas) {
      const restante = p.valor - p.valor_pago;
      const msg = `Olá, ${p.cliente}! Aqui é da Boutique do Salgueiro. Sua parcela ${p.numero}/${p.total_parcelas} de ${moeda(restante)} ${p.vencida ? 'venceu' : 'vence'} em ${p.vencimento.split('-').reverse().join('/')}. Podemos combinar o pagamento? 😊`;
      const tr = el(`<tr ${p.vencida ? 'style="background:#FCF0F0"' : ''}>
        <td><b>${esc(p.cliente)}</b></td>
        <td>Venda #${p.venda_id} — ${p.numero}/${p.total_parcelas}</td>
        <td>${p.vencimento.split('-').reverse().join('/')} ${p.vencida ? '<span class="pill pill-baixo">vencida</span>' : ''}</td>
        <td class="num"><b>${moeda(restante)}</b>${p.valor_pago > 0 ? `<br><small>${moeda(p.valor_pago)} já pago</small>` : ''}</td>
        <td class="acoes-linha">
          <button data-a="receber" style="color:var(--verde)">Receber</button>
          ${p.telefone ? `<button data-a="zap">WhatsApp</button>` : ''}
        </td></tr>`);
      tr.querySelector('[data-a=receber]').onclick = () => modalReceber(p, restante, carregar);
      const zap = tr.querySelector('[data-a=zap]');
      if (zap) zap.onclick = () => window.open(linkZap(p.telefone, msg));
      tbody.appendChild(tr);
    }
  }
  let deb;
  painel.querySelector('#cr-busca').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(carregar, 250); });
  corpo.appendChild(painel);
  carregar();
}

function modalReceber(p, restante, aoConcluir) {
  modal(`Receber — ${esc(p.cliente)}`, `
    <p style="margin-bottom:12px">Parcela ${p.numero}/${p.total_parcelas} da venda #${p.venda_id}
      · restante <b>${moeda(restante)}</b></p>
    <div class="linha-2">
      <div class="campo"><label>Valor recebido (R$)</label>
        <input id="rc-valor" type="number" min="0.01" step="0.01" value="${restante.toFixed(2)}"></div>
      <div class="campo"><label>Forma</label>
        <select id="rc-forma"><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option>
          <option value="debito">Cartão débito</option><option value="credito">Cartão crédito</option></select></div>
    </div>
    <p style="color:var(--texto-suave);font-size:12px">Recebimento em dinheiro entra na gaveta do caixa aberto.</p>
    <div class="erro" id="rc-erro"></div>
  `, async (m, fechar) => {
    const r = await api('crediario:receber', {
      parcela_id: p.id,
      valor: Number(m.querySelector('#rc-valor').value),
      forma: m.querySelector('#rc-forma').value
    });
    if (!r.ok) { m.querySelector('#rc-erro').textContent = r.erro; return; }
    toast(r.quitada ? 'Parcela quitada! ✅' : `Recebido. Restam ${moeda(r.restante)}.`);
    fechar(); aoConcluir();
  }, 'Confirmar recebimento');
}

// ---------- Aba: aniversariantes ----------
async function abaNiver(corpo) {
  const r = await api('clientes:aniversariantes');
  const painel = el(`
    <div class="painel"><table>
      <thead><tr><th>Dia</th><th>Cliente</th><th>Telefone</th><th style="width:130px"></th></tr></thead>
      <tbody></tbody></table></div>`);
  const tbody = painel.querySelector('tbody');
  const lista = r.ok ? r.clientes : [];
  if (!lista.length) tbody.appendChild(el(`<tr><td colspan="4" class="vazio">Nenhum aniversariante neste mês.</td></tr>`));
  for (const c of lista) {
    const msg = `Parabéns, ${c.nome}! 🎉 A Boutique do Salgueiro deseja um feliz aniversário! Passe aqui este mês e ganhe um desconto especial de presente. 🎁`;
    const tr = el(`<tr>
      <td><b>${String(c.dia).padStart(2, '0')}</b></td>
      <td>${esc(c.nome)}</td>
      <td>${esc(c.telefone || '—')}</td>
      <td class="acoes-linha">${c.telefone ? '<button>Parabenizar 🎉</button>' : ''}</td></tr>`);
    const b = tr.querySelector('button');
    if (b) b.onclick = () => window.open(linkZap(c.telefone, msg));
    tbody.appendChild(tr);
  }
  corpo.appendChild(painel);
}
