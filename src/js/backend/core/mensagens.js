// Mensagens internas (chat) e avisos do administrador — v3.0.
// Tudo vive no banco central: o app principal e os terminais em rede leem e
// escrevem nas mesmas tabelas, então não há servidor de chat separado.
// O tempo real é feito por polling curto (mensagens:resumo a cada ~15 s).
import { auditar } from './util.js';
import * as perms from './permissoes.js';

const ONLINE_TTL_S = 90;          // sem ping há mais de 90 s = offline
const JANELA_POPUP_H = 24;        // aviso só "salta na tela" nas primeiras 24 h
const MAX_TEXTO = 2000;
const MAX_TITULO = 120;

// ── helpers ──────────────────────────────────────────────────────────────────
function limpar(s, max) {
  return String(s ?? '').replace(/\s+$/g, '').slice(0, max);
}

function podeUsar(u) {
  return perms.pode(u, 'mensagens.usar');
}

function garantirGeral(db) {
  const r = db.prepare("SELECT id FROM conversas WHERE chave='geral'").get();
  if (r) return r.id;
  const ins = db.prepare("INSERT INTO conversas (tipo, chave) VALUES ('geral','geral')").run();
  return Number(ins.lastInsertRowid);
}

function chaveDireta(a, b) {
  const x = Math.min(Number(a), Number(b));
  const y = Math.max(Number(a), Number(b));
  return `d:${x}:${y}`;
}

function garantirDireta(db, a, b) {
  const chave = chaveDireta(a, b);
  const r = db.prepare('SELECT id FROM conversas WHERE chave=?').get(chave);
  if (r) return r.id;
  const ins = db.prepare("INSERT INTO conversas (tipo, chave) VALUES ('direta',?)").run(chave);
  return Number(ins.lastInsertRowid);
}

// Cria a linha de membro na primeira vez. No canal Geral o marco inicial é a
// última mensagem existente — quem entra hoje não recebe 300 não-lidas de ontem.
function garantirMembro(db, conversaId, usuarioId) {
  const m = db.prepare('SELECT lido_ate FROM conversa_membros WHERE conversa_id=? AND usuario_id=?')
    .get(conversaId, usuarioId);
  if (m) return m.lido_ate;
  const ultimo = db.prepare('SELECT COALESCE(MAX(id),0) AS n FROM mensagens WHERE conversa_id=?')
    .get(conversaId).n;
  const conv = db.prepare('SELECT tipo FROM conversas WHERE id=?').get(conversaId);
  const marco = conv && conv.tipo === 'geral' ? ultimo : 0;
  db.prepare('INSERT OR IGNORE INTO conversa_membros (conversa_id, usuario_id, lido_ate) VALUES (?,?,?)')
    .run(conversaId, usuarioId, marco);
  return marco;
}

// Resolve o alvo vindo do frontend: 'geral' ou o id de outro usuário.
function conversaDoAlvo(db, quem, alvo) {
  if (alvo === 'geral' || alvo === 0 || alvo == null) {
    return { id: garantirGeral(db), tipo: 'geral', outro: null };
  }
  const outro = Number(alvo);
  if (!Number.isInteger(outro) || outro <= 0) return null;
  if (outro === quem.id) return null;
  const existe = db.prepare('SELECT id FROM usuarios WHERE id=? AND ativo=1').get(outro);
  if (!existe) return null;
  return { id: garantirDireta(db, quem.id, outro), tipo: 'direta', outro };
}

