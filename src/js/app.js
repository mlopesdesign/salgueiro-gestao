// Salgueiro Gestão — interface (SPA sem dependências)
import { viewEstoque, abrirEtiquetas } from './estoque.js';
import { abrirEtiquetasLote } from './etiquetas.js';
import { viewPdv, imprimirVale } from './pdv.js';
import { viewClientes } from './clientes.js';
import { viewFinanceiro } from './financeiro.js';
import { viewCompras } from './compras.js';
import { viewRelatorios } from './relatorios.js';
import { viewRanking } from './ranking.js';
import { viewEstoques } from './estoques.js';
import { viewConfiguracoes } from './configuracoes.js';
import { viewMensagens, iniciarMensagens, pararMensagens, encerrarTelaMensagens } from './mensagens.js';
import { viewCatalogo } from './catalogo.js';

const $app = document.getElementById('app');
let usuario = null;
let categoriasCache = [];
let APP_VERSION = '3.25.36'; // fallback; valor real vem de NL_APPVERSION via api('app:versao')

// API dupla: no aplicativo usa IPC (preload); num terminal em rede (navegador),
// conversa com o servidor do computador principal via HTTP com token de sessão.
function criarApiRede() {
  let token = sessionStorage.getItem('salg_token') || null;
  return async (canal, payload) => {
    try {
      const resp = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Token': token } : {}) },
        body: JSON.stringify({ canal, payload })
      });
      const r = await resp.json();
      if (canal === 'auth:login' && r.ok && r.token) { token = r.token; sessionStorage.setItem('salg_token', token); }
      if (canal === 'auth:logout') { token = null; sessionStorage.removeItem('salg_token'); }
      return r;
    } catch {
      return { ok: false, erro: 'Sem conexão com o computador principal. Verifique se ele está ligado com o sistema aberto.' };
    }
  };
}
// No app desktop o Neutralino está presente → rotas locais (backend no WebView).
// Num terminal em rede (navegador) → HTTP, como na V1.
const NO_APP = typeof window.Neutralino !== 'undefined' && !window.__TERMINAL_REDE;
let _apiLocal = null;
const api = NO_APP
  ? (async (canal, payload) => {
      if (!_apiLocal) _apiLocal = (await import('./backend/servidor.js')).api;
      return _apiLocal(canal, payload);
    })
  : criarApiRede();
const EM_REDE = !NO_APP; // true quando rodando num terminal via navegador
export { api, el, esc, moeda, toast, modal, getConfig, aplicarTema, recarregarConfig, pode, ehAdmin, podeVerTela, getLicenca, setorAtivo, EM_REDE };

async function recarregarVersao() {
  try {
    const r = await api('app:versao');
    if (r?.ok && r.version) APP_VERSION = r.version;
  } catch {}
  return APP_VERSION;
}

// ---------- Licença (blocos liberados) ----------
let LICENCA = { modulos: null, vencida: false };
function getLicenca() { return LICENCA; }
async function recarregarLicenca() {
  const r = await api('licenca:status');
  if (r.ok) LICENCA = r;
  return LICENCA;
}
// tela → módulo da licença (telas fora da lista são sempre visíveis)
const MODULO_TELA = {
  pdv: 'pdv', produtos: 'produtos', categorias: 'produtos', estoque: 'produtos', estoques: 'produtos',
  compras: 'compras', clientes: 'clientes', financeiro: 'financeiro',
  relatorios: 'relatorios', ranking: 'relatorios', vales: 'devolucoes'
};
function moduloLiberado(tela) {
  const mod = MODULO_TELA[tela];
  if (!mod || !Array.isArray(LICENCA.modulos)) return true;
  return LICENCA.modulos.includes(mod);
}

// Setores desligados pelo Dev (some do sistema nesta instalação)
const SETOR_TELA = { compras: 'compras', financeiro: 'financeiro', relatorios: 'relatorios',
  ranking: 'relatorios', vales: 'vales' };
function setorAtivo(setor) {
  const bloq = Array.isArray(LICENCA.setores_bloqueados) ? LICENCA.setores_bloqueados : [];
  return !bloq.includes(setor);
}
function setorTelaAtivo(tela) {
  const setor = SETOR_TELA[tela];
  return !setor || setorAtivo(setor);
}

// ---------- Configuração / tema (white-label) ----------
let CONFIG = {};
function getConfig() { return CONFIG; }
async function recarregarConfig() {
  const r = await api('config:obter');
  if (r.ok) CONFIG = r.config;
  return CONFIG;
}
function aplicarTema() {
  const raiz = document.documentElement.style;
  if (CONFIG.cor_primaria) raiz.setProperty('--vinho', CONFIG.cor_primaria);
  if (CONFIG.cor_escura) raiz.setProperty('--vinho-escuro', CONFIG.cor_escura);
  if (CONFIG.cor_destaque) raiz.setProperty('--dourado', CONFIG.cor_destaque);
  document.title = CONFIG.loja_nome ? `${CONFIG.loja_nome} — Gestão` : 'Salgueiro Gestão';
  document.querySelectorAll('.logo-dinamica').forEach(img => {
    if (CONFIG.logo) { img.src = CONFIG.logo; img.style.display = ''; }
    else img.style.display = 'none';
  });
  document.querySelectorAll('.nome-loja').forEach(n => { n.textContent = CONFIG.loja_nome || 'Minha Loja'; });
  document.querySelectorAll('.sub-loja').forEach(n => { n.textContent = CONFIG.loja_subtitulo || ''; });
}

// ---------- utilidades de UI ----------
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function moeda(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
// Olhinho: todo campo de senha ganha botão para mostrar/ocultar o que digita
function aplicarOlhinhos(raiz) {
  (raiz || document).querySelectorAll('input[type="password"]:not([data-olhinho])').forEach(inp => {
    inp.dataset.olhinho = '1';
    const envolto = document.createElement('div');
    envolto.style.cssText = 'position:relative';
    inp.parentNode.insertBefore(envolto, inp);
    envolto.appendChild(inp);
    inp.style.paddingRight = '38px';
    const olho = document.createElement('button');
    olho.type = 'button';
    olho.tabIndex = -1;
    olho.textContent = '👁';
    olho.title = 'Mostrar/ocultar senha';
    olho.style.cssText = 'position:absolute;right:6px;top:50%;transform:translateY(-50%);' +
      'border:0;background:none;cursor:pointer;font-size:16px;opacity:.55;padding:4px;line-height:1';
    olho.onclick = () => {
      const mostrar = inp.type === 'password';
      inp.type = mostrar ? 'text' : 'password';
      olho.style.opacity = mostrar ? '1' : '.55';
      inp.focus();
    };
    envolto.appendChild(olho);
  });
}

let toastTimer;
function toast(msg, erro = false, onClick = null) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = el(`<div class="toast ${erro ? 'erro' : ''}${onClick ? ' toast-link' : ''}">${esc(msg)}${onClick ? ' <b style="opacity:.8">›</b>' : ''}</div>`);
  document.body.appendChild(t);
  if (onClick) { t.style.cursor = 'pointer'; t.onclick = () => { t.remove(); onClick(); }; }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), onClick ? 7000 : 3200);
}
function modal(titulo, corpoHtml, aoSalvar, rotuloSalvar = 'Salvar') {
  const m = el(`
    <div class="modal-fundo">
      <div class="modal">
        <header><h2>${esc(titulo)}</h2><button class="fechar">×</button></header>
        <div class="corpo">${corpoHtml}</div>
        <footer>
          <button class="btn btn-suave btn-cancelar">Cancelar</button>
          <button class="btn btn-primario btn-salvar">${esc(rotuloSalvar)}</button>
        </footer>
      </div>
    </div>`);
  const fechar = () => m.remove();
  m.querySelector('.fechar').onclick = fechar;
  m.querySelector('.btn-cancelar').onclick = fechar;
  m.addEventListener('mousedown', e => { if (e.target === m) fechar(); });
  m.querySelector('.btn-salvar').onclick = () => aoSalvar(m, fechar);
  document.body.appendChild(m);
  aplicarOlhinhos(m);
  const primeiro = m.querySelector('input, select');
  if (primeiro) primeiro.focus();
  return m;
}

// ---------- Permissões frontend ----------
function pode(chave) {
  if (!usuario) return false;
  if (usuario.perfil === 'admin') return true;
  return Array.isArray(usuario.permissoes) && usuario.permissoes.includes(chave);
}

// Ações que são do DONO da loja, não de quem tem a permissão: mexer no número
// do estoque e ver quem está conectado. O backend recusa de qualquer forma
// (ROTAS_SO_ADMIN em servidor.js) — aqui só evitamos mostrar botão que não
// funciona.
function ehAdmin() {
  return !!usuario && usuario.perfil === 'admin';
}

const PERM_TELA = {
  dashboard: 'dashboard.ver',
  pdv: 'pdv.ver',
  produtos: 'produtos.ver',
  categorias: 'produtos.ver',
  estoque: 'estoque.ver',
  estoques: 'estoque.ver',
  compras: 'compras.ver',
  clientes: 'clientes.ver',
  financeiro: 'financeiro.ver',
  relatorios: 'relatorios.ver',
  ranking: 'relatorios.ver',
  vales: 'vales.ver',
  catalogo: 'produtos.ver',
  mensagens: 'mensagens.usar',
  config: 'config.gerenciar'
};

function podeVerTela(id) {
  if (!usuario) return false;
  if (usuario.perfil === 'admin') return true;
  const perm = PERM_TELA[id];
  if (!perm) return true; // tela sem restrição específica
  return pode(perm);
}

