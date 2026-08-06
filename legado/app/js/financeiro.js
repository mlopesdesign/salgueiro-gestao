// Financeiro — contas a pagar/receber e fluxo de caixa
import { api, el, esc, moeda, toast, modal } from './app.js';

const dataBr = (d) => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';
const mesAtual = () => new Date().toISOString().slice(0, 7);

export async function viewFinanceiro(alvo) {
  const tela = el(`
    <div>
      <div class="pagina-topo"><h1>Financeiro</h1>
        <button class="btn btn-primario" id="novo">+ Novo lançamento</button></div>
      <div class="abas">
        <button data-aba="contas" class="ativa">Contas</button>
        <button data-aba="fluxo">Fluxo do mês</button>
        <button data-aba="consignados">🤝 Consignados</button>
      </div>
      <div id="aba-conteudo"></div>
    </div>`);
  const corpo = tela.querySelector('#aba-conteudo');
  const abas = { contas: abaContas, fluxo: abaFluxo, consignados: abaConsignados };
  tela.querySelectorAll('.abas button').forEach(b => {
    b.onclick = () => {
      tela.querySelectorAll('.abas button').forEach(x => x.classList.toggle('ativa', x === b));
      corpo.innerHTML = ''; abas[b.dataset.aba](corpo);
    };
  });
  tela.querySelector('#novo').onclick = () => formLancamento(null, () => { corpo.innerHTML = ''; abaContas(corpo); });
  alvo.appendChild(tela);
  abaContas(corpo);
}

// ---------- Contas ----------
async function abaContas(corpo) {
  const painel = el(`
    <div>
      <div class="cards" id="fin-cards"></div>
      <div class="painel">
        <div class="barra">
          <select id="f-tipo"><option value="">Pagar + Receber</option>
            <option value="pagar">Só a pagar</option><option value="receber">Só a receber</option></select>
          <select id="f-sit"><option value="abertas">Em aberto</option>
            <option value="pagas">Baixadas</option><option value="todas">Todas</option></select>
          <input id="f-mes" type="month" value="${mesAtual()}" style="padding:7px 10px;border:1px solid var(--borda);border-radius:8px">
          <button class="btn btn-suave" id="f-limpar">Todos os meses</button>
        </div>
        <table><thead><tr><th></th><th>Descrição</th><th>Categoria</th><th>Vencimento</th>
          <th class="num">Valor</th><th style="width:170px"></th></tr></thead><tbody></tbody></table>
      </div>
    </div>`);
  const tbody = painel.querySelector('tbody');
  const cards = painel.querySelector('#fin-cards');

  async function carregar() {
    const r = await api('financeiro:listar', {
      tipo: painel.querySelector('#f-tipo').value || null,
      situacao: painel.querySelector('#f-sit').value,
      mes: painel.querySelector('#f-mes').value || null
    });
    if (!r.ok) { toast(r.erro, true); return; }
    cards.innerHTML = `
      <div class="card"><div class="rotulo">A pagar (aberto)</div>
        <div class="valor" style="color:var(--vermelho)">${moeda(r.a_pagar)}</div></div>
      <div class="card"><div class="rotulo">A receber (aberto)</div>
        <div class="valor" style="color:var(--verde)">${moeda(r.a_receber)}</div></div>
      <div class="card"><div class="rotulo">Vencidas</div><div class="valor">${moeda(r.vencidas)}</div></div>`;
    tbody.innerHTML = '';
    if (!r.lancamentos.length) { tbody.appendChild(el(`<tr><td colspan="6" class="vazio">Nenhum lançamento.</td></tr>`)); return; }
    for (const l of r.lancamentos) {
      const tr = el(`<tr ${l.vencido ? 'style="background:#FCF0F0"' : ''}>
        <td>${l.tipo === 'pagar' ? '<span class="pill pill-baixo">pagar</span>' : '<span class="pill pill-ok">receber</span>'}</td>
        <td><b>${esc(l.descricao)}</b>${l.origem ? ' <small style="color:var(--texto-suave)">(automático)</small>' : ''}</td>
        <td>${esc(l.categoria || '—')}</td>
        <td>${dataBr(l.vencimento)} ${l.vencido ? '<span class="pill pill-baixo">vencida</span>' : ''}</td>
        <td class="num"><b>${moeda(l.valor)}</b>${l.pago_em ? `<br><small>baixado ${dataBr(l.pago_em)}</small>` : ''}</td>
        <td class="acoes-linha">
          ${!l.pago_em ? `<button data-a="baixar" style="color:var(--verde)">${l.tipo === 'pagar' ? 'Pagar' : 'Receber'}</button>` : ''}
          ${!l.origem ? '<button data-a="editar">Editar</button><button data-a="excluir" style="color:var(--vermelho)">✕</button>' : ''}
        </td></tr>`);
      const bx = tr.querySelector('[data-a=baixar]');
      if (bx) bx.onclick = async () => {
        if (!confirm(`Confirmar ${l.tipo === 'pagar' ? 'pagamento' : 'recebimento'} de ${moeda(l.valor)} — "${l.descricao}"?`)) return;
        const r2 = await api('financeiro:baixar', { id: l.id });
        r2.ok ? (toast('Baixa registrada.'), carregar()) : toast(r2.erro, true);
      };
      const ed = tr.querySelector('[data-a=editar]');
      if (ed) ed.onclick = () => formLancamento(l, carregar);
      const ex = tr.querySelector('[data-a=excluir]');
      if (ex) ex.onclick = async () => {
        if (!confirm('Excluir este lançamento?')) return;
        const r2 = await api('financeiro:excluir', { id: l.id });
        r2.ok ? (toast('Excluído.'), carregar()) : toast(r2.erro, true);
      };
      tbody.appendChild(tr);
    }
  }
  painel.querySelectorAll('#f-tipo, #f-sit, #f-mes').forEach(c => c.addEventListener('change', carregar));
  painel.querySelector('#f-limpar').onclick = () => { painel.querySelector('#f-mes').value = ''; carregar(); };
  corpo.appendChild(painel);
  carregar();
}

