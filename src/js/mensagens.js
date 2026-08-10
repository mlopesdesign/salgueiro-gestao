// Mensagens internas — balão flutuante, tela cheia e avisos do administrador.
// Não existe servidor de chat: tudo é lido e gravado no banco central do
// computador principal, e a interface pergunta "tem novidade?" de tempos em
// tempos (polling). Funciona igual no app e nos terminais em rede.
import { api, el, esc, toast, EM_REDE } from './app.js';

const INTERVALO_PARADO = 12000;   // sem o painel aberto
const INTERVALO_ABERTO = 4000;    // conversando: resposta quase imediata

let _timer = null;
let _eu = null;
let _resumo = { naoLidas: 0, conversas: [], avisos: [], online: [], podeAvisar: false, ativo: false };
let _painel = null;
let _balao = null;
let _alvoAberto = null;      // 'geral' | id do usuário | null (lista)
let _ultimoId = 0;           // maior id já desenhado na thread aberta
let _avisoNaTela = false;
let _anterior = 0;           // não lidas do ciclo anterior (para o som)
let _telaAtiva = null;       // instância da tela cheia, quando aberta

// ── utilidades ───────────────────────────────────────────────────────────────
const hhmm = s => String(s || '').slice(11, 16);
const dia = s => String(s || '').slice(0, 10);
const diaBr = s => { const p = dia(s).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''; };
const iniciais = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();

function rotuloDia(s) {
  const hoje = new Date();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ontem = new Date(hoje.getTime() - 86400000);
  if (dia(s) === iso(hoje)) return 'Hoje';
  if (dia(s) === iso(ontem)) return 'Ontem';
  return diaBr(s);
}

function somLigado() { return localStorage.getItem('salg_msg_som') !== '0'; }
function alternarSom() {
  localStorage.setItem('salg_msg_som', somLigado() ? '0' : '1');
  return somLigado();
}
// Bip curto gerado na hora (sem arquivo de áudio, funciona offline)
function bip() {
  if (!somLigado()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => { try { ctx.close(); } catch {} }, 600);
  } catch { /* som é enfeite: nunca pode quebrar o sistema */ }
}

function telaAtual() {
  const a = document.querySelector('.menu a.ativo');
  return a ? a.dataset.id : null;
}

// ── ciclo de vida ────────────────────────────────────────────────────────────
export function iniciarMensagens(usuario) {
  pararMensagens();
  _eu = usuario;
  _anterior = 0;
  montarBalao();
  tick();
  agendar();
}

export function pararMensagens() {
  document.getElementById('msg-etiqueta')?.remove();
  document.getElementById('msg-toast')?.remove();
  if (_timer) { clearInterval(_timer); _timer = null; }
  if (_balao) { _balao.remove(); _balao = null; }
  if (_painel) { _painel.remove(); _painel = null; }
  document.querySelectorAll('.aviso-fundo').forEach(n => n.remove());
  _alvoAberto = null; _avisoNaTela = false; _telaAtiva = null; _eu = null;
}

function agendar() {
  if (_timer) clearInterval(_timer);
  const abertoAgora = _painel && _painel.classList.contains('aberto');
  _timer = setInterval(tick, abertoAgora || _telaAtiva ? INTERVALO_ABERTO : INTERVALO_PARADO);
  // Na tela cheia de Mensagens o balão só atrapalharia (fica em cima do campo)
  if (_balao) _balao.style.display = _telaAtiva ? 'none' : (_resumo.ativo ? 'flex' : 'none');
  if (_telaAtiva && _painel) _painel.classList.remove('aberto');
}

