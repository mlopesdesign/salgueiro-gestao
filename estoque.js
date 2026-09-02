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
// Abre um mini-formulário: a foto é OPCIONAL (deixa o PDF mais pesado, então
// vem desmarcada). Marcando, cada peça sai com a miniatura ao lado do nome.
async function exportarEstoquePdf() {
  modal('Exportar estoque em PDF', `
    <div style="width:min(420px,86vw)">
      <label class="campo-check" style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <input id="est-pdf-foto" type="checkbox" style="width:16px;height:16px">
        <span>📷 Incluir a foto de cada peça</span>
      </label>
      <p style="margin:10px 2px 0;font-size:12px;color:var(--texto-suave,#777)">
        Com foto o relatório fica mais bonito para conferência visual, mas
        gera mais páginas e demora alguns segundos a mais. Sem marcar, sai a
        lista enxuta de sempre.
      </p>
    </div>
  `, async (mm, fechar) => {
    const incluirFoto = !!mm.querySelector('#est-pdf-foto')?.checked;
    fechar();
    await _gerarEstoquePdf(incluirFoto);
  }, 'Gerar PDF');
}

async function _gerarEstoquePdf(incluirFoto) {
  toast('Gerando PDF…');
  const r = await api('estoque:listarCompleto');
  if (!r.ok) { toast(r.erro, true); return; }

  // Foto: o banco guarda só o NOME do arquivo. Resolve todos de uma vez.
  if (incluirFoto) {
    const nomes = [...new Set(r.variacoes.map(v => v.foto).filter(Boolean))];
    if (nomes.length) {
      const rf = await api('fotos:obterVarias', { nomes });
      const mapa = (rf && rf.ok && rf.fotos) ? rf.fotos : {};
      for (const v of r.variacoes) v._fotoData = v.foto ? (mapa[v.foto] || null) : null;
    }
  }

  const cfg = (await api('config:obter')).config || {};
  const loja = cfg.loja_nome || 'Estoque';
  const data = new Date().toLocaleDateString('pt-BR');
  const moedaFmt = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const celFotoPdf = v => !incluirFoto ? '' : (v._fotoData
    ? `<td class="est-foto"><img src="${v._fotoData}"></td>`
    : `<td class="est-foto"><span class="est-foto-vazia">👗</span></td>`);
  let linhas = r.variacoes.map(v => `
    <tr>
      ${celFotoPdf(v)}
      <td>${esc(v.nome)}</td><td>${esc(v.referencia || '')}</td>
      <td>${esc(v.categoria)}</td><td>${esc(v.cor || '')}</td>
      <td>${esc(v.tamanho || '')}</td><td>${esc(v.codigo_barras || '')}</td>
      <td class="num">${v.estoque}</td>
      <td class="num">${moedaFmt(v.preco_venda || 0)}</td>
      <td class="num">${moedaFmt((v.estoque || 0) * (v.preco_venda || 0))}</td>
    </tr>`).join('');
  const thFoto = incluirFoto ? '<th class="est-foto">Foto</th>' : '';
  const colspanTot = incluirFoto ? 7 : 6;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Estoque — ${esc(loja)}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:10px;margin:10mm 8mm}
      h2{margin:0 0 4px;font-size:14px}
      p.sub{margin:0 0 8px;color:#666;font-size:9px}
      table{width:100%;border-collapse:collapse}
      th{background:#8B1A1C;color:#fff;padding:4px 3px;text-align:left;font-size:9px}
      td{padding:3px;border-bottom:1px solid #ddd;vertical-align:middle}
      tr:nth-child(even) td{background:#f9f9f9}
      .num{text-align:right}
      .est-foto{width:44px}
      td.est-foto{padding:2px 3px}
      .est-foto img{width:38px;height:38px;object-fit:cover;border-radius:4px;
        border:1px solid #ddd;display:block;background:#fafafa}
      .est-foto-vazia{display:flex;align-items:center;justify-content:center;
        width:38px;height:38px;font-size:16px;color:#bbb;border:1px solid #eee;border-radius:4px}
      tfoot td{font-weight:700;background:#eee;border-top:2px solid #8B1A1C}
      @media print{body{margin:5mm} tr{page-break-inside:avoid}}
    </style></head><body>
    <h2>${esc(loja)} — Relatório de Estoque</h2>
    <p class="sub">Gerado em ${data} · ${r.variacoes.length} variações · ${r.totalPecas} peças</p>
    <table>
      <thead><tr>${thFoto}<th>Produto</th><th>Ref</th><th>Categoria</th><th>Cor</th><th>Tam</th><th>Cód. barras</th><th class="num">Qtd</th><th class="num">Preço</th><th class="num">Total</th></tr></thead>
      <tbody>${linhas}</tbody>
      <tfoot><tr><td colspan="${colspanTot}">TOTAIS</td><td class="num">${r.totalPecas}</td><td></td><td class="num">${moedaFmt(r.totalVenda)}</td></tr></tfoot>
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
      <div id="est-filtros" style="display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 10px"></div>
      ${admin ? '' : `<p style="margin:0 12px 10px;font-size:12.5px;color:var(--texto-suave)">
        🔒 Só o administrador altera a quantidade em estoque. Aqui você consulta o saldo.</p>`}
      <table>
        <thead><tr><th style="width:52px"></th><th>Produto</th><th>Cor / Tamanho</th><th>Código</th>
          <th class="num">Estoque</th>${admin ? '<th style="width:230px"></th>' : ''}</tr></thead>
        <tbody><tr><td colspan="${admin ? 6 : 5}" class="vazio">Carregando estoque…</td></tr></tbody>
      </table>
    </div>`);
  const tbody   = painel.querySelector('tbody');
  const busca   = painel.querySelector('#mov-busca');
  const filtros = painel.querySelector('#est-filtros');
  const COLSPAN = admin ? 6 : 5;

  // Estado do filtro: 'todos' | 'proprios' | 'cons:<fornecedor_id>'
  let _filtroAtual = 'todos';
  let _todosItens  = [];   // lista completa carregada do backend (sem busca)
  let _emBusca     = false; // true enquanto o campo de busca tem texto

  // Carrega miniaturas sob demanda: a lista completa traz o NOME do arquivo da
  // foto; só busca a imagem (fotos:obter) quando a linha entra na tela. Assim a
  // lista abre leve mesmo com centenas de produtos.
  const _obs = ('IntersectionObserver' in window)
    ? new IntersectionObserver((ents, obs) => {
        for (const e of ents) {
          if (!e.isIntersecting) continue;
          const img = e.target; obs.unobserve(img);
          const nome = img.dataset.foto;
          if (!nome) continue;
          api('fotos:obter', { nome }).then(r => {
            if (r && r.ok && r.foto) img.src = r.foto;
          }).catch(() => {});
        }
      }, { root: null, rootMargin: '200px' })
    : null;

  // Célula de miniatura. `foto` pode vir pronta (data URI, da busca) ou como nome
  // de arquivo (lista completa) — nesse caso carrega sob demanda.
  function celFoto(foto) {
    if (foto && String(foto).startsWith('data:image/')) {
      return `<td><img class="thumb thumb-sm" src="${foto}"></td>`;
    }
    if (foto) {
      return `<td><img class="thumb thumb-sm" data-foto="${esc(String(foto))}"
                 src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"></td>`;
    }
    return `<td><span class="thumb thumb-sm thumb-vazio">👗</span></td>`;
  }

  // Desenha as linhas de uma lista já pronta.
  function desenhar(lista, vazioMsg) {
    if (_obs) _obs.disconnect();
    tbody.innerHTML = '';
    if (!lista.length) {
      tbody.appendChild(el(`<tr><td colspan="${COLSPAN}" class="vazio">${vazioMsg}</td></tr>`));
      return;
    }
    for (const v of lista) {
      // Badge de consignação: aparece no nome do produto quando aplicável
      const badgeCons = v.consignado
        ? ` <span style="font-size:10px;padding:1px 5px;border-radius:10px;background:var(--azul-claro,#dbeafe);color:var(--azul,#1d4ed8);font-weight:600;white-space:nowrap">🤝 ${esc(v.fornecedor || 'Consig.')}</span>`
        : '';
      const tr = el(`<tr>
        ${celFoto(v.foto)}
        <td><b>${esc(v.produto)}</b>${badgeCons}${v.referencia ? ` <small style="color:var(--texto-suave)">Ref. ${esc(v.referencia)}</small>` : ''}</td>
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
          tr.querySelector(`[data-a=${acao}]`).onclick = () => formMovimento(v, acao, recarregar);
        }
      }
      const thumbLazy = tr.querySelector('img[data-foto]');
      if (thumbLazy && _obs) _obs.observe(thumbLazy);
      tbody.appendChild(tr);
    }
  }

  // Filtra _todosItens conforme _filtroAtual e redesenha a tabela.
  function aplicarFiltro() {
    let lista = _todosItens;
    if (_filtroAtual === 'proprios') {
      lista = lista.filter(v => !v.consignado);
    } else if (_filtroAtual.startsWith('cons:')) {
      const fid = Number(_filtroAtual.slice(5));
      lista = lista.filter(v => v.consignado && v.fornecedor_id === fid);
    }
    const termo = busca.value.trim().toLowerCase();
    if (termo) {
      lista = lista.filter(v =>
        (v.produto || '').toLowerCase().includes(termo) ||
        (v.referencia || '').toLowerCase().includes(termo) ||
        (v.codigo_barras || '').includes(busca.value.trim())
      );
    }
    const msg = _filtroAtual === 'todos' ? 'Nenhum produto cadastrado no estoque.'
      : _filtroAtual === 'proprios'      ? 'Nenhum produto próprio no estoque.'
      : `Nenhum produto deste fornecedor no estoque.`;
    desenhar(lista, msg);
  }

  // Reconstrói os pills de filtro a partir da lista carregada.
  function renderFiltros(lista) {
    // Deriva fornecedores únicos com produtos consignados
    const fMap = new Map(); // fornecedor_id → { nome, count }
    let nProprios = 0, nCons = 0;
    for (const v of lista) {
      if (v.consignado && v.fornecedor_id) {
        const entry = fMap.get(v.fornecedor_id);
        if (entry) entry.count++; else fMap.set(v.fornecedor_id, { nome: v.fornecedor, count: 1 });
        nCons++;
      } else {
        nProprios++;
      }
    }
    // Só mostra a barra de filtros se houver consignados
    if (!nCons) { filtros.style.display = 'none'; return; }
    filtros.style.display = 'flex';

    const pill = (chave, label, ativo) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = 'btn-pill' + (ativo ? ' ativo' : '');
      b.style.cssText = [
        'border:1px solid var(--borda,#d1d5db)',
        'border-radius:20px',
        'padding:3px 12px',
        'font-size:12px',
        'cursor:pointer',
        'white-space:nowrap',
        ativo
          ? 'background:var(--primario,#2563eb);color:#fff;border-color:var(--primario,#2563eb)'
          : 'background:var(--fundo-card,#fff);color:var(--texto,#111)',
      ].join(';');
      b.onclick = () => { _filtroAtual = chave; renderFiltros(_todosItens); aplicarFiltro(); };
      return b;
    };

    filtros.innerHTML = '';
    filtros.appendChild(pill('todos', `Todos (${lista.length})`, _filtroAtual === 'todos'));
    if (nProprios) filtros.appendChild(pill('proprios', `🏪 Próprios (${nProprios})`, _filtroAtual === 'proprios'));
    for (const [fid, { nome, count }] of [...fMap.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome))) {
      const chave = `cons:${fid}`;
      filtros.appendChild(pill(chave, `🤝 ${nome} (${count})`, _filtroAtual === chave));
    }
  }

  // Estoque inteiro em ordem alfabética, já na abertura.
  async function carregarTudo() {
    tbody.innerHTML = `<tr><td colspan="${COLSPAN}" class="vazio">Carregando estoque…</td></tr>`;
    const r = await api('estoque:listarCompleto');
    _todosItens = (r.ok ? r.variacoes : []).map(v => ({
      id: v.variacao_id, produto: v.nome, referencia: v.referencia,
      cor: v.cor, tamanho: v.tamanho, codigo_barras: v.codigo_barras,
      estoque: v.estoque, preco_custo: v.preco_custo, preco_venda: v.preco_venda,
      foto: v.foto,
      consignado: v.consignado || 0,
      fornecedor_id: v.fornecedor_id || null,
      fornecedor: v.fornecedor || '',
    }));
    _emBusca = false;
    renderFiltros(_todosItens);
    aplicarFiltro();
  }

  // Depois de uma movimentação: recarrega tudo preservando o filtro ativo.
  function recarregar() { carregarTudo(); }

  // Busca via API (preserva comportamento do leitor de código de barras),
  // mas aplica o filtro ativo ao resultado.
  async function pesquisar() {
    const termo = busca.value.trim();
    if (!termo) { _emBusca = false; aplicarFiltro(); return; }
    _emBusca = true;
    // Filtra diretamente na lista em memória (já carregada), sem nova chamada API,
    // exceto se a lista ainda não foi carregada (primeira digitação antes do load).
    if (_todosItens.length || termo.length < 3) {
      // Barra de filtro: durante busca livre usa a lista em memória
      aplicarFiltro();
      // Leitor de código de barras: 1 resultado exato → abre entrada direto (admin)
      if (admin) {
        const exato = _todosItens.find(v => v.codigo_barras === termo);
        if (exato) { formMovimento(exato, 'entrada', recarregar); return; }
      }
      return;
    }
    // Fallback: lista ainda não carregou — usa API normalmente
    const r = await api('estoque:buscar', { termo });
    const lista = (r.ok ? r.variacoes : []).map(v => ({
      id: v.id, produto: v.produto, referencia: v.referencia,
      cor: v.cor, tamanho: v.tamanho, codigo_barras: v.codigo_barras,
      estoque: v.estoque, preco_custo: v.preco_custo, preco_venda: v.preco_venda,
      foto: v.foto,
      consignado: v.consignado || 0, fornecedor_id: v.fornecedor_id || null, fornecedor: v.fornecedor || '',
    }));
    if (admin && lista.length === 1 && lista[0].codigo_barras === termo) {
      formMovimento(lista[0], 'entrada', recarregar);
    }
    desenhar(lista, `Nada encontrado para "${esc(termo)}".`);
  }

  let debounce;
  busca.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(pesquisar, 300); });
  busca.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(debounce); pesquisar(); } });
  corpo.appendChild(painel);
  carregarTudo();
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
        <input id="m-qtd" type="number" min="0" step="1" inputmode="numeric" autofocus
          placeholder="${tipo === 'ajuste' ? 'contagem: ' + v.estoque : 'quantidade'}" onfocus="this.select()">
      </div>
      ${tipo === 'entrada' ? `
      <div class="campo"><label>Custo unitário (R$) — opcional</label>
        <input id="m-custo" type="number" min="0" step="0.01" placeholder="${v.preco_custo || ''}"></div>` : ''}
    </div>
    <div class="campo"><label>Motivo / observação</label>
      <input id="m-motivo" placeholder="${tipo === 'entrada' ? 'Compra fornecedor X' : tipo === 'saida' ? 'Perda, defeito, uso interno…' : 'Contagem de inventário'}"></div>
    <div class="erro" id="m-erro"></div>
  `, async (m, fechar) => {
    const _campoQtd = m.querySelector('#m-qtd');
    // Campo começa vazio (sem número pré-fixado) — exige digitar o valor.
    // Sem isto, submeter em branco viraria 0 e num ajuste zeraria o estoque.
    if (_campoQtd.value.trim() === '') {
      m.querySelector('#m-erro').textContent = tipo === 'ajuste'
        ? 'Informe a contagem do estoque.' : 'Informe a quantidade.';
      _campoQtd.focus(); return;
    }
    const r = await api('estoque:movimentar', {
      variacao_id: v.id,
      tipo,
      qtd: Number(_campoQtd.value),
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
        onfocus="this.select()"
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
