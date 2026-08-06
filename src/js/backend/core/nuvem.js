// Salgueiro Gestão V2 — Backup na nuvem (Google Drive + OneDrive)
// Port de legado/src/core/backup_nuvem.js para ESM / WebView2 / Neutralino.
// Sem dependências externas: usa fetch nativo, Web Crypto API e Neutralino.filesystem.
/* global Neutralino */

import * as ambiente from '../ambiente.js';

const EXT_ID = 'br.com.mllopes.salgueiro.rede';
const REDIRECT_PORT = 9741;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const FOLDER_NAME = 'SalgueiroBackup';
const MAX_BACKUPS = 30;

const PROVIDERS = {
  google: {
    nome: 'Google Drive',
    auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.file',
    revoke_url: 'https://oauth2.googleapis.com/revoke'
  },
  onedrive: {
    nome: 'OneDrive',
    auth_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'Files.ReadWrite offline_access',
    revoke_url: null
  }
};

// ── Persistência (reutiliza helpers de ambiente.js) ───────────────────────────
async function lerJson(nome) {
  try { const t = await ambiente.lerTextoDados(nome); return t ? JSON.parse(t) : {}; }
  catch { return {}; }
}
async function salvarJson(nome, dados) {
  await ambiente.escreverTextoDados(nome, JSON.stringify(dados, null, 2));
}

// ── Client IDs (configurados pelo desenvolvedor na tela de Nuvem) ─────────────
async function lerClientIds() { return lerJson('cloud_config.json'); }

export async function salvarClientId(provider, client_id) {
  if (!PROVIDERS[provider]) return { ok: false, erro: 'Provider inválido.' };
  const valor = String(client_id || '').trim();
  if (valor && valor.length < 10) return { ok: false, erro: 'Client ID muito curto — confira o valor copiado.' };
  const atual = await lerClientIds();
  atual[provider] = valor;
  await salvarJson('cloud_config.json', atual);
  return { ok: true, configurado: !!valor };
}

async function cfgProvider(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg) return null;
  const ids = await lerClientIds();
  const client_id = String(ids[provider] || '').trim();
  return { ...cfg, client_id };
}
function clientIdOk(cfg) { return !!cfg.client_id && cfg.client_id.length >= 10; }

// ── Tokens ────────────────────────────────────────────────────────────────────
async function lerTokens() { return lerJson('cloud_tokens.json'); }
async function salvarTokens(delta) {
  const atual = await lerTokens();
  await salvarJson('cloud_tokens.json', { ...atual, ...delta });
}
async function limparTokens(provider) {
  const atual = await lerTokens();
  delete atual[provider];
  await salvarJson('cloud_tokens.json', atual);
}

// ── Status (retornado à rota nuvem:status) ────────────────────────────────────
export async function obterStatus() {
  const tokens = await lerTokens();
  const ids = await lerClientIds();
  const resultado = {};
  for (const [key, cfg] of Object.entries(PROVIDERS)) {
    const client_id = String(ids[key] || '').trim();
    const t = tokens[key];
    resultado[key] = {
      nome: cfg.nome,
      conectado: !!(t && t.access_token),
      conta: t?.conta || null,
      ultimo_backup: t?.ultimo_backup || null,
      client_id_configurado: !!client_id && client_id.length >= 10
    };
  }
  return { ok: true, providers: resultado };
}

