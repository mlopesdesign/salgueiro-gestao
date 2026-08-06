// PDV — frente de caixa
import { api, el, esc, moeda, toast, modal, getConfig, pode, podeVerTela, setorAtivo, EM_REDE } from './app.js';

// Formas de pagamento disponíveis (respeita setores desligados pelo Dev)
const formasDisponiveis = () => FORMAS.filter(([v]) =>
  (v !== 'crediario' || setorAtivo('crediario')) && (v !== 'vale' || setorAtivo('vales')));

let itens = [];        // itens da venda em andamento
let cliente = null;    // cliente selecionado
let refresco = null;   // função para redesenhar a tela

const FORMAS = [
  ['dinheiro', 'Dinheiro'], ['pix', 'PIX'], ['debito', 'Cartão Débito'],
  ['credito', 'Cartão Crédito'], ['crediario', 'Crediário'], ['vale', 'Vale-troca']
];
const nomeForma = (f) => (FORMAS.find(x => x[0] === f) || [f, f])[1];

export function calcResgateLocal(cfg, pts) {
  if (!cfg.ativo || pts < cfg.minimo_resgate) return 0;
  return Math.floor(pts / cfg.minimo_resgate) * cfg.valor_resgate;
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
          <button class="btn btn-suave" id="b-vendas">Vendas do caixa</button>
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
        <td><input data-c="qtd" type="number" min="1" value="${i.qtd}"
          style="width:56px;padding:4px 6px;border:1px solid var(--borda);border-radius:6px"></td>
        <td class="num">${moeda(i.preco_unit)}</td>
        ${pode('pdv.desconto') ? `<td><input data-c="desconto" type="number" min="0" step="0.01" value="${i.desconto}"
          style="width:76px;padding:4px 6px;border:1px solid var(--borda);border-radius:6px"></td>` : ''}
        <td class="num"><b>${moeda(i.qtd * i.preco_unit - i.desconto)}</b></td>
        <td class="acoes-linha"><button style="color:var(--vermelho)">✕</button></td>
      </tr>`);
      tr.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
        i[inp.dataset.c] = Math.max(0, Number(inp.value) || 0);
        if (i.qtd < 1) i.qtd = 1;
        desenhar();
      }));
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
  tela.querySelector('#t-desc')?.addEventListener('input', totais);
  tela.querySelector('#t-desc-modo')?.addEventListener('click', () => {
    const $m = tela.querySelector('#t-desc-modo');
    $m.textContent = $m.textContent === 'R$' ? '%' : 'R$';
    tela.querySelector('#t-desc').value = '0';
    tela.querySelector('#t-desc').focus();
    totais();
  });

  // cliente
  tela.querySelector('#pdv-cliente').onclick = () =>
    escolherCliente(async c => {
      cliente = c;
      tela._pontosResgate = null;
      tela.querySelector('#pdv-cliente').textContent =
        c ? `👤 ${c.nome} — trocar (F4)` : 'Consumidor final — trocar (F4)';
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
              totais();
              toast(`🎁 ${pts} pontos aplicados: −${moeda(desc)} no total.`);
            });
          }
        } else { $pp.style.display = 'none'; }
      } else { $pp.style.display = 'none'; }
    });

  // finalizar
  tela.querySelector('#pdv-finalizar').onclick = () => {
    if (!itens.length) { toast('A venda está vazia.', true); return; }
    modalPagamento(totais().total, totais().desc, tela._pontosResgate || null, () => { alvo.innerHTML = ''; viewPdv(alvo); });
  };

  // caixa
  tela.querySelector('#b-sangria')?.addEventListener('click', () => modalMovCaixa('sangria'));
  tela.querySelector('#b-supr')?.addEventListener('click', () => modalMovCaixa('suprimento'));
  tela.querySelector('#b-fechar')?.addEventListener('click', () => modalFechamento(caixa, () => { alvo.innerHTML = ''; viewPdv(alvo); }));
  tela.querySelector('#b-vendas').onclick = () => modalVendas();
  tela.querySelector('#b-consulta').onclick = consultarPreco;

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
      s.onclick = () => { aoEscolher({ id: c.id, nome: c.nome }); m.remove(); };
      $lista.appendChild(s);
    }
  }
  let deb;
  m.querySelector('#cl-busca').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(busca, 250); });
  busca();
}

// ---------- Pagamento ----------
function modalPagamento(total, descontoGeral, pontosResgate, aoConcluir) {
  const pagamentos = [{ forma: 'dinheiro', valor: total, parcelas: 1 }];

  const m = modal(`Pagamento — total ${moeda(total)}`, `
    <div id="pg-linhas"></div>
    <button class="btn btn-suave" id="pg-add" type="button">+ Adicionar forma de pagamento</button>
    <div class="tot-linha" style="margin-top:14px"><span>Pago</span><b id="pg-pago">R$ 0,00</b></div>
    <div class="tot-linha"><span id="pg-rotulo">Troco</span><b id="pg-troco">R$ 0,00</b></div>
    <div class="erro" id="pg-erro"></div>
  `, async (m, fechar) => {
    const r = await api('pdv:venda', {
      itens: itens.map(i => ({ variacao_id: i.variacao_id, qtd: i.qtd, preco_unit: i.preco_unit, desconto: i.desconto })),
      desconto: descontoGeral,
      cliente_id: cliente ? cliente.id : null,
      pontos_resgatar: pontosResgate ? pontosResgate.pontos : 0,
      pagamentos: pagamentos.map(pg => ({
        forma: pg.forma, valor: pg.valor, parcelas: pg.parcelas,
        ...(pg.forma === 'vale' ? { codigo_vale: (pg.codigo_vale || '').trim().toUpperCase() } : {})
      }))
    });
    if (!r.ok) { m.querySelector('#pg-erro').textContent = r.erro; return; }
    fechar();
    if (r.pontos_ganhos > 0) setTimeout(() => toast(`🎁 +${r.pontos_ganhos} pontos ganhos!`), 400);
    modalCupom(r);
    aoConcluir();
  }, 'Confirmar venda');

  const $linhas = m.querySelector('#pg-linhas');
  function desenhar() {
    $linhas.innerHTML = '';
    pagamentos.forEach((pg, idx) => {
      const isVale = pg.forma === 'vale';
      const linha = el(`<div class="linha-3" style="align-items:end;margin-bottom:8px">
        <div class="campo" style="margin:0"><label>Forma</label>
          <select data-c="forma">${formasDisponiveis().map(([v, n]) =>
            `<option value="${v}" ${pg.forma === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="campo" style="margin:0"><label>Valor (R$)</label>
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
        if (c.dataset.c === 'codigo_vale') return; // tratado no blur
        pg[c.dataset.c] = Number(c.value);
        desenhar();
      }));
      // consulta saldo do vale ao sair do campo de código
      if (isVale) {
        const inpCod = linha.querySelector('[data-c="codigo_vale"]');
        const spanSaldo = linha.querySelector('.saldo-vale');
        inpCod.addEventListener('blur', async () => {
          const cod = inpCod.value.trim().toUpperCase();
          pg.codigo_vale = cod;
          if (!cod) { spanSaldo.textContent = ''; return; }
          const rv = await api('vales_troca:consultar', { codigo: cod });
          if (!rv.ok) {
            spanSaldo.textContent = rv.erro;
            spanSaldo.style.color = 'var(--vermelho)';
            return;
          }
          spanSaldo.textContent = `saldo: ${moeda(rv.vale.saldo)}`;
          spanSaldo.style.color = 'var(--verde)';
          // limitar o valor ao saldo disponível
          if ((pg.valor || 0) > rv.vale.saldo) {
            pg.valor = rv.vale.saldo;
            linha.querySelector('[data-c="valor"]').value = rv.vale.saldo;
            desenhar();
          }
        });
      }
      linha.querySelector('[data-a=rm]').onclick = () => { pagamentos.splice(idx, 1); desenhar(); };
      $linhas.appendChild(linha);
    });
    const pago = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    m.querySelector('#pg-pago').textContent = moeda(pago);
    const dif = pago - total;
    m.querySelector('#pg-rotulo').textContent = dif >= 0 ? 'Troco' : 'Falta';
    m.querySelector('#pg-troco').textContent = moeda(Math.abs(dif));
    m.querySelector('#pg-troco').style.color = dif >= 0 ? 'var(--verde)' : 'var(--vermelho)';
    if (pagamentos.some(p => p.forma === 'crediario') && !cliente) {
      m.querySelector('#pg-erro').textContent = 'Crediário exige cliente identificado (feche e use F4).';
    } else m.querySelector('#pg-erro').textContent = '';
  }
  m.querySelector('#pg-add').onclick = () => {
    const pago = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    pagamentos.push({ forma: 'pix', valor: Math.max(0, total - pago), parcelas: 1 });
    desenhar();
  };
  desenhar();
}

// ---------- Cupom ----------
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
        ${cfg.logo ? `<img src="${cfg.logo}" style="width:26mm;max-height:20mm;object-fit:contain"><br>` : ''}
        <b>${esc((cfg.loja_nome || 'MINHA LOJA').toUpperCase())}</b>
        ${infoLoja ? `<br><span style="font-size:9px">${infoLoja}</span>` : ''}<br>Comprovante de venda (não fiscal)</div>
      <div class="c-sep"></div>
      Venda #${d.venda.id} · ${esc(d.venda.criado_em)}<br>
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

  modal('Fechar caixa', `
    <div class="tot-linha"><span>Abertura</span><b>${moeda(r.caixa.valor_abertura)}</b></div>
    ${formasHtml || '<p style="color:var(--texto-suave)">Nenhuma venda neste caixa.</p>'}
    <div class="tot-linha"><span>Suprimentos</span><b>${moeda(r.suprimentos)}</b></div>
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

async function modalVendas() {
  const r = await api('pdv:listarVendas', {});
  const linhas = (r.vendas || []).map(v => `
    <tr data-id="${v.id}">
      <td>#${v.id}</td><td>${esc(v.criado_em)}</td><td>${esc(v.cliente || '—')}</td>
      <td>${esc(v.formas || '')}</td>
      <td class="num"><b>${moeda(v.total)}</b></td>
      <td>${v.status === 'cancelada' ? '<span class="pill pill-baixo">cancelada</span>' : '<span class="pill pill-ok">ok</span>'}</td>
      <td class="acoes-linha">
        ${v.status === 'concluida' ? '<button data-a="cupom">Cupom</button>' + (pode('pdv.devolucao') ? '<button data-a="devolver">Devolver</button>' : '') + (pode('pdv.cancelar') ? '<button data-a="cancelar" style="color:var(--vermelho)">Cancelar</button>' : '') : ''}
      </td>
    </tr>`).join('');

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
  m.querySelector('#hist-dev')?.addEventListener('click', () => { m.remove(); modalHistoricoDevolucoes(); });
}

const FORMA_DEV = { dinheiro: 'Dinheiro', estorno: 'Estorno/cartão', vale: 'Vale-troca' };

async function modalDevolucao(venda_id) {
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
      const slip = modal('Vale-troca emitido 🎫', `
        <div style="text-align:center;padding:12px">
          <p style="font-size:13px;color:var(--texto-suave);margin:0 0 8px">Guarde o código abaixo</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:4px;color:var(--vinho)">${esc(r.vale.codigo)}</div>
          <p style="margin:8px 0 0">Valor: <b>${moeda(r.vale.valor_total)}</b></p>
        </div>
      `, (_, f) => f(), 'Fechar');
    }
    await modalVendas();
  }, 'Confirmar devolução');

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

export { viewPdv };