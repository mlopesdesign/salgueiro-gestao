// Backup automático na nuvem — Google Drive e OneDrive
// Usa OAuth 2.0 PKCE (sem client_secret — seguro para apps desktop)
// Tokens armazenados em {dataDir}/cloud_tokens.json
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
// shell importado de forma opcional (não disponível no Node puro / testes)
let _shell;
try { _shell = require('electron').shell; } catch {}

// ── Configuração de providers ─────────────────────────────────────────────────
// IMPORTANTE: Márcio deve registrar os apps e substituir os client_id abaixo.
// Google: console.cloud.google.com → Credenciais → OAuth 2.0 para app desktop
// Microsoft: portal.azure.com → Registros de app → Plataforma: móvel/desktop
const PROVIDERS = {
  google: {
    nome: 'Google Drive',
    client_id: process.env.SALG_GOOGLE_CLIENT_ID || 'SEU_GOOGLE_CLIENT_ID_AQUI',
    auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.file',
    revoke_url: 'https://oauth2.googleapis.com/revoke'
  },
  onedrive: {
    nome: 'OneDrive',
    client_id: process.env.SALG_ONEDRIVE_CLIENT_ID || 'SEU_ONEDRIVE_CLIENT_ID_AQUI',
    auth_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'Files.ReadWrite offline_access',
    revoke_url: null
  }
};

// ── Credenciais configuráveis pela interface (Configurações → Nuvem) ────────
// Prioridade: cloud_config.json (salvo pela UI) → variável de ambiente → constante acima.
function cloudConfigPath(dataDir) { return path.join(dataDir, 'cloud_config.json'); }

function lerClientIds(dataDir) {
  try { return JSON.parse(fs.readFileSync(cloudConfigPath(dataDir), 'utf8')); }
  catch { return {}; }
}

function salvarClientId(dataDir, provider, client_id) {
  if (!PROVIDERS[provider]) return { ok: false, erro: 'Provider inválido.' };
  const valor = String(client_id || '').trim();
  if (valor && valor.length < 10) return { ok: false, erro: 'Client ID muito curto — confira o valor copiado.' };
  const atual = lerClientIds(dataDir);
  atual[provider] = valor;
  fs.writeFileSync(cloudConfigPath(dataDir), JSON.stringify(atual, null, 2));
  return { ok: true, configurado: !!valor };
}

function cfgProvider(dataDir, provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg) return null;
  const ids = lerClientIds(dataDir);
  const client_id = String(ids[provider] || cfg.client_id || '').trim();
  return { ...cfg, client_id };
}

function clientIdConfigurado(cfg) {
  return !!cfg.client_id && !cfg.client_id.startsWith('SEU_');
}

const REDIRECT_PORT = 9741;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const FOLDER_NAME = 'SalgueiroBackup';
const MAX_BACKUPS = 30;

// ── Helpers PKCE ─────────────────────────────────────────────────────────────
function pkceChallenge() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// ── Armazenamento de tokens ───────────────────────────────────────────────────
function tokensPath(dataDir) { return path.join(dataDir, 'cloud_tokens.json'); }

function lerTokens(dataDir) {
  try { return JSON.parse(fs.readFileSync(tokensPath(dataDir), 'utf8')); }
  catch { return {}; }
}

function salvarTokens(dataDir, dados) {
  const atual = lerTokens(dataDir);
  fs.writeFileSync(tokensPath(dataDir), JSON.stringify({ ...atual, ...dados }, null, 2));
}

function limparTokens(dataDir, provider) {
  const atual = lerTokens(dataDir);
  delete atual[provider];
  fs.writeFileSync(tokensPath(dataDir), JSON.stringify(atual, null, 2));
}

// ── Status da conexão ─────────────────────────────────────────────────────────
function obterStatus(dataDir) {
  const tokens = lerTokens(dataDir);
  const resultado = {};
  for (const key of Object.keys(PROVIDERS)) {
    const cfg = cfgProvider(dataDir, key);
    const t = tokens[key];
    resultado[key] = {
      nome: cfg.nome,
      conectado: !!(t && t.access_token),
      conta: t?.conta || null,
      ultimo_backup: t?.ultimo_backup || null,
      client_id_configurado: clientIdConfigurado(cfg)
    };
  }
  return { ok: true, providers: resultado };
}

