// Acesso em rede (multiterminal) — V2.
// O servidor HTTP roda numa extensão PowerShell (nativa do Windows); este
// módulo conversa com ela e mantém as sessões dos terminais (como na V1).
/* global Neutralino */

const EXT_ID = 'br.com.mllopes.salgueiro.rede';
const SESSAO_TTL = 12 * 3600 * 1000; // 12 horas

// Rotas que só funcionam no computador principal (usam diálogos/arquivos locais)
const SOMENTE_LOCAL = new Set([
  'config:listarImpressoras', 'config:imprimir',
  'backup:manual', 'backup:restaurar',
  'nuvem:conectar', 'nuvem:desconectar', 'nuvem:backup',
  'rede:aplicar', 'rede:abrirNavegador', 'dev:entrar', 'dev:aplicar', 'dev:remover'
]);

let estado = { ativa: false, porta: 8750, ips: [], erro: null, extensaoPronta: false };
const sessoes = new Map(); // token → { usuario, ultimo }
let _processar = null;
let _log = () => {};   // registrarLog do ambiente (v3.31.0)

function limparSessoes() {
  const agora = Date.now();
  for (const [t, s] of sessoes) if (agora - s.ultimo > SESSAO_TTL) sessoes.delete(t);
}

function novoToken() {
  const b = new Uint8Array(24);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

let _impressorasResolver = null;
let _imprimirResolver = null;

// Lista as impressoras do Windows através da extensão (Get-CimInstance)
export async function listarImpressoras() {
  try {
    const promessa = new Promise((res) => { _impressorasResolver = res; });
    await Neutralino.extensions.dispatch(EXT_ID, 'rede.impressoras', {});
    const resp = await Promise.race([promessa, new Promise(r => setTimeout(() => r(null), 4000))]);
    _impressorasResolver = null;
    if (resp && Array.isArray(resp.impressoras)) return { ok: true, impressoras: resp.impressoras };
  } catch { /* extensão indisponível */ }
  return { ok: true, impressoras: [], aviso: 'Não foi possível consultar as impressoras agora.' };
}

// Imprime silenciosamente num arquivo HTML via extensão PowerShell (Start-Process PrintTo)
export async function imprimir({ conteudo, impressora, tipo }) {
  try {
    const promessa = new Promise((res) => { _imprimirResolver = res; });
    await Neutralino.extensions.dispatch(EXT_ID, 'rede.imprimir', { conteudo, impressora, tipo });
    const resp = await Promise.race([promessa, new Promise(r => setTimeout(() => r(null), 30000))]);
    _imprimirResolver = null;
    if (resp) return resp;
  } catch { /* extensão indisponível */ }
  return { ok: false, erro: 'Extensão de impressão indisponível.' };
}

// Registra os ouvintes uma única vez (chamado pelo servidor.js no boot)
export function preparar(processar, registrarLog) {
  _processar = processar;
  if (typeof registrarLog === 'function') _log = registrarLog;
  Neutralino.events.on('rede.extensao.pronta', (ev) => {
    estado.extensaoPronta = true;
    estado.extensaoVersao = (ev.detail && ev.detail.v) || 1;
  });
  Neutralino.events.on('rede.status', (ev) => {
    const d = ev.detail || {};
    estado.ativa = !!d.ativa;
    if (d.porta) estado.porta = d.porta;
    estado.ips = Array.isArray(d.ips) ? d.ips : estado.ativa ? estado.ips : [];
    estado.erro = d.erro || null;
  });
  Neutralino.events.on('rede.impressoras.resp', (ev) => {
    if (_impressorasResolver) _impressorasResolver(ev.detail || {});
  });
  Neutralino.events.on('rede.imprimir.resp', (ev) => {
    if (_imprimirResolver) _imprimirResolver(ev.detail || {});
  });
  Neutralino.events.on('rede.api', async (ev) => {
    const d = ev.detail || {};
    // v3.31.0: a extensão nova (v=2) manda o corpo do pedido em TEXTO e
    // recebe a resposta em TEXTO — o PowerShell não desmonta nem remonta JSON
    // (custava segundos em relatório grande). A antiga (sem v) continua aceita:
    // no primeiro boot depois da atualização ela ainda está rodando.
    const ini = Date.now();
    let canal = d.canal, payload = d.payload;
    if (d.v === 2) {
      try { const c = JSON.parse(d.corpo || '{}'); canal = c.canal; payload = c.payload; }
      catch { canal = '?'; payload = null; }
    }
    const corpo = await atenderTerminal(canal, payload, d.token, d.ip);
    const ms = Date.now() - ini;
    if (ms >= 2000) _log('SISTEMA-LENTO', `${d.ip || '?'} ${canal} ${ms}ms dentro do sistema`);
    try {
      await Neutralino.extensions.dispatch(EXT_ID, 'rede.resposta',
        d.v === 2 ? { reqId: d.reqId, json: JSON.stringify(corpo) } : { reqId: d.reqId, corpo });
    } catch (e) {
      _log('ERRO-RESPOSTA', `${canal} ${e && e.message ? e.message : e}`);
      console.error('[rede] resposta falhou:', e);
    }
  });
}

// Mesma lógica de sessões da V1 (rede.js): cada terminal tem token próprio.
async function atenderTerminal(canal, payload, token, ip) {
  try {
    limparSessoes();
    if (SOMENTE_LOCAL.has(canal)) {
      return { ok: false, erro: 'Esta função só está disponível no computador principal.' };
    }
    // Pedido vindo de navegador: marca a origem do lado do servidor (v3.31.1).
    // `_terminal` (o código do aparelho) vem do próprio navegador.
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      payload._rede = true;
      payload._ip = ip || '';
    }
    const sess = (token && sessoes.get(token)) || { usuario: null };
    if (token && sessoes.has(token)) sessoes.get(token).ultimo = Date.now();

    if (canal === 'auth:login') {
      const r = await _processar('auth:login', payload, sess);
      if (r && r.ok) {
        const t = novoToken();
        sessoes.set(t, { usuario: r.usuario, ultimo: Date.now() });
        return { ...r, token: t };
      }
      return r;
    }
    if (canal === 'auth:logout') {
      if (token) sessoes.delete(token);
      return { ok: true };
    }
    return await _processar(canal, payload, sess);
  } catch (e) {
    console.error('[rede]', canal, e);
    _log('ERRO', `${ip || '?'} ${canal} ${e && e.message ? e.message : e}`);
    return { ok: false, erro: e.message || 'Erro interno.' };
  }
}

export async function iniciar({ porta }) {
  try {
    await Neutralino.extensions.dispatch(EXT_ID, 'rede.iniciar', { porta: Number(porta) || 8750 });
  } catch (e) {
    return { ok: false, erro: 'O componente de rede não respondeu. Feche e abra o sistema e tente de novo.' };
  }
  // espera o status confirmar (até 6s)
  const limite = Date.now() + 6000;
  while (Date.now() < limite) {
    if (estado.ativa && estado.porta === (Number(porta) || 8750)) {
      return { ok: true, ips: estado.ips };
    }
    if (estado.erro) return { ok: false, erro: estado.erro };
    await new Promise(r => setTimeout(r, 120));
  }
  return { ok: false, erro: 'O servidor de rede não confirmou a ativação.' };
}

export async function parar() {
  try { await Neutralino.extensions.dispatch(EXT_ID, 'rede.parar', {}); } catch { /* extensão parada */ }
  estado.ativa = false;
  return { ok: true };
}

export function status(portaConfig) {
  return {
    ok: true,
    ativa: estado.ativa,
    porta: estado.ativa ? estado.porta : (Number(portaConfig) || 8750),
    ips: estado.ips,
    terminais: sessoes.size
  };
}

export { SOMENTE_LOCAL };