function formLancamento(l, aoConcluir) {
  modal(l ? 'Editar lançamento' : 'Novo lançamento', `
    <div class="linha-2">
      <div class="campo"><label>Tipo</label>
        <select id="l-tipo">
          <option value="pagar" ${l?.tipo === 'pagar' ? 'selected' : ''}>Conta a pagar</option>
          <option value="receber" ${l?.tipo === 'receber' ? 'selected' : ''}>Conta a receber</option>
        </select></div>
      <div class="campo"><label>Valor (R$)</label>
        <input id="l-valor" type="number" min="0.01" step="0.01" value="${l?.valor ?? ''}"></div>
    </div>
    <div class="campo"><label>Descrição *</label><input id="l-desc" value="${esc(l?.descricao || '')}"
      placeholder="Aluguel, energia, fornecedor…"></div>
    <div class="linha-2">
      <div class="campo"><label>Categoria</label><input id="l-cat" value="${esc(l?.categoria || '')}"
        placeholder="Aluguel, Energia, Fornecedor, Impostos…"></div>
      <div class="campo"><label>Vencimento</label><input id="l-venc" type="date" value="${esc(l?.vencimento || '')}"></div>
    </div>
    <div class="erro" id="l-erro"></div>
  `, async (m, fechar) => {
    const r = await api('financeiro:salvar', {
      id: l?.id,
      tipo: m.querySelector('#l-tipo').value,
      descricao: m.querySelector('#l-desc').value,
      categoria: m.querySelector('#l-cat').value.trim() || null,
      valor: Number(m.querySelector('#l-valor').value),
      vencimento: m.querySelector('#l-venc').value || null
    });
    if (!r.ok) { m.querySelector('#l-erro').textContent = r.erro; return; }
    toast('Lançamento salvo.'); fechar(); aoConcluir();
  });
}