// ── OAuth: iniciar fluxo ──────────────────────────────────────────────────────
async function iniciarOAuth(dataDir, provider) {
  const cfg = cfgProvider(dataDir, provider);
  if (!cfg) return { ok: false, erro: 'Provider inválido.' };
  if (!clientIdConfigurado(cfg)) {
    return { ok: false, erro: `Cole a credencial (Client ID) do ${cfg.nome} no campo acima e salve antes de conectar.` };
  }

  const { verifier, challenge } = pkceChallenge();
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: cfg.client_id,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: cfg.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',   // Google: força refresh_token
    prompt: 'consent'          // Google: garante refresh_token mesmo se já autorizado
  });

  const authUrl = `${cfg.auth_url}?${params}`;

  return new Promise((resolve) => {
    let server;
    const timeout = setTimeout(() => {
      try { server.close(); } catch {}
      resolve({ ok: false, erro: 'Tempo esgotado. Tente novamente.' });
    }, 120000); // 2 minutos

    server = http.createServer(async (req, res) => {
      if (!req.url.startsWith('/callback')) return;
      const url = new URL(req.url, 'http://localhost');
      const code = url.searchParams.get('code');
      const retState = url.searchParams.get('state');
      const erro = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<html><body style="font-family:sans-serif;text-align:center;padding-top:60px">
        <h2>${erro ? '❌ Falha na autenticação' : '✅ Autenticado com sucesso!'}</h2>
        <p>${erro ? erro : 'Você pode fechar esta aba e voltar ao Salgueiro Gestão.'}</p>
        <script>setTimeout(()=>window.close(),3000)</script>
      </body></html>`);

      clearTimeout(timeout);
      server.close();

      if (erro || retState !== state) {
        return resolve({ ok: false, erro: erro || 'State inválido.' });
      }

      // Trocar code por tokens
      try {
        const body = new URLSearchParams({
          client_id: cfg.client_id,
          code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
          code_verifier: verifier
        });
        const resp = await fetchJson(cfg.token_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        });
        if (!resp.access_token) return resolve({ ok: false, erro: resp.error_description || 'Falha ao obter token.' });

        // Salvar tokens
        const dados = {
          access_token: resp.access_token,
          refresh_token: resp.refresh_token || null,
          expires_at: Date.now() + (resp.expires_in || 3600) * 1000
        };
        salvarTokens(dataDir, { [provider]: dados });
        resolve({ ok: true, provider, nome: cfg.nome });
      } catch (e) {
        resolve({ ok: false, erro: e.message });
      }
    });

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      if (_shell) _shell.openExternal(authUrl);
      else require('child_process').exec(`start "" "${authUrl}"`);
    });

    server.on('error', (e) => {
      clearTimeout(timeout);
      resolve({ ok: false, erro: `Porta ${REDIRECT_PORT} em uso. Feche outro processo e tente novamente.` });
    });
  });
}

// ── Refresh token ─────────────────────────────────────────────────────────────
async function refreshToken(dataDir, provider) {
  const cfg = cfgProvider(dataDir, provider);
  const tokens = lerTokens(dataDir);
  const t = tokens[provider];
  if (!t?.refresh_token) throw new Error('Não há refresh token. Reconecte o provider.');

  const body = new URLSearchParams({
    client_id: cfg.client_id,
    refresh_token: t.refresh_token,
    grant_type: 'refresh_token'
  });
  const resp = await fetchJson(cfg.token_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!resp.access_token) throw new Error(resp.error_description || 'Falha ao renovar token.');

  t.access_token = resp.access_token;
  t.expires_at = Date.now() + (resp.expires_in || 3600) * 1000;
  if (resp.refresh_token) t.refresh_token = resp.refresh_token;
  salvarTokens(dataDir, { [provider]: t });
  return t.access_token;
}

async function getToken(dataDir, provider) {
  const tokens = lerTokens(dataDir);
  const t = tokens[provider];
  if (!t) throw new Error('Provider não conectado.');
  if (Date.now() < (t.expires_at || 0) - 60000) return t.access_token;
  return refreshToken(dataDir, provider);
}

// ── Desconectar ───────────────────────────────────────────────────────────────
async function desconectar(dataDir, provider) {
  const cfg = PROVIDERS[provider];
  try {
    const token = await getToken(dataDir, provider);
    if (cfg.revoke_url) {
      await fetchJson(`${cfg.revoke_url}?token=${token}`, { method: 'POST' }).catch(() => {});
    }
  } catch {}
  limparTokens(dataDir, provider);
  return { ok: true };
}

// ── Backup: Google Drive ──────────────────────────────────────────────────────
async function backupGoogleDrive(dataDir, arquivoDb) {
  const token = await getToken(dataDir, 'google');
  const auth = `Bearer ${token}`;

  // Obter ou criar pasta SalgueiroBackup
  let folderId;
  const search = await fetchJson(
    `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
    { headers: { Authorization: auth } }
  );
  if (search.files?.length) {
    folderId = search.files[0].id;
  } else {
    const folder = await fetchJson('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
    });
    folderId = folder.id;
  }

  // Upload do arquivo
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const nomeArquivo = `salgueiro-${timestamp}.db`;
  const conteudo = fs.readFileSync(arquivoDb);

  const metadata = JSON.stringify({ name: nomeArquivo, parents: [folderId] });
  const boundary = 'backup_boundary_salgueiro';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(metadata),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    conteudo,
    Buffer.from(`\r\n--${boundary}--`)
  ]);

  const upload = await fetchJson(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': body.length },
      body
    }
  );
  if (!upload.id) throw new Error('Falha no upload: ' + JSON.stringify(upload));

  // Limpar backups antigos (manter MAX_BACKUPS)
  const lista = await fetchJson(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&orderBy=createdTime&fields=files(id,name)`,
    { headers: { Authorization: auth } }
  );
  const arquivos = lista.files || [];
  if (arquivos.length > MAX_BACKUPS) {
    const aExcluir = arquivos.slice(0, arquivos.length - MAX_BACKUPS);
    for (const f of aExcluir) {
      await fetchJson(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: 'DELETE', headers: { Authorization: auth } }).catch(() => {});
    }
  }

  return nomeArquivo;
}

// ── Backup: OneDrive ──────────────────────────────────────────────────────────
async function backupOneDrive(dataDir, arquivoDb) {
  const token = await getToken(dataDir, 'onedrive');
  const auth = `Bearer ${token}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const nomeArquivo = `salgueiro-${timestamp}.db`;
  const conteudo = fs.readFileSync(arquivoDb);

  // Upload via PUT simples (até 4MB — banco local quase sempre menor)
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${FOLDER_NAME}/${nomeArquivo}:/content`;
  const resp = await fetchJson(url, {
    method: 'PUT',
    headers: { Authorization: auth, 'Content-Type': 'application/octet-stream' },
    body: conteudo
  });
  if (!resp.id) throw new Error('Falha no upload OneDrive: ' + JSON.stringify(resp));

  // Limpar backups antigos
  try {
    const folder = await fetchJson(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${FOLDER_NAME}:/children?$orderby=createdDateTime&$top=200`,
      { headers: { Authorization: auth } }
    );
    const itens = folder.value || [];
    if (itens.length > MAX_BACKUPS) {
      for (const item of itens.slice(0, itens.length - MAX_BACKUPS)) {
        await fetchJson(`https://graph.microsoft.com/v1.0/me/drive/items/${item.id}`, { method: 'DELETE', headers: { Authorization: auth } }).catch(() => {});
      }
    }
  } catch {}

  return nomeArquivo;
}

