// PDV — frente de caixa
import { api, el, esc, moeda, toast, modal, getConfig, pode, podeVerTela, setorAtivo, EM_REDE } from './app.js';

// Formas de pagamento disponíveis (respeita setores desligados pelo Dev).
// 'troca' NÃO entra: é lançada pelo sistema quando o crédito de uma troca abate
// a venda nova; escolher no combo geraria um pagamento sem lastro.
const formasDisponiveis = () => FORMAS.filter(([v]) =>
  v !== 'troca' &&
  (v !== 'crediario' || setorAtivo('crediario')) && (v !== 'vale' || setorAtivo('vales')));

let itens = [];        // itens da venda em andamento
let cliente = null;    // cliente selecionado
let refresco = null;   // função para redesenhar a tela

const FORMAS = [
  ['dinheiro', 'Dinheiro'], ['pix', 'PIX'], ['debito', 'Cartão Débito'],
  ['credito', 'Cartão Crédito'], ['crediario', 'Crediário'], ['vale', 'Vale-troca'],
  ['cortesia', 'Cortesia (brinde)'],
  ['troca', 'Crédito de troca']
];
const nomeForma = (f) => (FORMAS.find(x => x[0] === f) || [f, f])[1];

export function calcResgateLocal(cfg, pts) {
  if (!cfg.ativo || pts < cfg.minimo_resgate) return 0;
  return Math.floor(pts / cfg.minimo_resgate) * cfg.valor_resgate;
}

// ── Campo de quantidade digitável ────────────────────────────────────────────
// Antes o campo só reagia ao evento `change`: as setinhas do input disparam
// `change` na hora, mas digitar só commita ao sair do campo — e o handler
// redesenhava a tabela inteira, destruindo o input e o cursor. Resultado: só
// dava para mudar a quantidade pelo leitor ou pelas setas.
//
// Agora: `input` a cada tecla (campo vazio é aceito enquanto digita, sem
// clampar para 1), `blur`/Enter normalizam, foco seleciona o conteúdo para
// digitar por cima, e ↑/↓ continuam funcionando.
//   aoDigitar(valorOuNull) → chamado a cada tecla, sem redesenhar a linha
//   aoConfirmar(valor)     → chamado ao sair do campo ou apertar Enter
//   aoLimitar(pedido, max) → chamado quando o valor digitado passou do máximo
function ligarCampoQtd(inp, { min = 0, max = null, aoDigitar, aoConfirmar, aoLimitar } = {}) {
  inp.setAttribute('inputmode', 'numeric');
  inp.setAttribute('autocomplete', 'off');

  const limpo = () => {
    const t = String(inp.value).replace(',', '.').trim();
    return t === '' ? null : Number(t);
  };
  const normalizar = () => {
    let v = limpo();
    if (v === null || !isFinite(v)) v = min;
    v = Math.floor(v);
    if (v < min) v = min;
    if (max !== null && v > max) {
      const pedido = v; v = max;
      if (aoLimitar) aoLimitar(pedido, max);
    }
    inp.value = String(v);
    return v;
  };

  inp.addEventListener('focus', () => { try { inp.select(); } catch {} });
  inp.addEventListener('input', () => {
    const v = limpo();
    if (aoDigitar) aoDigitar(v === null || !isFinite(v) ? null : Math.floor(v));
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
  });
  inp.addEventListener('blur', () => { if (aoConfirmar) aoConfirmar(normalizar()); });
  return inp;
}

async function viewPdv(alvo) {
  const r = await api('pdv:caixaAtual');
  if (!r.caixa) { telaAbertura(alvo); return; }
  telaVenda(alvo, r.caixa);
}

// ---------- Abertura de caixa ----------
async function telaAbertura(alvo) {
  // Carrega as lojas para escolher em qual unidade o caixa vai operar.
  let lojasLista = [];
  try { const rl = await api('lojas:listar'); if (rl && rl.ok) lojasLista = rl.lojas || []; } catch {}
  const salvo = Number(localStorage.getItem('salgueiro_loja_id')) || 0;
  const temEscolha = lojasLista.length > 1;
  const optLojas = lojasLista.map(l =>
    `<option value="${l.id}"${l.id === salvo ? ' selected' : ''}>${esc(l.nome)}</option>`).join('');

  const tela = el(`
    <div style="max-width:420px;margin:60px auto">
      <div class="painel" style="padding:28px">
        <h1 style="color:var(--vinho);font-size:19px;margin-bottom:6px">Abrir o caixa</h1>
        <p style="color:var(--texto-suave);margin-bottom:18px">Informe o dinheiro que está na gaveta para começar a vender.</p>
        ${temEscolha ? `<div class="campo"><label>Loja</label>
          <select id="cx-loja">${optLojas}</select>
          <small style="color:var(--texto-suave)">Esta máquina vai lembrar a última loja usada.</small></div>` : ''}
        <div class="campo"><label>Valor de abertura (R$)</label>
          <input id="cx-valor" type="number" min="0" step="0.01" value="0"></div>
        <div class="erro" id="cx-erro"></div>
        <button class="btn btn-primario btn-bloco" id="cx-abrir">Abrir caixa</button>
        <button class="btn btn-suave btn-bloco" id="cx-historico" style="margin-top:10px">📋 Histórico de vendas</button>
      </div>
    </div>`);
  tela.querySelector('#cx-abrir').onclick = async () => {
    const selLoja = tela.querySelector('#cx-loja');
    const loja_id = selLoja ? Number(selLoja.value)
                            : (salvo || (lojasLista[0] && lojasLista[0].id) || null);
    const r = await api('pdv:abrirCaixa', {
      valor_abertura: Number(tela.querySelector('#cx-valor').value), loja_id });
    if (!r.ok) { tela.querySelector('#cx-erro').textContent = r.erro; return; }
    if (r.loja_id) { try { localStorage.setItem('salgueiro_loja_id', String(r.loja_id)); } catch {} }
    toast('Caixa aberto. Boas vendas!');
    alvo.innerHTML = ''; viewPdv(alvo);
  };
  tela.querySelector('#cx-historico').onclick = () => modalHistoricoVendas();
  alvo.appendChild(tela);
  tela.querySelector('#cx-valor').focus();
}