// ---------- Fluxo do mês ----------
async function abaFluxo(corpo) {
  const painel = el(`
    <div>
      <div class="painel" style="margin-bottom:16px"><div class="barra">
        <label style="font-weight:600">Mês:</label>
        <input id="fx-mes" type="month" value="${mesAtual()}"
          style="padding:7px 10px;border:1px solid var(--borda);border-radius:8px">
      </div></div>
      <div id="fx-conteudo"></div>
    </div>`);
  const conteudo = painel.querySelector('#fx-conteudo');

  async function carregar() {
    const r = await api('financeiro:fluxo', { mes: painel.querySelector('#fx-mes').value });
    if (!r.ok) { toast(r.erro, true); return; }
    const nomeF = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', crediario: 'Crediário', vale: 'Vale' };
    conteudo.innerHTML = '';
    conteudo.appendChild(el(`
      <div>
        <div class="cards">
          <div class="card"><div class="rotulo">Vendas (${r.vendas.qtd})</div><div class="valor">${moeda(r.vendas.total)}</div></div>
          <div class="card"><div class="rotulo">Custo das peças vendidas</div><div class="valor">${moeda(r.vendas.custo)}</div></div>
          <div class="card"><div class="rotulo">Lucro bruto</div><div class="valor" style="color:var(--verde)">${moeda(r.vendas.lucro_bruto)}</div></div>
          <div class="card"><div class="rotulo">Despesas pagas</div><div class="valor" style="color:var(--vermelho)">${moeda(r.pagar.realizado)}</div></div>
          <div class="card"><div class="rotulo">Resultado do mês</div>
            <div class="valor" style="color:${r.resultado >= 0 ? 'var(--verde)' : 'var(--vermelho)'}">${moeda(r.resultado)}</div></div>
        </div>
        <div class="painel" style="padding:18px">
          <p style="font-weight:600;margin-bottom:8px">Recebimentos por forma de pagamento</p>
          ${r.por_forma.map(f => `<div class="tot-linha"><span>${nomeF[f.forma] || f.forma}</span><b>${moeda(f.total)}</b></div>`).join('')
            || '<p style="color:var(--texto-suave)">Nenhuma venda no mês.</p>'}
          <p style="font-weight:600;margin:14px 0 8px">Previsto (em aberto)</p>
          <div class="tot-linha"><span>Contas a pagar</span><b style="color:var(--vermelho)">${moeda(r.pagar.previsto)}</b></div>
          <div class="tot-linha"><span>A receber (inclui crediário)</span><b style="color:var(--verde)">${moeda(r.receber.previsto)}</b></div>
        </div>
      </div>`));
  }
  painel.querySelector('#fx-mes').addEventListener('change', carregar);
  corpo.appendChild(painel);
  carregar();
}

