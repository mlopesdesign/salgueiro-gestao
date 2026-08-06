// Fornecedores + Compras
import { api, el, esc, moeda, toast, modal } from './app.js';

export async function viewCompras(alvo) {
  const tela = el(`
    <div>
      <div class="pagina-topo"><h1>Compras</h1>
        <div style="display:flex;gap:8px">
          <button class="btn btn-suave" id="novo-forn">+ Fornecedor</button>
          <button class="btn btn-primario" id="nova-compra">+ Nova compra</button>
        </div></div>
      <div class="abas">
        <button data-aba="compras" class="ativa">Compras</button>
        <button data-aba="fornecedores">Fornecedores</button>
      </div>
      <div id="aba-conteudo"></div>
    </div>`);
  const corpo = tela.querySelector('#aba-conteudo');
  const abas = { compras: abaCompras, fornecedores: abaFornecedores };
  tela.querySelectorAll('.abas button').forEach(b => {
    b.onclick = () => {
      tela.querySelectorAll('.abas button').forEach(x => x.classList.toggle('ativa', x === b));
      corpo.innerHTML = ''; abas[b.dataset.aba](corpo);
    };
  });
  tela.querySelector('#novo-forn').onclick = () => formFornecedor(null, () => { corpo.innerHTML = ''; abaFornecedores(corpo); });
  tela.querySelector('#nova-compra').onclick = () => formCompra(() => { corpo.innerHTML = ''; abaCompras(corpo); });
  alvo.appendChild(tela);
  abaCompras(corpo);
}

// ---------- Compras ----------
async function abaCompras(corpo) {
  const r = await api('compras:listar');
  const painel = el(`
    <div class="painel"><table>
      <thead><tr><th>#</th><th>Data</th><th>Fornecedor</th><th>NF</th>
        <th class="num">Itens</th><th class="num">Total</th><th></th><th style="width:180px"></th></tr></thead>
      <tbody></tbody></table></div>`);
  const tbody = painel.querySelector('tbody');
  const pill = { pendente: '<span class="pill" style="background:#FCF3E3;color:#9A6B15">pendente</span>',
                 recebida: '<span class="pill pill-ok">recebida</span>',
                 cancelada: '<span class="pill pill-baixo">cancelada</span>' };
  const lista = r.ok ? r.compras : [];
  if (!lista.length) tbody.appendChild(el(`<tr><td colspan="8" class="vazio">Nenhuma compra registrada.</td></tr>`));
  for (const c of lista) {
    const tr = el(`<tr>
      <td>#${c.id}</td><td>${esc(c.criado_em)}</td><td>${esc(c.fornecedor || '—')}</td>
      <td>${esc(c.numero_nf || '—')}</td><td class="num">${c.qtd_itens}</td>
      <td class="num"><b>${moeda(c.total)}</b></td><td>${pill[c.status] || esc(c.status)}</td>
      <td class="acoes-linha">
        <button data-a="ver">Ver</button>
        ${c.status === 'pendente' ? `<button data-a="receber" style="color:var(--verde)">Receber</button>
          <button data-a="cancelar" style="color:var(--vermelho)">✕</button>` : ''}
      </td></tr>`);
    tr.querySelector('[data-a=ver]').onclick = () => modalVerCompra(c.id);
    const rec = tr.querySelector('[data-a=receber]');
    if (rec) rec.onclick = () => modalReceber(c, () => { corpo.innerHTML = ''; abaCompras(corpo); });
    const canc = tr.querySelector('[data-a=cancelar]');
    if (canc) canc.onclick = async () => {
      if (!confirm(`Cancelar a compra #${c.id}?`)) return;
      const r2 = await api('compras:cancelar', { id: c.id });
      r2.ok ? (toast('Compra cancelada.'), corpo.innerHTML = '', abaCompras(corpo)) : toast(r2.erro, true);
    };
    tbody.appendChild(tr);
  }
  corpo.appendChild(painel);
}