// Presença é dado volátil e de alta frequência (ping a cada 4–12 s).
// USA runVolatil: grava só na memória, sem reescrever o banco em disco.
// Persistir aqui foi a causa da perda de dados na v3.0.0 — cada ping
// disparava uma regravação completa do arquivo, multiplicando por ~1.000
// as chances de o processo ser morto no meio de uma gravação.
// Se o app fechar, a linha se perde e o próximo ping a recria. Sem prejuízo.
function registrarPing(db, quem, origem, tela) {
  const st = db.prepare(`INSERT INTO presenca (usuario_id, origem, tela, ultimo_ping)
              VALUES (?,?,?, datetime('now','localtime'))
              ON CONFLICT(usuario_id) DO UPDATE SET
                origem=excluded.origem, tela=excluded.tela, ultimo_ping=excluded.ultimo_ping`);
  const args = [quem.id, origem === 'rede' ? 'rede' : 'local', tela ? String(tela).slice(0, 40) : null];
  if (typeof st.runVolatil === 'function') st.runVolatil(...args);
  else st.run(...args); // harness de teste com node:sqlite
}

function idsOnline(db) {
  return db.prepare(`SELECT usuario_id, origem, tela FROM presenca
                     WHERE (julianday('now','localtime') - julianday(ultimo_ping)) * 86400 <= ?`)
    .all(ONLINE_TTL_S);
}

// Avisos que ainda devem interromper a tela deste usuário
function avisosPendentes(db, usuarioId) {
  const linhas = db.prepare(`
    SELECT a.id, a.titulo, a.texto, a.prioridade, a.alvo, a.alvo_ids, a.criado_em,
           u.nome AS autor
    FROM avisos a
    LEFT JOIN usuarios u ON u.id = a.autor_id
    WHERE a.ativo = 1
      AND (julianday('now','localtime') - julianday(a.criado_em)) * 24 <= ?
      AND NOT EXISTS (SELECT 1 FROM aviso_confirmacoes c
                      WHERE c.aviso_id = a.id AND c.usuario_id = ?)
    ORDER BY a.id
  `).all(JANELA_POPUP_H, usuarioId);
  return linhas.filter(a => {
    if (a.alvo === 'todos') return true;
    try {
      const ids = JSON.parse(a.alvo_ids || '[]');
      return Array.isArray(ids) && ids.includes(usuarioId);
    } catch { return false; }
  }).map(a => { delete a.alvo_ids; return a; });
}

// ── rotas ────────────────────────────────────────────────────────────────────

// Chamada a cada ~15 s por quem está logado: mantém a presença viva e devolve
// tudo que a interface precisa para acender o badge e abrir o popup de aviso.
function resumo(db, quem, p) {
  if (!quem) return { ok: false, erro: 'Sessão expirada.' };
  if (!podeUsar(quem)) return { ok: true, ativo: false, naoLidas: 0, conversas: [], avisos: [], online: [] };
  registrarPing(db, quem, (p || {}).origem, (p || {}).tela);

  const geralId = garantirGeral(db);
  garantirMembro(db, geralId, quem.id);

  const conversas = db.prepare(`
    SELECT c.id, c.tipo, c.chave, m.lido_ate,
           (SELECT COUNT(*) FROM mensagens x
             WHERE x.conversa_id = c.id AND x.id > m.lido_ate AND x.autor_id <> ?) AS nao_lidas,
           (SELECT x.texto FROM mensagens x WHERE x.conversa_id = c.id ORDER BY x.id DESC LIMIT 1) AS ultima,
           (SELECT x.criado_em FROM mensagens x WHERE x.conversa_id = c.id ORDER BY x.id DESC LIMIT 1) AS ultima_em
    FROM conversa_membros m
    JOIN conversas c ON c.id = m.conversa_id
    WHERE m.usuario_id = ?
  `).all(quem.id, quem.id);

  let total = 0;
  for (const c of conversas) {
    total += c.nao_lidas;
    c.outro_id = null;
    c.nome = 'Canal geral';
    if (c.tipo === 'direta') {
      const partes = c.chave.split(':');
      c.outro_id = Number(partes[1]) === quem.id ? Number(partes[2]) : Number(partes[1]);
      const u = db.prepare('SELECT nome FROM usuarios WHERE id=?').get(c.outro_id);
      c.nome = u ? u.nome : 'Conversa';
    }
  }

  return {
    ok: true,
    ativo: true,
    naoLidas: total,
    conversas,
    avisos: avisosPendentes(db, quem.id),
    online: idsOnline(db).map(o => o.usuario_id),
    podeAvisar: perms.pode(quem, 'mensagens.avisar')
  };
}

