// Módulo Estoque — movimentação, kardex, reposição e etiquetas
import { api, el, esc, moeda, toast, modal, getConfig, ehAdmin } from './app.js';
import { abrirEtiquetasLote, imprimirFolhaEtiquetas } from './etiquetas.js';
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
        <select id="est-f-tipo">
          <option value="todos">Consignados e próprios</option>
          <option value="proprios">🏪 Somente da loja</option>
          <option value="cons">🤝 Somente consignados</option>
        </select>
        <select id="est-f-forn" style="display:none"><option value="">Todos os fornecedores</option></select>
      </div>
      ${admin ? '' : `<p style="margin:0 12px 10px;font-size:12.5px;color:var(--texto-suave)">
        🔒 Só o administrador altera a quantidade em estoque. Aqui você consulta o saldo.</p>`}
      <div class="tab-scroll">
      <table class="tab-estoque">
        <thead><tr id="est-cab"><th style="width:52px"></th><th>Produto / variação</th><th>Código</th>
          <th class="num" style="width:70px">Total</th>${admin ? '<th style="width:132px"></th>' : ''}</tr></thead>
        <tbody><tr><td colspan="${admin ? 5 : 4}" class="vazio">Carregando estoque…</td></tr></tbody>
      </table>
      </div>
    </div>`);
  const tbody   = painel.querySelector('tbody');
  const busca   = painel.querySelector('#mov-busca');
  const fTipo   = painel.querySelector('#est-f-tipo');
  const fForn   = painel.querySelector('#est-f-forn');
  const cabecalho = painel.querySelector('#est-cab');
  // COLSPAN muda conforme o número de lojas — as colunas de saldo são montadas
  // quando `_locais` chega. Nunca deixar fixo. (v3.26.5)
  let COLSPAN = admin ? 5 : 4;

  // Cada loja vira uma COLUNA de verdade, com o número alinhado à direita.
  // Antes os saldos eram texto solto numa célula só, e nada batia entre as linhas.
  function montarCabecalho() {
    if (!cabecalho) return;
    [...cabecalho.querySelectorAll('.col-loja')].forEach(th => th.remove());
    const antesDeAcoes = admin ? cabecalho.children[cabecalho.children.length - 1] : null;
    for (const l of _locais) {
      const th = el(`<th class="col-loja num" style="width:96px;white-space:nowrap">${esc(l.nome)}</th>`);
      if (antesDeAcoes) cabecalho.insertBefore(th, antesDeAcoes); else cabecalho.appendChild(th);
    }
    COLSPAN = (admin ? 5 : 4) + _locais.length;
  }

  let _todosItens = [];   // lista completa carregada do backend
  let _emBusca    = false;
  let _locais     = [];   // estoques ativos (para a coluna por loja)
  let _saldos     = new Map();  // "variacao_id:estoque_id" → qtd

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

  // ── Lista AGRUPADA POR PRODUTO (v3.26.0) ─────────────────────────────────
  //
  // ANTES: uma linha por variação. Um produto com 6 cores × 5 tamanhos ocupava
  // 30 linhas soltas e sumia no meio da rolagem, e os botões de entrada/saída
  // ficavam na VARIAÇÃO — para dar entrada num produto inteiro era abrir, digitar
  // e fechar 30 vezes.
  //
  // AGORA: uma linha por PRODUTO (nome, total geral, botões) e, embaixo, as
  // variações com o saldo EM CADA LOJA. Os botões de entrada e saída são do
  // produto e abrem a grade inteira numa tela só.
  //
  // `_locais` e `_saldos` vêm de `estoques:mapaLocais`, uma consulta só.
  function saldoDe(variacaoId, estoqueId) {
    return _saldos.get(`${variacaoId}:${estoqueId}`) || 0;
  }

  function desenhar(lista, vazioMsg) {
    if (_obs) _obs.disconnect();
    tbody.innerHTML = '';
    if (!lista.length) {
      tbody.appendChild(el(`<tr><td colspan="${COLSPAN}" class="vazio">${vazioMsg}</td></tr>`));
      return;
    }
    // agrupa mantendo a ordem alfabética que o backend já devolveu
    const grupos = new Map();
    for (const v of lista) {
      if (!grupos.has(v.produto_id)) grupos.set(v.produto_id, { p: v, vars: [] });
      grupos.get(v.produto_id).vars.push(v);
    }

    for (const { p, vars } of grupos.values()) {
      const total = vars.reduce((a, v) => a + (Number(v.estoque) || 0), 0);
      const badgeCons = p.consignado
        ? ` <span style="font-size:10px;padding:1px 5px;border-radius:10px;background:var(--azul-claro,#dbeafe);color:var(--azul,#1d4ed8);font-weight:600;white-space:nowrap">🤝 ${esc(p.fornecedor || 'Consig.')}</span>`
        : '';
      // ---- linha do PRODUTO ----
      // A foto da linha do produto é a primeira foto QUE EXISTE entre as variações.
      // Usar `p.foto` (a primeira variação da lista) fazia o produto aparecer com o
      // ícone genérico sempre que a variação de cima estava sem foto. (v3.26.4)
      const fotoProduto = (vars.find(v => v.foto) || {}).foto || null;
      const trP = el(`<tr class="linha-produto" style="background:var(--fundo-suave,#f7f7f8)">
        ${celFoto(fotoProduto)}
        <td><b style="font-size:14.5px">${esc(p.produto)}</b>${badgeCons}
          ${p.referencia ? ` <small style="color:var(--texto-suave)">Ref. ${esc(p.referencia)}</small>` : ''}
          <small style="color:var(--texto-suave)"> · ${vars.length} variação(ões)</small></td>
        <td></td>
        <td class="num"><b style="font-size:14.5px">${total}</b></td>
        ${_locais.map(l => {
          const q = vars.reduce((a, v) => a + saldoDe(v.id ?? v.variacao_id, l.id), 0);
          return `<td class="num col-loja"${q ? '' : ' style="opacity:.3"'}><b>${q}</b></td>`;
        }).join('')}
        ${admin ? `<td class="acoes-estoque">
          <button class="btn-est btn-est-entrada" data-a="p-entrada">+ Entrada</button>
          <button class="btn-est btn-est-saida" data-a="p-saida">− Saída</button>
          <button class="btn-est btn-est-ajuste" data-a="p-ajuste">Ajustar</button>
        </td>` : ''}</tr>`);
      if (admin) {
        trP.querySelector('[data-a=p-entrada]').onclick = () => formMovimentoProduto(p, 'entrada', recarregar);
        trP.querySelector('[data-a=p-saida]').onclick   = () => formMovimentoProduto(p, 'saida', recarregar);
        trP.querySelector('[data-a=p-ajuste]').onclick  = () => formMovimentoProduto(p, 'ajuste', recarregar);
      }
      const thumbP = trP.querySelector('img[data-foto]');
      if (thumbP && _obs) _obs.observe(thumbP);
      tbody.appendChild(trP);

      // ---- linhas das VARIAÇÕES, com o saldo em cada loja ----
      for (const v of vars) {
        const porLocal = _locais.map(l => {
          const q = saldoDe(v.id ?? v.variacao_id, l.id);
          return `<td class="num col-loja"${q ? '' : ' style="opacity:.3"'}>${q}</td>`;
        }).join('');
        const trV = el(`<tr class="linha-variacao">
          ${celFoto(v.foto)}
          <td style="padding-left:26px">${esc(v.cor)} / <b>${esc(v.tamanho)}</b></td>
          <td style="font-family:Consolas,monospace;font-size:11.5px">${esc(v.codigo_barras || '')}</td>
          <td class="num">${v.estoque}</td>
          ${porLocal}
          ${admin ? '<td></td>' : ''}
        </tr>`);
        // Sem botão por variação (v3.26.2): entrada, saída e ajuste são do
        // PRODUTO e abrem a grade inteira numa janela só. Ordem do Marcio:
        // "entrada, saída, ajustar é tudo no produto, entrando tem que aparecer
        // todas as opções do produto pra alterar o que eu quiser na mesma janela".
        const thumbV = trV.querySelector('img[data-foto]');
        if (thumbV && _obs) _obs.observe(thumbV);
        tbody.appendChild(trV);
      }
    }
  }

  // Filtra _todosItens conforme os selects e redesenha a tabela.
  function aplicarFiltro() {
    const tipo = fTipo.value;
    const fid  = Number(fForn.value) || 0;
    let lista = _todosItens;
    if (tipo === 'proprios') {
      lista = lista.filter(v => !v.consignado);
    } else if (tipo === 'cons') {
      lista = lista.filter(v => v.consignado);
      if (fid) lista = lista.filter(v => v.fornecedor_id === fid);
    }
    const termo = busca.value.trim().toLowerCase();
    if (termo) {
      lista = lista.filter(v =>
        (v.produto || '').toLowerCase().includes(termo) ||
        (v.referencia || '').toLowerCase().includes(termo) ||
        (v.codigo_barras || '').includes(busca.value.trim())
      );
    }
    const msg = tipo === 'proprios' ? 'Nenhum produto próprio no estoque.'
      : tipo === 'cons' ? 'Nenhum produto consignado no estoque.'
      : 'Nenhum produto cadastrado no estoque.';
    desenhar(lista, msg);
  }

  // Popula o select de fornecedores e controla visibilidade.
  function renderFiltros(lista) {
    const fMap = new Map();
    for (const v of lista) {
      if (v.consignado && v.fornecedor_id && !fMap.has(v.fornecedor_id))
        fMap.set(v.fornecedor_id, v.fornecedor || 'Sem nome');
    }
    const prevForn = fForn.value;
    fForn.innerHTML = '<option value="">Todos os fornecedores</option>';
    for (const [fid, nome] of [...fMap.entries()].sort((a,b) => a[1].localeCompare(b[1]))) {
      const o = document.createElement('option');
      o.value = fid; o.textContent = nome;
      if (String(fid) === prevForn) o.selected = true;
      fForn.appendChild(o);
    }
  }

  // Estoque inteiro em ordem alfabética, já na abertura.
  async function carregarTudo() {
    tbody.innerHTML = `<tr><td colspan="${COLSPAN}" class="vazio">Carregando estoque…</td></tr>`;
    // Saldos por loja numa consulta só (v3.26.0). Se falhar, a lista abre
    // do mesmo jeito — só sem a coluna por loja, em vez de não abrir.
    try {
      const rl = await api('estoques:mapaLocais');
      if (rl && rl.ok) {
        _locais = rl.locais || [];
        _saldos = new Map((rl.saldos || []).map(x => [`${x.variacao_id}:${x.estoque_id}`, x.qtd]));
      }
    } catch { _locais = []; _saldos = new Map(); }
    montarCabecalho();
    const r = await api('estoque:listarCompleto');
    _todosItens = (r.ok ? r.variacoes : []).map(v => ({
      id: v.variacao_id, produto_id: v.produto_id, produto: v.nome, referencia: v.referencia,
      cor: v.cor, tamanho: v.tamanho, codigo_barras: v.codigo_barras,
      estoque: v.estoque, preco_custo: v.preco_custo, preco_venda: v.preco_venda,
      foto: v.foto,
      consignado: v.consignado || 0,
      fornecedor_id: v.fornecedor_id || null,
      fornecedor: v.fornecedor || '',
    }));
    _emBusca = false;
    renderFiltros(_todosItens);
    fTipo.dispatchEvent(new Event('change'));
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
      id: v.id, produto_id: v.produto_id, produto: v.produto, referencia: v.referencia,
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
  fTipo.addEventListener('change', () => {
    fForn.style.display = fTipo.value === 'cons' ? '' : 'none';
    aplicarFiltro();
  });
  fForn.addEventListener('change', () => aplicarFiltro());
  corpo.appendChild(painel);
  carregarTudo();
  busca.focus();
}

// ── Entrada / saída do PRODUTO INTEIRO, numa tela só (v3.26.0) ─────────────
//
// Pedido do Marcio: "se eu clicasse em dar entrada ou dar saída no produto,
// abriria uma tela com todas as variações para alterar todo mundo de uma vez.
// E não ficar alterando de um em um. Isso é horrível."
//
// Mesmo desenho da transferência por produto (v3.5.0), que já resolveu isso do
// outro lado: a grade inteira abre de uma vez, com o saldo de cada linha e um
// campo de quantidade. Variação zerada aparece esmaecida em vez de sumir — na
// entrada ela é preenchível (é justamente a peça que está chegando).
//
// UM local para a operação inteira: chegou mercadoria, vai tudo para o mesmo
// lugar. O padrão é o Almoxarifado Central na entrada e, na saída, o local com
// mais saldo daquele produto.
export async function formMovimentoProduto(prod, tipo, aoConcluir) {
  // v3.27.0 — UMA JANELA, TODAS AS LOJAS.
  // Antes havia um seletor de local e a grade mostrava só aquele estoque: para
  // acertar três lojas era preciso abrir a janela três vezes. Agora cada loja é
  // uma COLUNA e dá para lançar tudo de uma vez.
  // A coluna "tem aqui" saiu de propósito (pedido do Marcio): o saldo atual já
  // está na tela de trás. O saldo continua sendo usado por baixo para travar a
  // saída — estoque negativo não existe.
  const rv = await api('produtos:obter', { id: prod.produto_id });
  if (!rv.ok) { toast(rv.erro, true); return; }
  const rl = await api('estoques:listar', {});
  const locais = (rl && rl.ok ? rl.estoques || rl.locais : []) || [];
  if (!locais.length) { toast('Nenhum estoque cadastrado. Cadastre um local primeiro.', true); return; }

  const variacoes = rv.variacoes || [];
  if (!variacoes.length) { toast('Este produto não tem variações ativas.', true); return; }

  const rm = await api('estoques:mapaLocais');
  const mapa = new Map(((rm && rm.ok ? rm.saldos : []) || [])
    .map(x => [`${x.variacao_id}:${x.estoque_id}`, x.qtd]));
  const saldo = (vid, lid) => mapa.get(`${vid}:${lid}`) || 0;

  const ehEntrada = tipo === 'entrada';
  const ehAjuste  = tipo === 'ajuste';
  const rotulo = ehEntrada ? 'Entra' : ehAjuste ? 'Contagem real' : 'Sai';

  // Na saída, loja sem NENHUMA peça deste produto não entra na grade: coluna
  // inteira travada só ocupa espaço.
  const colunas = tipo === 'saida'
    ? locais.filter(l => variacoes.some(v => saldo(v.id, l.id) > 0))
    : locais.slice();
  if (!colunas.length) {
    toast('Este produto não tem saldo em nenhum estoque.', true);
    return;
  }

  const thLojas = colunas.map(l =>
    `<th class="num" style="min-width:92px">${esc(l.nome)}${l.tipo === 'almoxarifado' ? '<br><small style="font-weight:400;color:var(--texto-suave)">central</small>' : ''}</th>`
  ).join('');

  const corpo = `
    <p style="margin:0 0 4px"><b style="font-size:15px">${esc(prod.produto)}</b>
      ${prod.referencia ? `<small style="color:var(--texto-suave)"> · Ref. ${esc(prod.referencia)}</small>` : ''}</p>
    <p style="margin:0 0 12px;color:var(--texto-suave);font-size:12.5px">
      ${ehEntrada ? 'Quantas peças estão entrando em cada loja.'
        : ehAjuste ? 'Contagem real de cada variação em cada loja. Campo em branco não é tocado — e 0 zera.'
        : 'Quantas peças estão saindo de cada loja.'}
    </p>
    <div style="display:flex;gap:8px;margin:0 0 8px;flex-wrap:wrap">
      ${tipo === 'saida' ? '<button type="button" class="btn btn-suave" id="mp-tudo">Baixar tudo</button>' : ''}
      <button type="button" class="btn btn-suave" id="mp-limpar">Limpar</button>
      <span style="margin-left:auto;align-self:center;font-size:13px" id="mp-resumo"></span>
    </div>
    <div class="tab-scroll">
      <table class="tab-mov" style="width:100%">
        <thead><tr><th>Cor</th><th>Tamanho</th>${thLojas}</tr></thead>
        <tbody id="mp-corpo"></tbody>
      </table>
    </div>
    ${ehEntrada ? `<div class="campo" style="max-width:220px;margin-top:10px">
      <label>Custo unitário (R$) — opcional</label>
      <input id="mp-custo" type="number" min="0" step="0.01"></div>` : ''}
    <div class="campo"><label>Motivo / observação</label>
      <input id="mp-motivo" placeholder="${ehEntrada ? 'Compra fornecedor X' : 'Perda, defeito, uso interno…'}"></div>
    <div class="erro" id="mp-erro"></div>`;

  const m = modal(
    ehEntrada ? 'Entrada de mercadoria — produto inteiro, todas as lojas'
      : ehAjuste ? 'Ajuste de inventário — produto inteiro, todas as lojas'
      : 'Saída — produto inteiro, todas as lojas',
    corpo, async (mm, fechar) => {
      const erro = mm.querySelector('#mp-erro');
      // No ajuste, 0 é valor VÁLIDO (zera a peça naquele local): o que separa
      // "mexer" de "não mexer" é o campo estar preenchido, não ser > 0.
      const linhas = [...mm.querySelectorAll('[data-var]')]
        .map(i => ({
          variacao_id: Number(i.dataset.var),
          estoque_id: Number(i.dataset.loja),
          bruto: i.value.trim(),
          qtd: Number(i.value) || 0
        }))
        .filter(x => ehAjuste ? x.bruto !== '' : x.qtd > 0);
      if (!linhas.length) {
        erro.textContent = ehAjuste
          ? 'Informe a contagem de pelo menos uma variação.'
          : 'Informe a quantidade em pelo menos um estoque.';
        return;
      }
      const motivo = mm.querySelector('#mp-motivo').value.trim() || null;
      const custo = ehEntrada ? (Number(mm.querySelector('#mp-custo').value) || null) : null;
      // Sem motivo a saída em lote vira um punhado de baixas sem justificativa
      // no kardex — e é aí que some peça sem ninguém saber por quê.
      if (tipo === 'saida' && !motivo) { erro.textContent = 'Informe o motivo da saída.'; return; }

      let feitas = 0, pecas = 0, iguais = 0;
      const lojasTocadas = new Set();
      for (const l of linhas) {
        const r = await api('estoque:movimentar', {
          variacao_id: l.variacao_id, tipo, qtd: l.qtd,
          estoque_id: l.estoque_id, custo_unit: custo, motivo,
        });
        if (!r.ok) {
          // "o saldo já é esse valor" não é erro: é linha que não precisou mudar.
          if (ehAjuste && /j[áa] e(h|)\s*esse valor/i.test(r.erro || '')) { iguais++; continue; }
          erro.textContent = `${r.erro} (as ${feitas} primeiras linhas já foram gravadas)`;
          if (feitas) aoConcluir();
          return;
        }
        feitas++; pecas += l.qtd; lojasTocadas.add(l.estoque_id);
      }
      const nLojas = lojasTocadas.size;
      toast(ehAjuste
        ? `${feitas} lançamento(s) ajustado(s) em ${nLojas} estoque(s)${iguais ? ` · ${iguais} já estava(m) certo(s)` : ''}.`
        : `${ehEntrada ? 'Entrada' : 'Saída'} de ${pecas} peça(s) em ${nLojas} estoque(s).`);
      fechar(); aoConcluir();

      // Etiquetas do que acabou de entrar (v3.26.3). Uma variação pode ter
      // entrado em mais de uma loja: as quantidades somam, senão a etiqueta
      // sairia só para a última loja lançada.
      if (ehEntrada && linhas.length) {
        const porVar = new Map();
        for (const l of linhas) porVar.set(l.variacao_id, (porVar.get(l.variacao_id) || 0) + l.qtd);
        const entradas = [...porVar.entries()].map(([vid, qtd]) => {
          const v = variacoes.find(x => x.id === vid);
          return v ? { ...v, estoque: qtd } : null;   // `estoque` = quanto entrou
        }).filter(Boolean);
        if (entradas.length) {
          abrirEtiquetasLote([{ produto: rv.produto, variacoes: entradas }], { entrada: true });
        }
      }
    }, 'Confirmar');

  // A janela usa a tela. A conta anterior (260 + 104 por loja) dava menos que os
  // 640px padrão do modal e a grade nascia com barra de rolagem tendo espaço
  // sobrando ao lado — reprovado. Agora: o que a grade precisa, limitado a 90%
  // da janela, e nunca menor que o padrão.
  const cx = m.querySelector('.modal');
  if (cx) {
    const precisa = 300 + colunas.length * 130;        // 2 colunas fixas + campos
    const teto = Math.floor(window.innerWidth * 0.90);
    cx.style.width = Math.max(640, Math.min(precisa, teto)) + 'px';
    cx.style.maxWidth = '90vw';
  }

  const corpoTab = m.querySelector('#mp-corpo');
  const resumo   = m.querySelector('#mp-resumo');

  function atualizarResumo() {
    const campos = [...m.querySelectorAll('[data-var]')];
    const tot = campos.reduce((a, i) => a + (Number(i.value) || 0), 0);
    const lojas = new Set(campos.filter(i => i.value.trim() !== '').map(i => i.dataset.loja));
    resumo.textContent = lojas.size
      ? `${tot} peça(s) em ${lojas.size} estoque(s)`
      : '';
  }

  for (const v of variacoes) {
    const tds = colunas.map(l => {
      const tem = saldo(v.id, l.id);
      // Na saída, loja sem saldo desta variação não pode ser preenchida —
      // estoque negativo não existe em hipótese alguma.
      const trava = tipo === 'saida' && tem <= 0;
      return `<td class="num"><input type="number" min="0" ${tipo === 'saida' ? `max="${tem}"` : ''}
        step="1" inputmode="numeric" data-var="${v.id}" data-loja="${l.id}" data-tem="${tem}"
        placeholder="0" style="width:100%" onfocus="this.select()" ${trava ? 'disabled' : ''}></td>`;
    }).join('');
    const tr = el(`<tr><td>${esc(v.cor)}</td><td><b>${esc(v.tamanho)}</b></td>${tds}</tr>`);
    for (const inp of tr.querySelectorAll('input')) {
      inp.addEventListener('input', () => {
        // Clamp na saída SEM redesenhar a grade — redesenhar mataria o cursor
        // (armadilha registrada na v3.2.0 e repetida na v3.5.0).
        if (tipo === 'saida') {
          const tem = Number(inp.dataset.tem) || 0;
          if (Number(inp.value) > tem) inp.value = tem;
        }
        atualizarResumo();
      });
    }
    corpoTab.appendChild(tr);
  }

  const bTudo = m.querySelector('#mp-tudo');
  if (bTudo) bTudo.onclick = () => {
    for (const i of m.querySelectorAll('[data-var]')) {
      if (!i.disabled) i.value = Number(i.dataset.tem) || 0;
    }
    atualizarResumo();
  };
  m.querySelector('#mp-limpar').onclick = () => {
    for (const i of m.querySelectorAll('[data-var]')) i.value = '';
    atualizarResumo();
  };
  atualizarResumo();
}

// Movimentação de estoque (entrada / saída / ajuste).
//
// TODO movimento acontece dentro de UM local. Antes da v3.25.39 este form não
// mandava `estoque_id`: o backend caía no almoxarifado central, a peça sumia do
// total mas continuava no saldo da loja e o almoxarifado ficava negativo — o
// cliente via a peça "trocar de estoque" em vez de sair. Agora o local é sempre
// explícito e a entrada pode ser repartida entre vários locais de uma vez.
//
// `estoqueFixo` vem da tela de Estoques (locais): já se sabe de onde a peça sai.
export async function formMovimento(v, tipo, aoConcluir, estoqueFixo = null) {
  const rl = await api('estoques:porVariacao', { variacao_id: v.id });
  const locais = (rl && rl.ok ? rl.locais : []) || [];
  if (!locais.length) { toast('Nenhum estoque cadastrado. Cadastre um local primeiro.', true); return; }

  const titulos = {
    entrada: 'Entrada de mercadoria',
    saida:   'Saída manual',
    ajuste:  'Ajuste de estoque (inventário)',
  };
  const cabecalho = `<p style="margin-bottom:14px"><b>${esc(v.produto)}</b> — ${esc(v.cor)} / ${esc(v.tamanho)}
      &nbsp;·&nbsp; total Salgueiro: <b>${v.estoque}</b></p>`;
  const campoMotivo = `<div class="campo"><label>Motivo / observação</label>
      <input id="m-motivo" placeholder="${tipo === 'entrada' ? 'Compra fornecedor X' : tipo === 'saida' ? 'Perda, defeito, uso interno…' : 'Contagem de inventário'}"></div>
    <div class="erro" id="m-erro"></div>`;

  // ── Entrada: reparte a mercadoria entre os locais numa só operação ────────
  if (tipo === 'entrada') {
    const linhas = locais.map(l => `<tr>
      <td>${esc(l.nome)}${l.tipo === 'almoxarifado' ? ' <small style="opacity:.6">(central)</small>' : ''}</td>
      <td class="num" style="opacity:.6;width:90px">tem ${l.qtd}</td>
      <td style="width:110px"><input type="number" min="0" step="1" inputmode="numeric"
        data-local="${l.id}" placeholder="0" style="width:100%" onfocus="this.select()"></td>
    </tr>`).join('');
    modal(titulos.entrada, `${cabecalho}
      <div class="campo"><label>Quanto entra em cada estoque</label>
        <table style="width:100%"><tbody>${linhas}</tbody></table></div>
      <div class="campo"><label>Custo unitário (R$) — opcional</label>
        <input id="m-custo" type="number" min="0" step="0.01" placeholder="${v.preco_custo || ''}"></div>
      ${campoMotivo}`, async (m, fechar) => {
      const erro = m.querySelector('#m-erro');
      const destinos = [...m.querySelectorAll('[data-local]')]
        .map(i => ({ id: Number(i.dataset.local), qtd: Number(i.value) || 0 }))
        .filter(d => d.qtd > 0);
      if (!destinos.length) { erro.textContent = 'Informe a quantidade em pelo menos um estoque.'; return; }
      const custo  = Number(m.querySelector('#m-custo').value) || null;
      const motivo = m.querySelector('#m-motivo').value.trim() || null;
      let total = 0;
      for (const d of destinos) {
        const r = await api('estoque:movimentar', {
          variacao_id: v.id, tipo: 'entrada', qtd: d.qtd,
          estoque_id: d.id, custo_unit: custo, motivo,
        });
        if (!r.ok) { erro.textContent = r.erro; return; }
        total = r.estoque;
      }
      toast(`Entrada registrada em ${destinos.length} estoque(s). Total: ${total} un.`);
      fechar(); aoConcluir();
    }, 'Confirmar');
    return;
  }

  // ── Saída / ajuste: sai de UM local, escolhido explicitamente ─────────────
  const comSaldo = locais.filter(l => l.qtd > 0);
  if (tipo === 'saida' && !comSaldo.length) {
    toast('Esta peça não tem saldo em nenhum estoque.', true); return;
  }
  const opcoes = (tipo === 'saida' ? comSaldo : locais);
  const padrao = opcoes.some(l => l.id === Number(estoqueFixo))
    ? Number(estoqueFixo)
    : (opcoes.slice().sort((a, b) => b.qtd - a.qtd)[0] || opcoes[0]).id;

  const mod = modal(titulos[tipo], `${cabecalho}
    <div class="linha-2">
      <div class="campo">
        <label>${tipo === 'saida' ? 'Sai de qual estoque' : 'Qual estoque está sendo contado'}</label>
        <select id="m-local">${opcoes.map(l =>
          `<option value="${l.id}" ${l.id === padrao ? 'selected' : ''}>${esc(l.nome)} — ${l.qtd} un.</option>`
        ).join('')}</select>
      </div>
      <div class="campo">
        <label>${tipo === 'ajuste' ? 'Contagem real neste estoque' : 'Quantidade'}</label>
        <input id="m-qtd" type="number" min="0" step="1" inputmode="numeric" autofocus
          placeholder="quantidade" onfocus="this.select()">
      </div>
    </div>
    <p id="m-dica" style="margin:-4px 0 12px;font-size:12.5px;color:var(--texto-suave)"></p>
    ${campoMotivo}`, async (m, fechar) => {
    const erro  = m.querySelector('#m-erro');
    const campo = m.querySelector('#m-qtd');
    // Campo começa vazio de propósito: em branco viraria 0 e num ajuste zeraria
    // o estoque sem o usuário perceber.
    if (campo.value.trim() === '') {
      erro.textContent = tipo === 'ajuste' ? 'Informe a contagem do estoque.' : 'Informe a quantidade.';
      campo.focus(); return;
    }
    const r = await api('estoque:movimentar', {
      variacao_id: v.id, tipo, qtd: Number(campo.value),
      estoque_id: Number(m.querySelector('#m-local').value),
      custo_unit: null,
      motivo: m.querySelector('#m-motivo').value.trim() || null,
    });
    if (!r.ok) { erro.textContent = r.erro; return; }
    toast(`${r.local}: ${r.estoque_local} un. · total Salgueiro: ${r.estoque} un.`);
    fechar(); aoConcluir();
  }, 'Confirmar');

  // Dica viva: mostra o saldo do local escolhido enquanto o usuário troca.
  const selLocal = mod.querySelector('#m-local');
  const dica     = mod.querySelector('#m-dica');
  const atualizarDica = () => {
    const l = opcoes.find(x => x.id === Number(selLocal.value));
    dica.textContent = !l ? '' : (tipo === 'saida'
      ? `Saldo atual em ${l.nome}: ${l.qtd} un. — a saída não pode passar disso.`
      : `Saldo registrado em ${l.nome}: ${l.qtd} un.`);
  };
  selLocal.addEventListener('change', atualizarDica);
  atualizarDica();
  mod.querySelector('#m-qtd').focus();
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
  // Impressão silenciosa quando há impressora configurada. Sem ela — e SEMPRE
  // num terminal em rede, onde `config:imprimir` é SOMENTE_LOCAL — abre a janela
  // com o CSS 60×40mm. Antes caía em `window.print()`, que usava o `@page` de
  // 80mm do cupom e saía sem o layout da etiqueta. (v3.26.3)
  const folha = area.innerHTML;
  api('config:imprimir', { tipo: 'etiqueta' }).then(r => {
    if (!r.ok) imprimirFolhaEtiquetas(folha);
  }).catch(() => imprimirFolhaEtiquetas(folha));
}