// ---------- Login ----------
function telaLogin() {
  usuario = null;
  pararMensagens(); // tira o balão e o polling da tela de login
  $app.innerHTML = '';
  const tela = el(`
    <div class="login-fundo">
      <div class="login-caixa">
        <img class="logo-img logo-dinamica" style="display:none">
        <h1 class="nome-loja">Minha Loja</h1>
        <p class="sub">Sistema de gestão · <b>por ML Lopes Design</b></p>
        <p class="app-versao">Versão v${esc(APP_VERSION)}</p>
        <div id="lg-licenca"></div>
        <div class="campo"><label>Usuário</label><input id="lg-usuario" autocomplete="off"></div>
        <div class="campo"><label>Senha</label><input id="lg-senha" type="password"></div>
        <div class="erro" id="lg-erro"></div>
        <button class="btn btn-primario btn-bloco" id="lg-entrar">Entrar</button>
        <p style="text-align:center;margin:14px 0 0"><a id="lg-dev" style="cursor:pointer;opacity:.4;font-size:11px">suporte técnico</a></p>
      </div>
    </div>`);
  $app.appendChild(tela);
  aplicarOlhinhos(tela);

  // Aviso de licença vencida + renovação direto na tela de login
  const boxLic = tela.querySelector('#lg-licenca');
  if (LICENCA.vencida) {
    boxLic.appendChild(el(`
      <div style="background:#FFF4E0;border:1px solid #E0B25E;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12.5px">
        ⚠️ <b>Licença vencida em ${esc(LICENCA.validade)}.</b> O sistema está em modo consulta.
        <div style="display:flex;gap:6px;margin-top:8px">
          <input id="lg-cod" placeholder="Código de renovação" style="flex:1;text-transform:uppercase">
          <button class="btn btn-primario" id="lg-renovar" type="button">OK</button>
        </div>
        <div class="erro" id="lg-cod-erro"></div>
      </div>`));
    boxLic.querySelector('#lg-renovar').onclick = async () => {
      const r = await api('licenca:renovar', { codigo: boxLic.querySelector('#lg-cod').value });
      if (!r.ok) { boxLic.querySelector('#lg-cod-erro').textContent = r.erro; return; }
      await recarregarLicenca();
      toast(`Licença renovada — plano ${r.plano} até ${r.validade}. ✅`);
      telaLogin();
    };
  }
  tela.querySelector('#lg-dev').onclick = () => modalDev();

  const entrar = async () => {
    const r = await api('auth:login', {
      usuario: tela.querySelector('#lg-usuario').value,
      senha: tela.querySelector('#lg-senha').value
    });
    if (!r.ok) { tela.querySelector('#lg-erro').textContent = r.erro; return; }
    usuario = r.usuario;
    telaPrincipal();
  };
  tela.querySelector('#lg-entrar').onclick = entrar;
  tela.addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
  aplicarTema();
  tela.querySelector('#lg-usuario').focus();
}

// ---------- Shell principal ----------
const MENU = [
  { id: 'dashboard', rotulo: '📊 Painel' },
  { id: 'pdv', rotulo: '🛒 PDV — Vendas' },
  { id: 'produtos', rotulo: '👗 Produtos' },
  { id: 'categorias', rotulo: '🏷️ Categorias' },
  { id: 'estoque', rotulo: '📦 Estoque' },
  { id: 'estoques', rotulo: '🏢 Estoques (locais)' },
  { id: 'compras', rotulo: '🚚 Compras' },
  { id: 'clientes', rotulo: '👥 Clientes' },
  { id: 'financeiro', rotulo: '💰 Financeiro' },
  { id: 'relatorios', rotulo: '📈 Relatórios' },
  { id: 'ranking', rotulo: '🏆 Ranking' },
  { id: 'vales', rotulo: '🎫 Vales-Troca' },
  { id: 'catalogo', rotulo: '📔 Catálogo' },
  { id: 'mensagens', rotulo: '💬 Mensagens' },
  { id: 'config', rotulo: '⚙️ Configurações' }
];

function telaPrincipal() {
  $app.innerHTML = '';
  const shell = el(`
    <div class="layout">
      <button class="menu-toggle" id="btn-menu" title="Menu" aria-label="Abrir o menu">☰</button>
      <div class="menu-fundo" id="menu-fundo"></div>
      <aside class="sidebar">
        <div class="logo"><img class="logo-dinamica" style="display:none">
          <div><h2 class="nome-loja" style="font-size:15px">Minha Loja</h2><span class="sub-loja"></span></div></div>
        <nav class="menu"></nav>
        <div class="rodape">
          <div class="nome">${esc(usuario.nome)}</div>
          <div>${esc(usuario.perfil)} · <a id="sair">sair</a></div>
          <div id="sidebar-versao" style="margin-top:4px;font-size:10.5px;opacity:.45">v${esc(APP_VERSION)}</div>
          <div id="update-aviso" style="display:none;margin-top:5px;font-size:11px;color:var(--dourado);cursor:pointer;text-decoration:underline"></div>
        </div>
      </aside>
      <main class="conteudo" id="conteudo"></main>
    </div>`);
  const nav = shell.querySelector('.menu');
  for (const item of MENU) {
    if (!podeVerTela(item.id)) continue;
    if (!moduloLiberado(item.id)) continue; // bloco fora do plano contratado
    if (!setorTelaAtivo(item.id)) continue; // setor desligado pelo Dev
    const a = el(`<a data-id="${item.id}">${item.rotulo}</a>`);
    a.onclick = () => navegar(item.id);
    nav.appendChild(a);
  }
  // Aviso de vencimento próximo/vencida no rodapé
  if (LICENCA.validade) {
    const [va, vm] = LICENCA.validade.split('-').map(Number);
    const fim = new Date(va, vm, 0, 23, 59, 59);
    const dias = Math.ceil((fim - Date.now()) / 86400000);
    if (LICENCA.vencida || dias <= 7) {
      shell.querySelector('.rodape').appendChild(el(
        `<div style="margin-top:6px;font-size:11px;color:var(--dourado)">${
          LICENCA.vencida ? '⚠️ Licença vencida — modo consulta' : `🔑 Licença vence em ${dias} dia(s)`}</div>`));
    }
  }
  shell.querySelector('#sair').onclick = async () => { await api('auth:logout'); telaLogin(); };
  $app.appendChild(shell);

  // ── Gaveta do menu (celular/tablet pela rede) ────────────────────────────
  // Em tela pequena o menu de 220px sai da frente e volta pelo ☰. No desktop
  // o CSS esconde o botão e a barra fica fixa, como sempre foi.
  const _sidebar = shell.querySelector('.sidebar');
  const _fundo = shell.querySelector('#menu-fundo');
  const fecharMenu = () => {
    _sidebar.classList.remove('aberta');
    _fundo.classList.remove('visivel');
  };
  shell.querySelector('#btn-menu').onclick = () => {
    const abrindo = !_sidebar.classList.contains('aberta');
    _sidebar.classList.toggle('aberta', abrindo);
    _fundo.classList.toggle('visivel', abrindo);
  };
  _fundo.onclick = fecharMenu;
  // escolher uma tela fecha a gaveta — senão ela tapa o conteúdo no celular
  _sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) fecharMenu(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(); });
  aplicarTema(); // depois de anexar: nome/logo da loja aparecem na barra lateral
  navegar('dashboard');

  // Chat interno e avisos: balão flutuante + verificação periódica de novidades
  iniciarMensagens(usuario);

  // Auto-recuperação do banco (v2.9.0): se o sistema precisou voltar sozinho
  // para um backup no boot, o usuário PRECISA saber — recuperação silenciosa
  // esconde o problema e o problema volta maior.
  if (NO_APP) setTimeout(async () => {
    try {
      const rec = await api('app:recuperacao');
      if (rec?.ok && rec.recuperacao) {
        const r = rec.recuperacao;
        const det = (r.vendas != null)
          ? `\n\nForam recuperadas ${r.vendas} venda(s) e ${r.produtos} produto(s) da cópia "${r.backup}".`
          : `\n\nOrigem: ${r.backup}.`;
        alert('⚠️ RECUPERAÇÃO AUTOMÁTICA\n\n'
          + 'O sistema detectou que o banco de dados estava incompleto ao abrir '
          + 'e restaurou sozinho a última cópia íntegra.' + det
          + '\n\nConfira o movimento do último dia antes de continuar vendendo. '
          + 'O arquivo com problema foi guardado na pasta de dados para análise.');
      }
    } catch {}
  }, 2500);

  // Verificar atualização em background — 8 s após o boot, sem bloquear
  if (NO_APP) setTimeout(async () => {
    try {
      const upd = await api('updater:verificar', { versaoAtual: APP_VERSION });
      if (upd.ok && upd.temAtualizacao) {
        const av = document.getElementById('update-aviso');
        if (av) {
          av.textContent = `🔄 v${upd.versaoNova} disponível`;
          av.style.display = '';
          av.onclick = () => navegar('config');
        }
        toast(`🔄 Nova versão v${upd.versaoNova} disponível — veja em Configurações.`);
      }
    } catch {}
  }, 8000);
}

// ---------- Área do desenvolvedor (senha de Dev) ----------
function modalDev() {
  modal('Suporte técnico 🔧', `
    <p style="color:var(--texto-suave);font-size:13px;margin-bottom:10px">Área restrita do desenvolvedor.</p>
    <div class="campo"><label>Usuário</label><input id="dv-usuario" autocomplete="off" placeholder="dev-mlopesdesign"></div>
    <div class="campo"><label>Senha de desenvolvedor</label><input id="dv-senha" type="password"></div>
    <div class="erro" id="dv-erro"></div>
  `, async (m, fechar) => {
    const usuario = m.querySelector('#dv-usuario').value;
    const senha = m.querySelector('#dv-senha').value;
    const r = await api('dev:entrar', { usuario, senha });
    if (!r.ok) { m.querySelector('#dv-erro').textContent = r.erro; return; }
    fechar();
    painelDev(senha, r);
  }, 'Entrar');
}