// ── Executar backup ───────────────────────────────────────────────────────────
async function fazerBackup(dataDir, arquivoDb, provider) {
  if (!fs.existsSync(arquivoDb)) return { ok: false, erro: 'Banco de dados não encontrado.' };
  try {
    let nomeArquivo;
    if (provider === 'google') nomeArquivo = await backupGoogleDrive(dataDir, arquivoDb);
    else if (provider === 'onedrive') nomeArquivo = await backupOneDrive(dataDir, arquivoDb);
    else return { ok: false, erro: 'Provider desconhecido.' };

    // Registrar data do último backup
    const tokens = lerTokens(dataDir);
    if (tokens[provider]) {
      tokens[provider].ultimo_backup = new Date().toISOString();
      salvarTokens(dataDir, { [provider]: tokens[provider] });
    }
    return { ok: true, arquivo: nomeArquivo, provider };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

// Backup em todos os providers conectados
async function fazerBackupTodos(dataDir, arquivoDb) {
  const tokens = lerTokens(dataDir);
  const resultados = [];
  for (const provider of Object.keys(PROVIDERS)) {
    if (tokens[provider]?.access_token) {
      const r = await fazerBackup(dataDir, arquivoDb, provider);
      resultados.push({ provider, ...r });
    }
  }
  return { ok: true, resultados };
}

// ── Verifica se deve fazer backup diário ──────────────────────────────────────
function precisaBackupDiario(dataDir) {
  const tokens = lerTokens(dataDir);
  for (const provider of Object.keys(PROVIDERS)) {
    const t = tokens[provider];
    if (!t?.access_token) continue;
    const ultimo = t.ultimo_backup ? new Date(t.ultimo_backup) : null;
    if (!ultimo) return true;
    const horas = (Date.now() - ultimo.getTime()) / 3600000;
    if (horas >= 23) return true;
  }
  return false;
}

// ── fetch helper (usa Node.js nativo — disponível no Node 18+) ────────────────
function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? require('https') : require('http');
    const body = opts.body;
    const headers = { ...opts.headers };
    if (body && !headers['Content-Length']) headers['Content-Length'] = Buffer.byteLength(body);

    const req = mod.request({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), method: opts.method || 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        if (res.statusCode === 204 || !text) return resolve({});
        try { resolve(JSON.parse(text)); } catch { resolve({ _raw: text }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { obterStatus, iniciarOAuth, desconectar, fazerBackup, fazerBackupTodos, precisaBackupDiario, salvarClientId };
