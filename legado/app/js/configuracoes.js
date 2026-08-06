// Configurações — identidade visual (white-label), dados da loja e usuários
import { api, el, esc, toast, modal, getConfig, aplicarTema, recarregarConfig, setorAtivo, EM_REDE } from './app.js';

const PRESETS = [
  { nome: 'Salgueiro',      primaria: '#B01E23', escura: '#7E1114', destaque: '#F2C14E' },
  { nome: 'Vinho & Ouro',   primaria: '#7B2D3B', escura: '#5E1F2C', destaque: '#B8924A' },
  { nome: 'Azul Royal',     primaria: '#1E4FB0', escura: '#123272', destaque: '#F2C14E' },
  { nome: 'Verde Esmeralda',primaria: '#1E7D52', escura: '#12513A', destaque: '#D9B25F' },
  { nome: 'Rosa Boutique',  primaria: '#C2447A', escura: '#8A2B56', destaque: '#E8C39A' },
  { nome: 'Preto Elegante', primaria: '#2B2B2B', escura: '#111111', destaque: '#C9A24B' }
];

export async function viewConfiguracoes(alvo) {
  const tela = el(`
    <div>
      <div class="pagina-topo"><h1>Configurações</h1></div>
      <div class="abas">
        <button data-aba="aparencia" class="ativa">Aparência</button>
        <button data-aba="loja">Dados da loja</button>
        <button data-aba="lojas">🏬 Lojas</button>
        ${setorAtivo('pontos') ? '<button data-aba="pontos">🎁 Pontos</button>' : ''}
        ${setorAtivo('nuvem') ? '<button data-aba="nuvem">☁️ Nuvem</button>' : ''}
        <button data-aba="backup">💾 Backup</button>
        ${setorAtivo('rede') ? '<button data-aba="rede">🌐 Rede</button>' : ''}
        <button data-aba="impressoras">🖨️ Impressoras</button>
        <button data-aba="licenca">📜 Licença</button>
        <button data-aba="usuarios">Usuários</button>
      </div>
      <div id="aba-conteudo"></div>
    </div>`);
  const corpo = tela.querySelector('#aba-conteudo');
  const abas = { aparencia: abaAparencia, loja: abaLoja, lojas: abaLojas, pontos: abaPontos, usuarios: abaUsuarios, nuvem: abaNuvem, backup: abaBackup, rede: abaRede, licenca: abaLicenca, impressoras: abaImpressoras };
  tela.querySelectorAll('.abas button').forEach(b => {
    b.onclick = () => {
      tela.querySelectorAll('.abas button').forEach(x => x.classList.toggle('ativa', x === b));
      corpo.innerHTML = ''; abas[b.dataset.aba](corpo);
    };
  });
  alvo.appendChild(tela);
  abaAparencia(corpo);
}

// ---------- Aparência ----------
function abaAparencia(corpo) {
  const cfg = getConfig();
  const painel = el(`
    <div class="painel" style="padding:22px;max-width:680px">
      <div class="linha-2">
        <div class="campo"><label>Nome da loja (aparece no sistema e no cupom)</label>
          <input id="ap-nome" value="${esc(cfg.loja_nome)}"></div>
        <div class="campo"><label>Subtítulo (menu lateral)</label>
          <input id="ap-sub" value="${esc(cfg.loja_subtitulo)}"></div>
      </div>

      <div class="campo"><label>Logo (PNG/JPG, fundo transparente fica melhor)</label>
        <div style="display:flex;align-items:center;gap:14px">
          <img id="ap-logo-prev" src="${cfg.logo || ''}"
            style="width:64px;height:64px;object-fit:contain;border:1px dashed var(--borda);border-radius:8px;${cfg.logo ? '' : 'visibility:hidden'}">
          <input type="file" id="ap-logo" accept="image/png,image/jpeg,image/webp">
          <button class="btn btn-suave" id="ap-logo-rm" type="button">Remover</button>
        </div></div>

      <div class="campo"><label>Temas prontos</label>
        <div id="ap-presets" style="display:flex;gap:8px;flex-wrap:wrap"></div></div>

      <div class="linha-3">
        <div class="campo"><label>Cor principal</label><input id="ap-cor1" type="color" value="${cfg.cor_primaria}" style="height:42px"></div>
        <div class="campo"><label>Cor escura (menu)</label><input id="ap-cor2" type="color" value="${cfg.cor_escura}" style="height:42px"></div>
        <div class="campo"><label>Cor de destaque</label><input id="ap-cor3" type="color" value="${cfg.cor_destaque}" style="height:42px"></div>
      </div>

      <div class="erro" id="ap-erro"></div>
      <button class="btn btn-primario" id="ap-salvar">Salvar aparência</button>
      <p style="color:var(--texto-suave);font-size:12px;margin-top:10px">
        As cores são aplicadas na hora, em todo o sistema, no cupom e nas etiquetas.</p>
    </div>`);

  let logoData = cfg.logo || '';
  const prev = painel.querySelector('#ap-logo-prev');

  painel.querySelector('#ap-logo').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('Imagem muito grande (máx. 2 MB).', true); return; }
    const leitor = new FileReader();
    leitor.onload = () => {
      logoData = leitor.result;
      prev.src = logoData; prev.style.visibility = 'visible';
    };
    leitor.readAsDataURL(f);
  });
  painel.querySelector('#ap-logo-rm').onclick = () => {
    logoData = ''; prev.src = ''; prev.style.visibility = 'hidden';
    painel.querySelector('#ap-logo').value = '';
  };

  const presets = painel.querySelector('#ap-presets');
  for (const p of PRESETS) {
    const b = el(`<button type="button" class="btn btn-suave" style="gap:8px">
      <span style="display:inline-flex;gap:2px">
        <i style="width:14px;height:14px;border-radius:3px;background:${p.primaria}"></i>
        <i style="width:14px;height:14px;border-radius:3px;background:${p.escura}"></i>
        <i style="width:14px;height:14px;border-radius:3px;background:${p.destaque}"></i>
      </span>${esc(p.nome)}</button>`);
    b.onclick = () => {
      painel.querySelector('#ap-cor1').value = p.primaria;
      painel.querySelector('#ap-cor2').value = p.escura;
      painel.querySelector('#ap-cor3').value = p.destaque;
    };
    presets.appendChild(b);
  }

  painel.querySelector('#ap-salvar').onclick = async () => {
    const r = await api('config:salvar', {
      loja_nome: painel.querySelector('#ap-nome').value.trim() || 'Minha Loja',
      loja_subtitulo: painel.querySelector('#ap-sub').value.trim(),
      logo: logoData,
      cor_primaria: painel.querySelector('#ap-cor1').value,
      cor_escura: painel.querySelector('#ap-cor2').value,
      cor_destaque: painel.querySelector('#ap-cor3').value
    });
    if (!r.ok) { painel.querySelector('#ap-erro').textContent = r.erro; return; }
    await recarregarConfig();
    aplicarTema();
    toast('Aparência salva e aplicada. ✨');
  };
  corpo.appendChild(painel);
}