async function tick() {
  if (!_eu) return;
  const r = await api('mensagens:resumo', { origem: EM_REDE ? 'rede' : 'local', tela: telaAtual() });
  if (!r || !r.ok) return;
  _resumo = r;

  if (_balao) {
    _balao.style.display = (r.ativo && !_telaAtiva) ? 'flex' : 'none';
    const b = _balao.querySelector('.badge');
    b.textContent = r.naoLidas > 99 ? '99+' : String(r.naoLidas);
    b.style.display = r.naoLidas ? 'flex' : 'none';
    _balao.classList.toggle('tem-nova', r.naoLidas > 0);
  }
  // Aviso VISUAL de mensagem nova. Muitas máquinas da loja não têm som, então o
  // bip sozinho não serve: quem está no PDV precisa ver sem olhar para o canto.
  if (r.naoLidas > _anterior) {
    bip();
    avisarNova(r, r.naoLidas - _anterior);
  }
  _anterior = r.naoLidas;
  atualizarEtiqueta(r.naoLidas);

  if (Array.isArray(r.avisos) && r.avisos.length && !_avisoNaTela) mostrarAviso(r.avisos[0]);

  // conversa aberta no balão: puxa só o que chegou depois da última desenhada
  if (_painel && _painel.classList.contains('aberto') && _alvoAberto !== null) {
    await puxarNovas(_painel.querySelector('.msg-thread'), _alvoAberto);
  }
  if (_telaAtiva && _telaAtiva.alvo !== null) {
    await puxarNovas(_telaAtiva.el.querySelector('.msg-thread'), _telaAtiva.alvo, _telaAtiva);
  }
}

// ── balão flutuante ──────────────────────────────────────────────────────────
function montarBalao() {
  _balao = el(`<button class="msg-balao" title="Mensagens internas">💬<span class="badge">0</span></button>`);
  _balao.style.display = 'none';
  _balao.onclick = () => alternarPainel();
  document.body.appendChild(_balao);

  _painel = el(`
    <div class="msg-painel">
      <div class="msg-cab">
        <button class="voltar" style="display:none" title="Voltar">‹</button>
        <h3>Mensagens<small>Conversas da equipe</small></h3>
        <button class="som" title="Som de aviso">🔔</button>
        <button class="expandir" title="Abrir em tela cheia">⤢</button>
        <button class="fechar" title="Fechar">×</button>
      </div>
      <div class="msg-corpo"></div>
    </div>`);
  _painel.querySelector('.fechar').onclick = () => alternarPainel(false);
  _painel.querySelector('.voltar').onclick = () => abrirLista();
  _painel.querySelector('.expandir').onclick = () => {
    alternarPainel(false);
    const link = document.querySelector('.menu a[data-id="mensagens"]');
    if (link) link.click();
  };
  const btSom = _painel.querySelector('.som');
  btSom.textContent = somLigado() ? '🔔' : '🔕';
  btSom.onclick = () => {
    btSom.textContent = alternarSom() ? '🔔' : '🔕';
    toast(somLigado() ? 'Som de mensagem ligado.' : 'Som de mensagem desligado.');
  };
  document.body.appendChild(_painel);
}

function alternarPainel(forcar) {
  if (!_painel) return;
  const abrir = forcar === undefined ? !_painel.classList.contains('aberto') : forcar;
  _painel.classList.toggle('aberto', abrir);
  if (abrir) abrirLista();
  agendar();
}

export function abrirBalao(alvo) {
  if (!_painel) return;
  _painel.classList.add('aberto');
  abrirConversa(alvo);
  agendar();
}

async function abrirLista() {
  _alvoAberto = null;
  const cab = _painel.querySelector('.msg-cab');
  cab.querySelector('.voltar').style.display = 'none';
  cab.querySelector('h3').innerHTML = 'Mensagens<small>Conversas da equipe</small>';
  const corpo = _painel.querySelector('.msg-corpo');
  corpo.innerHTML = '<div class="msg-vazio">Carregando…</div>';

  const r = await api('mensagens:contatos');
  if (!r.ok) { corpo.innerHTML = `<div class="msg-vazio">${esc(r.erro)}</div>`; return; }
  corpo.innerHTML = '';
  corpo.appendChild(itemConversa({
    nome: 'Canal geral', sub: r.geral.ultima || 'Recado para toda a equipe',
    n: r.geral.nao_lidas, geral: true, online: false
  }, () => abrirConversa('geral', 'Canal geral')));

  if (!r.usuarios.length) {
    corpo.appendChild(el('<div class="msg-vazio">Ainda não há outros usuários cadastrados.<br>Crie usuários em Configurações → Usuários.</div>'));
  }
  for (const u of r.usuarios) {
    corpo.appendChild(itemConversa({
      nome: u.nome, sub: u.ultima || (u.online ? 'Online agora' : 'Sem mensagens'),
      n: u.nao_lidas, online: u.online
    }, () => abrirConversa(u.id, u.nome)));
  }
}