// ---------- Tela de venda ----------
function telaVenda(alvo, caixa) {
  itens = []; cliente = null;
  const tela = el(`
    <div>
      <div class="pagina-topo">
        <h1>PDV — Venda${caixa && caixa.loja ? ` <span style="font-size:13px;font-weight:600;color:var(--vinho);background:#F6E9E9;padding:3px 10px;border-radius:20px;vertical-align:middle">🏬 ${esc(caixa.loja)}</span>` : ''}</h1>
        <div style="display:flex;gap:8px">
          <button class="btn btn-suave" id="b-consulta">🔍 Consultar preço (F3)</button>
          <button class="btn btn-suave" id="b-troca" style="color:var(--vinho);font-weight:700">🔄 Troca (F6)</button>
          <button class="btn btn-suave" id="b-vendas">Vendas do caixa</button>
          <button class="btn btn-suave" id="b-historico">📋 Histórico</button>
          ${pode('caixa.sangria') ? '<button class="btn btn-suave" id="b-supr">+ Suprimento</button>' : ''}
          ${pode('caixa.sangria') ? '<button class="btn btn-suave" id="b-sangria">− Sangria</button>' : ''}
          ${pode('caixa.abrir_fechar') ? '<button class="btn btn-perigo" id="b-fechar">Fechar caixa</button>' : ''}
        </div>
      </div>
      <div class="pdv-grid">
        <div class="painel">
          <div class="barra">
            <input type="text" id="pdv-busca" placeholder="F2 · Bipe o código ou digite o nome do produto…">
          </div>
          <div id="pdv-sugestoes"></div>
          <table>
            <thead><tr><th>Item</th><th style="width:70px">Qtd</th><th class="num">Preço</th>
              ${pode('pdv.desconto') ? '<th style="width:90px">Desc. R$</th>' : ''}<th class="num">Total</th><th style="width:36px"></th></tr></thead>
            <tbody id="pdv-itens"><tr><td colspan="6" class="vazio">Bipe um produto para começar.</td></tr></tbody>
          </table>
        </div>
        <div>
          <div class="painel" style="padding:18px">
            <div class="campo"><label>Cliente</label>
              <button class="btn btn-suave btn-bloco" id="pdv-cliente">Consumidor final — trocar (F4)</button></div>
            <div id="pdv-pontos" style="display:none;margin-bottom:4px"></div>
            <div class="tot-linha"><span>Subtotal</span><b id="t-sub">R$ 0,00</b></div>
            ${pode('pdv.desconto') ? `<div class="tot-linha"><span>Desconto geral</span>
              <div style="display:flex;align-items:center">
                <input id="t-desc" type="number" min="0" step="0.01" value="0"
                  style="width:78px;text-align:right;padding:5px 8px;border:1px solid var(--borda);border-radius:6px 0 0 6px">
                <button id="t-desc-modo" title="Alternar R$/%" style="padding:5px 9px;border:1px solid var(--borda);border-left:none;border-radius:0 6px 6px 0;background:var(--superficie);cursor:pointer;font-weight:700;font-size:0.85em;min-width:36px">R$</button>
              </div></div>
              <div class="tot-linha" id="t-desc-info" style="display:none">
                <span style="color:var(--texto-suave);font-size:0.85em">= desconto de</span>
                <span id="t-desc-calc" style="color:var(--vermelho);font-weight:600;font-size:0.85em">R$ 0,00</span>
              </div>` : ''}
            <div class="tot-total"><span>TOTAL</span><b id="t-total">R$ 0,00</b></div>
            <button class="btn btn-primario btn-bloco" id="pdv-finalizar" style="margin-top:14px;padding:14px">
              Finalizar venda (F10)</button>
          </div>
        </div>
      </div>
    </div>`);

  const $busca = tela.querySelector('#pdv-busca');
  const $sug = tela.querySelector('#pdv-sugestoes');
  const $corpo = tela.querySelector('#pdv-itens');

  const arred = v => Math.round(v * 100) / 100;

  function totais() {
    const sub = arred(itens.reduce((s, i) => s + arred(i.qtd * i.preco_unit) - arred(i.desconto), 0));
    let desc = 0;
    if (pode('pdv.desconto')) {
      const modo = tela.querySelector('#t-desc-modo')?.textContent || 'R$';
      const val = Number(tela.querySelector('#t-desc')?.value) || 0;
      if (modo === '%') {
        desc = arred(sub * val / 100);
        const $info = tela.querySelector('#t-desc-info');
        const $calc = tela.querySelector('#t-desc-calc');
        if ($info) $info.style.display = val > 0 ? '' : 'none';
        if ($calc) $calc.textContent = moeda(desc);
      } else {
        desc = arred(val);
        const $info = tela.querySelector('#t-desc-info');
        if ($info) $info.style.display = 'none';
      }
    }
    const total = arred(Math.max(0, sub - desc));
    tela.querySelector('#t-sub').textContent = moeda(sub);
    tela.querySelector('#t-total').textContent = moeda(total);
    return { sub, desc, total };
  }

  function desenhar() {
    $corpo.innerHTML = '';
    if (!itens.length) {
      $corpo.appendChild(el(`<tr><td colspan="6" class="vazio">Bipe um produto para começar.</td></tr>`));
    }
    itens.forEach((i, idx) => {
      const tr = el(`<tr>
        <td><b>${esc(i.produto)}</b><br><small style="color:var(--texto-suave)">${esc(i.cor)} / ${esc(i.tamanho)}</small></td>
        <td><input data-c="qtd" type="number" min="1" max="${i.estoque || ''}" value="${i.qtd}"
          style="width:56px;padding:4px 6px;border:1px solid var(--borda);border-radius:6px;text-align:center"></td>
        <td class="num">${moeda(i.preco_unit)}</td>
        ${pode('pdv.desconto') ? `<td><input data-c="desconto" type="number" min="0" step="0.01" value="${i.desconto}"
          style="width:76px;padding:4px 6px;border:1px solid var(--borda);border-radius:6px"></td>` : ''}
        <td class="num"><b class="lin-total">${moeda(i.qtd * i.preco_unit - i.desconto)}</b></td>
        <td class="acoes-linha"><button style="color:var(--vermelho)">✕</button></td>
      </tr>`);

      const $linTotal = tr.querySelector('.lin-total');
      const repintarLinha = () => {
        $linTotal.textContent = moeda(i.qtd * i.preco_unit - i.desconto);
        totais();
      };

      // Quantidade: digitável. Não redesenha a tabela (isso destruía o cursor);
      // só repinta o total da própria linha e o rodapé.
      const $qtd = tr.querySelector('input[data-c="qtd"]');
      ligarCampoQtd($qtd, {
        min: 1,
        max: i.estoque || null,
        aoDigitar: v => { if (v !== null && v >= 1) { i.qtd = v; repintarLinha(); } },
        aoConfirmar: v => { i.qtd = v; repintarLinha(); },
        aoLimitar: (pedido, teto) =>
          toast(`Estoque insuficiente: pediu ${pedido}, só há ${teto} un. de ${i.produto}.`, true)
      });

      // Desconto por item: aceita centavos, então não passa pelo helper de qtd.
      const $desc = tr.querySelector('input[data-c="desconto"]');
      if ($desc) {
        $desc.addEventListener('focus', () => { try { $desc.select(); } catch {} });
        $desc.addEventListener('input', () => {
          const v = Number(String($desc.value).replace(',', '.'));
          i.desconto = isFinite(v) && v > 0 ? v : 0;
          repintarLinha();
        });
        $desc.addEventListener('blur', () => { $desc.value = String(i.desconto); repintarLinha(); });
        $desc.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $desc.blur(); } });
      }

      tr.querySelector('button').onclick = () => { itens.splice(idx, 1); desenhar(); };
      $corpo.appendChild(tr);
    });
    totais();
  }
  refresco = desenhar;

  function addItem(v) {
    if (v.estoque <= 0) { toast('Sem estoque desta variação.', true); return; }
    const existente = itens.find(i => i.variacao_id === v.id);
    if (existente) {
      if (existente.qtd + 1 > v.estoque) { toast('Estoque insuficiente.', true); return; }
      existente.qtd++;
    } else {
      itens.push({ variacao_id: v.id, produto: v.produto, cor: v.cor, tamanho: v.tamanho,
                   qtd: 1, preco_unit: v.preco_venda, desconto: 0, estoque: v.estoque });
    }
    $sug.innerHTML = ''; $busca.value = ''; $busca.focus();
    desenhar();
  }

  async function pesquisar() {
    const termo = $busca.value.trim();
    $sug.innerHTML = '';
    if (termo.length < 2) return;
    const r = await api('estoque:buscar', { termo });
    const lista = r.ok ? r.variacoes : [];
    if (lista.length === 1 && lista[0].codigo_barras === termo) { addItem(lista[0]); return; }
    if (!lista.length) { $sug.appendChild(el(`<div class="sug vazio-sug">Nada encontrado.</div>`)); return; }
    for (const v of lista.slice(0, 8)) {
      const s = el(`<div class="sug">
        <span class="sug-info">${v.foto ? `<img class="thumb thumb-sm" src="${v.foto}">` : '<span class="thumb thumb-sm thumb-vazio">👗</span>'}<span><b>${esc(v.produto)}</b> — ${esc(v.cor)}/${esc(v.tamanho)}
          <small>(${v.estoque} un.)</small></span></span><b>${moeda(v.preco_venda)}</b></div>`);
      s.onclick = () => addItem(v);
      $sug.appendChild(s);
    }
  }
  let deb;
  $busca.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(pesquisar, 250); });
  $busca.addEventListener('keydown', e => {
    if (e.key === 'Enter') { clearTimeout(deb); pesquisar(); }
  });
  tela.querySelector('#t-desc')?.addEventListener('input', () => {
    tela._descontoAutorizado = false; tela._descontoJustificativa = null; totais();
  });
  tela.querySelector('#t-desc-modo')?.addEventListener('click', () => {
    const $m = tela.querySelector('#t-desc-modo');
    $m.textContent = $m.textContent === 'R$' ? '%' : 'R$';
    tela.querySelector('#t-desc').value = '0';
    tela.querySelector('#t-desc').focus();
    tela._descontoAutorizado = false;
    totais();
  });

  // cliente
  tela.querySelector('#pdv-cliente').onclick = () =>
    escolherCliente(async c => {
      // Ao trocar cliente: limpa desconto de categoria anterior
      if (pode('pdv.desconto') && tela._descontoAutorizado) {
        const $td = tela.querySelector('#t-desc');
        const $tm = tela.querySelector('#t-desc-modo');
        if ($td) $td.value = '0';
        if ($tm) $tm.textContent = 'R$';
        tela._descontoAutorizado = false;
        tela._descontoJustificativa = null;
        totais();
      }
      cliente = c;
      tela._pontosResgate = null;
      tela.querySelector('#pdv-cliente').textContent =
        c ? `👤 ${c.nome} — trocar (F4)` : 'Consumidor final — trocar (F4)';
      // Auto-aplicar desconto de categoria
      if (c && (c.categoria_desconto || 0) > 0 && pode('pdv.desconto')) {
        const $tm = tela.querySelector('#t-desc-modo');
        const $td = tela.querySelector('#t-desc');
        if ($tm) $tm.textContent = '%';
        if ($td) $td.value = c.categoria_desconto.toFixed(2);
        tela._descontoAutorizado = true;
        totais();
        toast(`🏷️ Desconto de categoria: −${c.categoria_desconto}% aplicado.`);
      }
      const $pp = tela.querySelector('#pdv-pontos');
      if (c) {
        const [cfg, sd] = await Promise.all([
          api('pontos:config'),
          api('pontos:saldo', { cliente_id: c.id })
        ]);
        if (cfg.ativo && sd.ok) {
          const pts = sd.pontos;
          const desc = calcResgateLocal(cfg, pts);
          $pp.style.display = '';
          $pp.innerHTML = `<div style="background:var(--creme);border-radius:8px;padding:7px 10px;font-size:0.85em">
            🎁 <b>${pts} pontos</b>
            ${desc > 0
              ? `<button id="btn-resgatar" class="btn btn-suave" style="padding:2px 8px;margin-left:6px;font-size:0.8em">Usar ${pts} pts (−${moeda(desc)})</button>`
              : `<span style="color:var(--texto-suave)"> — faltam ${cfg.minimo_resgate - pts} pts</span>`}
          </div>`;
          if (desc > 0) {
            $pp.querySelector('#btn-resgatar').addEventListener('click', () => {
              const $m = tela.querySelector('#t-desc-modo');
              if ($m) $m.textContent = 'R$';
              const $di = tela.querySelector('#t-desc-info');
              if ($di) $di.style.display = 'none';
              tela.querySelector('#t-desc').value = desc.toFixed(2);
              tela._pontosResgate = { pontos: pts, desconto: desc };
              tela._descontoAutorizado = true;
              totais();
              toast(`🎁 ${pts} pontos aplicados: −${moeda(desc)} no total.`);
            });
          }
        } else { $pp.style.display = 'none'; }
      } else { $pp.style.display = 'none'; }
    });

  // finalizar
  tela.querySelector('#pdv-finalizar').onclick = async () => {
    if (!itens.length) { toast('A venda está vazia.', true); return; }
    const ts = totais();
    if (ts.desc > 0 && !tela._descontoAutorizado) {
      const just = await modalAutorizarDesconto(ts.desc);
      if (!just) return;
      tela._descontoAutorizado = true;
      tela._descontoJustificativa = just;   // { autorizado_por, motivo } → vai para a venda
    }
    // Desconto de categoria do cliente e resgate de pontos entram autorizados
    // por natureza (vêm da tabela, não da mão do operador) — sem justificativa.
    modalPagamento(ts.total, ts.desc, tela._pontosResgate || null,
      () => { alvo.innerHTML = ''; viewPdv(alvo); },
      tela._descontoJustificativa || null);
  };

  // caixa
  tela.querySelector('#b-sangria')?.addEventListener('click', () => modalMovCaixa('sangria'));
  tela.querySelector('#b-supr')?.addEventListener('click', () => modalMovCaixa('suprimento'));
  tela.querySelector('#b-fechar')?.addEventListener('click', () => modalFechamento(caixa, () => { alvo.innerHTML = ''; viewPdv(alvo); }));
  tela.querySelector('#b-vendas').onclick = () => modalVendas();
  tela.querySelector('#b-historico').onclick = () => modalHistoricoVendas();
  tela.querySelector('#b-consulta').onclick = consultarPreco;
  tela.querySelector('#b-troca').onclick = () => modalBuscarVendaTroca();

  // atalhos
  tela.tabIndex = -1;
  function consultarPreco() {
    const m = modal('Consultar preço', `
      <div class="campo">
        <input id="cp-busca" placeholder="Bipe o código de barras ou digite o nome…" autocomplete="off">
      </div>
      <div id="cp-res" class="cp-res"><div class="vazio" style="padding:18px !important">Bipe ou digite para ver o preço.</div></div>
    `, (mm, fechar) => fechar(), 'Fechar');
    const inp = m.querySelector('#cp-busca');
    const res = m.querySelector('#cp-res');
    let deb2;
    async function buscar() {
      const termo = inp.value.trim();
      if (termo.length < 2) return;
      const r = await api('estoque:buscar', { termo });
      const lista = r.ok ? r.variacoes : [];
      res.innerHTML = '';
      if (!lista.length) { res.appendChild(el(`<div class="vazio" style="padding:18px !important">Nada encontrado.</div>`)); return; }
      for (const v of lista.slice(0, 12)) {
        const linha = el(`<div class="cp-item">
          ${v.foto ? `<img class="thumb" src="${v.foto}">` : '<span class="thumb thumb-vazio">👗</span>'}
          <div class="cp-info"><b>${esc(v.produto)}</b><small>${esc(v.cor)} / ${esc(v.tamanho)} · ${v.estoque} un.</small></div>
          <div class="cp-preco">${moeda(v.preco_venda)}</div>
          <button class="btn btn-suave cp-add">+ Adicionar</button>
        </div>`);
        linha.querySelector('.cp-add').onclick = () => { addItem(v); toast('Adicionado à venda.'); };
        res.appendChild(linha);
      }
    }
    inp.addEventListener('input', () => { clearTimeout(deb2); deb2 = setTimeout(buscar, 250); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(deb2); buscar(); } });
  }

  tela.addEventListener('keydown', e => {
    if (e.key === 'F2') { e.preventDefault(); $busca.focus(); }
    if (e.key === 'F3') { e.preventDefault(); tela.querySelector('#b-consulta').click(); }
    if (e.key === 'F4') { e.preventDefault(); tela.querySelector('#pdv-cliente').click(); }
    if (e.key === 'F6') { e.preventDefault(); tela.querySelector('#b-troca').click(); }
    if (e.key === 'F10') { e.preventDefault(); tela.querySelector('#pdv-finalizar').click(); }
  });

  alvo.appendChild(tela);
  $busca.focus();
}