// ---------- Dados da loja ----------
function abaLoja(corpo) {
  const cfg = getConfig();
  const painel = el(`
    <div class="painel" style="padding:22px;max-width:680px">
      <div class="linha-2">
        <div class="campo"><label>CNPJ</label><input id="lj-cnpj" value="${esc(cfg.loja_cnpj)}"></div>
        <div class="campo"><label>Telefone/WhatsApp</label><input id="lj-tel" value="${esc(cfg.loja_telefone)}"></div>
      </div>
      <div class="campo"><label>Endereço</label><input id="lj-end" value="${esc(cfg.loja_endereco)}"></div>
      <div class="campo"><label>Mensagem no rodapé do cupom</label>
        <textarea id="lj-rodape" rows="3"
          style="width:100%;padding:9px 12px;border:1px solid var(--borda);border-radius:8px;font:inherit">${esc(cfg.cupom_rodape)}</textarea></div>
      <div class="erro" id="lj-erro"></div>
      <button class="btn btn-primario" id="lj-salvar">Salvar dados</button>
      <p style="color:var(--texto-suave);font-size:12px;margin-top:10px">
        CNPJ, telefone e endereço aparecem no cabeçalho do cupom quando preenchidos.</p>
    </div>`);
  painel.querySelector('#lj-salvar').onclick = async () => {
    const r = await api('config:salvar', {
      loja_cnpj: painel.querySelector('#lj-cnpj').value.trim(),
      loja_telefone: painel.querySelector('#lj-tel').value.trim(),
      loja_endereco: painel.querySelector('#lj-end').value.trim(),
      cupom_rodape: painel.querySelector('#lj-rodape').value
    });
    if (!r.ok) { painel.querySelector('#lj-erro').textContent = r.erro; return; }
    await recarregarConfig();
    toast('Dados da loja salvos.');
  };
  corpo.appendChild(painel);
}

// ---------- Usuários ----------
// ---------- Lojas (unidades) ----------
async function abaLojas(corpo) {
  const painel = el(`
    <div>
      <p style="color:var(--texto-suave);margin:0 0 12px">
        Cadastre suas unidades (Loja 1, Loja 2…). Cada caixa é aberto para uma loja, e a
        receita fica separada por loja nos relatórios — a receita total continua somando todas.
      </p>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primario" id="nova-loja">+ Nova loja</button></div>
      <div class="painel"><table>
        <thead><tr><th>Loja</th><th class="num">Caixas</th><th></th><th style="width:150px"></th></tr></thead>
        <tbody></tbody></table></div>
      <div class="erro" id="lojas-erro" style="margin-top:10px"></div>
    </div>`);
  const tbody = painel.querySelector('tbody');
  const erro = painel.querySelector('#lojas-erro');

  async function carregar() {
    erro.textContent = '';
    const r = await api('lojas:listar', { todas: true });
    tbody.innerHTML = '';
    if (!r.ok) { erro.textContent = r.erro; return; }
    if (!r.lojas.length) { tbody.appendChild(el('<tr><td colspan="4" class="vazio">Nenhuma loja.</td></tr>')); return; }
    for (const l of r.lojas) {
      const tr = el(`<tr>
        <td><b>${esc(l.nome)}</b></td>
        <td class="num">${l.qtd_caixas || 0}</td>
        <td>${l.ativo ? '<span class="pill pill-ok">ativa</span>' : '<span class="pill pill-baixo">inativa</span>'}</td>
        <td class="acoes-linha">
          <button data-a="editar">Editar</button>
          ${l.ativo ? '<button data-a="excluir" style="color:var(--vermelho)">Excluir</button>' : ''}
        </td></tr>`);
      tr.querySelector('[data-a=editar]').onclick = () => formLoja(l, carregar);
      const ex = tr.querySelector('[data-a=excluir]');
      if (ex) ex.onclick = async () => {
        if (!confirm(`Excluir/desativar a loja "${l.nome}"?`)) return;
        const r2 = await api('lojas:excluir', { id: l.id });
        r2.ok ? (toast('Loja atualizada.'), carregar()) : (erro.textContent = r2.erro);
      };
      tbody.appendChild(tr);
    }
  }
  painel.querySelector('#nova-loja').onclick = () => formLoja(null, carregar);
  corpo.appendChild(painel);
  carregar();
}