function itemConversa(d, aoClicar) {
  const item = el(`
    <div class="msg-item">
      <div class="msg-avatar${d.geral ? ' geral' : ''}">${d.geral ? '📢' : esc(iniciais(d.nome))}
        ${d.online ? '<span class="pt-online"></span>' : ''}</div>
      <div class="msg-item-txt"><b>${esc(d.nome)}</b><small>${esc(d.sub || '')}</small></div>
      ${d.n ? `<span class="n">${d.n > 99 ? '99+' : d.n}</span>` : ''}
    </div>`);
  item.onclick = aoClicar;
  return item;
}

async function abrirConversa(alvo, nomeConhecido) {
  _alvoAberto = alvo;
  const cab = _painel.querySelector('.msg-cab');
  cab.querySelector('.voltar').style.display = '';
  const nome = alvo === 'geral' ? 'Canal geral' : (nomeConhecido || nomeDe(alvo));
  const on = alvo !== 'geral' && (_resumo.online || []).includes(Number(alvo));
  cab.querySelector('h3').innerHTML =
    `${esc(nome)}<small>${alvo === 'geral' ? 'Todo mundo vê' : (on ? 'Online agora' : 'Offline')}</small>`;

  const corpo = _painel.querySelector('.msg-corpo');
  corpo.innerHTML = '';
  const thread = el('<div class="msg-thread"></div>');
  corpo.appendChild(thread);
  if (!_painel.querySelector('.msg-campo')) _painel.appendChild(campoEnvio(() => _alvoAberto, thread));
  else _painel.querySelector('.msg-campo').style.display = 'flex';

  await carregarThread(thread, alvo);
  const t = _painel.querySelector('.msg-campo textarea');
  if (t) t.focus();
}

function nomeDe(id) {
  const c = (_resumo.conversas || []).find(x => x.outro_id === Number(id));
  return (c && c.nome) || (_telaAtiva && _telaAtiva.nomes && _telaAtiva.nomes[id]) || 'Conversa';
}

// ── thread (usada pelo balão e pela tela cheia) ──────────────────────────────
async function carregarThread(thread, alvo) {
  thread.innerHTML = '<div class="msg-vazio">Carregando…</div>';
  const r = await api('mensagens:historico', { alvo });
  thread.innerHTML = '';
  if (!r.ok) { thread.innerHTML = `<div class="msg-vazio">${esc(r.erro)}</div>`; return; }
  if (!r.mensagens.length) {
    thread.innerHTML = '<div class="msg-vazio">Nenhuma mensagem ainda.<br>Escreva a primeira abaixo. 👇</div>';
  }
  thread.dataset.ultimoDia = '';
  for (const m of r.mensagens) desenharBolha(thread, m, r.eu);
  _ultimoId = r.mensagens.length ? r.mensagens[r.mensagens.length - 1].id : 0;
  thread.dataset.ultimo = String(_ultimoId);
  rolar(thread);
  await api('mensagens:marcarLido', { alvo });
  tickBadgeZero(alvo);
}

async function puxarNovas(thread, alvo, telaRef) {
  if (!thread) return;
  const apos = Number(thread.dataset.ultimo || 0);
  const r = await api('mensagens:historico', { alvo, apos });
  if (!r.ok || !r.mensagens.length) return;
  const vazio = thread.querySelector('.msg-vazio');
  if (vazio) vazio.remove();
  for (const m of r.mensagens) desenharBolha(thread, m, r.eu);
  thread.dataset.ultimo = String(r.mensagens[r.mensagens.length - 1].id);
  rolar(thread);
  await api('mensagens:marcarLido', { alvo });
  tickBadgeZero(alvo);
  if (telaRef && telaRef.recarregarLista) telaRef.recarregarLista();
}

