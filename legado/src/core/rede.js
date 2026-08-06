// Acesso em rede (multiterminal): servidor HTTP embutido.
// O computador principal roda o sistema normalmente; os demais terminais
// acessam pelo navegador (http://IP-do-principal:porta) — sem instalar nada.
// Cada terminal tem sessão própria (token), com o mesmo login/permissões.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2'
};

const SESSAO_TTL = 12 * 3600 * 1000; // 12 horas

// Rotas que só funcionam no computador principal (usam diálogos/impressora local)
const SOMENTE_LOCAL = new Set([
  'config:listarImpressoras', 'config:imprimir',
  'backup:manual', 'backup:restaurar',
  'nuvem:conectar', 'nuvem:desconectar', 'nuvem:backup',
  'rede:aplicar', 'rede:abrirNavegador', 'dev:entrar', 'dev:aplicar', 'dev:remover'
]);

let servidor = null;
const sessoes = new Map(); // token → { usuario, ultimo }

function ipsLocais() {
  const out = [];
  for (const [nome, ifaces] of Object.entries(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === 'IPv4' && !i.internal) out.push({ interface: nome, ip: i.address });
    }
  }
  return out;
}

function limparSessoes() {
  const agora = Date.now();
  for (const [t, s] of sessoes) if (agora - s.ultimo > SESSAO_TTL) sessoes.delete(t);
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > 5e6) { reject(new Error('Corpo muito grande.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b) });
  res.end(b);
}

// iniciar({ porta, dirApp, processar })
//  - processar(canal, payload, sessaoDoTerminal) → resultado da rota
function iniciar({ porta, dirApp, processar }) {
  if (servidor) return { ok: true, ja_ativo: true, porta };

  const srv = http.createServer(async (req, res) => {
    try {
      // ---- API ----
      if (req.method === 'POST' && req.url === '/api') {
        limparSessoes();
        let corpo;
        try { corpo = JSON.parse(await lerCorpo(req) || '{}'); }
        catch { return json(res, 400, { ok: false, erro: 'JSON inválido.' }); }
        const { canal, payload } = corpo;
        if (!canal || typeof canal !== 'string') return json(res, 400, { ok: false, erro: 'Canal ausente.' });
        if (SOMENTE_LOCAL.has(canal)) {
          return json(res, 200, { ok: false, erro: 'Esta função está disponível apenas no computador principal.' });
        }

        const token = req.headers['x-token'];
        let sess = token && sessoes.get(token);
        if (sess) sess.ultimo = Date.now();

        // login cria sessão própria do terminal
        if (canal === 'auth:login') {
          const sessNova = { usuario: null };
          const r = await processar(canal, payload, sessNova);
          if (r && r.ok && sessNova.usuario) {
            const t = crypto.randomBytes(24).toString('hex');
            sessoes.set(t, { usuario: sessNova.usuario, ultimo: Date.now() });
            return json(res, 200, { ...r, token: t });
          }
          return json(res, 200, r);
        }
        if (canal === 'auth:logout') {
          if (token) sessoes.delete(token);
          return json(res, 200, { ok: true });
        }

        const sessCli = { usuario: sess ? sess.usuario : null };
        const r = await processar(canal, payload, sessCli);
        // rotas podem alterar o usuário da sessão (ex.: trocar senha não; manter simples)
        if (sess) sess.usuario = sessCli.usuario;
        return json(res, 200, r);
      }

      // ---- Arquivos estáticos (interface) ----
      if (req.method === 'GET') {
        let alvo = decodeURIComponent((req.url || '/').split('?')[0]);
        if (alvo === '/' || alvo === '') alvo = '/index.html';
        const arquivo = path.normalize(path.join(dirApp, alvo));
        if (!arquivo.startsWith(path.normalize(dirApp + path.sep))) {
          res.writeHead(403); return res.end('Proibido');
        }
        fs.readFile(arquivo, (err, dados) => {
          if (err) { res.writeHead(404); return res.end('Não encontrado'); }
          res.writeHead(200, { 'Content-Type': MIME[path.extname(arquivo).toLowerCase()] || 'application/octet-stream' });
          res.end(dados);
        });
        return;
      }

      res.writeHead(405); res.end();
    } catch (e) {
      try { json(res, 500, { ok: false, erro: e.message || 'Erro interno.' }); } catch {}
    }
  });

  return new Promise((resolve) => {
    srv.on('error', (e) => resolve({ ok: false, erro: `Não foi possível iniciar na porta ${porta}: ${e.code === 'EADDRINUSE' ? 'porta em uso' : e.message}` }));
    srv.listen(porta, '0.0.0.0', () => {
      servidor = srv;
      console.log(`[rede] servidor ativo na porta ${porta}`);
      resolve({ ok: true, porta, ips: ipsLocais() });
    });
  });
}

function parar() {
  if (!servidor) return { ok: true };
  try { servidor.close(); } catch {}
  servidor = null;
  sessoes.clear();
  return { ok: true };
}

function status(porta) {
  return { ok: true, ativa: !!servidor, porta, ips: ipsLocais(), terminais: sessoes.size };
}

module.exports = { iniciar, parar, status, ipsLocais, SOMENTE_LOCAL };