function formLoja(l, aoConcluir) {
  modal(l ? 'Editar loja' : 'Nova loja', `
    <div class="campo"><label>Nome da loja</label>
      <input id="lj-nome" type="text" maxlength="60" value="${l ? esc(l.nome) : ''}" placeholder="Ex.: Loja 1 - Centro"></div>
    <div class="erro" id="lj-erro"></div>
  `, async (wrap, fechar) => {
    const nome = wrap.querySelector('#lj-nome').value.trim();
    if (!nome) { wrap.querySelector('#lj-erro').textContent = 'Informe o nome da loja.'; return; }
    const r = await api('lojas:salvar', { id: l ? l.id : undefined, nome });
    if (!r.ok) { wrap.querySelector('#lj-erro').textContent = r.erro; return; }
    toast('Loja salva.'); fechar(); aoConcluir && aoConcluir();
  }, 'Salvar');
}

async function abaUsuarios(corpo) {
  const r = await api('auth:listarUsuarios');
  const painel = el(`
    <div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primario" id="novo-usr">+ Novo usuário</button></div>
      <div class="painel"><table>
        <thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th></th><th style="width:100px"></th></tr></thead>
        <tbody></tbody></table></div>
    </div>`);
  const tbody = painel.querySelector('tbody');
  const perfis = { admin: 'Administrador', caixa: 'Caixa', estoque: 'Estoquista' };
  for (const u of (r.ok ? r.usuarios : [])) {
    const tr = el(`<tr>
      <td><b>${esc(u.nome)}</b></td><td>${esc(u.usuario)}</td>
      <td>${perfis[u.perfil] || esc(u.perfil)}</td>
      <td>${u.ativo ? '<span class="pill pill-ok">ativo</span>' : '<span class="pill pill-baixo">inativo</span>'}</td>
      <td class="acoes-linha"><button>Editar</button></td></tr>`);
    tr.querySelector('button').onclick = () => formUsuario(u, () => { corpo.innerHTML = ''; abaUsuarios(corpo); });
    tbody.appendChild(tr);
  }
  painel.querySelector('#novo-usr').onclick = () => formUsuario(null, () => { corpo.innerHTML = ''; abaUsuarios(corpo); });
  corpo.appendChild(painel);
}

async function formUsuario(u, aoConcluir) {
  const cat = await api('permissoes:catalogo');
  const catalogo = cat.ok ? cat.catalogo : [];
  const defaults = cat.ok ? cat.defaults : {};
  const grupos = {};
  for (const p of catalogo) { (grupos[p.grupo] = grupos[p.grupo] || []).push(p); }
  const marcadas = new Set(u ? (u.permissoes_efetivas || []) : (defaults.caixa || []));
  const matriz = Object.entries(grupos).map(([g, itens]) => `
    <div class="perm-grupo">
      <h4>${esc(g)}</h4>
      ${itens.map(p => `<label class="perm-item"><input type="checkbox" class="perm-chk" value="${esc(p.chave)}" ${marcadas.has(p.chave) ? 'checked' : ''}> ${esc(p.rotulo)}</label>`).join('')}
    </div>`).join('');

  const m = modal(u ? `Editar — ${esc(u.nome)}` : 'Novo usuário', `
    <div class="linha-2">
      <div class="campo"><label>Nome *</label><input id="u-nome" value="${esc(u?.nome || '')}"></div>
      <div class="campo"><label>Usuário (login) *</label><input id="u-usuario" value="${esc(u?.usuario || '')}"></div>
    </div>
    <div class="linha-2">
      <div class="campo"><label>Perfil (modelo)</label>
        <select id="u-perfil">
          <option value="caixa" ${u?.perfil === 'caixa' ? 'selected' : ''}>Vendedor (vende, não vê custos)</option>
          <option value="estoque" ${u?.perfil === 'estoque' ? 'selected' : ''}>Estoquista</option>
          <option value="admin" ${u?.perfil === 'admin' ? 'selected' : ''}>Administrador (acesso total)</option>
        </select></div>
      <div class="campo"><label>${u ? 'Nova senha (deixe vazio p/ manter)' : 'Senha * (mín. 6)'}</label>
        <input id="u-senha" type="password"></div>
    </div>
    ${u ? `<div class="campo"><label><input type="checkbox" id="u-ativo" ${u.ativo ? 'checked' : ''} style="width:auto;margin-right:6px">Usuário ativo (desmarcado = bloqueia o login)</label></div>` : ''}
    <div class="perm-editor" id="perm-editor">
      <div class="perm-topo">
        <label>Permissões — o que este usuário pode ver e fazer</label>
        <div class="perm-presets">
          <button type="button" class="btn btn-suave" data-preset="caixa">Modelo Vendedor</button>
          <button type="button" class="btn btn-suave" data-preset="estoque">Modelo Estoquista</button>
          <button type="button" class="btn btn-suave" data-preset="marcar">Marcar tudo</button>
          <button type="button" class="btn btn-suave" data-preset="limpar">Limpar</button>
        </div>
      </div>
      <div class="perm-aviso" id="perm-aviso"></div>
      <div class="perm-matriz">${matriz}</div>
    </div>
    <div class="erro" id="u-erro"></div>
  `, async (mm, fechar) => {
    const perfil = mm.querySelector('#u-perfil').value;
    const permissoes = [...mm.querySelectorAll('.perm-chk')].filter(c => c.checked).map(c => c.value);
    const r = await api('auth:salvarUsuario', {
      id: u?.id,
      nome: mm.querySelector('#u-nome').value,
      usuario: mm.querySelector('#u-usuario').value,
      perfil,
      senha: mm.querySelector('#u-senha').value || null,
      ativo: u ? mm.querySelector('#u-ativo').checked : true,
      permissoes
    });
    if (!r.ok) { mm.querySelector('#u-erro').textContent = r.erro; return; }
    toast('Usuário salvo.'); fechar(); aoConcluir();
  });

  const selPerfil = m.querySelector('#u-perfil');
  const aviso = m.querySelector('#perm-aviso');
  const chks = () => [...m.querySelectorAll('.perm-chk')];
  const aplicar = (chaves) => chks().forEach(c => { c.checked = chaves.includes(c.value); });
  function atualizarPorPerfil() {
    if (selPerfil.value === 'admin') {
      chks().forEach(c => { c.checked = true; c.disabled = true; });
      aviso.textContent = 'Administrador tem acesso total — as permissões abaixo ficam todas ligadas.';
    } else {
      chks().forEach(c => { c.disabled = false; });
      aviso.textContent = 'Use um modelo como ponto de partida e ajuste as caixas conforme precisar.';
    }
  }
  selPerfil.addEventListener('change', () => {
    if (selPerfil.value !== 'admin') aplicar(defaults[selPerfil.value] || []);
    atualizarPorPerfil();
  });
  m.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
    const p = b.dataset.preset;
    if (p === 'marcar') aplicar(catalogo.map(x => x.chave));
    else if (p === 'limpar') aplicar([]);
    else aplicar(defaults[p] || []);
  });
  atualizarPorPerfil();
}