function desenharBolha(thread, m, euId) {
  const d = rotuloDia(m.criado_em);
  if (thread.dataset.ultimoDia !== d) {
    thread.appendChild(el(`<span class="msg-dia">${esc(d)}</span>`));
    thread.dataset.ultimoDia = d;
  }
  const meu = Number(m.autor_id) === Number(euId);
  thread.appendChild(el(`
    <div class="msg-bolha${meu ? ' eu' : ''}">
      ${meu ? '' : `<span class="quem">${esc(m.autor || '—')}</span>`}
      ${esc(m.texto)}<span class="hora">${esc(hhmm(m.criado_em))}</span>
    </div>`));
}

function rolar(thread) {
  const cx = thread.parentElement || thread;
  cx.scrollTop = cx.scrollHeight;
}

// zera o badge na hora, sem esperar o próximo ciclo do polling
function tickBadgeZero(alvo) {
  const conv = (_resumo.conversas || []).find(c =>
    alvo === 'geral' ? c.tipo === 'geral' : c.outro_id === Number(alvo));
  if (!conv || !conv.nao_lidas) return;
  _resumo.naoLidas = Math.max(0, _resumo.naoLidas - conv.nao_lidas);
  conv.nao_lidas = 0;
  _anterior = _resumo.naoLidas;
  atualizarEtiqueta(_resumo.naoLidas);
  document.getElementById('msg-toast')?.remove();
  if (_balao) {
    const b = _balao.querySelector('.badge');
    b.textContent = String(_resumo.naoLidas);
    b.style.display = _resumo.naoLidas ? 'flex' : 'none';
    _balao.classList.toggle('tem-nova', _resumo.naoLidas > 0);
  }
}

function campoEnvio(obterAlvo, thread) {
  const box = el(`
    <div class="msg-campo">
      <textarea placeholder="Escreva a mensagem… (Enter envia)" maxlength="2000"></textarea>
      <button title="Enviar">➤</button>
    </div>`);
  const ta = box.querySelector('textarea');
  const bt = box.querySelector('button');
  const enviar = async () => {
    const texto = ta.value.trim();
    if (!texto) return;
    const alvo = obterAlvo();
    if (alvo === null || alvo === undefined) { toast('Escolha uma conversa primeiro.', true); return; }
    bt.disabled = true;
    const r = await api('mensagens:enviar', { alvo, texto });
    bt.disabled = false;
    if (!r.ok) { toast(r.erro, true); return; }
    ta.value = ''; ta.style.height = '38px';
    const alvoThread = thread.isConnected ? thread : document.querySelector('.msg-thread');
    if (alvoThread) {
      const vazio = alvoThread.querySelector('.msg-vazio');
      if (vazio) vazio.remove();
      desenharBolha(alvoThread, r.mensagem, _eu.id);
      alvoThread.dataset.ultimo = String(r.mensagem.id);
      rolar(alvoThread);
    }
    ta.focus();
  };
  bt.onclick = enviar;
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
  });
  ta.addEventListener('input', () => {
    ta.style.height = '38px';
    ta.style.height = Math.min(ta.scrollHeight, 96) + 'px';
  });
  return box;
}

// ── popup de aviso ───────────────────────────────────────────────────────────
// Etiqueta amarela colada no balão: fica enquanto houver mensagem não lida.
// É o aviso permanente — o toast some, esta não.
function atualizarEtiqueta(n) {
  if (!_balao) return;
  let et = document.getElementById('msg-etiqueta');
  if (!n) { if (et) et.remove(); return; }
  if (!et) {
    et = el(`<button id="msg-etiqueta" class="msg-etiqueta" title="Abrir mensagens"></button>`);
    et.onclick = () => { _balao.click(); };
    document.body.appendChild(et);
  }
  et.innerHTML = `<b>${n}</b> ${n === 1 ? 'nova mensagem' : 'novas mensagens'}`;
}