// ── PKCE (Web Crypto API — sem require('crypto')) ─────────────────────────────
async function pkceChallenge() {
  const verifierBytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(verifierBytes);
  const verifier = btoa(String.fromCharCode(...verifierBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encoded = new TextEncoder().encode(verifier);
  const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hashBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { verifier, challenge };
}
function randomHex(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

// ── OAuth PKCE — aguarda callback via extensão PowerShell ────────────────────
let _oauthResolver = null;

// Deve ser chamado uma vez no boot (em servidor.js, após rede.preparar())
export function registrarOAuthListener() {
  Neutralino.events.on('nuvem.oauth.callback', (ev) => {
    if (_oauthResolver) { _oauthResolver(ev.detail || {}); _oauthResolver = null; }
  });
}

export async function iniciarOAuth(provider) {
  const cfg = await cfgProvider(provider);
  if (!cfg) return { ok: false, erro: 'Provider inválido.' };
  if (!clientIdOk(cfg)) {
    return { ok: false, erro: `Cole a credencial (Client ID) do ${cfg.nome} no campo acima e salve antes de conectar.` };
  }

  const { verifier, challenge } = await pkceChallenge();
  const state = randomHex(16);

  const params = new URLSearchParams({
    client_id: cfg.client_id, response_type: 'code',
    redirect_uri: REDIRECT_URI, scope: cfg.scope, state,
    code_challenge: challenge, code_challenge_method: 'S256',
    access_type: 'offline', prompt: 'consent'
  });
  const authUrl = `${cfg.auth_url}?${params}`;

  // Pede à extensão PowerShell para abrir listener temporário na porta 9741
  try {
    await Neutralino.extensions.dispatch(EXT_ID, 'nuvem.oauthIniciar', { porta: REDIRECT_PORT });
  } catch {
    return { ok: false, erro: 'Extensão de rede não disponível. Verifique se a rede está ativada em Configurações → Rede.' };
  }

  // Abre o browser do usuário na URL de autenticação
  await Neutralino.os.open(authUrl);

  // Aguarda o código OAuth (máx. 2 minutos)
  const cb = await new Promise((resolve) => {
    _oauthResolver = resolve;
    setTimeout(() => {
      if (_oauthResolver === resolve) { _oauthResolver = null; resolve({ erro: 'Tempo esgotado. Tente novamente.' }); }
    }, 120000);
  });

  if (cb.erro) return { ok: false, erro: cb.erro };
  if (cb.state !== state) return { ok: false, erro: 'Resposta inválida do servidor de autenticação. Tente novamente.' };

  // Troca o código por tokens
  try {
    const body = new URLSearchParams({
      client_id: cfg.client_id, code: cb.code,
      redirect_uri: REDIRECT_URI, grant_type: 'authorization_code', code_verifier: verifier
    });
    const resp = await fetch(cfg.token_url, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString()
    });
    const data = await resp.json();
    if (!data.access_token) return { ok: false, erro: data.error_description || 'Falha ao obter token de acesso.' };

    await salvarTokens({
      [provider]: {
        access_token: data.access_token,
        refresh_token: data.refresh_token || null,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000
      }
    });
    return { ok: true, provider, nome: cfg.nome };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

// ── Refresh / get token ───────────────────────────────────────────────────────
async function refreshToken(provider) {
  const cfg = await cfgProvider(provider);
  const tokens = await lerTokens();
  const t = tokens[provider];
  if (!t?.refresh_token) throw new Error('Não há refresh token. Reconecte o provider.');
  const body = new URLSearchParams({
    client_id: cfg.client_id, refresh_token: t.refresh_token, grant_type: 'refresh_token'
  });
  const resp = await fetch(cfg.token_url, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString()
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(data.error_description || 'Falha ao renovar token.');
  t.access_token = data.access_token;
  t.expires_at = Date.now() + (data.expires_in || 3600) * 1000;
  if (data.refresh_token) t.refresh_token = data.refresh_token;
  await salvarTokens({ [provider]: t });
  return t.access_token;
}

async function getToken(provider) {
  const tokens = await lerTokens();
  const t = tokens[provider];
  if (!t) throw new Error('Provider não conectado.');
  if (Date.now() < (t.expires_at || 0) - 60000) return t.access_token;
  return refreshToken(provider);
}

// ── Desconectar ───────────────────────────────────────────────────────────────
export async function desconectar(provider) {
  if (!PROVIDERS[provider]) return { ok: false, erro: 'Provider inválido.' };
  try {
    const cfg = PROVIDERS[provider];
    if (cfg.revoke_url) {
      const token = await getToken(provider).catch(() => null);
      if (token) fetch(`${cfg.revoke_url}?token=${token}`, { method: 'POST' }).catch(() => {});
    }
  } catch {}
  await limparTokens(provider);
  return { ok: true };
}

// ── Backup: Google Drive ──────────────────────────────────────────────────────
async function backupGoogleDrive(db) {
  const token = await getToken('google');
  const auth = `Bearer ${token}`;

  // Localizar ou criar pasta SalgueiroBackup
  let folderId;
  const search = await (await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D'${FOLDER_NAME}'+and+mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse&fields=files(id)`,
    { headers: { Authorization: auth } }
  )).json();
  if (search.files?.length) {
    folderId = search.files[0].id;
  } else {
    const folder = await (await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
    })).json();
    folderId = folder.id;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const nomeArquivo = `salgueiro-${ts}.db`;
  const bytes = db.exportar(); // Uint8Array

  // Multipart upload
  const boundary = 'salg_bkp_boundary';
  const meta = JSON.stringify({ name: nomeArquivo, parents: [folderId] });
  const pre = new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`);
  const post = new TextEncoder().encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(pre.length + bytes.length + post.length);
  body.set(pre, 0); body.set(bytes, pre.length); body.set(post, pre.length + bytes.length);

  const upload = await (await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    { method: 'POST', headers: { Authorization: auth, 'Content-Type': `multipart/related; boundary=${boundary}` }, body }
  )).json();
  if (!upload.id) throw new Error('Upload Google Drive falhou: ' + JSON.stringify(upload));

  // Limpar backups antigos (mantém MAX_BACKUPS)
  const lista = await (await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed%3Dfalse&orderBy=createdTime&fields=files(id,name)`,
    { headers: { Authorization: auth } }
  )).json();
  const arqs = lista.files || [];
  if (arqs.length > MAX_BACKUPS) {
    for (const f of arqs.slice(0, arqs.length - MAX_BACKUPS)) {
      fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: 'DELETE', headers: { Authorization: auth } }).catch(() => {});
    }
  }
  return nomeArquivo;
}

// ── Backup: OneDrive ──────────────────────────────────────────────────────────
async function backupOneDrive(db) {
  const token = await getToken('onedrive');
  const auth = `Bearer ${token}`;
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const nomeArquivo = `salgueiro-${ts}.db`;
  const bytes = db.exportar();

  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${FOLDER_NAME}/${nomeArquivo}:/content`;
  const resp = await (await fetch(url, {
    method: 'PUT', headers: { Authorization: auth, 'Content-Type': 'application/octet-stream' }, body: bytes
  })).json();
  if (!resp.id) throw new Error('Upload OneDrive falhou: ' + JSON.stringify(resp));

  try {
    const folder = await (await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${FOLDER_NAME}:/children?$orderby=createdDateTime&$top=200`,
      { headers: { Authorization: auth } }
    )).json();
    const itens = folder.value || [];
    if (itens.length > MAX_BACKUPS) {
      for (const item of itens.slice(0, itens.length - MAX_BACKUPS)) {
        fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${item.id}`, { method: 'DELETE', headers: { Authorization: auth } }).catch(() => {});
      }
    }
  } catch {}
  return nomeArquivo;
}

// ── Executar backup ───────────────────────────────────────────────────────────
export async function fazerBackup(db, provider) {
  try {
    let nomeArquivo;
    if (provider === 'google') nomeArquivo = await backupGoogleDrive(db);
    else if (provider === 'onedrive') nomeArquivo = await backupOneDrive(db);
    else return { ok: false, erro: 'Provider desconhecido.' };

    const tokens = await lerTokens();
    if (tokens[provider]) {
      tokens[provider].ultimo_backup = new Date().toISOString();
      await salvarTokens({ [provider]: tokens[provider] });
    }
    return { ok: true, arquivo: nomeArquivo, provider };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

// Backup em todos os providers conectados (fire-and-forget após fechar caixa)
export async function fazerBackupTodos(db) {
  const tokens = await lerTokens();
  const resultados = [];
  for (const provider of Object.keys(PROVIDERS)) {
    if (tokens[provider]?.access_token) {
      resultados.push(await fazerBackup(db, provider));
    }
  }
  return { ok: true, resultados };
}

// Retorna true se pelo menos um provider está conectado E passou 23h sem backup
export async function precisaBackupDiario() {
  const tokens = await lerTokens();
  for (const provider of Object.keys(PROVIDERS)) {
    const t = tokens[provider];
    if (!t?.access_token) continue;
    const ultimo = t.ultimo_backup ? new Date(t.ultimo_backup) : null;
    if (!ultimo || (Date.now() - ultimo.getTime()) / 3600000 >= 23) return true;
  }
  return false;
}