// ---------- Pontos de fidelidade ----------
async function abaPontos(corpo) {
  const cfg = await api('pontos:config');
  const painel = document.createElement('div');
  painel.className = 'painel';
  painel.style.cssText = 'padding:22px;max-width:600px';
  painel.innerHTML = `
    <p style="color:var(--texto-suave);margin-bottom:18px">
      Programa de fidelidade opcional. Quando ativado, clientes identificados acumulam pontos a cada compra
      e podem resgatar como desconto na próxima venda.
    </p>
    <div class="campo" style="margin-bottom:14px">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <input type="checkbox" id="pts-ativo" ${cfg.ativo ? 'checked' : ''} style="width:18px;height:18px">
        <span><b>Ativar programa de pontos</b></span>
      </label>
    </div>
    <div id="pts-form" style="${cfg.ativo ? '' : 'opacity:.45;pointer-events:none'}">
      <div class="linha-3" style="margin-bottom:14px">
        <div class="campo">
          <label>Pontos por R$ 1 gasto</label>
          <input type="number" id="pts-por-real" min="1" step="1" value="${cfg.por_real}"
            style="text-align:right">
          <small style="color:var(--texto-suave)">ex: 1 ponto por R$ 1</small>
        </div>
        <div class="campo">
          <label>Mínimo para resgatar (pts)</label>
          <input type="number" id="pts-minimo" min="1" step="1" value="${cfg.minimo_resgate}"
            style="text-align:right">
          <small style="color:var(--texto-suave)">ex: 100 pontos para resgatar</small>
        </div>
        <div class="campo">
          <label>Desconto por resgate (R$)</label>
          <input type="number" id="pts-valor" min="1" step="0.01" value="${cfg.valor_resgate}"
            style="text-align:right">
          <small style="color:var(--texto-suave)">ex: R$ 10 de desconto</small>
        </div>
      </div>
      <div style="background:var(--creme);border-radius:8px;padding:12px;font-size:0.9em;margin-bottom:18px">
        📊 Com essa configuração: a cada <b id="ex-min">${cfg.minimo_resgate}</b> pontos o cliente ganha
        <b id="ex-val">R$ ${cfg.valor_resgate.toFixed(2).replace('.',',')}</b> de desconto.<br>
        Para ter direito ao resgate precisa gastar pelo menos
        <b id="ex-gasto">R$ ${(cfg.minimo_resgate / cfg.por_real).toFixed(2).replace('.',',')}</b>.
      </div>
    </div>
    <button class="btn btn-primario" id="pts-salvar">Salvar configuração</button>
    <div class="erro" id="pts-erro" style="margin-top:8px"></div>
  `;

  const $ativo = painel.querySelector('#pts-ativo');
  const $form = painel.querySelector('#pts-form');
  $ativo.addEventListener('change', () => {
    $form.style.cssText = $ativo.checked ? '' : 'opacity:.45;pointer-events:none';
  });

  function atualizarExemplo() {
    const min = Number(painel.querySelector('#pts-minimo').value) || 100;
    const val = Number(painel.querySelector('#pts-valor').value) || 10;
    const porReal = Number(painel.querySelector('#pts-por-real').value) || 1;
    painel.querySelector('#ex-min').textContent = min;
    painel.querySelector('#ex-val').textContent = 'R$ ' + val.toFixed(2).replace('.', ',');
    painel.querySelector('#ex-gasto').textContent = 'R$ ' + (min / porReal).toFixed(2).replace('.', ',');
  }
  ['#pts-minimo','#pts-valor','#pts-por-real'].forEach(sel =>
    painel.querySelector(sel).addEventListener('input', atualizarExemplo));

  painel.querySelector('#pts-salvar').onclick = async () => {
    const r = await api('pontos:salvarConfig', {
      ativo: $ativo.checked,
      por_real: Number(painel.querySelector('#pts-por-real').value) || 1,
      minimo_resgate: Number(painel.querySelector('#pts-minimo').value) || 100,
      valor_resgate: Number(painel.querySelector('#pts-valor').value) || 10
    });
    if (r.ok) { toast('Configuração de pontos salva.'); corpo.innerHTML = ''; abaPontos(corpo); }
    else painel.querySelector('#pts-erro').textContent = r.erro || 'Erro ao salvar.';
  };

  corpo.appendChild(painel);
}