// ---------- Consignados (acerto com fornecedores) ----------
async function abaConsignados(corpo) {
  const painel = el(`<div class="painel" style="padding:22px">
    <p style="color:var(--texto-suave);margin:0 0 14px">
      Cada venda de produto consignado registra automaticamente a parte do fornecedor.
      Clique em <b>Acertar</b> para gerar a conta a pagar do repasse (vencimento em 7 dias) —
      assim o fluxo de caixa fecha certinho: a parte da loja fica no resultado e a do fornecedor vira despesa.
    </p>
    <div id="cg-corpo"><p style="color:var(--texto-suave)">Carregando…</p></div>
    <div class="erro" id="cg-erro" style="margin-top:10px"></div>
  </div>`);
  corpo.appendChild(painel);

  const carregar = async () => {
    const div = painel.querySelector('#cg-corpo');
    const r = await api('consignacao:resumo');
    if (!r.ok) { div.innerHTML = `<p style="color:var(--vermelho)">${esc(r.erro)}</p>`; return; }
    if (!r.fornecedores.length) {
      div.innerHTML = '<p class="vazio">Nenhuma venda consignada ainda. Marque produtos como consignados no cadastro (Produtos → Editar).</p>';
      return;
    }
    div.innerHTML = `
      <p style="color:var(--texto-suave);font-size:13px;margin:0 0 8px">
        O <b>repasse do fornecedor</b> = custo da peça + a fatia dele no lucro. A coluna <b>Custo</b> mostra
        quanto do repasse é só a reposição da peça; a <b>Parte da loja</b> é o restante do lucro.
      </p>
      <table><thead><tr><th>Fornecedor</th><th class="num">Peças pend.</th>
      <th class="num">Custo</th><th class="num">Lucro fornec.</th>
      <th class="num">Repasse pendente</th><th class="num">Parte da loja</th><th class="num">Já acertado</th><th></th></tr></thead>
      <tbody>${r.fornecedores.map(f => `
        <tr data-id="${f.fornecedor_id}">
          <td><b>${esc(f.fornecedor)}</b></td>
          <td class="num">${f.pecas_pendentes || 0}</td>
          <td class="num" style="color:var(--texto-suave)">${moeda(f.pendente_custo)}</td>
          <td class="num" style="color:var(--texto-suave)">${moeda(f.pendente_lucro_fornecedor)}</td>
          <td class="num"><b style="color:var(--vermelho)">${moeda(f.pendente_fornecedor)}</b></td>
          <td class="num" style="color:var(--verde)">${moeda(f.pendente_loja)}</td>
          <td class="num" style="color:var(--texto-suave)">${moeda(f.total_acertado)}</td>
          <td class="acoes-linha">
            <button data-a="extrato">Extrato</button>
            ${f.pendente_fornecedor > 0 ? '<button data-a="acertar">💰 Acertar</button>' : ''}
          </td>
        </tr>`).join('')}</tbody></table>`;

    div.querySelectorAll('[data-a=acertar]').forEach(b => b.onclick = async () => {
      const tr = b.closest('tr');
      if (!confirm('Gerar a conta a pagar do repasse deste fornecedor?')) return;
      const r2 = await api('consignacao:acertar', { fornecedor_id: Number(tr.dataset.id) });
      if (!r2.ok) { painel.querySelector('#cg-erro').textContent = r2.erro; return; }
      toast(`Acerto gerado: ${moeda(r2.valor)} para ${r2.fornecedor} (${r2.pecas} peça(s)) — veja em Contas.`);
      carregar();
    });
    div.querySelectorAll('[data-a=extrato]').forEach(b => b.onclick = async () => {
      const tr = b.closest('tr');
      const r2 = await api('consignacao:listar', { fornecedor_id: Number(tr.dataset.id) });
      if (!r2.ok) { toast(r2.erro, true); return; }
      const linhas = r2.movimentos.map(mv => `
        <tr><td>#${mv.venda_id}</td><td>${esc(String(mv.data_venda || '').slice(0, 16))}</td>
          <td>${esc(mv.produto)}</td><td class="num">${mv.qtd}</td>
          <td class="num">${moeda(mv.valor_venda)}</td>
          <td class="num" style="color:var(--texto-suave)">${moeda(mv.valor_custo)}</td>
          <td class="num">${moeda(mv.lucro)}</td>
          <td class="num">${mv.pct_fornecedor}%</td>
          <td class="num" style="color:var(--texto-suave)">${moeda(mv.lucro_fornecedor)}</td>
          <td class="num"><b>${moeda(mv.valor_fornecedor)}</b></td>
          <td class="num" style="color:var(--verde)">${moeda(mv.valor_loja)}</td>
          <td>${mv.status === 'pendente' ? '<span class="pill pill-baixo">pendente</span>'
              : mv.status === 'acertado' ? '<span class="pill pill-ok">acertado</span>'
              : '<span class="pill">cancelado</span>'}</td></tr>`).join('');
      modal('Extrato de consignação 🤝', `
        <p style="color:var(--texto-suave);font-size:13px;margin:0 0 10px">
          Repasse do fornecedor = <b>Custo</b> + <b>Lucro fornec.</b> (fatia dele do lucro). A loja fica com o restante.
        </p>
        <table><thead><tr><th>Venda</th><th>Data</th><th>Produto</th><th class="num">Qtd</th>
          <th class="num">Venda</th><th class="num">Custo</th><th class="num">Lucro</th><th class="num">%</th>
          <th class="num">Lucro fornec.</th><th class="num">Repasse</th><th class="num">Loja</th><th></th></tr></thead>
          <tbody>${linhas || '<tr><td colspan="12" class="vazio">Sem movimentos.</td></tr>'}</tbody></table>
      `, (_, f) => f(), 'Fechar');
    });
  };
  carregar();
}