async function modalVerCompra(id) {
  const d = await api('compras:obter', { id });
  if (!d.ok) { toast(d.erro, true); return; }
  const linhas = d.itens.map(i => `
    <tr><td>${esc(i.produto)} — ${esc(i.cor)}/${esc(i.tamanho)}</td>
      <td class="num">${i.qtd}</td><td class="num">${moeda(i.custo_unit)}</td>
      <td class="num"><b>${moeda(i.qtd * i.custo_unit)}</b></td></tr>`).join('');
  modal(`Compra #${id} — ${esc(d.compra.fornecedor || 'sem fornecedor')}`, `
    <table><thead><tr><th>Item</th><th class="num">Qtd</th><th class="num">Custo</th><th class="num">Total</th></tr></thead>
      <tbody>${linhas}</tbody></table>
    <div class="tot-total"><span>Total</span><b>${moeda(d.compra.total)}</b></div>
  `, (m, fechar) => fechar(), 'Fechar');
}

function modalReceber(c, aoConcluir) {
  modal(`Receber compra #${c.id}`, `
    <p style="margin-bottom:12px">Ao receber, as peças <b>entram no estoque</b> (com custo médio atualizado)
      e é gerada uma <b>conta a pagar de ${moeda(c.total)}</b> no Financeiro.</p>
    <div class="campo" style="max-width:220px"><label>Vencimento do pagamento</label>
      <input id="rc-venc" type="date"></div>
  `, async (m, fechar) => {
    const r = await api('compras:receber', { id: c.id, vencimento: m.querySelector('#rc-venc').value || null });
    if (!r.ok) { toast(r.erro, true); return; }
    toast('Mercadoria recebida — estoque atualizado.');
    fechar(); aoConcluir();
  }, 'Confirmar recebimento');
}

function formCompra(aoConcluir) {
  const itens = [];
  const m = modal('Nova compra', `
    <div class="linha-2">
      <div class="campo"><label>Fornecedor</label><select id="cp-forn"><option value="">—</option></select></div>
      <div class="campo"><label>Nº da NF (opcional)</label><input id="cp-nf"></div>
    </div>
    <div class="campo"><label>Adicionar item (bipe o código ou digite o nome)</label>
      <input id="cp-busca" placeholder="Buscar produto…"></div>
    <div id="cp-sugestoes"></div>
    <table><thead><tr><th>Item</th><th style="width:80px">Qtd</th><th style="width:110px">Custo un.</th>
      <th class="num">Total</th><th style="width:36px"></th></tr></thead>
      <tbody id="cp-itens"></tbody></table>
    <div class="tot-total"><span>Total da compra</span><b id="cp-total">R$ 0,00</b></div>
    <div class="erro" id="cp-erro"></div>
  `, async (m, fechar) => {
    const r = await api('compras:criar', {
      fornecedor_id: Number(m.querySelector('#cp-forn').value) || null,
      numero_nf: m.querySelector('#cp-nf').value.trim() || null,
      itens: itens.map(i => ({ variacao_id: i.variacao_id, qtd: i.qtd, custo_unit: i.custo_unit }))
    });
    if (!r.ok) { m.querySelector('#cp-erro').textContent = r.erro; return; }
    toast(`Compra #${r.id} criada (pendente). Use "Receber" quando a mercadoria chegar.`);
    fechar(); aoConcluir();
  }, 'Salvar compra');

  api('fornecedores:listar', {}).then(r => {
    if (!r.ok) return;
    const sel = m.querySelector('#cp-forn');
    for (const f of r.fornecedores) sel.appendChild(el(`<option value="${f.id}">${esc(f.nome)}</option>`));
  });

  const $corpo = m.querySelector('#cp-itens');
  function desenhar() {
    $corpo.innerHTML = '';
    itens.forEach((i, idx) => {
      const tr = el(`<tr>
        <td>${esc(i.produto)} — ${esc(i.cor)}/${esc(i.tamanho)}</td>
        <td><input data-c="qtd" type="number" min="1" value="${i.qtd}"
          style="width:60px;padding:4px 6px;border:1px solid var(--borda);border-radius:6px"></td>
        <td><input data-c="custo_unit" type="number" min="0" step="0.01" value="${i.custo_unit}"
          style="width:90px;padding:4px 6px;border:1px solid var(--borda);border-radius:6px"></td>
        <td class="num">${moeda(i.qtd * i.custo_unit)}</td>
        <td class="acoes-linha"><button style="color:var(--vermelho)">✕</button></td></tr>`);
      tr.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
        i[inp.dataset.c] = Math.max(0, Number(inp.value) || 0); if (i.qtd < 1) i.qtd = 1; desenhar();
      }));
      tr.querySelector('button').onclick = () => { itens.splice(idx, 1); desenhar(); };
      $corpo.appendChild(tr);
    });
    m.querySelector('#cp-total').textContent =
      (itens.reduce((s, i) => s + i.qtd * i.custo_unit, 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const $busca = m.querySelector('#cp-busca');
  const $sug = m.querySelector('#cp-sugestoes');
  let deb;
  $busca.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(async () => {
      const termo = $busca.value.trim();
      $sug.innerHTML = '';
      if (termo.length < 2) return;
      const r = await api('estoque:buscar', { termo });
      for (const v of (r.ok ? r.variacoes : []).slice(0, 6)) {
        const s = el(`<div class="sug"><span><b>${esc(v.produto)}</b> — ${esc(v.cor)}/${esc(v.tamanho)}</span>
          <small>custo atual ${moeda(v.preco_custo)}</small></div>`);
        s.onclick = () => {
          itens.push({ variacao_id: v.id, produto: v.produto, cor: v.cor, tamanho: v.tamanho,
                       qtd: 1, custo_unit: v.preco_custo || 0 });
          $sug.innerHTML = ''; $busca.value = ''; desenhar();
        };
        $sug.appendChild(s);
      }
    }, 250);
  });
}