// ---- Aba: Backup na Nuvem ----
async function abaNuvem(corpo) {
  const painel = el(`<div class="painel"><div id="nuvem-corpo"></div></div>`);
  corpo.appendChild(painel);
  await renderNuvem(painel.querySelector('#nuvem-corpo'));
}

async function renderNuvem(alvo) {
  alvo.innerHTML = '<p style="color:var(--texto-suave)">Carregando…</p>';
  const r = await api('nuvem:status');
  if (!r.ok) { alvo.innerHTML = `<p style="color:var(--vermelho)">${esc(r.erro)}</p>`; return; }

  const cards = Object.entries(r.providers).map(([key, p]) => {
    const ultimoBackup = p.ultimo_backup
      ? new Date(p.ultimo_backup).toLocaleString('pt-BR')
      : 'Nunca';
    const badge = p.conectado
      ? `<span class="pill pill-ok" style="font-size:0.85em">Conectado</span>`
      : `<span class="pill" style="background:#eee;font-size:0.85em">Desconectado</span>`;
    const credencial = `
      <div style="background:var(--fundo,#faf8f6);border:1px solid var(--borda,#ddd);border-radius:8px;padding:10px 12px;margin:8px 0">
        <div style="font-size:0.85em;margin-bottom:6px">
          🔑 Credencial (Client ID): ${p.client_id_configurado
            ? '<b style="color:green">configurada ✓</b>'
            : '<b style="color:var(--vermelho)">necessária para conectar</b>'}
        </div>
        <div style="display:flex;gap:6px">
          <input class="cid-${key}" placeholder="${p.client_id_configurado ? 'Cole um novo valor para trocar' : 'Cole aqui o Client ID'}" style="flex:1;font-size:0.85em">
          <button class="btn btn-suave" data-acao="salvarCid" data-prov="${key}">Salvar</button>
        </div>
        <details style="margin-top:6px;font-size:0.78em;color:var(--texto-suave)">
          <summary style="cursor:pointer">Como obter (faço uma única vez e uso em todos os clientes)</summary>
          ${key === 'google'
            ? `1. Acesse <b>console.cloud.google.com</b> → crie um projeto.<br>
               2. "APIs e serviços" → ative a <b>Google Drive API</b>.<br>
               3. "Tela de permissão OAuth" → tipo Externo → publique.<br>
               4. "Credenciais" → Criar credencial → <b>ID do cliente OAuth</b> → tipo <b>App para computador</b>.<br>
               5. Copie o <b>ID do cliente</b> (termina com .apps.googleusercontent.com) e cole acima.`
            : `1. Acesse <b>portal.azure.com</b> → "Registros de aplicativo" → Novo registro.<br>
               2. Contas: "Contas em qualquer diretório + contas Microsoft pessoais".<br>
               3. Redirecionamento: plataforma <b>Aplicativos móveis e de desktop</b>, URI <b>http://localhost:9741/callback</b>.<br>
               4. Copie o <b>ID do aplicativo (cliente)</b> e cole acima.`}
        </details>
      </div>`;

    return `
      <div style="border:1px solid var(--borda,#ddd);border-radius:8px;padding:20px;margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <h4 style="margin:0">${key === 'google' ? '🟦' : '🟩'} ${esc(p.nome)}</h4>
          ${badge}
        </div>
        ${credencial}
        <p style="font-size:0.88em;color:var(--texto-suave);margin:4px 0">
          Último backup: <b>${ultimoBackup}</b>
          ${p.conta ? ` · Conta: ${esc(p.conta)}` : ''}
        </p>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          ${!p.conectado
            ? `<button class="btn btn-primario" data-acao="conectar" data-prov="${key}" ${p.client_id_configurado ? '' : 'disabled title="Salve a credencial acima primeiro"'}>Conectar com ${esc(p.nome)}</button>`
            : `<button class="btn btn-primario" data-acao="backup" data-prov="${key}">☁ Fazer backup agora</button>
               <button class="btn" data-acao="desconectar" data-prov="${key}" style="color:var(--vermelho)">Desconectar</button>`
          }
        </div>
        <div class="nuvem-msg-${key}" style="margin-top:8px;font-size:0.9em"></div>
      </div>`;
  }).join('');

  alvo.innerHTML = `
    <h3 style="margin-bottom:4px">☁️ Backup na Nuvem</h3>
    <p style="color:var(--texto-suave);font-size:0.9em;margin-bottom:20px">
      Backup automático do banco de dados após fechar o caixa e diariamente enquanto o sistema estiver aberto.
      Mantém os últimos 30 arquivos. Requer conexão com a internet.
    </p>
    ${cards}
    <p style="font-size:0.8em;color:var(--texto-suave);margin-top:8px">
      Depois de salvar a credencial, clique em Conectar: o navegador abre, você entra na conta
      e o resto é automático. A credencial é do desenvolvedor — o cliente só faz o login.
    </p>`;

  alvo.querySelectorAll('[data-acao]').forEach(btn => {
    btn.onclick = async () => {
      const acao = btn.dataset.acao;
      const prov = btn.dataset.prov;
      const msg = alvo.querySelector(`.nuvem-msg-${prov}`);
      btn.disabled = true;
      if (acao === 'conectar') {
        msg.textContent = 'Abrindo navegador para autenticação…';
        const r2 = await api('nuvem:conectar', { provider: prov });
        if (r2.ok) { toast(`${r2.nome} conectado! ✅`); await renderNuvem(alvo); }
        else { msg.style.color = 'var(--vermelho)'; msg.textContent = r2.erro; btn.disabled = false; }
      } else if (acao === 'backup') {
        msg.textContent = 'Fazendo backup…';
        const r2 = await api('nuvem:backup', { provider: prov });
        if (r2.ok) { msg.style.color = 'green'; msg.textContent = `✅ Backup concluído: ${r2.arquivo}`; await renderNuvem(alvo); }
        else { msg.style.color = 'var(--vermelho)'; msg.textContent = `❌ ${r2.erro}`; btn.disabled = false; }
      } else if (acao === 'desconectar') {
        if (!confirm(`Desconectar ${prov === 'google' ? 'Google Drive' : 'OneDrive'}?`)) { btn.disabled = false; return; }
        await api('nuvem:desconectar', { provider: prov });
        toast('Desconectado.'); await renderNuvem(alvo);
      } else if (acao === 'salvarCid') {
        const campo = alvo.querySelector(`.cid-${prov}`);
        const valor = campo.value.trim();
        if (!valor) { msg.style.color = 'var(--vermelho)'; msg.textContent = 'Cole o Client ID antes de salvar.'; btn.disabled = false; return; }
        const r2 = await api('nuvem:salvarClientId', { provider: prov, client_id: valor });
        if (r2.ok) { toast('Credencial salva. ✅'); await renderNuvem(alvo); }
        else { msg.style.color = 'var(--vermelho)'; msg.textContent = r2.erro; btn.disabled = false; }
      }
    };
  });
}