// Lista de contatos para a tela de chat: todo usuário ativo, menos eu.
function contatos(db, quem) {
  if (!quem) return { ok: false, erro: 'Sessão expirada.' };
  if (!podeUsar(quem)) return { ok: false, erro: 'Você não tem acesso às mensagens.' };
  const online = new Map(idsOnline(db).map(o => [o.usuario_id, o]));
  const usuarios = db.prepare(
    'SELECT id, nome, usuario, perfil FROM usuarios WHERE ativo=1 AND id<>? ORDER BY nome'
  ).all(quem.id);

  for (const u of usuarios) {
    const pres = online.get(u.id);
    u.online = !!pres;
    u.origem = pres ? pres.origem : null;
    u.tela = pres ? pres.tela : null;
    const conv = db.prepare('SELECT id FROM conversas WHERE chave=?').get(chaveDireta(quem.id, u.id));
    u.conversa_id = conv ? conv.id : null;
    u.nao_lidas = 0;
    u.ultima = null;
    u.ultima_em = null;
    if (conv) {
      const m = db.prepare('SELECT lido_ate FROM conversa_membros WHERE conversa_id=? AND usuario_id=?')
        .get(conv.id, quem.id);
      const lidoAte = m ? m.lido_ate : 0;
      u.nao_lidas = db.prepare(
        'SELECT COUNT(*) AS n FROM mensagens WHERE conversa_id=? AND id>? AND autor_id<>?'
      ).get(conv.id, lidoAte, quem.id).n;
      const ult = db.prepare(
        'SELECT texto, criado_em FROM mensagens WHERE conversa_id=? ORDER BY id DESC LIMIT 1'
      ).get(conv.id);
      if (ult) { u.ultima = ult.texto; u.ultima_em = ult.criado_em; }
    }
  }

  const geralId = garantirGeral(db);
  const lidoGeral = garantirMembro(db, geralId, quem.id);
  const geral = {
    conversa_id: geralId,
    nao_lidas: db.prepare('SELECT COUNT(*) AS n FROM mensagens WHERE conversa_id=? AND id>? AND autor_id<>?')
      .get(geralId, lidoGeral, quem.id).n
  };
  const ultG = db.prepare('SELECT texto, criado_em FROM mensagens WHERE conversa_id=? ORDER BY id DESC LIMIT 1').get(geralId);
  geral.ultima = ultG ? ultG.texto : null;
  geral.ultima_em = ultG ? ultG.criado_em : null;

  return { ok: true, usuarios, geral, eu: { id: quem.id, nome: quem.nome } };
}

function historico(db, quem, p) {
  if (!quem) return { ok: false, erro: 'Sessão expirada.' };
  if (!podeUsar(quem)) return { ok: false, erro: 'Você não tem acesso às mensagens.' };
  const alvo = conversaDoAlvo(db, quem, (p || {}).alvo);
  if (!alvo) return { ok: false, erro: 'Conversa inválida.' };
  garantirMembro(db, alvo.id, quem.id);

  const limite = Math.min(Math.max(Number((p || {}).limite) || 120, 1), 400);
  const apos = Number((p || {}).apos) || 0;
  const linhas = apos
    ? db.prepare(`SELECT m.id, m.texto, m.criado_em, m.autor_id, u.nome AS autor
                  FROM mensagens m LEFT JOIN usuarios u ON u.id=m.autor_id
                  WHERE m.conversa_id=? AND m.id>? ORDER BY m.id`).all(alvo.id, apos)
    : db.prepare(`SELECT * FROM (
                    SELECT m.id, m.texto, m.criado_em, m.autor_id, u.nome AS autor
                    FROM mensagens m LEFT JOIN usuarios u ON u.id=m.autor_id
                    WHERE m.conversa_id=? ORDER BY m.id DESC LIMIT ?
                  ) ORDER BY id`).all(alvo.id, limite);

  return { ok: true, conversa_id: alvo.id, tipo: alvo.tipo, mensagens: linhas, eu: quem.id };
}