function painelDev(senha, dados) {
  const e0 = dados.estado;
  const planosNomes = dados.nomes;
  const cat = dados.catalogo;
  const planos = dados.planos;

  const linhasMod = Object.entries(cat).map(([id, nome]) =>
    `<label class="dev-chk-item"><input type="checkbox" data-mod="${id}"> ${esc(nome)}</label>`).join('');

  const setoresCat = dados.setores || {};
  const bloqueados = dados.setores_bloqueados || [];
  const linhasSetor = Object.entries(setoresCat).map(([id, nome]) =>
    `<label class="dev-chk-item"><input type="checkbox" data-setor="${id}"${bloqueados.includes(id) ? ' checked' : ''}> ${esc(nome)}</label>`).join('');

  const m = modal('Painel do Desenvolvedor', `
    <style>
      .dev-panel{display:flex;flex-direction:column;gap:0}
      .dev-section{border:1px solid var(--borda);border-radius:10px;padding:18px 20px;margin-bottom:14px;background:var(--fundo,#faf8f6)}
      .dev-section h4{margin:0 0 10px;font-size:14px;display:flex;align-items:center;gap:8px}
      .dev-hint{font-size:12px;color:var(--texto-suave);margin:0 0 10px;line-height:1.5}
      .dev-id{font-family:'Consolas','Courier New',monospace;font-size:22px;font-weight:700;letter-spacing:3px;color:var(--vinho)}
      .dev-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px}
      .dev-chk-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin:8px 0}
      .dev-chk-item{display:flex;gap:8px;align-items:center;padding:5px 0;font-size:13px;cursor:pointer}
      .dev-chk-item input[type=checkbox]{width:16px;height:16px;margin:0}
      .dev-btn-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
      .dev-danger{border-color:#e0b0b0;background:#fdf6f6}
      .dev-warn-box{background:#FFF8E6;border:1px solid #E8D48B;border-radius:8px;padding:10px 14px;font-size:12.5px;margin-bottom:14px;line-height:1.5}
      .dev-pwd-row{display:flex;align-items:center;gap:0}
      .dev-pwd-row input{border-top-right-radius:0;border-bottom-right-radius:0;flex:1}
      .dev-pwd-toggle{border:1px solid var(--borda);border-left:0;border-radius:0 8px 8px 0;background:var(--fundo,#faf8f6);padding:0 10px;height:42px;cursor:pointer;font-size:16px;display:flex;align-items:center}
    </style>
    <div class="dev-panel">
      <div class="dev-section">
        <h4>🏷️ Identificacao</h4>
        <p class="dev-hint">Use este ID para gerar codigos de renovacao na ferramenta.</p>
        <div class="dev-id">${esc(e0.cliente_id)}</div>
      </div>

      ${dados.senha_padrao ? '<div class="dev-warn-box">⚠️ Voce ainda esta usando a <b>senha provisoria</b>. Troque no campo "Seguranca" abaixo antes de distribuir.</div>' : ''}

      <div class="dev-section">
        <h4>📋 Licenciamento</h4>
        <div class="dev-row">
          <div class="campo"><label>Plano</label>
            <select id="dv-plano">
              <option value="basico">Basico</option>
              <option value="intermediario">Intermediario</option>
              <option value="completo">Completo</option>
            </select></div>
          <div class="campo"><label>Pago ate (mes)</label><input id="dv-validade" type="month"></div>
        </div>
        <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block">Modulos liberados</label>
        <div class="dev-chk-grid">${linhasMod}</div>
        <p class="dev-hint" style="margin-top:4px">Modulos do plano ficam marcados automaticamente. Os extras sao liberados avulsos.</p>
      </div>

      <div class="dev-section">
        <h4>🔒 Setores desta loja</h4>
        <p class="dev-hint">Marque os setores que esta loja <b>NAO</b> usa — a area desaparece do sistema inteiro.</p>
        <div class="dev-chk-grid">${linhasSetor}</div>
        <div class="dev-btn-row">
          <button class="btn btn-suave" id="dv-setores-salvar" type="button">Salvar setores</button>
        </div>
      </div>

      <div class="dev-section">
        <h4>🔑 Seguranca</h4>
        <div class="dev-btn-row">
          <button class="btn btn-suave" id="dv-trocar" type="button">Trocar minha senha</button>
          <button class="btn btn-suave" id="dv-remover" type="button" style="color:var(--vermelho)">Remover licenca</button>
        </div>
        <p class="dev-hint" style="margin-top:8px">Remover licenca coloca em modo completo livre (sem expiracao).</p>
      </div>

      <div class="dev-section dev-danger">
        <h4 style="color:var(--vermelho)">⚠️ Reset de fabrica</h4>
        <p class="dev-hint">Apaga TODOS os dados da loja e volta ao estado inicial. Um backup do banco e feito automaticamente antes.</p>
        <button class="btn btn-perigo" id="dv-reset" type="button">Resetar de fabrica</button>
      </div>

      <div class="erro" id="dv-erro2" style="margin-top:4px"></div>
    </div>
  `, async (mm, fechar) => {
    const plano = mm.querySelector('#dv-plano').value;
    const base = planos[plano] || [];
    const extras = [...mm.querySelectorAll('input[data-mod]:checked')]
      .map(c => c.dataset.mod).filter(mod => !base.includes(mod));
    const validade = mm.querySelector('#dv-validade').value;
    const r = await api('dev:aplicar', { senha, plano, modulos_extras: extras, validade });
    if (!r.ok) { mm.querySelector('#dv-erro2').textContent = r.erro; return; }
    fechar();
    await recarregarLicenca();
    toast(`Licença aplicada: ${planosNomes[r.estado.plano]} até ${r.estado.validade}.`);
    usuario ? telaPrincipal() : telaLogin();
  }, 'Aplicar licença');

  // estado inicial + comportamento dos checkboxes conforme o plano
  const selPlano = m.querySelector('#dv-plano');
  const chks = [...m.querySelectorAll('input[data-mod]')];
  const sync = () => {
    const base = planos[selPlano.value] || [];
    chks.forEach(c => {
      const doPlano = base.includes(c.dataset.mod);
      c.disabled = doPlano;
      if (doPlano) c.checked = true;
    });
  };
  selPlano.value = e0.sem_licenca ? 'completo' : e0.plano;
  m.querySelector('#dv-validade').value = e0.validade || new Date().toISOString().slice(0, 7);
  chks.forEach(c => { c.checked = e0.modulos.includes(c.dataset.mod); });
  selPlano.onchange = sync;
  sync();

  m.querySelector('#dv-remover').onclick = async () => {
    const r = await api('dev:remover', { senha });
    if (!r.ok) { m.querySelector('#dv-erro2').textContent = r.erro; return; }
    m.remove();
    await recarregarLicenca();
    toast('Licença removida — sistema em modo completo, sem expiração.');
    usuario ? telaPrincipal() : telaLogin();
  };

  m.querySelector('#dv-setores-salvar').onclick = async () => {
    const bloq = [...m.querySelectorAll('input[data-setor]:checked')].map(c => c.dataset.setor);
    const r = await api('dev:setores', { senha, bloqueados: bloq });
    if (!r.ok) { m.querySelector('#dv-erro2').textContent = r.erro; return; }
    await recarregarLicenca();
    toast('Setores atualizados. As áreas desligadas somem do menu.');
    // Redesenha para refletir os setores no menu imediatamente
    if (usuario) telaPrincipal();
  };

  m.querySelector('#dv-reset').onclick = () => {
    modal('Reset de fábrica ⚠️', `
      <p style="font-size:13px;color:var(--vermelho)"><b>Isto apaga TODOS os dados desta loja e não tem volta</b> (um backup do banco é gravado antes, na pasta de dados).</p>
      <div class="campo"><label>Sua senha de desenvolvedor</label><input id="rs-senha" type="password"></div>
      <div class="campo"><label>Digite <b>ZERAR</b> para confirmar</label><input id="rs-conf" autocomplete="off" placeholder="ZERAR"></div>
      <div class="erro" id="rs-erro"></div>
    `, async (mm, fechar) => {
      const senha = mm.querySelector('#rs-senha').value;
      const confirmacao = mm.querySelector('#rs-conf').value;
      const r = await api('dev:resetarFabrica', { senha, confirmacao });
      if (!r.ok) { mm.querySelector('#rs-erro').textContent = r.erro; return; }
      fechar(); m.remove();
      toast('Loja zerada. Entre novamente com admin / admin123.');
      usuario = null; telaLogin();
    }, 'Zerar tudo agora');
  };

  m.querySelector('#dv-trocar').onclick = () => {
    modal('Trocar senha de desenvolvedor 🔑', `
      <div class="campo"><label>Senha atual</label><input id="ts-atual" type="password"></div>
      <div class="campo"><label>Nova senha (mín. 6)</label><input id="ts-nova" type="password"></div>
      <div class="campo"><label>Repita a nova senha</label><input id="ts-nova2" type="password"></div>
      <div class="erro" id="ts-erro"></div>
    `, async (mm, fechar) => {
      const atual = mm.querySelector('#ts-atual').value;
      const nova = mm.querySelector('#ts-nova').value;
      const nova2 = mm.querySelector('#ts-nova2').value;
      if (nova !== nova2) { mm.querySelector('#ts-erro').textContent = 'As senhas não conferem.'; return; }
      const r = await api('dev:trocarSenha', { senha_atual: atual, nova_senha: nova });
      if (!r.ok) { mm.querySelector('#ts-erro').textContent = r.erro; return; }
      fechar();
      toast('Senha de desenvolvedor atualizada. ✅');
    }, 'Salvar nova senha');
  };
}

function navegar(id) {
  if (!podeVerTela(id)) { toast('Você não tem acesso a esta área.', true); return; }
  if (!moduloLiberado(id)) { toast('Este módulo não está incluído no seu plano.', true); return; }
  if (!setorTelaAtivo(id)) { toast('Esta área está desativada nesta instalação.', true); return; }
  document.querySelectorAll('.menu a').forEach(a =>
    a.classList.toggle('ativo', a.dataset.id === id));
  const alvo = document.getElementById('conteudo');
  // saindo da tela cheia de Mensagens: devolve o balão e volta o polling lento
  if (id !== 'mensagens') encerrarTelaMensagens();
  alvo.innerHTML = '';
  ({ dashboard: viewDashboard, produtos: viewProdutos, categorias: viewCategorias,
     estoque: viewEstoque, pdv: viewPdv, clientes: viewClientes,
     financeiro: viewFinanceiro, compras: viewCompras, relatorios: viewRelatorios,
     ranking: viewRanking, estoques: viewEstoques,
     vales: viewValesTroca, catalogo: (a) => viewCatalogo(a, api),
     mensagens: viewMensagens, config: viewConfiguracoes }[id])(alvo);
}

// ---------- Painel ----------
function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
function diaSemanaCurto(iso) {
  const [a, m, d] = iso.split('-');
  return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(+a, +m - 1, +d).getDay()];
}
function diaMes(iso) { const p = iso.split('-'); return `${p[2]}/${p[1]}`; }