// Toast de mensagem nova: aparece por alguns segundos com quem mandou e o começo
// do texto. Clicar abre a conversa direto.
function avisarNova(resumo, quantasNovas) {
  const comNaoLidas = (resumo.conversas || [])
    .filter(c => c.nao_lidas > 0)
    .sort((a, b) => String(b.ultima_em || '').localeCompare(String(a.ultima_em || '')));
  const c = comNaoLidas[0];
  if (!c) return;

  document.getElementById('msg-toast')?.remove();
  const t = el(`
    <div id="msg-toast" class="msg-toast" role="status">
      <div class="mt-icone">💬</div>
      <div class="mt-corpo">
        <div class="mt-de">${esc(c.nome || 'Nova mensagem')}${
          comNaoLidas.length > 1 ? ` <span class="mt-mais">+${comNaoLidas.length - 1} conversa(s)</span>` : ''}</div>
        <div class="mt-txt">${esc(String(c.ultima || '').slice(0, 90))}</div>
      </div>
      <button class="mt-fechar" title="Dispensar">✕</button>
    </div>`);
  t.querySelector('.mt-fechar').onclick = (ev) => { ev.stopPropagation(); t.remove(); };
  t.onclick = () => {
    t.remove();
    if (!_painel || !_painel.classList.contains('aberto')) _balao.click();
    const alvo = c.tipo === 'geral' ? 'geral' : c.outro_id;
    setTimeout(() => { try { abrirConversa(alvo, c.nome); } catch {} }, 120);
  };
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add('saindo'); setTimeout(() => t.remove(), 400); }, 7000);
}

function mostrarAviso(a) {
  _avisoNaTela = true;
  const fundo = el(`
    <div class="aviso-fundo">
      <div class="aviso-caixa${a.prioridade === 'urgente' ? ' urgente' : ''}">
        <div class="topo">
          <div class="tag">${a.prioridade === 'urgente' ? '⚠️ Aviso urgente' : '📢 Aviso da administração'}</div>
          <h2>${esc(a.titulo)}</h2>
        </div>
        <div class="txt">${esc(a.texto)}</div>
        <div class="pe">
          <small>Enviado por ${esc(a.autor || '—')} · ${esc(diaBr(a.criado_em))} às ${esc(hhmm(a.criado_em))}</small>
          <button class="btn btn-primario">Entendi</button>
        </div>
      </div>
    </div>`);
  fundo.querySelector('button').onclick = async () => {
    await api('avisos:confirmar', { id: a.id });
    fundo.remove();
    _avisoNaTela = false;
    _resumo.avisos = (_resumo.avisos || []).filter(x => x.id !== a.id);
    if (_resumo.avisos.length) mostrarAviso(_resumo.avisos[0]); // enfileira o próximo
  };
  document.body.appendChild(fundo);
  bip();
  fundo.querySelector('button').focus();
}