function enviar(db, quem, p) {
  if (!quem) return { ok: false, erro: 'Sessão expirada.' };
  if (!podeUsar(quem)) return { ok: false, erro: 'Você não tem acesso às mensagens.' };
  const texto = limpar((p || {}).texto, MAX_TEXTO).trim();
  if (!texto) return { ok: false, erro: 'Escreva a mensagem antes de enviar.' };
  const alvo = conversaDoAlvo(db, quem, (p || {}).alvo);
  if (!alvo) return { ok: false, erro: 'Escolha para quem quer enviar.' };

  garantirMembro(db, alvo.id, quem.id);
  if (alvo.outro) garantirMembro(db, alvo.id, alvo.outro);

  const r = db.prepare('INSERT INTO mensagens (conversa_id, autor_id, texto) VALUES (?,?,?)')
    .run(alvo.id, quem.id, texto);
  const id = Number(r.lastInsertRowid);
  // quem escreveu já leu a própria mensagem
  db.prepare('UPDATE conversa_membros SET lido_ate=? WHERE conversa_id=? AND usuario_id=?')
    .run(id, alvo.id, quem.id);

  const nova = db.prepare(`SELECT m.id, m.texto, m.criado_em, m.autor_id, u.nome AS autor
                           FROM mensagens m LEFT JOIN usuarios u ON u.id=m.autor_id WHERE m.id=?`).get(id);
  return { ok: true, mensagem: nova, conversa_id: alvo.id };
}

function marcarLido(db, quem, p) {
  if (!quem) return { ok: false, erro: 'Sessão expirada.' };
  const alvo = conversaDoAlvo(db, quem, (p || {}).alvo);
  if (!alvo) return { ok: false, erro: 'Conversa inválida.' };
  garantirMembro(db, alvo.id, quem.id);
  const ate = Number((p || {}).ate) ||
    db.prepare('SELECT COALESCE(MAX(id),0) AS n FROM mensagens WHERE conversa_id=?').get(alvo.id).n;
  db.prepare('UPDATE conversa_membros SET lido_ate=? WHERE conversa_id=? AND usuario_id=? AND lido_ate < ?')
    .run(ate, alvo.id, quem.id, ate);
  return { ok: true, lido_ate: ate };
}

// ── Avisos ───────────────────────────────────────────────────────────────────

function enviarAviso(db, quem, p) {
  if (!perms.pode(quem, 'mensagens.avisar')) {
    return { ok: false, erro: 'Você não tem permissão para enviar avisos.' };
  }
  const titulo = limpar((p || {}).titulo, MAX_TITULO).trim();
  const texto = limpar((p || {}).texto, MAX_TEXTO).trim();
  if (!titulo) return { ok: false, erro: 'Dê um título ao aviso.' };
  if (!texto) return { ok: false, erro: 'Escreva o conteúdo do aviso.' };
  const prioridade = (p || {}).prioridade === 'urgente' ? 'urgente' : 'normal';

  let alvo = 'todos';
  let alvoIds = null;
  if (Array.isArray((p || {}).usuarios) && p.usuarios.length) {
    const ids = p.usuarios.map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (ids.length) { alvo = 'usuarios'; alvoIds = JSON.stringify(ids); }
  }

  const r = db.prepare(
    'INSERT INTO avisos (autor_id, titulo, texto, prioridade, alvo, alvo_ids) VALUES (?,?,?,?,?,?)'
  ).run(quem.id, titulo, texto, prioridade, alvo, alvoIds);
  const id = Number(r.lastInsertRowid);
  // quem escreveu não precisa receber o próprio recado na cara
  db.prepare('INSERT OR IGNORE INTO aviso_confirmacoes (aviso_id, usuario_id) VALUES (?,?)').run(id, quem.id);
  auditar(db, quem, 'aviso_enviado', `${prioridade} · ${titulo}`);
  return { ok: true, id };
}