// ---- Aba: Backup manual e restauração ----
async function abaBackup(corpo) {
  const painel = el(`<div class="painel" style="padding:22px;max-width:680px">
    <h3 style="margin:0 0 6px">Backup manual</h3>
    <p style="color:var(--texto-suave);margin:0 0 14px">
      Salve uma cópia completa do banco de dados onde quiser (pendrive, pasta na rede, etc.).
    </p>
    <button class="btn btn-primario" id="bk-fazer">💾 Fazer backup agora…</button>

    <hr style="border:none;border-top:1px solid var(--borda);margin:22px 0">

    <h3 style="margin:0 0 6px">Restaurar backup</h3>
    <p style="color:var(--texto-suave);margin:0 0 14px">
      Substitui os dados atuais por um arquivo de backup (.db). Uma cópia de segurança dos
      dados atuais é criada automaticamente antes, e o sistema reinicia ao concluir.
    </p>
    <button class="btn btn-suave" id="bk-restaurar" style="color:var(--vermelho)">↩️ Restaurar de um arquivo…</button>

    <hr style="border:none;border-top:1px solid var(--borda);margin:22px 0">

    <h3 style="margin:0 0 6px">Backups automáticos locais</h3>
    <p style="color:var(--texto-suave);margin:0 0 10px">
      O sistema guarda 1 cópia por dia (últimos 30 dias) em: <code id="bk-pasta" style="font-size:11px"></code>
    </p>
    <div id="bk-lista"><p style="color:var(--texto-suave)">Carregando…</p></div>
    <div class="erro" id="bk-erro" style="margin-top:10px"></div>
  </div>`);
  corpo.appendChild(painel);

  painel.querySelector('#bk-fazer').onclick = async () => {
    const r = await api('backup:manual');
    if (!r.ok) { if (r.erro !== 'Operação cancelada.') painel.querySelector('#bk-erro').textContent = r.erro; return; }
    toast('Backup salvo em: ' + r.arquivo);
  };

  painel.querySelector('#bk-restaurar').onclick = async () => {
    const r = await api('backup:restaurar');
    if (!r.ok && r.erro !== 'Operação cancelada.') painel.querySelector('#bk-erro').textContent = r.erro;
    // em caso de sucesso o app reinicia sozinho
  };

  const r = await api('backup:listarLocais');
  if (r.ok) {
    painel.querySelector('#bk-pasta').textContent = r.pasta;
    const lista = painel.querySelector('#bk-lista');
    if (!r.backups.length) {
      lista.innerHTML = '<p style="color:var(--texto-suave)">Nenhum backup automático ainda — o primeiro é criado na próxima abertura do sistema.</p>';
    } else {
      lista.innerHTML = `<table><thead><tr><th>Arquivo</th><th class="num">Tamanho</th></tr></thead>
        <tbody>${r.backups.map(b => `<tr><td>${esc(b.nome)}</td><td class="num">${(b.tamanho / 1024).toFixed(0)} KB</td></tr>`).join('')}</tbody></table>`;
    }
  }
}