// ---------- Cliente ----------
function escolherCliente(aoEscolher) {
  const m = modal('Cliente da venda', `
    <div class="campo"><input id="cl-busca" placeholder="Buscar por nome, CPF ou telefone…"></div>
    <div id="cl-lista"></div>
    <hr style="border:none;border-top:1px solid var(--borda);margin:12px 0">
    <p style="font-weight:600;margin-bottom:8px">Cadastro rápido</p>
    <div class="linha-2">
      <div class="campo"><label>Nome *</label><input id="cl-nome"></div>
      <div class="campo"><label>Telefone/WhatsApp</label><input id="cl-tel"></div>
    </div>
    <div class="erro" id="cl-erro"></div>
  `, async (m, fechar) => {
    const nome = m.querySelector('#cl-nome').value.trim();
    if (!nome) { m.querySelector('#cl-erro').textContent = 'Informe o nome (ou clique em um cliente da lista).'; return; }
    const r = await api('clientes:salvar', { nome, telefone: m.querySelector('#cl-tel').value.trim() });
    if (!r.ok) { m.querySelector('#cl-erro').textContent = r.erro; return; }
    aoEscolher({ id: r.id, nome });
    toast('Cliente cadastrado.'); fechar();
  }, 'Cadastrar e usar');

  const $lista = m.querySelector('#cl-lista');
  async function busca() {
    const r = await api('clientes:listar', { busca: m.querySelector('#cl-busca').value });
    $lista.innerHTML = '';
    $lista.appendChild(el(`<div class="sug"><span>— Consumidor final (sem cadastro)</span></div>`))
      .onclick = () => { aoEscolher(null); m.remove(); };
    for (const c of (r.ok ? r.clientes : [])) {
      const s = el(`<div class="sug"><span><b>${esc(c.nome)}</b>
        <small>${esc(c.telefone || '')}</small></span>
        ${c.saldo_devedor > 0 ? `<small style="color:var(--vermelho)">deve ${moeda(c.saldo_devedor)}</small>` : ''}</div>`);
      s.onclick = () => { aoEscolher({ id: c.id, nome: c.nome, categoria_desconto: c.categoria_desconto || 0 }); m.remove(); };
      $lista.appendChild(s);
    }
  }
  let deb;
  m.querySelector('#cl-busca').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(busca, 250); });
  busca();
}

