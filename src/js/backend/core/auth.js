// Autenticação e usuários
import { hashSenha, verificarSenha, auditar } from './util.js';
import * as perms from './permissoes.js';

async function login(db, usuario, senha) {
  const u = db.prepare(
    'SELECT id, nome, usuario, senha_hash, perfil, permissoes FROM usuarios WHERE usuario = ? AND ativo = 1'
  ).get(String(usuario || '').trim().toLowerCase());

  if (!u || !(await verificarSenha(String(senha || ''), u.senha_hash))) {
    return { ok: false, erro: 'Usuário ou senha inválidos.' };
  }
  const logado = {
    id: u.id, nome: u.nome, usuario: u.usuario, perfil: u.perfil,
    permissoes: perms.efetivas(u.perfil, u.permissoes)
  };
  auditar(db, logado, 'login', 'Entrou no sistema');
  return { ok: true, usuario: logado };
}

function listarUsuarios(db) {
  const linhas = db.prepare(
    'SELECT id, nome, usuario, perfil, permissoes, ativo, criado_em FROM usuarios ORDER BY nome'
  ).all();
  for (const u of linhas) {
    u.permissoes_efetivas = perms.efetivas(u.perfil, u.permissoes);
    delete u.permissoes; // não expõe o JSON cru, só as efetivas
  }
  return { ok: true, usuarios: linhas };
}

async function salvarUsuario(db, p, quem) {
  if (!perms.pode(quem, 'usuarios.gerenciar')) {
    return { ok: false, erro: 'Sem permissão para gerenciar usuários.' };
  }
  const nome = String(p.nome || '').trim();
  const usuario = String(p.usuario || '').trim().toLowerCase();
  const perfil = ['admin', 'caixa', 'estoque'].includes(p.perfil) ? p.perfil : 'caixa';
  if (!nome || !usuario) return { ok: false, erro: 'Nome e usuário são obrigatórios.' };

  // permissões: admin = todas (null); senão o que veio do formulário (validado) ou o modelo do perfil
  const permJson = perfil === 'admin'
    ? null
    : JSON.stringify(perms.normalizar(perfil, p.permissoes) || perms.DEFAULTS[perfil] || []);

  try {
    if (p.id) {
      db.prepare('UPDATE usuarios SET nome=?, usuario=?, perfil=?, permissoes=?, ativo=? WHERE id=?')
        .run(nome, usuario, perfil, permJson, p.ativo ? 1 : 0, p.id);
      if (p.senha) {
        db.prepare('UPDATE usuarios SET senha_hash=? WHERE id=?').run(await hashSenha(p.senha), p.id);
      }
      auditar(db, quem, 'usuario_editado', `#${p.id} ${usuario}`);
      return { ok: true, id: p.id };
    }
    if (!p.senha || String(p.senha).length < 6) {
      return { ok: false, erro: 'Senha deve ter pelo menos 6 caracteres.' };
    }
    const r = db.prepare('INSERT INTO usuarios (nome, usuario, senha_hash, perfil, permissoes) VALUES (?,?,?,?,?)')
      .run(nome, usuario, await hashSenha(p.senha), perfil, permJson);
    auditar(db, quem, 'usuario_criado', usuario);
    return { ok: true, id: Number(r.lastInsertRowid) };
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return { ok: false, erro: 'Já existe um usuário com esse login.' };
    throw e;
  }
}

async function trocarSenha(db, p, quem) {
  if (!quem) return { ok: false, erro: 'Sessão expirada.' };
  const u = db.prepare('SELECT senha_hash FROM usuarios WHERE id=?').get(quem.id);
  if (!u || !(await verificarSenha(String(p.senhaAtual || ''), u.senha_hash))) {
    return { ok: false, erro: 'Senha atual incorreta.' };
  }
  if (!p.senhaNova || String(p.senhaNova).length < 6) {
    return { ok: false, erro: 'Nova senha deve ter pelo menos 6 caracteres.' };
  }
  db.prepare('UPDATE usuarios SET senha_hash=? WHERE id=?').run(await hashSenha(p.senhaNova), quem.id);
  auditar(db, quem, 'senha_trocada', null);
  return { ok: true };
}

// Valida credenciais de administrador sem alterar a sessão (autorização de desconto)
async function verificarAdmin(db, usuario, senha) {
  const u = db.prepare(
    'SELECT id, senha_hash, perfil FROM usuarios WHERE usuario=? AND ativo=1'
  ).get(String(usuario || '').trim().toLowerCase());
  if (!u) return { ok: false, erro: 'Usuário não encontrado.' };
  if (!(await verificarSenha(String(senha || ''), u.senha_hash)))
    return { ok: false, erro: 'Senha incorreta.' };
  if (u.perfil !== 'admin')
    return { ok: false, erro: 'Somente administradores podem autorizar descontos.' };
  return { ok: true };
}

export { login, listarUsuarios, salvarUsuario, trocarSenha, verificarAdmin };