function confirmarAviso(db, quem, p) {
  if (!quem) return { ok: false, erro: 'Sessão expirada.' };
  const id = Number((p || {}).id);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, erro: 'Aviso inválido.' };
  db.prepare('INSERT OR IGNORE INTO aviso_confirmacoes (aviso_id, usuario_id) VALUES (?,?)')
    .run(id, quem.id);
  return { ok: true };
}

// Histórico de avisos. Quem pode avisar vê todos e o quadro de leitura;
// os demais veem só os avisos endereçados a eles.
function listarAvisos(db, quem, p) {
  if (!quem) return { ok: false, erro: 'Sessão expirada.' };
  const limite = Math.min(Math.max(Number((p || {}).limite) || 50, 1), 200);
  const gestor = perms.pode(quem, 'mensagens.avisar');

  const linhas = db.prepare(`
    SELECT a.id, a.titulo, a.texto, a.prioridade, a.alvo, a.alvo_ids, a.ativo, a.criado_em,
           u.nome AS autor
    FROM avisos a LEFT JOIN usuarios u ON u.id = a.autor_id
    ORDER BY a.id DESC LIMIT ?
  `).all(limite);

  const ativos = db.prepare('SELECT id, nome FROM usuarios WHERE ativo=1 ORDER BY nome').all();

  const saida = [];
  for (const a of linhas) {
    let destinos = ativos;
    if (a.alvo === 'usuarios') {
      let ids = [];
      try { ids = JSON.parse(a.alvo_ids || '[]'); } catch { ids = []; }
      destinos = ativos.filter(u => ids.includes(u.id));
    }
    const meu = destinos.some(u => u.id === quem.id);
    if (!gestor && !meu) continue;

    const confirmados = db.prepare(
      'SELECT usuario_id, confirmado_em FROM aviso_confirmacoes WHERE aviso_id=?'
    ).all(a.id);
    const mapa = new Map(confirmados.map(c => [c.usuario_id, c.confirmado_em]));

    delete a.alvo_ids;
    a.destinatarios = destinos.map(u => ({
      id: u.id, nome: u.nome, confirmado_em: mapa.get(u.id) || null
    }));
    a.lidos = a.destinatarios.filter(d => d.confirmado_em).length;
    a.total = a.destinatarios.length;
    a.confirmado_por_mim = mapa.has(quem.id);
    if (!gestor) delete a.destinatarios;
    saida.push(a);
  }
  return { ok: true, avisos: saida, gestor };
}

function encerrarAviso(db, quem, p) {
  if (!perms.pode(quem, 'mensagens.avisar')) {
    return { ok: false, erro: 'Você não tem permissão para encerrar avisos.' };
  }
  const id = Number((p || {}).id);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, erro: 'Aviso inválido.' };
  db.prepare('UPDATE avisos SET ativo=0 WHERE id=?').run(id);
  auditar(db, quem, 'aviso_encerrado', `#${id}`);
  return { ok: true };
}

// Quem está online agora (usado na tela de Mensagens e em Configurações → Rede)
function terminais(db, quem) {
  if (!quem) return { ok: false, erro: 'Sessão expirada.' };
  const online = idsOnline(db);
  const nomes = new Map(db.prepare('SELECT id, nome, perfil FROM usuarios').all().map(u => [u.id, u]));
  return {
    ok: true,
    terminais: online.map(o => ({
      usuario_id: o.usuario_id,
      nome: (nomes.get(o.usuario_id) || {}).nome || '—',
      perfil: (nomes.get(o.usuario_id) || {}).perfil || '—',
      origem: o.origem,
      tela: o.tela
    }))
  };
}

export {
  resumo, contatos, historico, enviar, marcarLido,
  enviarAviso, confirmarAviso, listarAvisos, encerrarAviso, terminais,
  ONLINE_TTL_S, JANELA_POPUP_H
};