// ---------- Autorização de desconto ----------
// Desconto avulso (v3.3.0) — mudou de trava para rastro.
// Antes exigia login e senha de ADMINISTRADOR, o que parava a fila no balcão e
// mesmo assim não registrava nada: a venda gravava só o valor do desconto, sem
// quem liberou nem por quê, e não havia como auditar depois.
// Agora quem está no PDV assume o desconto com a PRÓPRIA senha e informa quem
// autorizou e o motivo — os dois vão para `vendas.desconto_autorizado_por` e
// `vendas.desconto_motivo` e saem no Relatório de Evento.
// Devolve null se o operador desistir, ou { autorizado_por, motivo }.
function modalAutorizarDesconto(desconto) {
  return new Promise(resolve => {
    let resolvido = false;
    const m = modal('Desconto — quem autorizou?', `
      <p style="margin-bottom:6px">Desconto de <b style="color:var(--vinho);font-size:1.15em">${moeda(desconto)}</b> nesta venda.</p>
      <p style="margin-bottom:14px;font-size:12px;color:var(--texto-suave)">
        Registre quem liberou e por quê. Fica gravado na venda e aparece no relatório do evento.
      </p>
      <div class="linha-2">
        <div class="campo"><label>Autorizado por *</label>
          <input id="ad-autor" autocomplete="off" placeholder="Nome de quem liberou"></div>
        <div class="campo"><label>Motivo *</label>
          <input id="ad-motivo" autocomplete="off" placeholder="Ex.: peça com defeito, cliente antiga…"></div>
      </div>
      <div class="campo">
        <label>Sua senha *</label>
        <input id="ad-senha" type="password" placeholder="••••••" autocomplete="current-password">
        <small style="color:var(--texto-suave);font-size:11px">
          A senha de quem está operando o caixa agora — confirma que o lançamento foi seu.
        </small>
      </div>
      <div class="erro" id="ad-erro"></div>
    `, async (mm, fechar) => {
      const $err = mm.querySelector('#ad-erro');
      const autor = mm.querySelector('#ad-autor').value.trim();
      const motivo = mm.querySelector('#ad-motivo').value.trim();
      const senha = mm.querySelector('#ad-senha').value;
      if (!autor)  { $err.textContent = 'Informe quem autorizou o desconto.'; return; }
      if (!motivo) { $err.textContent = 'Informe o motivo do desconto.'; return; }
      if (!senha)  { $err.textContent = 'Digite a sua senha para confirmar.'; return; }
      const r = await api('auth:autorizarDesconto', { senha });
      if (!r.ok) { $err.textContent = r.erro; return; }
      resolvido = true; fechar();
      resolve({ autorizado_por: autor, motivo });
    }, 'Confirmar desconto');
    setTimeout(() => { try { m.querySelector('#ad-autor').focus(); } catch {} }, 60);
    // Detecta fechamento sem confirmar (clique em × ou fora do modal)
    const obs = new MutationObserver(() => {
      if (!document.contains(m)) { obs.disconnect(); if (!resolvido) resolve(null); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
}

// ---------- Pagamento ----------
function modalPagamento(total, descontoGeral, pontosResgate, aoConcluir, descontoJustificativa) {
  // Configuração de desconto à vista (dinheiro/PIX)
  const cfg = getConfig();
  const ativoAvista   = cfg.desconto_avista_ativo === '1';
  const pctAvista     = Math.max(0, Math.min(1, Number(cfg.desconto_avista_percent || 5) / 100));
  const minimoAvista  = Number(cfg.desconto_avista_minimo || 100);

  let descontoAvista = 0; // calculado em desenhar()

  const pagamentos = [{ forma: 'dinheiro', valor: total, parcelas: 1 }];

  const m = modal(`Pagamento — total ${moeda(total)}`, `
    <div id="pg-avista-badge" style="display:none;background:#e8f5e9;border:1px solid var(--verde,#2e7d32);border-radius:8px;padding:8px 12px;margin-bottom:10px;color:var(--verde,#2e7d32);font-weight:600;font-size:13px"></div>
    <div id="pg-linhas"></div>
    <button class="btn btn-suave" id="pg-add" type="button">+ Adicionar forma de pagamento</button>
    <div class="tot-linha" style="margin-top:14px"><span>Pago</span><b id="pg-pago">R$ 0,00</b></div>
    <div id="pg-avista-row" style="display:none" class="tot-linha">
      <span style="color:var(--verde,#2e7d32)">🏷️ Desconto à vista</span>
      <b id="pg-avista-val" style="color:var(--verde,#2e7d32)"></b>
    </div>
    <div class="tot-linha"><span id="pg-rotulo">Troco</span><b id="pg-troco">R$ 0,00</b></div>
    <div class="erro" id="pg-erro"></div>
  `, async (m, fechar) => {
    // Cortesia: autorizador e beneficiário são obrigatórios
    const semDados = pagamentos.find(pg => pg.forma === 'cortesia' &&
      (!String(pg.autorizado_por || '').trim() || !String(pg.beneficiario || '').trim()));
    if (semDados) {
      m.querySelector('#pg-erro').textContent =
        'Cortesia: preencha quem autorizou e para quem foi.';
      return;
    }
    const r = await api('pdv:venda', {
      itens: itens.map(i => ({ variacao_id: i.variacao_id, qtd: i.qtd, preco_unit: i.preco_unit, desconto: i.desconto })),
      desconto: descontoGeral + descontoAvista,  // desconto manual + desconto à vista
      // Justificativa do desconto avulso (v3.3.0). Só existe quando o operador
      // digitou desconto na mão — categoria e pontos não pedem.
      desconto_autorizado_por: descontoJustificativa ? descontoJustificativa.autorizado_por : null,
      desconto_motivo: descontoJustificativa ? descontoJustificativa.motivo : null,
      cliente_id: cliente ? cliente.id : null,
      pontos_resgatar: pontosResgate ? pontosResgate.pontos : 0,
      pagamentos: pagamentos.map(pg => ({
        forma: pg.forma, valor: pg.valor, parcelas: pg.parcelas,
        ...(pg.forma === 'vale' ? { codigo_vale: (pg.codigo_vale || '').trim().toUpperCase() } : {}),
        ...(pg.forma === 'cortesia' ? {
          autorizado_por: String(pg.autorizado_por || '').trim(),
          beneficiario: String(pg.beneficiario || '').trim()
        } : {})
      }))
    });
    if (!r.ok) { m.querySelector('#pg-erro').textContent = r.erro; return; }
    fechar();
    if (r.pontos_ganhos > 0) setTimeout(() => toast(`🎁 +${r.pontos_ganhos} pontos ganhos!`), 400);
    modalCupom(r);
    aoConcluir();
  }, 'Confirmar venda');

  // Calcula desconto à vista: só se ativoAvista, total >= mínimo,
  // cliente NÃO tem desconto de categoria, e TODOS os pagamentos são dinheiro ou pix
  function calcAvista() {
    if (!ativoAvista || total < minimoAvista) return 0;
    if (cliente && (cliente.categoria_desconto || 0) > 0) return 0; // categoria prevalece
    if (pagamentos.length === 0) return 0;
    const soAvista = pagamentos.every(p => p.forma === 'dinheiro' || p.forma === 'pix');
    if (!soAvista) return 0;
    return Math.round(total * pctAvista * 100) / 100;
  }

  const $linhas = m.querySelector('#pg-linhas');
  function desenhar() {
    $linhas.innerHTML = '';

    // Recalcula desconto à vista; se mudou, ajusta 1º pagamento automaticamente
    const novoAvista = calcAvista();
    if (novoAvista !== descontoAvista) {
      descontoAvista = novoAvista;
      const totalLiquido = total - descontoAvista;
      // Auto-ajuste apenas quando há 1 pagamento
      if (pagamentos.length === 1) pagamentos[0].valor = totalLiquido;
    }
    const totalLiquido = total - descontoAvista;

    // Badge de desconto à vista
    const $badge = m.querySelector('#pg-avista-badge');
    const $row   = m.querySelector('#pg-avista-row');
    const $val   = m.querySelector('#pg-avista-val');
    if (descontoAvista > 0) {
      $badge.style.display = '';
      $badge.textContent = `🏷️ Desconto à vista ${(pctAvista * 100).toFixed(0)}% aplicado: −${moeda(descontoAvista)} → total ${moeda(totalLiquido)}`;
      $row.style.display = ''; $val.textContent = `−${moeda(descontoAvista)}`;
    } else {
      $badge.style.display = 'none'; $row.style.display = 'none';
    }

    pagamentos.forEach((pg, idx) => {
      const isVale = pg.forma === 'vale';
      const isCortesia = pg.forma === 'cortesia';
      const linha = el(`<div class="linha-3" style="align-items:end;margin-bottom:8px">
        <div class="campo" style="margin:0"><label>Forma</label>
          <select data-c="forma">${formasDisponiveis().map(([v, n]) =>
            `<option value="${v}" ${pg.forma === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="campo" style="margin:0"><label>${isCortesia ? 'Valor cortesia (R$)' : 'Valor (R$)'}</label>
          <input data-c="valor" type="number" min="0" step="0.01" value="${pg.valor}"></div>
        <div style="display:flex;gap:6px;align-items:end">
          ${isVale
            ? `<div class="campo" style="margin:0;flex:1">
                <label>Código do vale <span class="saldo-vale" style="color:var(--verde);font-size:11px"></span></label>
                <input data-c="codigo_vale" value="${esc(pg.codigo_vale || '')}" placeholder="VT-XXXXXX"
                  style="text-transform:uppercase;letter-spacing:2px" autocomplete="off"></div>`
            : `<div class="campo" style="margin:0;flex:1;${['credito', 'crediario'].includes(pg.forma) ? '' : 'visibility:hidden'}">
                <label>Parcelas</label>
                <select data-c="parcelas">${Array.from({ length: 12 }, (_, k) =>
                  `<option value="${k + 1}" ${pg.parcelas === k + 1 ? 'selected' : ''}>${k + 1}x</option>`).join('')}</select></div>`
          }
          <button type="button" data-a="rm" class="btn btn-suave" style="padding:8px 10px;color:var(--vermelho)">✕</button>
        </div>
      </div>`);
      linha.querySelectorAll('select,input').forEach(c => c.addEventListener('change', () => {
        if (c.dataset.c === 'forma') { pg.forma = c.value; pg.codigo_vale = ''; desenhar(); return; }
        if (c.dataset.c === 'codigo_vale') return;
        pg[c.dataset.c] = Number(c.value);
        desenhar();
      }));
      if (isVale) {
        const inpCod = linha.querySelector('[data-c="codigo_vale"]');
        const spanSaldo = linha.querySelector('.saldo-vale');
        inpCod.addEventListener('blur', async () => {
          const cod = inpCod.value.trim().toUpperCase();
          pg.codigo_vale = cod;
          if (!cod) { spanSaldo.textContent = ''; return; }
          const rv = await api('vales_troca:consultar', { codigo: cod });
          if (!rv.ok) { spanSaldo.textContent = rv.erro; spanSaldo.style.color = 'var(--vermelho)'; return; }
          spanSaldo.textContent = `saldo: ${moeda(rv.vale.saldo)}`;
          spanSaldo.style.color = 'var(--verde)';
          if ((pg.valor || 0) > rv.vale.saldo) {
            pg.valor = rv.vale.saldo;
            linha.querySelector('[data-c="valor"]').value = rv.vale.saldo;
            desenhar();
          }
        });
      }
      linha.querySelector('[data-a=rm]').onclick = () => { pagamentos.splice(idx, 1); desenhar(); };
      $linhas.appendChild(linha);

      if (isCortesia) {
        const extra = el(`<div class="linha-2" style="margin:-2px 0 12px;padding:10px 12px;
            background:rgba(180,83,9,.08);border-left:3px solid #b45309;border-radius:6px">
          <div class="campo" style="margin:0"><label>Autorizado por *</label>
            <input data-c="autorizado_por" value="${esc(pg.autorizado_por || '')}"
              placeholder="quem liberou" autocomplete="off"></div>
          <div class="campo" style="margin:0"><label>Para quem foi *</label>
            <input data-c="beneficiario" value="${esc(pg.beneficiario || '')}"
              placeholder="quem recebeu o brinde" autocomplete="off"></div>
        </div>`);
        extra.querySelectorAll('input').forEach(c =>
          c.addEventListener('input', () => { pg[c.dataset.c] = c.value; }));
        $linhas.appendChild(extra);
      }
    });

    // Cortesia não é dinheiro recebido: sai do total a pagar, não entra em "pago"
    const cortesiaTotal = pagamentos.reduce((s, p) =>
      s + (p.forma === 'cortesia' ? (Number(p.valor) || 0) : 0), 0);
    const pago = pagamentos.reduce((s, p) =>
      s + (p.forma === 'cortesia' ? 0 : (Number(p.valor) || 0)), 0);
    const aReceber = Math.max(0, totalLiquido - cortesiaTotal);
    m.querySelector('#pg-pago').textContent = moeda(pago);
    const dif = pago - aReceber;
    m.querySelector('#pg-rotulo').textContent = dif >= 0 ? 'Troco' : 'Falta';
    m.querySelector('#pg-troco').textContent = moeda(Math.abs(dif));
    m.querySelector('#pg-troco').style.color = dif >= 0 ? 'var(--verde)' : 'var(--vermelho)';
    if (pagamentos.some(p => p.forma === 'crediario') && !cliente) {
      m.querySelector('#pg-erro').textContent = 'Crediário exige cliente identificado (feche e use F4).';
    } else m.querySelector('#pg-erro').textContent = '';
  }
  m.querySelector('#pg-add').onclick = () => {
    const pago = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    pagamentos.push({ forma: 'pix', valor: Math.max(0, (total - descontoAvista) - pago), parcelas: 1 });
    desenhar();
  };
  desenhar();
}

// ---------- Cupom ----------
function _fmtDataHora(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : s;
}

function modalCupom(d) {
  modal(`Venda #${d.venda.id} concluída ✅`, `
    <p style="margin-bottom:14px">Total: <b style="font-size:18px">${moeda(d.venda.total)}</b>
      ${d.venda.cliente ? ` · Cliente: ${esc(d.venda.cliente)}` : ''}</p>
    <p style="color:var(--texto-suave)">Imprimir o comprovante para o cliente?</p>
  `, (m, fechar) => { imprimirCupom(d); fechar(); }, 'Imprimir cupom');
}

async function imprimirCupom(d) {
  let area = document.getElementById('area-impressao');
  if (!area) { area = document.createElement('div'); area.id = 'area-impressao'; document.body.appendChild(area); }
  const linhaItem = (i) => `
    <tr><td colspan="3">${esc(i.produto)} ${esc(i.cor)}/${esc(i.tamanho)}</td></tr>
    <tr><td>${i.qtd} x ${moeda(i.preco_unit)}</td>
        <td>${i.desconto > 0 ? '-' + moeda(i.desconto) : ''}</td>
        <td style="text-align:right">${moeda(i.total)}</td></tr>`;
  const linhaPg = (p) => `
    <tr><td colspan="2">${nomeForma(p.forma)}${p.parcelas > 1 ? ` ${p.parcelas}x` : ''}</td>
        <td style="text-align:right">${moeda(p.valor)}</td></tr>
    ${p.troco > 0 ? `<tr><td colspan="2">Troco</td><td style="text-align:right">${moeda(p.troco)}</td></tr>` : ''}`;
  const parcelas = (d.parcelas || []).map(p =>
    `<tr><td>Parcela ${p.numero}</td><td>${p.vencimento}</td>
      <td style="text-align:right">${moeda(p.valor)}</td></tr>`).join('');

  const cfg = getConfig();
  const infoLoja = [cfg.loja_cnpj && `CNPJ ${cfg.loja_cnpj}`, cfg.loja_telefone, cfg.loja_endereco]
    .filter(Boolean).map(esc).join('<br>');
  area.innerHTML = `
    <div class="cupom">
      <div class="c-centro">
        ${(cfg.logo_cupom || cfg.logo) ? `<img src="${cfg.logo_cupom || cfg.logo}" style="width:26mm;max-height:20mm;object-fit:contain"><br>` : ''}
        <b>${esc((cfg.cupom_nome || cfg.loja_nome || 'MINHA LOJA').toUpperCase())}</b>
        ${infoLoja ? `<br><span style="font-size:9px">${infoLoja}</span>` : ''}<br>Comprovante de venda (não fiscal)</div>
      <div class="c-sep"></div>
      Venda #${d.venda.id} · ${esc(_fmtDataHora(d.venda.criado_em))}<br>
      Vendedor(a): ${esc(d.venda.vendedor || '')}<br>
      ${d.venda.cliente ? `Cliente: ${esc(d.venda.cliente)}<br>` : ''}
      <div class="c-sep"></div>
      <table>${d.itens.map(linhaItem).join('')}</table>
      <div class="c-sep"></div>
      <table>
        <tr><td>Subtotal</td><td style="text-align:right">${moeda(d.venda.subtotal)}</td></tr>
        ${d.venda.desconto > 0 ? `<tr><td>Desconto</td><td style="text-align:right">-${moeda(d.venda.desconto)}</td></tr>` : ''}
        <tr><td><b>TOTAL</b></td><td style="text-align:right"><b>${moeda(d.venda.total)}</b></td></tr>
      </table>
      <table>${d.pagamentos.map(linhaPg).join('')}</table>
      ${parcelas ? `<div class="c-sep"></div><b>Crediário:</b><table>${parcelas}</table>` : ''}
      <div class="c-sep"></div>
      <div class="c-centro">${esc(cfg.cupom_rodape || 'Obrigado pela preferência!').replace(/\n/g, '<br>')}</div>
    </div>`;
  // Terminal em rede: imprime direto pelo diálogo do navegador (impressora desta máquina).
  // Computador principal: usa a impressora configurada silenciosamente; fallback para diálogo.
  if (EM_REDE) { window.print(); return; }
  const r = await api('config:imprimir', { tipo: 'cupom' });
  if (!r.ok) window.print();
}


// ── Vale-troca impresso na térmica de 80mm (v3.6.0) ─────────────────────────
// Pedido do Marcio: parar de mandar a cliente anotar o código.
// Usa EXATAMENTE o caminho do cupom de venda — monta o HTML em #area-impressao
// e chama api('config:imprimir', {tipo:'cupom'}), que já resolve impressora,
// CSS de 80mm e impressão silenciosa. Nada da configuração de impressora é
// tocado: se o cupom imprime, o vale imprime.
async function imprimirVale(vale, extra) {
  let area = document.getElementById('area-impressao');
  if (!area) { area = document.createElement('div'); area.id = 'area-impressao'; document.body.appendChild(area); }
  const cfg = getConfig();
  const infoLoja = [cfg.loja_cnpj && `CNPJ ${cfg.loja_cnpj}`, cfg.loja_telefone, cfg.loja_endereco]
    .filter(Boolean).map(esc).join('<br>');
  const val = vale.validade
    ? (() => { const [a, m, d] = String(vale.validade).split('-'); return `${d}/${m}/${a}`; })()
    : null;
  const e = extra || {};

  area.innerHTML = `
    <div class="cupom">
      <div class="c-centro">
        ${(cfg.logo_cupom || cfg.logo) ? `<img src="${cfg.logo_cupom || cfg.logo}" style="width:26mm;max-height:20mm;object-fit:contain"><br>` : ''}
        <b>${esc((cfg.cupom_nome || cfg.loja_nome || 'MINHA LOJA').toUpperCase())}</b>
        ${infoLoja ? `<br><span style="font-size:9px">${infoLoja}</span>` : ''}
      </div>
      <div class="c-sep"></div>
      <div class="c-centro"><b>VALE-TROCA</b><br>
        <span style="font-size:9px">Crédito para usar em uma próxima compra</span></div>
      <div class="c-sep"></div>
      <div class="c-centro" style="font-size:22px;font-weight:700;letter-spacing:2px;margin:4px 0">
        ${esc(vale.codigo)}</div>
      <div class="c-centro" style="font-size:15px;font-weight:700;margin-bottom:3px">
        ${moeda(vale.valor_total)}</div>
      ${val ? `<div class="c-centro">Válido até <b>${val}</b></div>` : ''}
      <div class="c-sep"></div>
      ${e.cliente ? `Cliente: ${esc(e.cliente)}<br>` : ''}
      ${e.venda_id ? `Origem: venda #${e.venda_id}<br>` : ''}
      Emitido em ${new Date().toLocaleString('pt-BR')}<br>
      ${e.operador ? `Atendente: ${esc(e.operador)}<br>` : ''}
      <div class="c-sep"></div>
      <div style="font-size:9px">
        Como usar: apresente este comprovante na loja. No pagamento, escolha
        <b>Vale-troca</b> e informe o código acima. Pode ser usado em partes —
        o saldo restante continua valendo${val ? ' até a data indicada' : ''}.
      </div>
      <div class="c-sep"></div>
      <div class="c-centro" style="font-size:9px">Documento não fiscal · guarde este comprovante</div>
    </div>`;

  if (EM_REDE) { window.print(); return { ok: true }; }
  const r = await api('config:imprimir', { tipo: 'cupom' });
  if (!r.ok) window.print();   // sem impressora configurada: cai no diálogo
  return r;
}

// Modal do vale emitido — com o botão de imprimir em vez de "anote o código".
// Usado pela troca e pela devolução com reembolso em vale.
function modalValeEmitido(vale, titulo, extra) {
  const val = vale.validade
    ? (() => { const [a, m, d] = String(vale.validade).split('-'); return `${d}/${m}/${a}`; })()
    : null;
  const m = modal(titulo || 'Vale-troca gerado 🎫', `
    <div style="text-align:center;padding:14px 10px">
      <p style="color:var(--texto-suave);margin-bottom:10px">Crédito para a cliente usar depois</p>
      <div style="font-size:30px;font-weight:900;letter-spacing:4px;color:var(--vinho);margin-bottom:6px">
        ${esc(vale.codigo)}</div>
      <p style="font-size:17px;margin:0">Valor: <b>${moeda(vale.valor_total)}</b></p>
      ${val ? `<p style="margin-top:4px">Válido até <b>${val}</b></p>` : ''}
      <div style="margin-top:16px">
        <button class="btn btn-primario" id="vl-imprimir" style="padding:11px 22px;font-size:15px">
          🖨️ Imprimir o vale</button>
      </div>
      <p style="font-size:11px;color:var(--texto-suave);margin-top:10px">
        Sai na impressora de cupom, com o código e a validade. Entregue à cliente.
      </p>
      <div class="erro" id="vl-erro" style="margin-top:6px"></div>
    </div>
  `, (_, fechar) => fechar(), 'Fechar');

  const btn = m.querySelector('#vl-imprimir');
  btn.onclick = async () => {
    btn.disabled = true;
    const antes = btn.textContent;
    btn.textContent = 'Imprimindo…';
    const r = await imprimirVale(vale, extra);
    btn.disabled = false;
    btn.textContent = antes;
    if (r && r.ok === false) {
      m.querySelector('#vl-erro').textContent =
        r.erro + ' — abrimos a janela de impressão do sistema.';
    } else {
      toast('Vale enviado para a impressora.');
    }
  };
  // imprime sozinho ao abrir: o caso normal é entregar o papel na hora
  setTimeout(() => { try { btn.click(); } catch {} }, 250);
  return m;
}

// ---------- Caixa: sangria/suprimento, fechamento, vendas ----------
function modalMovCaixa(tipo) {
  modal(tipo === 'sangria' ? 'Sangria (retirada de dinheiro)' : 'Suprimento (entrada de troco)', `
    <div class="linha-2">
      <div class="campo"><label>Valor (R$)</label><input id="mc-valor" type="number" min="0" step="0.01"></div>
      <div class="campo"><label>Motivo</label><input id="mc-motivo"
        placeholder="${tipo === 'sangria' ? 'Depósito, pagamento…' : 'Reforço de troco…'}"></div>
    </div>
    <div class="erro" id="mc-erro"></div>
  `, async (m, fechar) => {
    const r = await api('pdv:movimentoCaixa', {
      tipo, valor: Number(m.querySelector('#mc-valor').value),
      motivo: m.querySelector('#mc-motivo').value.trim() || null
    });
    if (!r.ok) { m.querySelector('#mc-erro').textContent = r.erro; return; }
    toast(tipo === 'sangria' ? 'Sangria registrada.' : 'Suprimento registrado.');
    fechar();
  }, 'Registrar');
}

async function modalFechamento(caixa, aoConcluir) {
  const r = await api('pdv:resumoCaixa', { caixa_id: caixa.id });
  if (!r.ok) { toast(r.erro, true); return; }
  const formasHtml = r.por_forma.map(f =>
    `<div class="tot-linha"><span>${nomeForma(f.forma)}</span><b>${moeda(f.total)}</b></div>`).join('');
  const lojasHtml = (r.por_loja || []).length > 1
    ? '<div class="tot-linha" style="margin-top:8px"><span><b>Vendas por loja</b></span><span></span></div>' +
      r.por_loja.map(l =>
        `<div class="tot-linha"><span>🏬 ${esc(l.loja)} (${l.qtd})</span><b>${moeda(l.total)}</b></div>`).join('')
    : '';
  const c = r.consignados || { pecas: 0 };
  const consigHtml = c.pecas > 0 ? `
    <div class="tot-linha" style="margin-top:8px"><span><b>Consignados (${c.pecas} peça${c.pecas > 1 ? 's' : ''})</b></span><b>${moeda(c.venda)}</b></div>
    <div class="tot-linha"><span>&nbsp;&nbsp;Custo das peças</span><b>${moeda(c.custo)}</b></div>
    <div class="tot-linha"><span>&nbsp;&nbsp;Parte do fornecedor (custo + lucro)</span><b>${moeda(c.fornecedor)}</b></div>
    <div class="tot-linha"><span>&nbsp;&nbsp;Parte da loja</span><b style="color:var(--verde)">${moeda(c.loja)}</b></div>` : '';

  modal('Fechar caixa', `
    <div class="tot-linha"><span>Abertura</span><b>${moeda(r.caixa.valor_abertura)}</b></div>
    ${formasHtml || '<p style="color:var(--texto-suave)">Nenhuma venda neste caixa.</p>'}
    <div class="tot-linha"><span><b>Total de vendas (${r.qtd_vendas})</b></span><b>${moeda(r.total_vendas)}</b></div>
    ${lojasHtml}
    ${consigHtml}
    <div class="tot-linha" style="margin-top:8px"><span>Suprimentos</span><b>${moeda(r.suprimentos)}</b></div>
    <div class="tot-linha"><span>Sangrias</span><b>-${moeda(r.sangrias)}</b></div>
    <div class="tot-total"><span>Dinheiro esperado na gaveta</span><b>${moeda(r.esperado_dinheiro)}</b></div>
    <div class="campo" style="margin-top:14px"><label>Dinheiro contado na gaveta (R$)</label>
      <input id="fc-valor" type="number" min="0" step="0.01"></div>
    <div class="campo"><label>Observações</label><input id="fc-obs"></div>
    <div class="erro" id="fc-erro"></div>
  `, async (m, fechar) => {
    const r2 = await api('pdv:fecharCaixa', {
      valor_informado: Number(m.querySelector('#fc-valor').value),
      obs: m.querySelector('#fc-obs').value.trim() || null
    });
    if (!r2.ok) { m.querySelector('#fc-erro').textContent = r2.erro; return; }
    const dif = r2.diferenca;
    toast(dif === 0 ? 'Caixa fechado sem diferenças. 🎉'
      : `Caixa fechado com ${dif > 0 ? 'sobra' : 'falta'} de ${moeda(Math.abs(dif))}.`, dif !== 0);
    fechar(); aoConcluir();
  }, 'Fechar caixa');
}

function _pillVenda(v) {
  if (v.status === 'cancelada') return '<span class="pill pill-baixo">cancelada</span>';
  const dev = Number(v.total_devolvido) || 0;
  if (dev > 0 && dev >= Number(v.total)) return '<span class="pill pill-baixo">devolvida</span>';
  if (dev > 0) return '<span class="pill" style="background:#d97706;color:#fff">dev. parcial</span>';
  return '<span class="pill pill-ok">ok</span>';
}

async function modalVendas() {
  const r = await api('pdv:listarVendas', {});
  const linhas = (r.vendas || []).map(v => {
    const dev = Number(v.total_devolvido) || 0;
    const podeDevolver = v.status === 'concluida' && dev < Number(v.total);
    return `
    <tr data-id="${v.id}">
      <td>#${v.id}</td><td>${esc(v.criado_em)}</td><td>${esc(v.cliente || '—')}</td>
      <td>${esc(v.formas || '')}</td>
      <td class="num"><b>${moeda(v.total)}</b></td>
      <td>${_pillVenda(v)}</td>
      <td class="acoes-linha">
        ${v.status === 'concluida' ? '<button data-a="cupom">Cupom</button>' : ''}
        ${podeDevolver && pode('pdv.devolucao') ? '<button data-a="devolver">↩ Devolver</button>' : ''}
        ${podeDevolver && pode('pdv.ver') ? '<button data-a="trocar" style="color:var(--vinho)">🔄 Troca</button>' : ''}
        ${v.status === 'concluida' && pode('pdv.cancelar') ? '<button data-a="cancelar" style="color:var(--vermelho)">Cancelar</button>' : ''}
      </td>
    </tr>`;
  }).join('');

  const m = modal('Vendas deste caixa', `
    ${pode('pdv.devolucao') ? '<div style="text-align:right;margin-bottom:8px"><button class="btn btn-suave" id="hist-dev">↩️ Histórico de devoluções</button></div>' : ''}
    <table><thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Formas</th>
      <th class="num">Total</th><th></th><th style="width:150px"></th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="7" class="vazio">Nenhuma venda ainda.</td></tr>'}</tbody></table>
  `, (m, fechar) => fechar(), 'Fechar');

  m.querySelectorAll('[data-a=cupom]').forEach(b => b.onclick = async () => {
    const d = await api('pdv:obterVenda', { id: Number(b.closest('tr').dataset.id) });
    if (d.ok) imprimirCupom(d);
  });
  m.querySelectorAll('[data-a=cancelar]').forEach(b => b.onclick = async () => {
    const id = Number(b.closest('tr').dataset.id);
    const motivo = prompt(`Motivo do cancelamento da venda #${id}:`);
    if (motivo === null) return;
    const r2 = await api('pdv:cancelarVenda', { venda_id: id, motivo });
    if (!r2.ok) { toast(r2.erro, true); return; }
    toast('Venda cancelada; estoque devolvido.');
    m.remove(); modalVendas();
  });
  m.querySelectorAll('[data-a=devolver]').forEach(b => b.onclick = () => modalDevolucao(Number(b.closest('tr').dataset.id)));
  m.querySelectorAll('[data-a=trocar]').forEach(b => b.onclick = () => { m.remove(); modalTroca(Number(b.closest('tr').dataset.id)); });
  m.querySelector('#hist-dev')?.addEventListener('click', () => { m.remove(); modalHistoricoDevolucoes(); });
}

const FORMA_DEV = {
  dinheiro: 'Dinheiro', estorno: 'Estorno/cartão', vale: 'Vale-troca',
  troca: 'Troca (sem diferença)', nada: 'Troca (sem acerto)'
};

async function modalDevolucao(venda_id, aoFinalizar) {
  const info = await api('devolucoes:itensVenda', { venda_id });
  if (!info.ok) { toast(info.erro, true); return; }
  if (!info.itens.length) { toast('Não há itens disponíveis para devolução nesta venda.', true); return; }

  const linhas = info.itens.map(i => `
    <tr>
      <td><b>${esc(i.produto)}</b><br><small style="color:var(--texto-suave)">${esc(i.cor)} / ${esc(i.tamanho)}</small></td>
      <td class="num">${moeda(i.valor_unit)}</td>
      <td class="num">${i.disponivel}</td>
      <td><input data-vid="${i.variacao_id}" data-max="${i.disponivel}" type="number" min="0" max="${i.disponivel}" value="0"
        style="width:64px;padding:4px 6px;border:1px solid var(--borda);border-radius:6px"></td>
    </tr>`).join('');

  const m = modal(`Devolução — venda #${venda_id}`, `
    <table><thead><tr><th>Item</th><th class="num">Valor un.</th><th class="num">Disp.</th><th>Devolver</th></tr></thead>
      <tbody>${linhas}</tbody></table>
    <div class="linha-2" style="margin-top:12px">
      <div class="campo"><label>Reembolso</label>
        <select id="dv-forma">
          <option value="dinheiro">Dinheiro (sai do caixa)</option>
          <option value="estorno">Estorno / cartão (registro)</option>
          <option value="vale">Vale-troca / crédito (registro)</option>
        </select></div>
      <div class="campo"><label>Motivo</label><input id="dv-motivo" placeholder="Defeito, tamanho, arrependimento…"></div>
    </div>
    <div class="tot-total"><span>Total a devolver</span><b id="dv-total">R$ 0,00</b></div>
    <div class="erro" id="dv-erro"></div>
  `, async (mm, fechar) => {
    const itens = [...mm.querySelectorAll('input[data-vid]')]
      .map(inp => ({ variacao_id: Number(inp.dataset.vid), qtd: Number(inp.value) || 0 }))
      .filter(i => i.qtd > 0);
    if (!itens.length) { mm.querySelector('#dv-erro').textContent = 'Informe a quantidade a devolver.'; return; }
    const forma = mm.querySelector('#dv-forma').value;
    const motivo = mm.querySelector('#dv-motivo').value;
    const r = await api('devolucoes:registrar', { venda_id, itens, forma_reembolso: forma, motivo });
    if (!r.ok) { mm.querySelector('#dv-erro').textContent = r.erro; return; }
    fechar();
    toast('Devolução registrada.');
    if (r.vale) {
      modalValeEmitido(r.vale, 'Vale-troca emitido 🎫', {
        venda_id, cliente: info.venda?.cliente || null
      });
    }
    if (aoFinalizar) aoFinalizar();
    else await modalVendas();
  }, 'Confirmar devolução');

  // Quantidades digitáveis pelo teclado (antes só as setinhas funcionavam bem)
  m.querySelectorAll('input[data-vid]').forEach(inp => ligarCampoQtd(inp, {
    min: 0, max: Number(inp.dataset.max) || null
  }));

  // Atualizar total ao vivo
  m.addEventListener('input', () => {
    const total = [...m.querySelectorAll('input[data-vid]')]
      .reduce((s, inp) => s + (
        (Number(inp.value) || 0) *
        (info.itens.find(i => i.variacao_id === Number(inp.dataset.vid))?.valor_unit || 0)
      ), 0);
    m.querySelector('#dv-total').textContent = moeda(total);
  });
}

// ── Buscar a venda de origem da troca ────────────────────────────────────────
// Entrada pelo botão 🔄 Troca do PDV (F6). Começa no dia de hoje — o caso
// normal é a cliente voltar no mesmo dia de funcionamento — mas o período é
// editável para trocas de dias anteriores.
async function modalBuscarVendaTroca() {
  const hoje = new Date().toISOString().slice(0, 10);
  let ini = hoje, fim = hoje, termo = '';

  const m = modal('🔄 Troca — escolher a venda', `
    <div style="width:min(720px,92vw)">
      <p style="font-size:12px;color:var(--texto-suave);margin:0 0 10px">
        Localize a venda que originou a peça. Bipe o cupom, digite o número da venda
        ou o nome da cliente.
      </p>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">
        <div class="campo" style="margin:0;flex:0 0 auto">
          <label style="font-size:11px">De</label>
          <input type="date" id="bt-ini" value="${ini}" style="padding:5px 8px">
        </div>
        <div class="campo" style="margin:0;flex:0 0 auto">
          <label style="font-size:11px">Até</label>
          <input type="date" id="bt-fim" value="${fim}" style="padding:5px 8px">
        </div>
        <div class="campo" style="margin:0;flex:1;min-width:160px">
          <label style="font-size:11px">Nº da venda ou cliente</label>
          <input type="text" id="bt-termo" placeholder="Ex.: 148 ou Maria…" style="padding:5px 8px">
        </div>
        <button class="btn btn-suave" id="bt-buscar" style="flex:0 0 auto">Buscar</button>
      </div>
      <div style="overflow-x:auto;max-height:46vh">
        <table><thead><tr><th>#</th><th>Data/Hora</th><th>Cliente</th><th>Vendedor</th>
          <th class="num">Total</th><th>Status</th><th style="width:110px"></th></tr></thead>
          <tbody id="bt-tbody"></tbody></table>
      </div>
    </div>
  `, (_, fechar) => fechar(), 'Fechar');

  const tbody = m.querySelector('#bt-tbody');

  async function carregar() {
    tbody.innerHTML = '<tr><td colspan="7" class="vazio">Carregando…</td></tr>';
    const r = await api('pdv:listarVendasGeral', { data_inicio: ini, data_fim: fim, termo });
    const vendas = r.vendas || [];
    if (!vendas.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="vazio">Nenhuma venda no período. Amplie as datas ou revise a busca.</td></tr>';
      return;
    }
    tbody.innerHTML = vendas.map(v => {
      const dev = Number(v.total_devolvido) || 0;
      const podeTrocar = v.status === 'concluida' && dev < Number(v.total);
      return `
      <tr data-id="${v.id}">
        <td>#${v.id}</td>
        <td>${esc(v.criado_em ? v.criado_em.slice(0, 16).replace('T', ' ') : '—')}</td>
        <td>${esc(v.cliente || '—')}</td>
        <td>${esc(v.vendedor || '—')}</td>
        <td class="num"><b>${moeda(v.total)}</b></td>
        <td>${_pillVenda(v)}</td>
        <td class="acoes-linha">${podeTrocar
          ? '<button data-a="trocar" style="color:var(--vinho);font-weight:700">🔄 Trocar</button>'
          : '<span style="font-size:11px;color:var(--texto-suave)">—</span>'}</td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('[data-a=trocar]').forEach(b => b.onclick = () => {
      const id = Number(b.closest('tr').dataset.id);
      m.remove();
      modalTroca(id);
    });
  }

  m.querySelector('#bt-buscar').onclick = () => {
    ini = m.querySelector('#bt-ini').value || hoje;
    fim = m.querySelector('#bt-fim').value || hoje;
    termo = m.querySelector('#bt-termo').value.trim();
    carregar();
  };
  m.querySelector('#bt-termo').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); m.querySelector('#bt-buscar').click(); }
  });
  carregar();
  setTimeout(() => { try { m.querySelector('#bt-termo').focus(); } catch {} }, 60);
}

// ── Modal Troca ──────────────────────────────────────────────────────────────
// Painel split: esquerda = itens que voltaram; direita = itens que vão sair.
// Crédito da devolução abate o total novo.
//   novo > crédito → cliente paga a diferença
//   crédito > novo → o operador escolhe o destino do excedente
//                    (vale-troca · dinheiro · estorno no cartão · nada)
//   mesmo valor    → nada a acertar
async function modalTroca(venda_id, aoFinalizar) {
  const info = await api('devolucoes:itensVenda', { venda_id });
  if (!info.ok) { toast(info.erro, true); return; }
  if (!info.itens.length) { toast('Não há itens disponíveis para troca nesta venda.', true); return; }

  let carrinho = []; // [{ variacao_id, produto, cor, tamanho, preco_tabela, preco_unit, qtd }]
  const arredF = v => Math.round((Number(v)||0)*100)/100;

  // O desconto da compra original acompanha a troca (regra do Marcio, v3.2.1):
  // devolve-se o valor cheio e o MESMO percentual incide sobre a peça nova
  // inteira. Peça de R$100 paga R$90 → troca por uma de R$200: a nova sai por
  // R$180, o crédito é R$90, a cliente paga R$90. Trocando por outra de R$100
  // não há nada a acertar.
  // O backend é a fonte de verdade (core/trocas.js aplica o mesmo fator); aqui
  // só espelhamos para o operador ver o número antes de confirmar.
  const _subOrig = Number(info.venda?.subtotal) || 0;
  const _totOrig = Number(info.venda?.total) || 0;
  const fatorDesc = (_subOrig > 0 && _totOrig > 0) ? _totOrig / _subOrig : 1;
  const pctDesc = Math.round((1 - fatorDesc) * 10000) / 100;
  const temDesconto = pctDesc > 0.009;
  const comDesconto = precoTabela => arredF(precoTabela * fatorDesc);

  const linhasVoltou = info.itens.map(i => `
    <tr>
      <td style="font-size:12px"><b>${esc(i.produto)}</b><br>
        <span style="color:var(--texto-suave)">${esc(i.cor||'')} ${i.tamanho ? '/ '+esc(i.tamanho) : ''}</span></td>
      <td class="num" style="font-size:12px">${moeda(i.valor_unit)}</td>
      <td class="num" style="font-size:11px">${i.disponivel}</td>
      <td><input class="inp-dev" data-vid="${i.variacao_id}" data-vu="${i.valor_unit}" data-max="${i.disponivel}"
          type="number" min="0" max="${i.disponivel}" value="0"
          style="width:56px;padding:3px 5px;border:1px solid var(--borda);border-radius:5px;text-align:center"></td>
    </tr>`).join('');

  const m = modal(`🔄 Troca — venda #${venda_id}`, `
    <div style="width:min(780px,90vw)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;min-height:200px">

        <div>
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:var(--vinho)">↩️ O que voltou</div>
          <div style="overflow-x:auto">
          <table style="width:100%;font-size:12px">
            <thead><tr style="font-size:11px;color:var(--texto-suave)">
              <th style="text-align:left">Item</th><th class="num">Vl.un.</th><th class="num">Disp</th><th>Qty</th>
            </tr></thead>
            <tbody>${linhasVoltou}</tbody>
          </table>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:1px solid var(--borda)">
            <span style="font-size:12px;color:var(--texto-suave)">Crédito</span>
            <b id="tc-credito" style="color:var(--vinho)">R$ 0,00</b>
          </div>
        </div>

        <div>
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:var(--vinho)">🛍️ O que vai levar</div>
          ${temDesconto ? `<div style="background:#e8f5e9;border:1px solid var(--verde,#2e7d32);border-radius:6px;
            padding:6px 9px;margin-bottom:8px;font-size:11px;color:var(--verde,#2e7d32);font-weight:600">
            🏷️ A compra teve ${pctDesc.toFixed(pctDesc % 1 ? 2 : 0)}% de desconto — o mesmo desconto vale para a peça nova.
          </div>` : ''}
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <input id="tc-busca" type="text" placeholder="🔍 Produto, código ou ref…"
              style="flex:1;padding:6px 10px;border:1px solid var(--borda);border-radius:6px;font-size:12px">
          </div>
          <div id="tc-resultados" style="display:none;max-height:110px;overflow-y:auto;border:1px solid var(--borda);border-radius:6px;padding:4px;margin-bottom:8px;background:var(--fundo)"></div>
          <div id="tc-carrinho-vazio" style="font-size:12px;color:var(--texto-suave);padding:8px">Nenhum item adicionado.</div>
          <table id="tc-carrinho-tabela" style="width:100%;font-size:12px;display:none">
            <tbody id="tc-carrinho-body"></tbody>
          </table>
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--borda)">
            ${temDesconto ? `
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--texto-suave)">
              <span>Preço de tabela</span><span id="tc-bruto-novo">R$ 0,00</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--verde,#2e7d32)">
              <span>Desconto de ${pctDesc.toFixed(pctDesc % 1 ? 2 : 0)}% (da compra)</span>
              <span id="tc-desc-novo">−R$ 0,00</span>
            </div>` : ''}
            <div style="display:flex;justify-content:space-between">
              <span style="font-size:12px;color:var(--texto-suave)">Total novo</span>
              <b id="tc-total-novo">R$ 0,00</b>
            </div>
          </div>
        </div>
      </div>

      <div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:8px">
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px">
          <span>Diferença</span>
          <b id="tc-diferenca" style="font-size:16px">R$ 0,00</b>
        </div>
        <div id="tc-pag-panel" style="display:none">
          <div style="font-size:11px;color:var(--texto-suave);margin-bottom:6px">Cliente paga a diferença em:</div>
          <div class="linha-2">
            <div class="campo" style="margin:0"><label>Forma</label>
              <select id="tc-pag-forma">
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="debito">Cartão Débito</option>
                <option value="credito">Cartão Crédito</option>
              </select>
            </div>
            <div class="campo" style="margin:0"><label>Valor (R$)</label>
              <input id="tc-pag-valor" type="number" min="0" step="0.01" value="0">
            </div>
          </div>
        </div>
        <div id="tc-exced-panel" style="display:none;margin-top:4px">
          <div id="tc-excedente-msg" style="color:var(--verde,#16a34a);font-size:12px;margin-bottom:6px"></div>
          <div style="font-size:11px;color:var(--texto-suave);margin-bottom:4px">O que fazer com a diferença a favor da cliente?</div>
          <div class="campo" style="margin:0">
            <select id="tc-exced-destino">
              <option value="vale">🎫 Vale-troca (crédito para usar depois)</option>
              <option value="dinheiro">💵 Devolver em dinheiro (sai do caixa)</option>
              <option value="estorno">💳 Estornar no cartão (registro)</option>
              <option value="nada">— Nada (cliente abre mão da diferença)</option>
            </select>
          </div>
          <div id="tc-exced-obs" style="font-size:11px;color:var(--texto-suave);margin-top:4px"></div>
        </div>
        <div id="tc-igual-msg" style="display:none;font-size:12px;color:var(--texto-suave);margin-top:4px">
          ✅ Mesmo valor — nada a acertar. É só confirmar a troca.
        </div>
        <div class="campo" style="margin:8px 0 0">
          <label>Motivo (opcional)</label>
          <input id="tc-motivo" placeholder="Tamanho, cor, defeito…" style="font-size:12px">
        </div>
      </div>
      <div class="erro" id="tc-erro" style="margin-top:8px"></div>
    </div>
  `, async (mm, fechar) => {
    const itensDevolver = [...mm.querySelectorAll('.inp-dev')]
      .map(inp => ({ variacao_id: Number(inp.dataset.vid), qtd: Number(inp.value)||0 }))
      .filter(i => i.qtd > 0);
    if (!itensDevolver.length) { mm.querySelector('#tc-erro').textContent = 'Informe os itens que voltaram.'; return; }
    if (!carrinho.length) { mm.querySelector('#tc-erro').textContent = 'Adicione pelo menos um item para o cliente levar.'; return; }

    const credito = _calcCredito(mm);
    const totalNovo = carrinho.reduce((s, i) => s + arredF(i.preco_unit * i.qtd), 0);
    const diferenca = arredF(totalNovo - credito);

    const pagamentosExtra = [];
    if (diferenca > 0.01) {
      const forma = mm.querySelector('#tc-pag-forma').value;
      const valor = Number(mm.querySelector('#tc-pag-valor').value)||0;
      if (valor < diferenca - 0.01) {
        mm.querySelector('#tc-erro').textContent = `Valor insuficiente (falta ${moeda(diferenca - valor)}).`; return;
      }
      pagamentosExtra.push({ forma, valor });
    }

    const r = await api('trocas:registrar', {
      venda_id,
      itens_devolver: itensDevolver,
      // preco_unit vai SEMPRE como preço de tabela; quem aplica o desconto
      // herdado é o core/trocas.js (fonte de verdade única).
      itens_novo: carrinho.map(i => ({ variacao_id: i.variacao_id, qtd: i.qtd, preco_unit: i.preco_tabela })),
      pagamentos_extra: pagamentosExtra,
      destino_excedente: diferenca < -0.01
        ? (mm.querySelector('#tc-exced-destino')?.value || 'vale')
        : null,
      motivo: mm.querySelector('#tc-motivo').value || 'Troca'
    });
    if (!r.ok) { mm.querySelector('#tc-erro').textContent = r.erro; return; }

    fechar();
    const sufixoVenda = r.venda_nova_id ? ` Nova venda #${r.venda_nova_id}.` : '';
    if (r.vale) {
      // imprime o vale na térmica em vez de mandar a cliente anotar (v3.6.0)
      modalValeEmitido(r.vale, 'Vale-troca gerado 🎫', {
        venda_id, cliente: info.venda?.cliente || null
      });
    } else if (r.destino_excedente === 'dinheiro') {
      toast(`Troca registrada. Devolva ${moeda(r.excedente)} em dinheiro à cliente (saiu do caixa).${sufixoVenda}`);
    } else if (r.destino_excedente === 'estorno') {
      toast(`Troca registrada. Faça o estorno de ${moeda(r.excedente)} na maquininha.${sufixoVenda}`);
    } else if (r.destino_excedente === 'nada') {
      toast(`Troca registrada sem acerto da diferença de ${moeda(r.excedente)}.${sufixoVenda}`);
    } else {
      toast(`Troca registrada!${sufixoVenda}`);
    }
    if (aoFinalizar) aoFinalizar();
  }, 'Confirmar troca');

  function _calcCredito(mm) {
    return info.itens.reduce((s, it) => {
      const inp = mm.querySelector(`.inp-dev[data-vid="${it.variacao_id}"]`);
      return s + arredF((Number(inp?.value)||0) * it.valor_unit);
    }, 0);
  }

  // Recalcula os números SEM redesenhar o carrinho — usado pelos campos de
  // quantidade, que seriam destruídos (com o cursor dentro) a cada tecla.
  function _atualizarTotais() { _recalcular(); _renderCarrinho(); }

  function _recalcular() {
    const credito = _calcCredito(m);
    const brutoNovo = carrinho.reduce((s, i) => s + arredF(i.preco_tabela * i.qtd), 0);
    const totalNovo = carrinho.reduce((s, i) => s + arredF(i.preco_unit * i.qtd), 0);
    const diferenca = arredF(totalNovo - credito);
    m.querySelector('#tc-credito').textContent = moeda(credito);
    m.querySelector('#tc-total-novo').textContent = moeda(totalNovo);
    const $bruto = m.querySelector('#tc-bruto-novo');
    const $desc = m.querySelector('#tc-desc-novo');
    if ($bruto) $bruto.textContent = moeda(brutoNovo);
    if ($desc) $desc.textContent = '−' + moeda(arredF(brutoNovo - totalNovo));
    const dEl = m.querySelector('#tc-diferenca');
    const pagPanel = m.querySelector('#tc-pag-panel');
    const excPanel = m.querySelector('#tc-exced-panel');
    const igualMsg = m.querySelector('#tc-igual-msg');

    if (diferenca > 0.01) {
      // Cliente leva mais do que devolveu → paga a diferença
      dEl.textContent = moeda(diferenca);
      dEl.style.color = 'var(--vermelho,#dc2626)';
      pagPanel.style.display = '';
      excPanel.style.display = 'none';
      igualMsg.style.display = 'none';
      const iv = m.querySelector('#tc-pag-valor');
      if (iv) iv.value = diferenca.toFixed(2);
    } else if (diferenca < -0.01) {
      // Devolveu mais do que levou → escolher o destino do excedente
      dEl.textContent = moeda(-diferenca) + ' a favor';
      dEl.style.color = 'var(--verde,#16a34a)';
      pagPanel.style.display = 'none';
      igualMsg.style.display = 'none';
      excPanel.style.display = '';
      m.querySelector('#tc-excedente-msg').textContent =
        `Sobram ${moeda(-diferenca)} a favor da cliente.`;
      _explicarDestino(-diferenca);
    } else {
      // Mesmo valor → nada a acertar
      dEl.textContent = 'R$ 0,00';
      dEl.style.color = '';
      pagPanel.style.display = 'none';
      excPanel.style.display = 'none';
      igualMsg.style.display = '';
    }
  }

  function _explicarDestino(valor) {
    const sel = m.querySelector('#tc-exced-destino');
    const obs = m.querySelector('#tc-exced-obs');
    if (!sel || !obs) return;
    const textos = {
      vale:     `Gera um código de vale-troca de ${moeda(valor)} com validade, para a cliente usar numa próxima compra.`,
      dinheiro: `Sai ${moeda(valor)} da gaveta do caixa agora (entra como sangria no fechamento).`,
      estorno:  `Registra o estorno de ${moeda(valor)}. O estorno em si você faz na maquininha — o caixa não é movimentado.`,
      nada:     `A troca é fechada sem devolver os ${moeda(valor)}. A diferença fica com a loja.`
    };
    obs.textContent = textos[sel.value] || '';
  }

  function _renderCarrinho() {
    const vazio = m.querySelector('#tc-carrinho-vazio');
    const tabela = m.querySelector('#tc-carrinho-tabela');
    const body = m.querySelector('#tc-carrinho-body');
    if (!carrinho.length) { vazio.style.display = ''; tabela.style.display = 'none'; return; }
    vazio.style.display = 'none'; tabela.style.display = '';
    body.innerHTML = carrinho.map((it, idx) => `
      <tr>
        <td style="font-size:11px"><b>${esc(it.produto)}</b> ${esc(it.cor||'')} ${it.tamanho ? esc(it.tamanho) : ''}</td>
        <td class="num" style="font-size:11px">${temDesconto
          ? `<span style="text-decoration:line-through;color:var(--texto-suave);font-size:10px">${moeda(it.preco_tabela)}</span>
             <b style="color:var(--verde,#2e7d32)">${moeda(it.preco_unit)}</b>`
          : moeda(it.preco_unit)}</td>
        <td><input class="inp-carr" data-idx="${idx}" type="number" min="1" value="${it.qtd}"
          style="width:46px;padding:2px 4px;border:1px solid var(--borda);border-radius:4px;text-align:center"></td>
        <td class="num carr-total" style="font-size:11px;font-weight:700">${moeda(it.preco_unit * it.qtd)}</td>
        <td><button class="btn-rm" data-idx="${idx}"
          style="background:none;border:none;cursor:pointer;color:var(--vermelho,#dc2626);font-size:14px">✕</button></td>
      </tr>`).join('');
    // Quantidade do carrinho: digitável. Só recalcula os totais — redesenhar o
    // carrinho aqui apagaria o campo no meio da digitação.
    body.querySelectorAll('.inp-carr').forEach(inp => {
      const it = carrinho[Number(inp.dataset.idx)];
      const $tot = inp.closest('tr').querySelector('.carr-total');
      ligarCampoQtd(inp, {
        min: 1,
        aoDigitar: v => {
          if (v === null || v < 1) return;
          it.qtd = v;
          if ($tot) $tot.textContent = moeda(it.preco_unit * it.qtd);
          _recalcular();
        },
        aoConfirmar: v => {
          it.qtd = v;
          if ($tot) $tot.textContent = moeda(it.preco_unit * it.qtd);
          _recalcular();
        }
      });
    });
    body.querySelectorAll('.btn-rm').forEach(btn => btn.addEventListener('click', () => {
      carrinho.splice(Number(btn.dataset.idx), 1); _atualizarTotais();
    }));
  }

  // Busca de produtos (lado direito)
  let _t;
  const buscaInp = m.querySelector('#tc-busca');
  const resultados = m.querySelector('#tc-resultados');
  buscaInp.addEventListener('input', () => {
    clearTimeout(_t);
    const termo = buscaInp.value.trim();
    if (!termo) { resultados.style.display = 'none'; return; }
    _t = setTimeout(async () => {
      const r = await api('estoque:buscar', { termo });
      if (!r.ok || !r.variacoes?.length) {
        resultados.style.display = 'block';
        resultados.innerHTML = '<div style="padding:6px;font-size:11px;color:var(--texto-suave)">Nenhum produto encontrado.</div>';
        return;
      }
      resultados.style.display = 'block';
      resultados.innerHTML = r.variacoes.slice(0,10).map(v => {
        const label = `${esc(v.produto)} ${v.cor && v.cor!=='Única' ? esc(v.cor) : ''} ${v.tamanho && v.tamanho!=='U' ? esc(v.tamanho) : ''}`.trim();
        return `<div class="tc-ri" data-vid="${v.id}" data-nome="${esc(v.produto)}" data-cor="${esc(v.cor||'')}"
          data-tam="${esc(v.tamanho||'')}" data-preco="${v.preco_venda}" data-est="${v.estoque}"
          style="padding:5px 7px;cursor:pointer;border-radius:4px;font-size:11px;display:flex;justify-content:space-between;align-items:center">
          <span>${label} <span style="color:var(--texto-suave)">(est:${v.estoque})</span></span>
          <b style="color:var(--vinho)">${moeda(v.preco_venda)}</b>
        </div>`;
      }).join('');
      resultados.querySelectorAll('.tc-ri').forEach(div => {
        div.addEventListener('mouseenter', () => div.style.background = 'var(--fundo-hover,#f3f4f6)');
        div.addEventListener('mouseleave', () => div.style.background = '');
        div.addEventListener('click', () => {
          const vid = Number(div.dataset.vid);
          const ex = carrinho.find(i => i.variacao_id === vid);
          if (ex) { ex.qtd++; }
          else {
            const tabela = Number(div.dataset.preco);
            carrinho.push({ variacao_id: vid, produto: div.dataset.nome, cor: div.dataset.cor,
              tamanho: div.dataset.tam,
              preco_tabela: tabela,          // o que vai para o backend
              preco_unit: comDesconto(tabela), // com o desconto herdado, só para exibir
              qtd: 1 });
          }
          buscaInp.value = ''; resultados.style.display = 'none';
          _atualizarTotais();
        });
      });
    }, 300);
  });

  // Quantidades do lado esquerdo (o que voltou): digitáveis pelo teclado.
  // Usam _recalcular() e NÃO _atualizarTotais(): mexer aqui não muda o que há no
  // carrinho da direita, e redesenhá-lo destruiria o campo que o operador acabou
  // de clicar (o blur deste campo dispara antes do foco chegar no outro).
  m.querySelectorAll('.inp-dev').forEach(inp => ligarCampoQtd(inp, {
    min: 0,
    max: Number(inp.dataset.max) || null,
    aoDigitar: () => _recalcular(),
    aoConfirmar: () => _recalcular(),
    aoLimitar: (pedido, teto) =>
      toast(`Só é possível devolver ${teto} un. desta peça (pediu ${pedido}).`, true)
  }));

  // Explicação do destino do excedente muda junto com a escolha
  m.querySelector('#tc-exced-destino')?.addEventListener('change', () => {
    const credito = _calcCredito(m);
    const totalNovo = carrinho.reduce((s, i) => s + arredF(i.preco_unit * i.qtd), 0);
    _explicarDestino(arredF(credito - totalNovo));
  });
}

async function modalHistoricoDevolucoes() {
  const r = await api('devolucoes:listar');
  if (!r.ok) { toast(r.erro, true); return; }
  const linhas = (r.devolucoes || []).map(d => `
    <tr>
      <td>#${d.id}</td>
      <td>#${d.venda_id}</td>
      <td>${esc((d.criado_em || '').slice(0, 16))}</td>
      <td>${esc(d.cliente || '—')}</td>
      <td class="num">${d.pecas}</td>
      <td>${esc(FORMA_DEV[d.forma_reembolso] || d.forma_reembolso)}</td>
      <td class="num"><b>${moeda(d.valor_devolvido)}</b></td>
      <td>${esc(d.motivo || '—')}</td>
    </tr>`).join('');
  modal('Histórico de devoluções ↩️', `
    <table><thead><tr><th>#</th><th>Venda</th><th>Data</th><th>Cliente</th>
      <th class="num">Peças</th><th>Reembolso</th><th class="num">Valor</th><th>Motivo</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="8" class="vazio">Nenhuma devolução registrada.</td></tr>'}</tbody></table>
  `, (_, f) => f(), 'Fechar');
}


async function modalHistoricoVendas() {
  const hoje = new Date().toISOString().slice(0,10);
  const inicio30 = new Date(Date.now() - 30*24*3600*1000).toISOString().slice(0,10);
  let filtroIni = inicio30, filtroFim = hoje, filtroTermo = '';

  async function carregarTabela(container) {
    container.innerHTML = '<tr><td colspan="8" class="vazio">Carregando…</td></tr>';
    const r = await api('pdv:listarVendasGeral', { data_inicio: filtroIni, data_fim: filtroFim, termo: filtroTermo });
    const vendas = (r.vendas || []);
    if (!vendas.length) {
      container.innerHTML = '<tr><td colspan="8" class="vazio">Nenhuma venda encontrada.</td></tr>';
      return;
    }
    container.innerHTML = vendas.map(v => {
      const dev = Number(v.total_devolvido) || 0;
      const podeDevolver = v.status === 'concluida' && dev < Number(v.total);
      return `
      <tr data-id="${v.id}">
        <td>#${v.id}</td>
        <td>${esc(v.criado_em ? v.criado_em.slice(0,16).replace('T',' ') : '—')}</td>
        <td>${esc(v.cliente || '—')}</td>
        <td>${esc(v.vendedor || '—')}</td>
        <td>${esc(v.formas || '')}</td>
        <td class="num"><b>${moeda(v.total)}</b></td>
        <td>${_pillVenda(v)}</td>
        <td class="acoes-linha">
          <button data-a="cupom">🖨️ Reimprimir</button>
          ${podeDevolver && pode('pdv.devolucao') ? '<button data-a="devolver">↩️ Devolver</button>' : ''}
          ${podeDevolver && pode('pdv.ver') ? '<button data-a="trocar" style="color:var(--vinho)">🔄 Troca</button>' : ''}
        </td>
      </tr>`;
    }).join('');
    container.querySelectorAll('[data-a=cupom]').forEach(b => b.onclick = async () => {
      const d = await api('pdv:obterVenda', { id: Number(b.closest('tr').dataset.id) });
      if (d.ok) imprimirCupom(d);
      else toast(d.erro || 'Erro ao carregar venda.', true);
    });
    container.querySelectorAll('[data-a=devolver]').forEach(b => b.onclick = () => {
      const id = Number(b.closest('tr').dataset.id);
      modalDevolucao(id, () => carregarTabela(container));
    });
    container.querySelectorAll('[data-a=trocar]').forEach(b => b.onclick = () => {
      const id = Number(b.closest('tr').dataset.id);
      modalTroca(id, () => carregarTabela(container));
    });
  }

  const m = modal('Histórico de vendas', `
    <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">
      <div class="campo" style="margin:0;flex:0 0 auto">
        <label style="font-size:11px">De</label>
        <input type="date" id="hv-ini" value="${filtroIni}" style="padding:5px 8px">
      </div>
      <div class="campo" style="margin:0;flex:0 0 auto">
        <label style="font-size:11px">Até</label>
        <input type="date" id="hv-fim" value="${filtroFim}" style="padding:5px 8px">
      </div>
      <div class="campo" style="margin:0;flex:1;min-width:140px">
        <label style="font-size:11px">Cliente ou nº da venda</label>
        <input type="text" id="hv-termo" placeholder="Filtrar…" style="padding:5px 8px">
      </div>
      <button class="btn btn-suave" id="hv-buscar" style="flex:0 0 auto">Buscar</button>
    </div>
    <div style="overflow-x:auto">
      <table><thead><tr><th>#</th><th>Data/Hora</th><th>Cliente</th><th>Vendedor</th><th>Formas</th>
        <th class="num">Total</th><th>Status</th><th style="width:190px"></th></tr></thead>
        <tbody id="hv-tbody"></tbody></table>
    </div>
  `, (m, fechar) => fechar(), 'Fechar');

  const tbody = m.querySelector('#hv-tbody');
  carregarTabela(tbody);

  m.querySelector('#hv-buscar').onclick = () => {
    filtroIni   = m.querySelector('#hv-ini').value;
    filtroFim   = m.querySelector('#hv-fim').value;
    filtroTermo = m.querySelector('#hv-termo').value.trim();
    carregarTabela(tbody);
  };
  m.querySelector('#hv-termo').addEventListener('keydown', e => {
    if (e.key === 'Enter') m.querySelector('#hv-buscar').click();
  });
}

export { viewPdv, imprimirVale, modalValeEmitido };