// ---- Aba: Acesso em Rede (multiterminal) ----
async function abaRede(corpo) {
  const r = await api('rede:status');
  const painel = el(`<div class="painel" style="padding:22px;max-width:680px">
    <p style="color:var(--texto-suave);margin-bottom:16px">
      Com o acesso em rede ligado, outros computadores e tablets da loja usam o sistema
      <b>pelo navegador</b>, sem instalar nada — basta este computador estar ligado com o sistema aberto.
      Cada terminal tem seu próprio login e permissões.
    </p>
    <div id="rd-corpo"></div>
    <div class="erro" id="rd-erro" style="margin-top:10px"></div>
  </div>`);
  corpo.appendChild(painel);
  const div = painel.querySelector('#rd-corpo');

  if (!r.ok) { div.innerHTML = `<p style="color:var(--vermelho)">${esc(r.erro)}</p>`; return; }

  div.innerHTML = `
    <label style="display:flex;gap:10px;align-items:center;margin-bottom:14px;font-size:14px">
      <input type="checkbox" id="rd-ativa" ${r.ativa_config ? 'checked' : ''}>
      <b>Ligar acesso em rede</b>
    </label>
    <div class="campo" style="max-width:160px"><label>Porta</label><input id="rd-porta" type="number" value="${esc(r.porta)}"></div>
    <button class="btn btn-primario" id="rd-aplicar" style="margin:8px 0 16px">Aplicar</button>
    <div id="rd-status"></div>
    <p style="color:var(--texto-suave);font-size:12px;margin-top:14px">
      ⚠️ Impressão silenciosa, backups e conexões de nuvem funcionam apenas neste computador (principal).
      Nos terminais, a impressão usa o diálogo do navegador. Se o Firewall do Windows perguntar, permita o acesso em redes privadas.
    </p>`;

  const renderStatus = (s) => {
    const alvo = div.querySelector('#rd-status');
    if (!s.ativa) { alvo.innerHTML = '<p style="color:var(--texto-suave)">Servidor desligado.</p>'; return; }
    const links = (s.ips || []).map(i => {
      const url = `http://${i.ip}:${s.porta}`;
      return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0">
        <a href="#" class="rd-link" data-url="${esc(url)}" style="font-weight:700;font-size:15px;color:var(--vinho);text-decoration:underline;cursor:pointer">${esc(url)}</a>
        <button type="button" class="btn btn-suave rd-copiar" data-url="${esc(url)}" style="padding:2px 10px;font-size:11px">📋 copiar</button>
        <small style="color:var(--texto-suave)">(${esc(i.interface)})</small>
      </div>`;
    }).join('');
    alvo.innerHTML = `<div style="background:var(--fundo);border:1px solid var(--borda);border-radius:8px;padding:12px 14px">
      🟢 <b>Servidor ativo.</b> Endereços para os terminais (clique para abrir no navegador):${links || '<div>Nenhuma rede detectada.</div>'}
      <div style="font-size:12px;color:var(--texto-suave);margin-top:6px">Terminais conectados agora: ${s.terminais || 0}</div>
    </div>`;
    alvo.querySelectorAll('.rd-link').forEach(a => a.onclick = async (e) => {
      e.preventDefault();
      const r3 = await api('rede:abrirNavegador', { url: a.dataset.url });
      if (!r3.ok) window.open(a.dataset.url, '_blank'); // num terminal (navegador), abre em nova aba
    });
    alvo.querySelectorAll('.rd-copiar').forEach(b => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.url); toast('Endereço copiado. 📋'); }
      catch { toast('Não foi possível copiar automaticamente.', true); }
    });
  };
  renderStatus(r);

  div.querySelector('#rd-aplicar').onclick = async () => {
    painel.querySelector('#rd-erro').textContent = '';
    const r2 = await api('rede:aplicar', {
      ativa: div.querySelector('#rd-ativa').checked,
      porta: Number(div.querySelector('#rd-porta').value) || 8750
    });
    if (!r2.ok) { painel.querySelector('#rd-erro').textContent = r2.erro; return; }
    toast(r2.ativa ? 'Acesso em rede ligado.' : 'Acesso em rede desligado.');
    const s = await api('rede:status');
    if (s.ok) renderStatus(s);
  };
}

// ---- Aba: Licença ----
async function abaLicenca(corpo) {
  const r = await api('licenca:status');
  const painel = el(`<div class="painel" style="padding:22px;max-width:680px"><div id="lc-corpo"></div></div>`);
  corpo.appendChild(painel);
  const div = painel.querySelector('#lc-corpo');
  if (!r.ok) { div.innerHTML = `<p style="color:var(--vermelho)">${esc(r.erro)}</p>`; return; }

  const situacao = r.sem_licenca
    ? '<span class="pill pill-ok">sem restrições</span>'
    : (r.vencida ? '<span class="pill pill-baixo">VENCIDA</span>' : '<span class="pill pill-ok">ativa</span>');

  div.innerHTML = `
    <div style="background:var(--fundo);border:1px solid var(--borda);border-radius:8px;padding:14px 16px;margin-bottom:16px">
      <div style="margin-bottom:6px">Plano: <b>${esc(r.nome_plano)}</b> · Situação: ${situacao}</div>
      ${r.validade ? `<div style="margin-bottom:6px">Pago até: <b>${esc(r.validade)}</b></div>` : ''}
      <div>ID desta instalação: <b style="letter-spacing:2px">${esc(r.cliente_id)}</b></div>
      <div style="font-size:12px;color:var(--texto-suave);margin-top:6px">Informe este ID ao suporte para renovar ou mudar de plano.</div>
    </div>
    <h3 style="margin:0 0 8px">Renovar / ativar código</h3>
    <div style="display:flex;gap:8px;max-width:480px">
      <input id="lc-cod" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" style="flex:1;text-transform:uppercase">
      <button class="btn btn-primario" id="lc-renovar">Aplicar</button>
    </div>
    <div class="erro" id="lc-erro" style="margin-top:8px"></div>`;

  div.querySelector('#lc-renovar').onclick = async () => {
    const r2 = await api('licenca:renovar', { codigo: div.querySelector('#lc-cod').value });
    if (!r2.ok) { div.querySelector('#lc-erro').textContent = r2.erro; return; }
    toast(`Licença renovada — plano ${r2.plano} até ${r2.validade}. ✅`);
    corpo.innerHTML = ''; abaLicenca(corpo);
  };
}

// ---- Aba: Impressoras ----
async function abaImpressoras(corpo) {
  // Num terminal em rede não há impressão silenciosa remota: cada máquina
  // imprime na SUA impressora pelo diálogo do navegador. Nada a configurar aqui.
  if (EM_REDE) {
    corpo.appendChild(el(`<div class="painel" style="padding:22px;max-width:680px">
      <h3 style="margin:0 0 10px">🖨️ Impressão neste terminal</h3>
      <p style="color:var(--texto-suave);margin:0 0 10px">
        Este computador está acessando o sistema pela rede. Aqui, <b>cada máquina imprime na sua
        própria impressora</b>: ao imprimir cupom ou etiquetas, abre o diálogo do navegador e você
        escolhe a impressora instalada <b>nesta</b> máquina (ex.: caixa imprime cupom na térmica dele,
        estoque imprime etiquetas na impressora de etiquetas dele).
      </p>
      <p style="color:var(--texto-suave);margin:0;font-size:12.5px">
        💡 Dica: no diálogo do navegador dá para marcar a impressora como padrão e desativar
        cabeçalhos/rodapés. A impressão <b>silenciosa</b> (sem diálogo) é configurada apenas no
        computador principal, nesta mesma aba.
      </p>
    </div>`));
    return;
  }
  const cfg = getConfig();
  const painel = el(`<div class="painel" style="padding:22px;max-width:680px">
    <p style="color:var(--texto-suave);margin-bottom:18px">
      Configure impressoras dedicadas para cada finalidade. Quando configurado, o sistema imprime
      <b>silenciosamente</b> sem abrir o diálogo do Windows. Deixe em branco para usar o diálogo padrão.
    </p>
    <div id="imp-corpo"><p style="color:var(--texto-suave)">Carregando impressoras…</p></div>
    <div class="erro" id="imp-erro" style="margin-top:10px"></div>
    <button class="btn btn-primario" id="imp-salvar" style="margin-top:16px">Salvar impressoras</button>
  </div>`);

  corpo.appendChild(painel);

  const r = await api('config:listarImpressoras');
  const div = painel.querySelector('#imp-corpo');

  if (!r.ok) {
    div.innerHTML = `<p style="color:var(--vermelho)">Erro ao listar impressoras: ${esc(r.erro)}</p>`;
    return;
  }

  const opts = ['<option value="">— Usar diálogo do Windows —</option>',
    ...r.impressoras.map(p =>
      `<option value="${esc(p.nome)}"${p.padrao ? ' style="font-weight:bold"' : ''}>${esc(p.nome)}${p.padrao ? ' ★' : ''}</option>`)
  ].join('');

  const mkSelect = (id, label, dica) => `
    <div class="campo" style="margin-bottom:18px">
      <label><b>${esc(label)}</b></label>
      <select id="${id}">${opts}</select>
      <small style="color:var(--texto-suave)">${esc(dica)}</small>
    </div>`;

  div.innerHTML =
    mkSelect('imp-cupom', '🧾 Impressora de Cupom / Comprovante',
      'Impressora térmica de 80mm para comprovantes de venda, cancelamentos e devoluções.') +
    mkSelect('imp-etiqueta', '🏷️ Impressora de Etiquetas',
      'Impressora de etiquetas com código de barras ou QR Code.') +
    `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
      <button class="btn btn-suave" id="imp-teste-cupom" type="button">🖨 Testar cupom</button>
      <button class="btn btn-suave" id="imp-teste-etiqueta" type="button">🖨 Testar etiqueta</button>
    </div>`;

  painel.querySelector('#imp-cupom').value = cfg.impressora_cupom || '';
  painel.querySelector('#imp-etiqueta').value = cfg.impressora_etiqueta || '';

  painel.querySelector('#imp-teste-cupom').onclick = async () => {
    const nome = painel.querySelector('#imp-cupom').value;
    if (!nome) { toast('Selecione uma impressora de cupom antes de testar.', true); return; }
    let area = document.getElementById('area-impressao');
    if (!area) { area = document.createElement('div'); area.id = 'area-impressao'; document.body.appendChild(area); }
    area.innerHTML = `<div class="cupom"><div class="c-centro"><b>TESTE DE IMPRESSAO</b><br>Cupom de comprovante<br><br>Se aparecer aqui a impressora esta OK</div></div>`;
    const rt = await api('config:imprimir', { tipo: 'cupom' });
    if (!rt.ok) window.print();
  };
  painel.querySelector('#imp-teste-etiqueta').onclick = async () => {
    const nome = painel.querySelector('#imp-etiqueta').value;
    if (!nome) { toast('Selecione uma impressora de etiquetas antes de testar.', true); return; }
    let area = document.getElementById('area-impressao');
    if (!area) { area = document.createElement('div'); area.id = 'area-impressao'; document.body.appendChild(area); }
    area.innerHTML = `<div class="etq-grid"><div class="etiqueta"><div class="loja">TESTE</div><div class="prod">Produto Teste</div><div class="var">P / Branco</div><div class="cod-num">0000000000000</div></div></div>`;
    const rt = await api('config:imprimir', { tipo: 'etiqueta' });
    if (!rt.ok) window.print();
  };

  painel.querySelector('#imp-salvar').onclick = async () => {
    const r2 = await api('config:salvar', {
      impressora_cupom: painel.querySelector('#imp-cupom').value,
      impressora_etiqueta: painel.querySelector('#imp-etiqueta').value
    });
    if (!r2.ok) { painel.querySelector('#imp-erro').textContent = r2.erro; return; }
    await recarregarConfig();
    toast('Impressoras salvas.');
  };
}