// ---------- Fornecedores ----------
async function abaFornecedores(corpo) {
  const r = await api('fornecedores:listar', {});
  const painel = el(`
    <div class="painel"><table>
      <thead><tr><th>Nome</th><th>CNPJ/CPF</th><th>Telefone</th><th class="num">Compras</th>
        <th style="width:140px"></th></tr></thead><tbody></tbody></table></div>`);
  const tbody = painel.querySelector('tbody');
  const lista = r.ok ? r.fornecedores : [];
  if (!lista.length) tbody.appendChild(el(`<tr><td colspan="5" class="vazio">Nenhum fornecedor.</td></tr>`));
  for (const f of lista) {
    const tr = el(`<tr>
      <td><b>${esc(f.nome)}</b></td><td>${esc(f.cnpj || '—')}</td><td>${esc(f.telefone || '—')}</td>
      <td class="num">${f.qtd_compras}</td>
      <td class="acoes-linha">
        <button data-a="editar">Editar</button>
        <button data-a="excluir" style="color:var(--vermelho)">Excluir</button>
      </td></tr>`);
    tr.querySelector('[data-a=editar]').onclick = () => formFornecedor(f, () => { corpo.innerHTML = ''; abaFornecedores(corpo); });
    tr.querySelector('[data-a=excluir]').onclick = async () => {
      if (!confirm(`Excluir "${f.nome}"?`)) return;
      const r2 = await api('fornecedores:excluir', { id: f.id });
      r2.ok ? (toast('Fornecedor excluído.'), corpo.innerHTML = '', abaFornecedores(corpo)) : toast(r2.erro, true);
    };
    tbody.appendChild(tr);
  }
  corpo.appendChild(painel);
}

function formFornecedor(f, aoConcluir) {
  modal(f ? 'Editar fornecedor' : 'Novo fornecedor', `
    <div class="linha-2">
      <div class="campo"><label>Nome *</label><input id="fo-nome" value="${esc(f?.nome || '')}"></div>
      <div class="campo"><label>CNPJ ou CPF</label><input id="fo-cnpj" placeholder="00.000.000/0000-00 ou 000.000.000-00" value="${esc(f?.cnpj || '')}"></div>
    </div>
    <div class="linha-2">
      <div class="campo"><label>Telefone</label><input id="fo-tel" value="${esc(f?.telefone || '')}"></div>
      <div class="campo"><label>E-mail</label><input id="fo-email" value="${esc(f?.email || '')}"></div>
    </div>
    <div class="campo"><label>Observações</label><input id="fo-obs" value="${esc(f?.obs || '')}"></div>
    <div class="erro" id="fo-erro"></div>
  `, async (m, fechar) => {
    const r = await api('fornecedores:salvar', {
      id: f?.id, nome: m.querySelector('#fo-nome').value, cnpj: m.querySelector('#fo-cnpj').value,
      telefone: m.querySelector('#fo-tel').value, email: m.querySelector('#fo-email').value,
      obs: m.querySelector('#fo-obs').value
    });
    if (!r.ok) { m.querySelector('#fo-erro').textContent = r.erro; return; }
    toast('Fornecedor salvo.'); fechar(); aoConcluir();
  });
}