// ── tela cheia (item do menu) ────────────────────────────────────────────────
export async function viewMensagens(alvo) {
  const pagina = el(`
    <div>
      <div class="pagina-topo">
        <h1>💬 Mensagens</h1>
        <div style="display:flex;gap:8px">
          <button class="btn btn-suave" id="ms-terminais">🖥️ Quem está online</button>
          <button class="btn btn-primario" id="ms-aviso" style="display:none">📢 Enviar aviso</button>
        </div>
      </div>
      <div class="msg-tela">
        <div class="painel">
          <div class="msg-abas">
            <button class="ativa" data-aba="conversas">Conversas</button>
            <button data-aba="avisos">Avisos</button>
          </div>
          <div class="msg-corpo" id="ms-lista"></div>
        </div>
        <div class="painel" id="ms-direita">
          <div class="msg-cab"><h3>Escolha uma conversa<small>ou use o canal geral</small></h3></div>
          <div class="msg-corpo"><div class="msg-thread"></div></div>
        </div>
      </div>
    </div>`);
  alvo.appendChild(pagina);

  const ctx = { el: pagina, alvo: null, nomes: {}, recarregarLista: null };
  _telaAtiva = ctx;
  agendar();

  const lista = pagina.querySelector('#ms-lista');
  const direita = pagina.querySelector('#ms-direita');
  const btAviso = pagina.querySelector('#ms-aviso');
  let aba = 'conversas';

  const r0 = await api('mensagens:resumo', { origem: EM_REDE ? 'rede' : 'local', tela: 'mensagens' });
  if (r0.ok) _resumo = r0;
  if (_resumo.podeAvisar) btAviso.style.display = '';
  btAviso.onclick = () => formAviso(() => { aba = 'avisos'; marcarAba(); desenhar(); });

  pagina.querySelector('#ms-terminais').onclick = async () => {
    const r = await api('mensagens:terminais');
    if (!r.ok) { toast(r.erro, true); return; }
    const linhas = r.terminais.length
      ? r.terminais.map(t => `<tr><td><b>${esc(t.nome)}</b></td><td>${esc(t.perfil)}</td>
          <td>${t.origem === 'rede' ? '🌐 Terminal em rede' : '🖥️ Computador principal'}</td>
          <td>${esc(t.tela || '—')}</td></tr>`).join('')
      : '<tr><td colspan="4" class="vazio">Ninguém conectado no momento.</td></tr>';
    const { modal } = await import('./app.js');
    modal('Quem está online agora', `
      <table style="width:100%"><thead><tr><th>Pessoa</th><th>Perfil</th><th>Onde</th><th>Tela</th></tr></thead>
      <tbody>${linhas}</tbody></table>
      <p style="font-size:12px;color:var(--texto-suave);margin-top:10px">
        Considera-se online quem deu sinal de vida nos últimos 90 segundos.</p>`,
      (m, fechar) => fechar(), 'Fechar');
  };

  function marcarAba() {
    pagina.querySelectorAll('.msg-abas button').forEach(b =>
      b.classList.toggle('ativa', b.dataset.aba === aba));
  }
  pagina.querySelectorAll('.msg-abas button').forEach(b => {
    b.onclick = () => { aba = b.dataset.aba; marcarAba(); desenhar(); };
  });

  async function desenhar() {
    lista.innerHTML = '<div class="msg-vazio">Carregando…</div>';
    if (aba === 'avisos') { await desenharAvisos(); return; }

    const r = await api('mensagens:contatos');
    if (!r.ok) { lista.innerHTML = `<div class="msg-vazio">${esc(r.erro)}</div>`; return; }
    lista.innerHTML = '';
    ctx.nomes = {};
    lista.appendChild(itemConversa({
      nome: 'Canal geral', sub: r.geral.ultima || 'Recado para toda a equipe',
      n: r.geral.nao_lidas, geral: true
    }, () => abrir('geral', 'Canal geral', 'Todo mundo vê')));
    if (!r.usuarios.length) {
      lista.appendChild(el('<div class="msg-vazio">Só existe você por enquanto.<br>Cadastre a equipe em <b>Configurações → Usuários</b> para conversar em particular.</div>'));
    }
    for (const u of r.usuarios) {
      ctx.nomes[u.id] = u.nome;
      lista.appendChild(itemConversa({
        nome: u.nome, sub: u.ultima || (u.online ? 'Online agora' : 'Sem mensagens'),
        n: u.nao_lidas, online: u.online
      }, () => abrir(u.id, u.nome, u.online ? 'Online agora' : 'Offline')));
    }
  }
  ctx.recarregarLista = () => { if (aba === 'conversas') desenhar(); };

  async function desenharAvisos() {
    const r = await api('avisos:listar', {});
    if (!r.ok) { lista.innerHTML = `<div class="msg-vazio">${esc(r.erro)}</div>`; return; }
    if (!r.avisos.length) {
      lista.innerHTML = '<div class="msg-vazio">Nenhum aviso publicado ainda.</div>';
      return;
    }
    lista.innerHTML = '';
    for (const a of r.avisos) {
      const linha = el(`
        <div class="aviso-linha">
          <div class="cab"><b>${esc(a.titulo)}</b>
            ${a.prioridade === 'urgente' ? '<span class="pill-urgente">urgente</span>' : ''}
            ${a.ativo ? '' : '<span class="pill-encerrado">encerrado</span>'}</div>
          <div class="corpo">${esc(a.texto)}</div>
          <div class="meta">
            <span>${esc(a.autor || '—')} · ${esc(diaBr(a.criado_em))} ${esc(hhmm(a.criado_em))}</span>
            <span>👁️ ${a.lidos}/${a.total} leram</span>
          </div>
        </div>`);
      if (a.destinatarios) {
        const grade = el('<div class="leitura-grade"></div>');
        for (const d of a.destinatarios) {
          grade.appendChild(el(`<span class="leitura-chip${d.confirmado_em ? ' leu' : ''}" title="${
            d.confirmado_em ? 'Leu em ' + esc(diaBr(d.confirmado_em)) + ' ' + esc(hhmm(d.confirmado_em)) : 'Ainda não leu'
          }">${d.confirmado_em ? '✓ ' : '○ '}${esc(d.nome)}</span>`));
        }
        linha.appendChild(grade);
        if (a.ativo) {
          const bt = el('<button class="btn btn-suave" style="margin-top:8px;padding:4px 10px;font-size:12px">Encerrar aviso</button>');
          bt.onclick = async () => {
            const rr = await api('avisos:encerrar', { id: a.id });
            if (!rr.ok) { toast(rr.erro, true); return; }
            toast('Aviso encerrado — não aparece mais nos terminais.');
            desenharAvisos();
          };
          linha.appendChild(bt);
        }
      }
      lista.appendChild(linha);
    }
  }

  async function abrir(alvoId, nome, sub) {
    ctx.alvo = alvoId;
    direita.innerHTML = '';
    direita.appendChild(el(`<div class="msg-cab"><h3>${esc(nome)}<small>${esc(sub)}</small></h3></div>`));
    const corpo = el('<div class="msg-corpo"></div>');
    const thread = el('<div class="msg-thread"></div>');
    corpo.appendChild(thread);
    direita.appendChild(corpo);
    direita.appendChild(campoEnvio(() => ctx.alvo, thread));
    await carregarThread(thread, alvoId);
    desenhar();
    const t = direita.querySelector('textarea');
    if (t) t.focus();
  }

  await desenhar();
}

