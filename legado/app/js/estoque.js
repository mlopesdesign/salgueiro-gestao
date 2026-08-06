// Módulo Estoque — movimentação, kardex, reposição e etiquetas
import { api, el, esc, moeda, toast, modal, getConfig } from './app.js';

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

// ---------- Tela Estoque ----------
export async function viewEstoque(alvo) {
  const tela = el(`
    <div>
      <div class="pagina-topo"><h1>Estoque</h1></div>
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
  abaMovimentar(corpo);
}

// ---------- Aba: Movimentar ----------
function abaMovimentar(corpo) {
  const painel = el(`
    <div class="painel">
      <div class="barra">
        <input type="text" id="mov-busca" placeholder="Bipe o código de barras ou digite nome/referência…">
      </div>
      <table>
        <thead><tr><th>Produto</th><th>Cor / Tamanho</th><th>Código</th>
          <th class="num">Estoque</th><th style="width:230px"></th></tr></thead>
        <tbody><tr><td colspan="5" class="vazio">Busque um produto para movimentar.</td></tr></tbody>
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
      tbody.appendChild(el(`<tr><td colspan="5" class="vazio">Nada encontrado para "${esc(termo)}".</td></tr>`));
      return;
    }
    // leitor de código de barras: 1 resultado exato → abre direto a entrada
    if (lista.length === 1 && lista[0].codigo_barras === termo) {
      formMovimento(lista[0], 'entrada', pesquisar);
    }
    for (const v of lista) {
      const tr = el(`<tr>
        <td><b>${esc(v.produto)}</b>${v.referencia ? ` <small style="color:var(--texto-suave)">Ref. ${esc(v.referencia)}</small>` : ''}</td>
        <td>${esc(v.cor)} / ${esc(v.tamanho)}</td>
        <td style="font-family:Consolas,monospace">${esc(v.codigo_barras || '')}</td>
        <td class="num"><b>${v.estoque}</b></td>
        <td class="acoes-linha">
          <button data-a="entrada" style="color:var(--verde)">+ Entrada</button>
          <button data-a="saida" style="color:var(--vermelho)">− Saída</button>
          <button data-a="ajuste">Ajustar</button>
        </td></tr>`);
      for (const acao of ['entrada', 'saida', 'ajuste']) {
        tr.querySelector(`[data-a=${acao}]`).onclick = () => formMovimento(v, acao, pesquisar);
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
      <td>${esc(m.criado_em)}</td>
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
      <thead><tr><th>Produto</th><th>Categoria</th>
        <th class="num">Estoque</th><th class="num">Mínimo</th><th class="num">Repor</th></tr></thead>
      <tbody></tbody>
    </table></div>`);
  const tbody = painel.querySelector('tbody');
  const lista = r.ok ? r.produtos : [];
  if (!lista.length) tbody.appendChild(el(`<tr><td colspan="5" class="vazio">Nenhum produto abaixo do mínimo. 🎉</td></tr>`));
  for (const p of lista) {
    tbody.appendChild(el(`<tr>
      <td><b>${esc(p.nome)}</b>${p.referencia ? ` <small style="color:var(--texto-suave)">Ref. ${esc(p.referencia)}</small>` : ''}</td>
      <td>${esc(p.categoria || '—')}</td>
      <td class="num">${p.estoque_total}</td>
      <td class="num">${p.estoque_minimo}</td>
      <td class="num"><span class="pill pill-baixo">${p.estoque_minimo - p.estoque_total + 1}+</span></td>
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
      <td style="width:110px"><input data-v="${v.id}" type="number" min="0" value="${Math.max(0, v.estoque)}"
        style="width:90px;padding:5px 8px;border:1px solid var(--borda);border-radius:6px"></td>
    </tr>`).join('');

  modal(`Etiquetas — ${esc(produto.nome)}`, `
    <p style="margin-bottom:10px;color:var(--texto-suave)">Quantidade de etiquetas por variação:</p>
    <table><thead><tr><th>Variação</th><th>Código</th><th></th><th>Qtd</th></tr></thead>
      <tbody>${linhasHtml}</tbody></table>
  `, (m, fechar) => {
    const qtds = {};
    m.querySelectorAll('input[data-v]').forEach(i => { qtds[i.dataset.v] = Number(i.value) || 0; });
    const total = Object.values(qtds).reduce((s, n) => s + n, 0);
    if (!total) { toast('Informe ao menos uma etiqueta.', true); return; }
    imprimirEtiquetas(produto, variacoes, qtds);
    fechar();
  }, 'Imprimir');
}

function imprimirEtiquetas(produto, variacoes, qtds) {
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
          <div class="loja">${esc((getConfig().loja_nome || "MINHA LOJA").toUpperCase())}</div>
          <div class="prod">${esc(produto.nome)}</div>
          <div class="var">${esc(v.cor)} · Tam. ${esc(v.tamanho)}${produto.referencia ? ' · Ref. ' + esc(produto.referencia) : ''}</div>
          <div class="preco">${moeda(produto.preco_venda)}</div>
          ${ean13Svg(v.codigo_barras)}
          <div class="cod-num">${esc(v.codigo_barras)}</div>
        </div>`);
    }
  }
  area.innerHTML = `<div class="etq-grid">${etiquetas.join('')}</div>`;
  window.print();
}