// Gráfico de área SVG (sem dependências — funciona offline)
function graficoVendas(serie) {
  // Quando total é null (usuário sem permissão financeira), usar qtd como altura das barras
  const semFin = serie.length > 0 && serie[0].total === null;
  const vals = semFin ? serie.map(d => d.qtd) : serie.map(d => d.total);
  const W = 720, H = 200, padX = 34, padT = 18, padB = 32;
  const max = Math.max(1, ...vals);
  const n = serie.length;
  const stepX = (W - padX * 2) / (n - 1);
  const x = i => padX + i * stepX;
  const y = v => (H - padB) - (v / max) * (H - padT - padB);
  const pts = serie.map((d, i) => [x(i), y(vals[i])]);
  const linha = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = `M${padX},${H - padB} ` + pts.map(p => 'L' + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + ` L${x(n - 1).toFixed(1)},${H - padB} Z`;
  const grade = [0.25, 0.5, 0.75, 1].map(f => {
    const gy = (H - padB) - f * (H - padT - padB);
    return `<line x1="${padX}" x2="${W - padX}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" class="grade-linha"/>`;
  }).join('');
  const dots = pts.map((p, i) =>
    `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === n - 1 ? 4.5 : 2.6}" class="pt ${i === n - 1 ? 'pt-hoje' : ''}"><title>${diaMes(serie[i].dia)}: ${serie[i].qtd} venda(s)</title></circle>`).join('');
  const rotulos = serie.map((d, i) => (i % 2 === 1)
    ? `<text x="${x(i).toFixed(1)}" y="${H - 10}" class="eixo-x">${diaSemanaCurto(d.dia)} ${d.dia.split('-')[2]}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="grafico" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="gArea" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="var(--vinho)" stop-opacity=".28"/>
      <stop offset="1" stop-color="var(--vinho)" stop-opacity="0"/></linearGradient></defs>
    ${grade}
    <path d="${area}" fill="url(#gArea)"/>
    <path d="${linha}" fill="none" stroke="var(--vinho)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${rotulos}
  </svg>`;
}

async function viewDashboard(alvo) {
  const cfg = getConfig();
  const r = await api('dashboard:resumo');
  if (!r.ok) {
    alvo.appendChild(el(`<div class="painel"><div class="barra">Não foi possível carregar o painel: ${esc(r.erro || '')}</div></div>`));
    return;
  }
  const d = r;
  // verFin: null em lucro_bruto significa que o backend ocultou por falta de permissão
  const verFin = d.mes.lucro_bruto !== null;
  const nomeLoja = cfg.loja_nome || 'sua loja';
  // totalPeriodo usa bruto (gross) para não aparecer zerado quando há devoluções no período
  const totalPeriodo = verFin ? d.serie.reduce((s, x) => s + (x.bruto || 0), 0) : 0;
  const ic = { perigo: '⛔', alerta: '⚠️', info: '💡' };

  const tela = el(`
  <div class="dashboard">
    <div class="pagina-topo">
      <div>
        <h1>${saudacao()}, ${esc((usuario.nome || '').split(' ')[0])} 👋</h1>
        <p class="subtitulo-topo">${esc(nomeLoja)} · ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>
      <button class="btn btn-primario" id="ir-pdv">🛒 Nova venda</button>
    </div>

    <div class="cards">
      <div class="card card-destaque">
        <div class="rotulo">Vendas de hoje</div>
        <div class="valor">${verFin ? moeda(d.hoje.total) : d.hoje.qtd + (d.hoje.qtd === 1 ? ' venda' : ' vendas')}</div>
        <div class="card-rodape">${d.hoje.qtd} venda(s)${verFin ? ' · ticket ' + moeda(d.hoje.ticket) : ''}</div>
        ${verFin && d.hoje.devolvido > 0 ? `<div class="card-rodape" style="color:var(--dourado,#e6a817);font-size:11px">↩ devoluções: ${moeda(d.hoje.devolvido)}</div>` : ''}
      </div>
      <div class="card">
        <div class="rotulo">Vendas do mês</div>
        <div class="valor">${verFin ? moeda(d.mes.total) : d.mes.qtd + (d.mes.qtd === 1 ? ' venda' : ' vendas')}</div>
        <div class="card-rodape">${d.mes.qtd} venda(s) concluída(s)</div>
        ${verFin && d.mes.devolvido > 0 ? `<div class="card-rodape" style="color:var(--dourado,#e6a817);font-size:11px">↩ devoluções: ${moeda(d.mes.devolvido)}</div>` : ''}
      </div>
      ${verFin ? `
      <div class="card">
        <div class="rotulo">Lucro bruto do mês</div>
        <div class="valor">${moeda(d.mes.lucro_bruto)}</div>
        <div class="card-rodape">margem de ${d.mes.margem}%</div>
      </div>
      <div class="card">
        <div class="rotulo">Estoque a preço de venda</div>
        <div class="valor">${moeda(d.estoque.valor_venda)}</div>
        <div class="card-rodape">${d.estoque.pecas} peças · ${d.estoque.produtos} produtos</div>
      </div>` : `
      <div class="card">
        <div class="rotulo">Peças em estoque</div>
        <div class="valor">${d.estoque.pecas}</div>
        <div class="card-rodape">${d.estoque.produtos} produtos ativos</div>
      </div>`}
    </div>

    <div class="dash-grid">
      <div class="painel painel-pad col-2">
        <div class="painel-cab"><h3>Vendas dos últimos 14 dias</h3>${verFin ? `<span>${moeda(totalPeriodo)} no período</span>` : ''}</div>
        <div class="grafico-wrap">${graficoVendas(d.serie)}</div>
      </div>
      <div class="painel painel-pad">
        <div class="painel-cab"><h3>Precisa de atenção</h3></div>
        <div class="alertas" id="alertas"></div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="painel painel-pad col-2">
        <div class="painel-cab"><h3>Mais vendidos no mês</h3></div>
        <div id="top-produtos"></div>
      </div>
      <div class="painel painel-pad">
        <div class="painel-cab"><h3>Panorama rápido</h3></div>
        <div class="panorama" id="panorama"></div>
      </div>
    </div>
  </div>`);

  // Alertas acionáveis
  const wrapAl = tela.querySelector('#alertas');
  if (!d.alertas.length) {
    wrapAl.appendChild(el(`<div class="alerta ok"><span class="ic">✔</span><span>Tudo em ordem — sem pendências.</span></div>`));
  } else {
    for (const a of d.alertas) {
      const item = el(`<div class="alerta ${esc(a.nivel)}"><span class="ic">${ic[a.nivel] || '•'}</span><span class="alerta-txt">${esc(a.texto)}</span><span class="ir">abrir ›</span></div>`);
      item.onclick = () => navegar(a.tela);
      wrapAl.appendChild(item);
    }
  }

  // Top produtos com barra proporcional
  const wrapTop = tela.querySelector('#top-produtos');
  if (!d.top_produtos.length) {
    wrapTop.appendChild(el(`<div class="vazio" style="padding:26px !important">Nenhuma venda registrada ainda este mês.</div>`));
  } else {
    const maxR = verFin
      ? Math.max(...d.top_produtos.map(t => t.receita || 0), 1)
      : Math.max(...d.top_produtos.map(t => t.pecas), 1);
    d.top_produtos.forEach((t, i) => {
      const barPct = Math.max(6, ((verFin ? (t.receita || 0) : t.pecas) / maxR) * 100).toFixed(1);
      wrapTop.appendChild(el(`<div class="top-item">
        <div class="top-nome"><span class="rank">${i + 1}</span>${esc(t.nome)}</div>
        <div class="top-barra"><span style="width:${barPct}%"></span></div>
        <div class="top-val">${verFin ? moeda(t.receita) : ''}<small>${t.pecas} pç</small></div>
      </div>`));
    });
  }

  // Panorama rápido (linhas clicáveis)
  const pano = tela.querySelector('#panorama');
  const linhaP = (rotulo, valor, destino, atencao) => {
    const item = el(`<div class="pano ${destino ? 'link' : ''} ${atencao ? 'aten' : ''}"><span>${rotulo}</span><b>${valor}</b></div>`);
    if (destino) item.onclick = () => navegar(destino);
    pano.appendChild(item);
  };
  linhaP('Caixa', d.caixa.aberto ? '🟢 Aberto' : '🔴 Fechado', 'pdv', !d.caixa.aberto);
  linhaP('Crediário em aberto', `${d.crediario.aberto_qtd}x`, 'clientes');
  linhaP('Em atraso (crediário)', `${d.crediario.atraso_clientes} cliente(s)`, 'clientes', d.crediario.atraso_clientes > 0);
  if (d.financeiro) {
    linhaP('A pagar em 7 dias', moeda(d.financeiro.a_vencer.pagar.total), 'financeiro', d.financeiro.vencidos.pagar.qtd > 0);
    linhaP('A receber em 7 dias', moeda(d.financeiro.a_vencer.receber.total), 'financeiro');
  }
  linhaP('Aniversariantes do mês', String(d.aniversariantes), 'clientes', d.aniversariantes > 0);

  tela.querySelector('#ir-pdv').onclick = () => navegar('pdv');
  alvo.appendChild(tela);
}

// ---------- Categorias ----------
async function viewCategorias(alvo) {
  const r = await api('categorias:listar');
  categoriasCache = r.ok ? r.categorias : [];

  const tela = el(`
    <div>
      <div class="pagina-topo">
        <h1>Categorias</h1>
        <button class="btn btn-primario" id="nova">+ Nova categoria</button>
      </div>
      <div class="painel"><table>
        <thead><tr><th>Nome</th><th class="num">Produtos</th><th style="width:130px"></th></tr></thead>
        <tbody></tbody>
      </table></div>
    </div>`);
  const tbody = tela.querySelector('tbody');
  if (!categoriasCache.length) {
    tbody.appendChild(el(`<tr><td colspan="3" class="vazio">Nenhuma categoria cadastrada.</td></tr>`));
  }
  for (const c of categoriasCache) {
    const tr = el(`<tr>
      <td>${esc(c.nome)}</td>
      <td class="num">${c.qtd_produtos}</td>
      <td class="acoes-linha">
        <button data-a="editar">Editar</button>
        <button data-a="excluir" style="color:var(--vermelho)">Excluir</button>
      </td></tr>`);
    tr.querySelector('[data-a=editar]').onclick = () => formCategoria(c, () => navegar('categorias'));
    tr.querySelector('[data-a=excluir]').onclick = async () => {
      if (!confirm(`Excluir a categoria "${c.nome}"?`)) return;
      const resp = await api('categorias:excluir', { id: c.id });
      resp.ok ? (toast('Categoria excluída.'), navegar('categorias')) : toast(resp.erro, true);
    };
    tbody.appendChild(tr);
  }
  tela.querySelector('#nova').onclick = () => formCategoria(null, () => navegar('categorias'));
  alvo.appendChild(tela);
}

function formCategoria(cat, aoConcluir) {
  modal(cat ? 'Editar categoria' : 'Nova categoria', `
    <div class="campo"><label>Nome</label><input id="c-nome" value="${esc(cat?.nome || '')}"></div>
    <div class="erro" id="c-erro"></div>
  `, async (m, fechar) => {
    const r = await api('categorias:salvar', { id: cat?.id, nome: m.querySelector('#c-nome').value });
    if (!r.ok) { m.querySelector('#c-erro').textContent = r.erro; return; }
    toast('Categoria salva.'); fechar(); aoConcluir();
  });
}

// ---------- Lista de produtos: modal de opções ----------
async function modalExportarLista() {
  const rc = await api('categorias:listar');
  const cats = rc.ok ? rc.categorias : [];
  const verCusto = pode('produtos.custo');

  const chk = (id, rot, marcado) =>
    `<label class="exp-chk"><input type="checkbox" id="${id}"${marcado ? ' checked' : ''}><span>${rot}</span></label>`;

  const m = modal('Exportar lista de produtos', `
    <style>
      .exp-box{width:min(500px,86vw)}
      .exp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .exp-chks{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;
        border:1px solid var(--borda);border-radius:8px;padding:10px 12px}
      .exp-chk{display:flex;align-items:center;gap:8px;padding:4px 0;
        font-size:13px;font-weight:400;cursor:pointer;margin:0}
      .exp-chk input{width:15px;height:15px;margin:0;flex-shrink:0}
      .exp-box .campo{margin-bottom:12px}
      .exp-box .campo>label{display:block;margin-bottom:4px}
    </style>
    <div class="exp-box">
      <div class="exp-grid2">
        <div class="campo">
          <label>Categoria</label>
          <select id="ex-cat">
            <option value="">Todas</option>
            ${cats.map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label>Estoque</label>
          <select id="ex-filtro">
            <option value="todos">Todos os produtos</option>
            <option value="com">Só com estoque</option>
            <option value="sem">Só sem estoque</option>
          </select>
        </div>
      </div>

      <div class="campo">
        <label>Colunas da lista</label>
        <div class="exp-chks">
          ${chk('cl-foto', 'Foto (só no PDF)', false)}
          ${chk('cl-ref', 'Referência', true)}
          ${chk('cl-cat', 'Categoria', true)}
          ${chk('cl-cor', 'Cor / Tamanho', true)}
          ${chk('cl-cod', 'Código de barras', true)}
          ${chk('cl-est', 'Estoque', true)}
          ${chk('cl-venda', 'Preço de venda', true)}
          ${verCusto ? chk('cl-custo', 'Preço de custo', false) : ''}
          ${chk('cl-total', 'Total (qtd × preço)', true)}
          ${chk('cl-conf', 'Coluna "Conferido"', false)}
        </div>
      </div>

      <div class="exp-grid2">
        <div class="campo">
          <label>Formato</label>
          <select id="ex-formato">
            <option value="pdf">PDF (para imprimir)</option>
            <option value="xlsx">Excel (.xlsx)</option>
          </select>
        </div>
        <div class="campo">
          <label>Organização</label>
          <select id="ex-agrupar">
            <option value="1">Agrupar por categoria</option>
            <option value="0">Lista alfabética</option>
          </select>
        </div>
      </div>
      <div class="erro" id="ex-erro"></div>
    </div>
  `, async (mm, fechar) => {
    const q = id => mm.querySelector('#' + id);
    const o = {
      categoria: q('ex-cat').value,
      filtro: q('ex-filtro').value,
      agrupar: q('ex-agrupar').value === '1',
      cols: {
        foto: q('cl-foto').checked,
        ref: q('cl-ref').checked,
        cat: q('cl-cat').checked,
        cor: q('cl-cor').checked,
        cod: q('cl-cod').checked,
        est: q('cl-est').checked,
        venda: q('cl-venda').checked,
        custo: !!q('cl-custo')?.checked,
        total: q('cl-total').checked,
        conf: q('cl-conf').checked
      }
    };
    if (!Object.values(o.cols).some(Boolean)) {
      q('ex-erro').textContent = 'Marque pelo menos uma coluna.'; return;
    }
    const formato = q('ex-formato').value;
    fechar();
    if (formato === 'pdf') await exportarListaProdutosPdf(o);
    else await exportarListaProdutosXlsx(o);
  }, 'Gerar lista');

  return m;
}

// Aplica os filtros escolhidos no modal sobre as variações vindas do backend
function _filtrarVariacoes(lista, o) {
  return lista.filter(v => {
    if (o.categoria && v.categoria !== o.categoria) return false;
    if (o.filtro === 'com' && !(v.estoque > 0)) return false;
    if (o.filtro === 'sem' && v.estoque > 0) return false;
    return true;
  });
}

// ---------- Lista de produtos para conferência física (PDF / Excel) ----------
async function exportarListaProdutosPdf(o) {
  toast('Gerando lista…');
  const r = await api('estoque:listarCompleto');
  if (!r.ok) { toast(r.erro || 'Erro ao gerar a lista.', true); return; }
  const variacoes = _filtrarVariacoes(r.variacoes, o);
  if (!variacoes.length) { toast('Nenhum produto encontrado com esses filtros.', true); return; }

  // Coluna de foto (opcional): resolve os NOMES de arquivo para data URI de uma
  // vez só, e guarda a imagem pronta em cada variação. Sem isso a lista sai sem
  // foto, porque o banco guarda só o nome do arquivo.
  const mostrarFoto = !!(o.cols && o.cols.foto);
  if (mostrarFoto) {
    const nomes = [...new Set(variacoes.map(v => v.foto).filter(Boolean))];
    if (nomes.length) {
      const rf = await api('fotos:obterVarias', { nomes });
      const mapa = (rf && rf.ok && rf.fotos) ? rf.fotos : {};
      for (const v of variacoes) v._fotoData = v.foto ? (mapa[v.foto] || null) : null;
    }
  }

  const cfg = getConfig() || {};
  const loja = cfg.loja_nome || 'Minha Loja';
  const data = new Date().toLocaleDateString('pt-BR');
  const fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const c = o.cols;
  // Cabeçalhos conforme as colunas escolhidas
  const ths = [];
  if (mostrarFoto) ths.push('<th class="lp-foto-th">Foto</th>');
  ths.push('<th>Produto</th>');
  if (c.ref) ths.push('<th>Referência</th>');
  if (c.cat && !o.agrupar) ths.push('<th>Categoria</th>');
  if (c.cor) ths.push('<th>Cor</th><th>Tam</th>');
  if (c.cod) ths.push('<th>Código de barras</th>');
  if (c.est) ths.push('<th class="num">Estoque</th>');
  if (c.custo) ths.push('<th class="num">Custo</th>');
  if (c.venda) ths.push('<th class="num">Preço venda</th>');
  if (c.total) ths.push('<th class="num">Total</th>');
  if (c.conf) ths.push('<th style="width:70px">Conferido</th>');
  const nCols = ths.length;

  const linhaTr = v => {
    const tds = [];
    if (mostrarFoto) {
      tds.push(v._fotoData
        ? `<td class="lp-foto-td"><img class="lp-foto" src="${v._fotoData}"></td>`
        : `<td class="lp-foto-td"><span class="lp-foto lp-foto-vazia">👗</span></td>`);
    }
    tds.push(`<td>${esc(v.nome)}</td>`);
    if (c.ref) tds.push(`<td>${esc(v.referencia || '')}</td>`);
    if (c.cat && !o.agrupar) tds.push(`<td>${esc(v.categoria || '')}</td>`);
    if (c.cor) {
      const cor = (v.cor && v.cor !== 'Única') ? esc(v.cor) : '';
      const tam = (v.tamanho && v.tamanho !== 'U') ? esc(v.tamanho) : '';
      tds.push(`<td>${cor}</td><td class="ctr">${tam}</td>`);
    }
    if (c.cod) tds.push(`<td class="cod">${esc(v.codigo_barras || '')}</td>`);
    if (c.est) tds.push(`<td class="num">${v.estoque}</td>`);
    if (c.custo) tds.push(`<td class="num">${fmt(v.preco_custo)}</td>`);
    if (c.venda) tds.push(`<td class="num preco">${fmt(v.preco_venda)}</td>`);
    if (c.total) tds.push(`<td class="num">${fmt((v.estoque || 0) * (v.preco_venda || 0))}</td>`);
    if (c.conf) tds.push('<td class="conf"></td>');
    return `<tr>${tds.join('')}</tr>`;
  };

  let blocos;
  if (o.agrupar) {
    const porCat = {};
    for (const v of variacoes) {
      const k = v.categoria || 'Sem categoria';
      (porCat[k] = porCat[k] || []).push(v);
    }
    blocos = Object.keys(porCat).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(cat => {
      const linhas = porCat[cat].map(linhaTr).join('');
      const pecas = porCat[cat].reduce((s, v) => s + (v.estoque || 0), 0);
      const subtotal = porCat[cat].reduce((s, v) => s + (v.estoque || 0) * (v.preco_venda || 0), 0);
      return `<tr class="cat"><td colspan="${nCols}">${esc(cat)} — ${porCat[cat].length} variação(ões)` +
        `${c.est ? ' · ' + pecas + ' peças' : ''}${c.total ? ' · ' + fmt(subtotal) : ''}</td></tr>${linhas}`;
    }).join('');
  } else {
    blocos = [...variacoes]
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
      .map(linhaTr).join('');
  }

  // Totais do conjunto filtrado
  const totPecas = variacoes.reduce((s, v) => s + (v.estoque || 0), 0);
  const totVenda = variacoes.reduce((s, v) => s + (v.estoque || 0) * (v.preco_venda || 0), 0);
  const tfootTds = [];
  for (let i = 0; i < nCols; i++) tfootTds.push('<td></td>');
  const idxProd = ths.findIndex(t => t.includes('>Produto<'));
  if (idxProd >= 0) tfootTds[idxProd] = '<td>TOTAL GERAL</td>';
  const idxEst = ths.findIndex(t => t.includes('Estoque'));
  const idxTot = ths.findIndex(t => t.includes('>Total<'));
  if (idxEst > 0) tfootTds[idxEst] = `<td class="num">${totPecas}</td>`;
  if (idxTot > 0) tfootTds[idxTot] = `<td class="num">${fmt(totVenda)}</td>`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Lista de Produtos — ${esc(loja)}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;font-size:10px;margin:8mm 6mm;color:#111}
      h2{margin:0 0 3px;font-size:15px;color:#8B1A1C}
      p.sub{margin:0 0 10px;color:#666;font-size:9px}
      table{width:100%;border-collapse:collapse}
      thead th{background:#8B1A1C;color:#fff;padding:5px 4px;text-align:left;font-size:9px;
        position:sticky;top:0}
      td{padding:4px;border-bottom:1px solid #e0e0e0;vertical-align:middle}
      tr.cat td{background:#f2e6e6;font-weight:700;font-size:10px;color:#8B1A1C;
        padding:6px 4px;border-top:2px solid #8B1A1C;border-bottom:none}
      tr:not(.cat):nth-child(even) td{background:#fafafa}
      .num{text-align:right}
      .ctr{text-align:center;font-weight:700}
      .cod{font-family:Consolas,monospace;font-size:8px;color:#555}
      .lp-foto-th{width:46px}
      .lp-foto-td{width:46px;padding:2px 4px}
      .lp-foto{width:40px;height:40px;object-fit:cover;border-radius:4px;
        border:1px solid #ddd;display:block;background:#fafafa}
      .lp-foto-vazia{display:flex;align-items:center;justify-content:center;
        font-size:18px;color:#bbb}
      .preco{font-weight:700;color:#8B1A1C}
      .conf{width:70px;border-bottom:1px solid #999}
      tfoot td{font-weight:700;background:#eee;border-top:2px solid #8B1A1C;padding:6px 4px}
      @media print{
        body{margin:5mm}
        tr{page-break-inside:avoid}
        tr.cat{page-break-after:avoid}
        thead{display:table-header-group}
      }
    </style></head><body>
    <h2>${esc(loja)} — Lista de Produtos e Preços</h2>
    <p class="sub">Gerado em ${data} · ${variacoes.length} variações${c.est ? ' · ' + totPecas + ' peças' : ''}${
      o.categoria ? ' · Categoria: ' + esc(o.categoria) : ''}${
      o.filtro === 'com' ? ' · somente com estoque' : o.filtro === 'sem' ? ' · somente sem estoque' : ''}${
      c.total ? ' · Total a preço de venda: ' + fmt(totVenda) : ''}</p>
    <table>
      <thead><tr>${ths.join('')}</tr></thead>
      <tbody>${blocos}</tbody>
      <tfoot><tr>${tfootTds.join('')}</tr></tfoot>
    </table></body></html>`;

  const w = window.open('', '_blank', 'width=1100,height=760');
  if (!w) { toast('Permita popups para gerar o PDF.', true); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

async function exportarListaProdutosXlsx(o) {
  toast('Gerando Excel…');
  const r = await api('estoque:exportarXlsxFiltrado', o);
  if (!r.ok) { toast(r.erro || 'Erro ao gerar o Excel.', true); return; }
  const bin = atob(r.buffer);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista-produtos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  toast('Excel baixado com sucesso.');
}

// ---------- Produtos ----------
async function viewProdutos(alvo) {
  const rc = await api('categorias:listar');
  categoriasCache = rc.ok ? rc.categorias : [];

  const tela = el(`
    <div>
      <div class="pagina-topo">
        <h1>Produtos</h1>
        <div style="display:flex;gap:10px">
          <button class="btn btn-suave" id="lista-exportar">📋 Exportar lista</button>
          <button class="btn btn-suave" id="etq-lote" disabled>🏷️ Imprimir etiquetas</button>
          ${pode('produtos.editar') ? '<button class="btn btn-primario" id="novo">+ Novo produto</button>' : ''}
        </div>
      </div>
      <div class="painel">
        <div class="barra">
          <input type="text" id="busca" placeholder="Buscar por nome, referência ou código de barras…">
          <select id="f-cat"><option value="">Todas as categorias</option>
            ${categoriasCache.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}
          </select>
          <select id="f-cons" title="Mostrar só peças em consignação ou só peças da loja">
            <option value="">Consignados e próprios</option>
            <option value="sim">🤝 Somente consignados</option>
            <option value="nao">🏪 Somente da loja</option>
          </select>
        </div>
        <table>
          <thead><tr>
            <th class="col-chk"><input type="checkbox" id="sel-todos" title="Selecionar todos os visíveis"></th><th>Produto</th><th>Categoria</th>${pode('produtos.custo') ? '<th class="num">Custo</th>' : ''}<th class="num">Venda</th>
            <th class="num">Estoque</th><th>Situação</th><th style="width:130px"></th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>`);

  const tbody = tela.querySelector('tbody');
  async function carregar() {
    const consignado = tela.querySelector('#f-cons').value;
    const r = await api('produtos:listar', {
      busca: tela.querySelector('#busca').value,
      categoria_id: Number(tela.querySelector('#f-cat').value) || null,
      consignado
    });
    tbody.innerHTML = '';
    const lista = r.ok ? r.produtos : [];
    if (!lista.length) {
      tbody.appendChild(el(`<tr><td colspan="8" class="vazio">${
        consignado === 'sim' ? 'Nenhum produto consignado encontrado.'
        : consignado === 'nao' ? 'Nenhum produto próprio da loja encontrado.'
        : 'Nenhum produto encontrado.'}</td></tr>`));
      return;
    }
    for (const p of lista) {
      const baixo = (p.variacoes_abaixo || 0) > 0;
      const tr = el(`<tr>
        <td class="col-chk"><input type="checkbox" class="chk-prod" data-id="${p.id}"></td>
        <td><div class="prod-cel">${p.foto ? `<img class="thumb" src="${p.foto}">` : '<span class="thumb thumb-vazio">👗</span>'}<div><b>${esc(p.nome)}</b>${p.referencia ? `<br><small style="color:var(--texto-suave)">Ref. ${esc(p.referencia)}</small>` : ''}${
          // Peça consignada: mostra de quem é e qual a fatia do fornecedor no
          // lucro — sem isso, o filtro acha a peça mas não dá para conferir o
          // acerto sem abrir o cadastro uma a uma.
          p.consignado ? `<br><small style="color:#4a4a4a">🤝 Consignado${p.fornecedor ? ' · ' + esc(p.fornecedor) : ''}${p.pct_fornecedor ? ' · ' + p.pct_fornecedor + '% do lucro' : ''}</small>` : ''
        }</div></div></td>
        <td>${esc(p.categoria || '—')}</td>
        ${pode('produtos.custo') ? `<td class="num">${moeda(p.preco_custo)}</td>` : ''}
        <td class="num">${moeda(p.preco_venda)}</td>
        <td class="num">${p.estoque_total} <small>(${p.qtd_variacoes} var.)</small></td>
        <td><span class="pill ${baixo ? 'pill-baixo' : 'pill-ok'}">${baixo ? 'Repor' : 'OK'}</span></td>
        <td class="acoes-linha">
          ${pode('produtos.editar') ? '<button data-a="editar">Editar</button>' : ''}
          ${pode('produtos.editar') ? '<button data-a="duplicar" title="Criar um produto novo a partir deste">Duplicar</button>' : ''}
          <button data-a="etq">Etiquetas</button>
          ${pode('produtos.excluir') ? '<button data-a="excluir" style="color:var(--vermelho)">Excluir</button>' : ''}
        </td></tr>`);
      tr.querySelector('[data-a=etq]').onclick = async () => {
        const d = await api('produtos:obter', { id: p.id });
        if (d.ok) abrirEtiquetas(p.id); else toast(d.erro, true);
      };
      const bEditar = tr.querySelector('[data-a=editar]');
      if (bEditar) bEditar.onclick = async () => {
        const d = await api('produtos:obter', { id: p.id });
        if (d.ok) formProduto(d.produto, d.variacoes, carregar); else toast(d.erro, true);
      };
      // Duplicar: abre o formulário de PRODUTO NOVO já preenchido com os dados
      // deste. Nada é gravado até o usuário salvar, então ele confere e ajusta
      // antes. Estoque nasce zerado e o código de barras sai em branco (é
      // UNIQUE — copiar quebraria o cadastro).
      const bDup = tr.querySelector('[data-a=duplicar]');
      if (bDup) bDup.onclick = async () => {
        const d = await api('produtos:obter', { id: p.id });
        if (!d.ok) { toast(d.erro, true); return; }
        const copia = { ...d.produto };
        delete copia.id;
        copia.nome = `${copia.nome} (cópia)`;
        copia.referencia = '';          // referência é única na prática — o usuário preenche
        const vars = (d.variacoes || []).map(v => ({
          cor: v.cor, tamanho: v.tamanho,
          estoque: '',                  // peça copiada não traz estoque
          estoque_minimo: v.estoque_minimo || '',
          codigo_barras: '',            // gerado no salvar
          foto: v.foto || null
        }));
        formProduto(copia, vars.length ? vars : [{ cor:'', tamanho:'', estoque:'' }], carregar, true);
        toast('Confira os dados e salve para criar o produto novo.');
      };

      const bExcluir = tr.querySelector('[data-a=excluir]');
      if (bExcluir) bExcluir.onclick = async () => {
        if (!confirm(`Excluir "${p.nome}"? O histórico é preservado.`)) return;
        const resp = await api('produtos:excluir', { id: p.id });
        resp.ok ? (toast('Produto excluído.'), carregar()) : toast(resp.erro, true);
      };
      tbody.appendChild(tr);
    }
  }
  let debounce;
  tela.querySelector('#busca').addEventListener('input', () => {
    clearTimeout(debounce); debounce = setTimeout(async () => { await carregar(); atualizarBotao(); }, 250);
  });
  tela.querySelector('#f-cat').addEventListener('change', async () => { await carregar(); atualizarBotao(); });
  tela.querySelector('#f-cons').addEventListener('change', async () => { await carregar(); atualizarBotao(); });
  // ----- lista de produtos (modal de opções) -----
  tela.querySelector('#lista-exportar').onclick = () => modalExportarLista();

  // ----- seleção múltipla p/ etiquetas em lote -----
  const btnEtq = tela.querySelector('#etq-lote');
  const selTodos = tela.querySelector('#sel-todos');
  function idsSelecionados() {
    return [...tela.querySelectorAll('.chk-prod:checked')].map(c => Number(c.dataset.id));
  }
  function atualizarBotao() {
    const n = idsSelecionados().length;
    btnEtq.disabled = n === 0;
    btnEtq.textContent = n ? `🏷️ Imprimir etiquetas (${n})` : '🏷️ Imprimir etiquetas';
    const visiveis = tela.querySelectorAll('.chk-prod').length;
    selTodos.checked = visiveis > 0 && n === visiveis;
  }
  tela.addEventListener('change', (e) => {
    if (e.target === selTodos) {
      tela.querySelectorAll('.chk-prod').forEach(c => { c.checked = selTodos.checked; });
      atualizarBotao();
    } else if (e.target.classList && e.target.classList.contains('chk-prod')) {
      atualizarBotao();
    }
  });
  btnEtq.onclick = async () => {
    const ids = idsSelecionados();
    if (!ids.length) return;
    btnEtq.disabled = true; btnEtq.textContent = 'Carregando…';
    const detalhes = [];
    for (const id of ids) {
      const d = await api('produtos:obter', { id });
      if (d.ok) detalhes.push({ produto: d.produto, variacoes: d.variacoes });
    }
    atualizarBotao();
    abrirEtiquetasLote(detalhes);
  };

  const bNovo = tela.querySelector('#novo');
  if (bNovo) bNovo.onclick = () => formProduto(null, [], carregar);
  alvo.appendChild(tela);
  carregar();
}

// `duplicando` = os campos vêm preenchidos de outro produto, mas o registro é
// NOVO: não há prod.id, o título muda e o estoque começa vazio.
function formProduto(prod, variacoes, aoConcluir, duplicando) {
  // linha nova nasce sem estoque preenchido (campos em branco, não com 0/1)
  const linhas = (variacoes.length ? variacoes : [{ cor: '', tamanho: '', estoque: '' }])
    .map(v => ({ ...v }));

  let fotoAtual = prod?.foto || null;
  const m = modal(duplicando ? 'Duplicar produto' : (prod?.id ? 'Editar produto' : 'Novo produto'), `
    <div class="foto-campo">
      <div class="foto-preview" id="p-foto-prev">${prod?.foto ? '<img src="' + esc(prod.foto) + '">' : '<span>sem foto</span>'}</div>
      <div class="foto-acoes">
        <label class="btn btn-suave foto-btn">📷 Escolher foto<input id="p-foto-input" type="file" accept="image/*" style="display:none"></label>
        <button type="button" class="btn btn-suave" id="p-foto-rem" style="${prod?.foto ? '' : 'display:none'}">Remover</button>
        <div class="foto-dica">Opcional. Ajuda a identificar a peça no sistema e no PDV — não aparece na etiqueta.</div>
      </div>
    </div>
    <div class="linha-2">
      <div class="campo"><label>Nome do produto *</label><input id="p-nome" value="${esc(prod?.nome || '')}"></div>
      <div class="campo"><label>Referência</label><input id="p-ref" value="${esc(prod?.referencia || '')}"></div>
    </div>
    <div class="linha-3">
      <div class="campo"><label>Categoria</label>
        <select id="p-cat"><option value="">—</option>
          ${categoriasCache.map(c =>
            `<option value="${c.id}" ${prod?.categoria_id === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
        </select></div>
      ${pode('produtos.custo') ? `<div class="campo"><label>Preço de custo (R$)</label><input id="p-custo" type="number" step="0.01" min="0" value="${prod?.preco_custo ?? ''}"></div>` : ''}
      <div class="campo"><label>Preço de venda (R$) *</label><input id="p-venda" type="number" step="0.01" min="0" value="${prod?.preco_venda ?? ''}"></div>
    </div>
    <div class="campo" style="max-width:240px"><label>Mínimo padrão (todas as variações)</label>
      <input id="p-min" type="number" min="0" value="${prod?.estoque_minimo || ''}" placeholder="0 = sem alerta">
      <small style="color:var(--texto-suave)">Cada variação pode ter seu próprio mínimo na grade abaixo.</small></div>

    <div style="border:1px dashed var(--borda);border-radius:8px;padding:12px 14px;margin:6px 0 12px">
      <label style="display:flex;gap:8px;align-items:center;cursor:pointer">
        <input type="checkbox" id="p-consig" ${prod?.consignado ? 'checked' : ''}> <b>🤝 Produto consignado</b>
        <small style="color:var(--texto-suave)">— peça de fornecedor; na venda, o repasse dele fica registrado para o acerto</small>
      </label>
      <div class="linha-3" id="p-consig-campos" style="margin-top:10px;${prod?.consignado ? '' : 'display:none'}">
        <div class="campo"><label>Fornecedor *</label>
          <select id="p-forn"><option value="">Carregando…</option></select></div>
        <div class="campo"><label>% do fornecedor *</label>
          <input id="p-pctf" type="number" min="1" max="99" step="0.5" value="${prod?.pct_fornecedor || ''}"></div>
        <div class="campo"><label>% da loja</label>
          <input id="p-pctl" disabled placeholder="—"></div>
      </div>
    </div>

    <div class="grade-titulo">
      <h3>Grade — cores e tamanhos</h3>
      <button class="btn btn-suave" id="add-var" type="button">+ Variação</button>
    </div>
    <table class="grade">
      <thead><tr><th class="var-foto-cell" title="Foto da variação">Foto</th><th>Cor</th><th>Tamanho</th><th>${prod?.id ? 'Estoque' : 'Estoque inicial'}</th><th>Mínimo</th><th>Código de barras</th><th></th></tr></thead>
      <tbody id="grade-corpo"></tbody>
    </table>
    <div class="erro" id="p-erro"></div>
  `, async (m, fechar) => {
    const dados = {
      id: prod?.id,
      foto: fotoAtual,
      nome: m.querySelector('#p-nome').value,
      referencia: m.querySelector('#p-ref').value,
      categoria_id: Number(m.querySelector('#p-cat').value) || null,
      preco_custo: Number(m.querySelector('#p-custo')?.value) || 0,
      preco_venda: Number(m.querySelector('#p-venda').value) || 0,
      estoque_minimo: Number(m.querySelector('#p-min').value) || 0,
      consignado: m.querySelector('#p-consig').checked ? 1 : 0,
      fornecedor_id: Number(m.querySelector('#p-forn').value) || null,
      pct_fornecedor: Number(m.querySelector('#p-pctf').value) || 0,
      // `foto` PRECISA ir aqui. Desde a v2.7.0 o core aceita foto por variação
      // (produtos.js:146), mas a tela não a enviava: o usuário escolhia a
      // imagem, via a miniatura na grade, salvava — e a foto sumia.
      // A linha vai para o backend se tiver QUALQUER coisa preenchida.
      // Antes o filtro era só `l.cor || l.tamanho || l.id`: quem cadastrava uma
      // peça sem variação — digitando apenas a quantidade e deixando cor e
      // tamanho em branco — tinha a linha DESCARTADA aqui. O core então criava
      // uma variação Única/U com estoque 0 (produtos.js:108) e o produto nascia
      // zerado, obrigando a dar entrada pelo módulo Estoque depois.
      variacoes: linhas.filter(l =>
        l.id || l.cor || l.tamanho ||
        Number(l.estoque) > 0 || Number(l.estoque_minimo) > 0 ||
        l.codigo_barras || l.foto)
        .map(l => ({ id: l.id, cor: l.cor, tamanho: l.tamanho,
          estoque: Number(l.estoque) || 0, estoque_minimo: Number(l.estoque_minimo) || 0,
          codigo_barras: l.codigo_barras, foto: l.foto ?? null }))
    };
    const r = await api('produtos:salvar', dados);
    if (!r.ok) { m.querySelector('#p-erro').textContent = r.erro; return; }
    toast('Produto salvo.'); fechar(); aoConcluir();
  });

  const corpo = m.querySelector('#grade-corpo');

  // consignação: mostrar/esconder campos, % da loja ao vivo e lista de fornecedores
  const cbConsig = m.querySelector('#p-consig');
  const boxConsig = m.querySelector('#p-consig-campos');
  const selForn = m.querySelector('#p-forn');
  const inpPctF = m.querySelector('#p-pctf');
  const inpPctL = m.querySelector('#p-pctl');
  const syncPct = () => {
    const v = Number(inpPctF.value) || 0;
    inpPctL.value = (v > 0 && v < 100) ? `${+(100 - v).toFixed(1)}%` : '';
  };
  inpPctF.addEventListener('input', syncPct); syncPct();
  cbConsig.onchange = () => { boxConsig.style.display = cbConsig.checked ? '' : 'none'; };
  api('fornecedores:listar', {}).then(r => {
    selForn.innerHTML = '<option value="">— selecione —</option>' + (r.ok ? (r.fornecedores || []).map(f =>
      `<option value="${f.id}" ${prod?.fornecedor_id === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('') : '');
    if (!r.ok || !(r.fornecedores || []).length) {
      selForn.innerHTML += '<option value="" disabled>Cadastre fornecedores em Compras</option>';
    }
  });

  // foto opcional (redimensiona no cliente antes de salvar)
  const fPrev = m.querySelector('#p-foto-prev');
  const fInp = m.querySelector('#p-foto-input');
  const fRem = m.querySelector('#p-foto-rem');
  fInp.addEventListener('change', () => {
    const arq = fInp.files[0];
    if (!arq) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 500;
        let w = img.width, h = img.height;
        if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
        else if (h > max) { w = Math.round(w * max / h); h = max; }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        fotoAtual = cv.toDataURL('image/jpeg', 0.72);
        fPrev.innerHTML = `<img src="${fotoAtual}">`;
        fRem.style.display = '';
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(arq);
  });
  fRem.onclick = () => { fotoAtual = null; fPrev.innerHTML = '<span>sem foto</span>'; fRem.style.display = 'none'; fInp.value = ''; };

  function desenharGrade() {
    corpo.innerHTML = '';
    linhas.forEach((l, i) => {
      const tr = el(`<tr>
        <td class="var-foto-cell"></td>
        <td><input data-c="cor" value="${esc(l.cor || '')}" placeholder="Preto"></td>
        <td><input data-c="tamanho" value="${esc(l.tamanho || '')}" placeholder="M"></td>
        <td><input data-c="estoque" type="number" min="0" value="${l.id ? (l.estoque ?? 0) : (l.estoque || '')}" placeholder="0" ${l.id ? 'disabled title="Ajuste pelo módulo Estoque"' : ''}></td>
        <td><input data-c="estoque_minimo" type="number" min="0" value="${l.estoque_minimo || ''}" placeholder="0" style="width:60px" title="Mínimo para esta variação (0 = usa o padrão do produto)"></td>
        <td>${l.id
          ? `<span class="cod">${esc(l.codigo_barras || '')}</span>`
          : `<input data-c="codigo_barras" value="${esc(l.codigo_barras || '')}" placeholder="automático">`}</td>
        <td class="acoes-linha">
          <button type="button" class="var-dup" title="Duplicar esta variação (copia cor e foto)">⎘</button>
          <button type="button" class="var-del" style="color:var(--vermelho)" title="Remover esta variação">✕</button>
        </td>
      </tr>`);
      // ---- foto da variação ----
      const tdFoto = tr.querySelector('.var-foto-cell');
      const fInp = document.createElement('input');
      fInp.type = 'file'; fInp.accept = 'image/*'; fInp.style.display = 'none';
      if (l.foto) {
        // ÁREA DE PRODUTOS = área de EDIÇÃO: clicar na foto abre o explorer
        // para trocar. A classe `foto-editavel` mantém esta imagem fora do
        // lightbox e do hover (que continuam valendo no PDV e nas listas).
        // Antes, o clique era sequestrado pelo lightbox global (fase de
        // captura + stopPropagation) e a troca só existia no clique direito,
        // que ninguém descobria — na prática a foto ficava presa para sempre.
        const img = document.createElement('img');
        img.className = 'var-foto-thumb foto-editavel'; img.src = l.foto;
        img.title = 'Clique para escolher outra foto';
        img.style.cursor = 'pointer';
        img.onclick = () => fInp.click();
        tdFoto.appendChild(img);

        // sem isto, uma foto errada nunca sairia da variação
        const rem = document.createElement('button');
        rem.type = 'button'; rem.className = 'var-foto-rem';
        rem.textContent = '✕'; rem.title = 'Remover a foto desta variação';
        rem.onclick = (e) => { e.stopPropagation(); l.foto = null; desenharGrade(); };
        tdFoto.appendChild(rem);
      } else {
        const btn = document.createElement('div');
        btn.className = 'var-foto-btn'; btn.title = 'Adicionar foto a esta variação';
        btn.textContent = '📷';
        btn.onclick = () => fInp.click();
        tdFoto.appendChild(btn);
      }
      fInp.onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const img2 = new Image();
          img2.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = cv.height = 400;
            const ctx = cv.getContext('2d');
            const s = Math.min(img2.width, img2.height);
            ctx.drawImage(img2, (img2.width-s)/2, (img2.height-s)/2, s, s, 0, 0, 400, 400);
            l.foto = cv.toDataURL('image/jpeg', 0.72);
            desenharGrade();
          };
          img2.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      };
      tdFoto.appendChild(fInp);
      // ---- inputs de dados ----
      tr.querySelectorAll('[data-c]').forEach(inp => {
        inp.addEventListener('input', () => {
          // campo numérico vazio = 0 (não força o usuário a apagar um valor pré-preenchido)
          l[inp.dataset.c] = inp.type === 'number'
            ? (inp.value === '' ? 0 : Number(inp.value))
            : inp.value;
        });
      });
      // Duplicar variação: copia cor, tamanho, mínimo e foto da linha. Estoque e
      // código de barras nascem em branco — o código é UNIQUE no banco e o
      // estoque de uma variação nova é sempre zero. Entra logo abaixo da
      // original, para a grade continuar legível.
      const btnDup = tr.querySelector('.var-dup');
      if (btnDup) {
        btnDup.onclick = () => {
          linhas.splice(i + 1, 0, {
            cor: l.cor || '', tamanho: l.tamanho || '',
            estoque: '', estoque_minimo: l.estoque_minimo || '',
            codigo_barras: '', foto: l.foto || null
          });
          desenharGrade();
          // foco no tamanho da linha nova — é quase sempre o que muda
          const nova = corpo.children[i + 1];
          if (nova) { const t = nova.querySelector('[data-c="tamanho"]'); if (t) { t.focus(); t.select(); } }
        };
      }

      const btnDel = tr.querySelector('.var-del');
      if (btnDel) {
        btnDel.onclick = () => {
          if (l.id && (l.estoque || 0) > 0) {
            if (!confirm(`Esta variação tem ${l.estoque} peça(s) em estoque. Excluir mesmo assim?`)) return;
          }
          linhas.splice(i, 1);
          desenharGrade();
        };
      }
      corpo.appendChild(tr);
    });
  }

  m.querySelector('#add-var').onclick = () => {
    linhas.push({ cor: '', tamanho: '', estoque: '', codigo_barras: '', foto: null });
    desenharGrade();
  };
  desenharGrade();
}

// ---------- Vales-Troca ----------
async function viewValesTroca(alvo) {
  if (!pode('vales.ver')) { alvo.innerHTML = '<p class="vazio">Sem acesso.</p>'; return; }
  const r = await api('vales_troca:listar');
  const vales = r.ok ? r.vales : [];
  const tela = el(`
    <div>
      <div class="pagina-topo"><h1>🎫 Vales-Troca</h1></div>
      <div class="painel">
        <table>
          <thead><tr>
            <th>Código</th>
            <th class="num">Valor total</th>
            <th class="num">Usado</th>
            <th class="num">Saldo</th>
            <th>Status</th>
            <th>Emitido em</th>
            <th>Válido até</th>
            <th style="width:120px"></th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>`);
  const tbody = tela.querySelector('tbody');
  if (!vales.length) {
    tbody.appendChild(el(`<tr><td colspan="8" class="vazio">Nenhum vale-troca emitido ainda.</td></tr>`));
  }
  const brData = s => { if (!s) return null; const [a, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
  for (const v of vales) {
    const saldo = v.valor_total - v.valor_usado;
    // Vencido é calculado pela data (não existe status 'expirado' no banco)
    const cls = v.vencido ? 'badge-cinza'
      : v.status === 'ativo' ? 'badge-verde'
      : v.status === 'parcial' ? 'badge-amarelo' : 'badge-cinza';
    const rotulo = v.vencido && v.status !== 'usado' ? 'vencido' : v.status;
    tbody.appendChild(el(`<tr${v.vencido && v.status !== 'usado' ? ' style="opacity:.6"' : ''}>
      <td><b>${esc(v.codigo)}</b></td>
      <td class="num">${moeda(v.valor_total)}</td>
      <td class="num">${moeda(v.valor_usado)}</td>
      <td class="num">${moeda(saldo)}</td>
      <td><span class="badge ${cls}">${esc(rotulo)}</span></td>
      <td>${brData(v.criado_em) || '—'}</td>
      <td>${v.validade ? esc(brData(v.validade)) : '<span style="color:var(--texto-suave)">sem vencimento</span>'}</td>
      <td class="acoes-linha">${saldo > 0 && !v.vencido
        ? '<button data-a="reimp">🖨️ 2ª via</button>' : ''}</td>
    </tr>`));
  }
  // 2ª via do vale — para quando a cliente perde o papel
  tbody.querySelectorAll('[data-a=reimp]').forEach((b, i) => {
    const vale = vales[i] || vales.find(x => x.codigo === b.closest('tr').querySelector('b').textContent);
    b.onclick = async () => {
      b.disabled = true;
      const r = await imprimirVale({
        codigo: vale.codigo,
        valor_total: vale.valor_total - vale.valor_usado,   // 2ª via sai com o SALDO
        validade: vale.validade
      }, { cliente: vale.cliente_nome || null });
      b.disabled = false;
      if (r && r.ok === false) toast(r.erro, true);
      else toast('2ª via enviada para a impressora.');
    };
  });
  alvo.appendChild(tela);
}

// ---------- Lightbox + hover card ----------
function iniciarLightbox() {
  // Lightbox — clicar em qualquer imagem com .thumb ou dentro de .foto-preview
  const lb = document.createElement('div'); lb.id = 'lb';
  lb.innerHTML = '<span id="lb-close">✕</span><img id="lb-img" alt="">';
  lb.style.display = 'none';
  document.body.appendChild(lb);

  function abrirLb(src) {
    lb.querySelector('#lb-img').src = src;
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function fecharLb() {
    lb.style.display = 'none';
    lb.querySelector('#lb-img').src = '';
    document.body.style.overflow = '';
  }
  lb.addEventListener('click', fecharLb);

  // Hover card — aparece ao passar o mouse numa miniatura real (não emoji)
  const hov = document.createElement('div'); hov.id = 'img-hov';
  hov.innerHTML = '<img id="hov-img" alt="">';
  document.body.appendChild(hov);
  const hovImg = hov.querySelector('#hov-img');
  let hovTimer = null;

  // delegação de eventos — funciona para thumbs criados dinamicamente
  // e.target pode ser um nó de texto (sem .closest); guard com instanceof Element
  // `foto-editavel` marca as imagens da ÁREA DE PRODUTOS, onde clicar serve
  // para TROCAR a foto (abre o explorer). Elas ficam fora do lightbox e do
  // hover — no PDV e nas listas tudo continua ampliando como antes.
  const SEL_ZOOM = 'img.thumb:not(.foto-editavel), .foto-preview img:not(.foto-editavel), img.var-foto-thumb:not(.foto-editavel)';
  const SEL_HOVER = 'img.thumb:not(.foto-editavel), img.var-foto-thumb:not(.foto-editavel)';

  document.addEventListener('click', e => {
    if (!(e.target instanceof Element)) return;
    const img = e.target.closest(SEL_ZOOM);
    if (img && img.src && !img.src.startsWith('data:text')) {
      e.stopPropagation();
      abrirLb(img.src);
    }
  }, true);

  document.addEventListener('mouseenter', e => {
    if (!(e.target instanceof Element)) return;
    const img = e.target.closest(SEL_HOVER);
    if (!img || !img.src || img.src.endsWith('#')) return;
    clearTimeout(hovTimer);
    hovTimer = setTimeout(() => {
      hovImg.src = img.src;
      hov.style.display = 'block';
    }, 120);
  }, true);

  document.addEventListener('mousemove', e => {
    if (hov.style.display === 'none') return;
    const x = e.clientX + 18, y = e.clientY - 110;
    hov.style.left = Math.min(x, window.innerWidth - 220) + 'px';
    hov.style.top  = Math.max(8, Math.min(y, window.innerHeight - 220)) + 'px';
  });

  document.addEventListener('mouseleave', e => {
    if (!(e.target instanceof Element)) return;
    const img = e.target.closest(SEL_HOVER);
    if (img) { clearTimeout(hovTimer); hov.style.display = 'none'; }
  }, true);
}

// ---------- Inicialização ----------
(async () => {
  await recarregarVersao();
  await recarregarConfig();
  await recarregarLicenca();
  aplicarTema();
  iniciarLightbox();
  if (NO_APP) {
    api('app:garantirExtensao').catch(() => {});
    // Abertura maximizada garantida por "maximized":true no neutralino.config.json.
    // Foco no startup via AppActivate no PS1 da extensão (~2s após iniciar).
  }
  telaLogin();
})();