// Formulário do aviso (só para quem tem mensagens.avisar)
async function formAviso(aoEnviar) {
  const { modal } = await import('./app.js');
  const r = await api('mensagens:contatos');
  const usuarios = r.ok ? r.usuarios : [];
  const m = modal('📢 Enviar aviso para os terminais', `
    <div class="campo"><label>Título</label>
      <input id="av-titulo" maxlength="120" placeholder="Ex.: Fechamento mais cedo hoje"></div>
    <div class="campo"><label>Mensagem</label>
      <textarea id="av-texto" rows="5" maxlength="2000" style="width:100%;padding:9px 12px;border:1px solid var(--borda);border-radius:8px;font:inherit;resize:vertical"
        placeholder="Escreva o recado do jeito que a equipe deve ler."></textarea></div>
    <label class="perm-item"><input type="checkbox" id="av-urgente"> Marcar como <b>urgente</b> (destaque vermelho)</label>
    <label class="perm-item"><input type="checkbox" id="av-selec"> Enviar só para pessoas escolhidas</label>
    <div id="av-lista" style="display:none;margin-top:6px;border:1px solid var(--borda);border-radius:8px;padding:10px;max-height:170px;overflow:auto">
      ${usuarios.map(u => `<label class="perm-item"><input type="checkbox" class="av-u" value="${u.id}"> ${esc(u.nome)} <small style="color:var(--texto-suave)">${esc(u.perfil)}</small></label>`).join('') ||
        '<div style="font-size:12.5px;color:var(--texto-suave)">Nenhum outro usuário cadastrado.</div>'}
    </div>
    <p style="font-size:12px;color:var(--texto-suave);margin-top:10px">
      O aviso aparece na tela de quem estiver logado e fica esperando quem entrar depois.
      Você acompanha quem já confirmou a leitura na aba <b>Avisos</b>.</p>
  `, async (mm, fechar) => {
    const usuariosSel = mm.querySelector('#av-selec').checked
      ? Array.from(mm.querySelectorAll('.av-u:checked')).map(c => Number(c.value)) : [];
    const rr = await api('avisos:enviar', {
      titulo: mm.querySelector('#av-titulo').value,
      texto: mm.querySelector('#av-texto').value,
      prioridade: mm.querySelector('#av-urgente').checked ? 'urgente' : 'normal',
      usuarios: usuariosSel
    });
    if (!rr.ok) { toast(rr.erro, true); return; }
    fechar();
    toast('Aviso enviado para os terminais. ✅');
    if (aoEnviar) aoEnviar();
  }, 'Enviar aviso');
  m.querySelector('#av-selec').onchange = e => {
    m.querySelector('#av-lista').style.display = e.target.checked ? '' : 'none';
  };
}

export function encerrarTelaMensagens() { _telaAtiva = null; agendar(); }
