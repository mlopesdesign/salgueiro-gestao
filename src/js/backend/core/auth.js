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
    'SELECT id, nome, usuario, senha_hash, perfil FROM usuarios WHERE usuario=? AND ativo=1'
  ).get(String(usuario || '').trim().toLowerCase());
  if (!u) return { ok: false, erro: 'Usuário não encontrado.' };
  if (!(await verificarSenha(String(senha || ''), u.senha_hash)))
    return { ok: false, erro: 'Senha incorreta.' };
  if (u.perfil !== 'admin')
    return { ok: false, erro: 'Somente administradores podem autorizar descontos.' };
  return { ok: true, usuario: { id: u.id, nome: u.nome, usuario: u.usuario } };
}

// Autorização do desconto MANUAL no PDV (v3.10.0).
//
// Decisão do Marcio (13/08/2026): desconto digitado na mão só sai com senha de
// administrador. Desconto de categoria do cliente e desconto automático à vista
// continuam livres — vêm da tabela, ninguém digita.
//
// Dois caminhos, conforme quem está no caixa:
//   • já é admin  → digita só a PRÓPRIA senha (confirma que é ele no teclado)
//   • não é admin → digita o login e a senha de um administrador
//
// O nome de quem autorizou sai daqui, do banco — nunca de um campo que o
// operador preenche. Assim o relatório não pode ser assinado com nome de
// terceiro.
async function autorizarDescontoAdmin(db, sessaoUsuario, p) {
  const login = String((p && p.usuario) || '').trim().toLowerCase();
  const senha = String((p && p.senha) || '');
  if (!senha) return { ok: false, erro: 'Digite a senha do administrador.' };

  // Sem login informado, só vale para quem já está logado como admin.
  if (!login) {
    if (!sessaoUsuario || !sessaoUsuario.id) return { ok: false, erro: 'Sessão expirada. Entre novamente.' };
    if (sessaoUsuario.perfil !== 'admin') {
      return { ok: false, erro: 'Informe o usuário e a senha de um administrador.' };
    }
    const u = db.prepare('SELECT id, nome, usuario, senha_hash, perfil FROM usuarios WHERE id=? AND ativo=1')
      .get(sessaoUsuario.id);
    if (!u) return { ok: false, erro: 'Usuário não encontrado ou desativado.' };
    if (u.perfil !== 'admin') return { ok: false, erro: 'Somente administradores podem autorizar descontos.' };
    if (!(await verificarSenha(senha, u.senha_hash))) return { ok: false, erro: 'Senha incorreta.' };
    return { ok: true, autorizado_por: u.nome, usuario_id: u.id };
  }

  const r = await verificarAdmin(db, login, senha);
  if (!r.ok) return r;
  return { ok: true, autorizado_por: r.usuario.nome, usuario_id: r.usuario.id };
}

// Quanto de desconto a venda tem direito SEM autorização: o percentual da
// categoria do cliente mais o desconto automático à vista. Serve para o
// servidor decidir se o desconto que chegou precisa de token de admin.
// Recalculado aqui a partir do banco e da configuração — nunca aceito do
// payload, senão bastaria mentir a origem para furar a trava.
function descontoLivre(db, { cliente_id, subtotal, pagamentos, config }) {
  const sub = Number(subtotal) || 0;
  if (sub <= 0) return 0;
  const cfg = config || {};
  const arred2 = (n) => Math.round(n * 100) / 100;

  let categoria = 0;
  if (cliente_id) {
    const c = db.prepare(`
      SELECT COALESCE(cc.desconto_percent, 0) pct
        FROM clientes cl
        LEFT JOIN categorias_clientes cc ON cc.id = cl.categoria_id
       WHERE cl.id = ?`).get(cliente_id);
    if (c && c.pct > 0) categoria = arred2(sub * Number(c.pct) / 100);
  }
  // Categoria e à vista não se somam: quando o cliente tem categoria, o
  // desconto à vista não é oferecido (mesma regra do PDV, pdv.js:591).
  if (categoria > 0) return categoria;

  if (cfg.desconto_avista_ativo !== '1') return 0;
  const minimo = Number(cfg.desconto_avista_minimo || 100);
  if (sub < minimo) return 0;
  const formas = Array.isArray(pagamentos) ? pagamentos.map(pg => pg && pg.forma) : [];
  if (!formas.length) return 0;
  if (!formas.every(f => f === 'dinheiro' || f === 'pix')) return 0;
  const pct = Math.max(0, Math.min(1, Number(cfg.desconto_avista_percent || 5) / 100));
  return arred2(sub * pct);
}

// Confere a senha do usuário que está operando o PDV agora.
// Usado no desconto avulso (v3.3.0): o vendedor não precisa mais chamar o
// administrador — ele assume o desconto com a própria senha e registra quem
// autorizou e por quê. O controle deixou de ser trava e virou rastro.
// `sessaoUsuario` vem do servidor, nunca do payload: assim ninguém digita o
// login de outra pessoa para assinar no lugar dela.
async function verificarOperador(db, sessaoUsuario, senha) {
  if (!sessaoUsuario || !sessaoUsuario.id) return { ok: false, erro: 'Sessão expirada. Entre novamente.' };
  const u = db.prepare(
    'SELECT id, nome, usuario, senha_hash FROM usuarios WHERE id=? AND ativo=1'
  ).get(sessaoUsuario.id);
  if (!u) return { ok: false, erro: 'Usuário não encontrado ou desativado.' };
  if (!(await verificarSenha(String(senha || ''), u.senha_hash)))
    return { ok: false, erro: 'Senha incorreta.' };
  return { ok: true, usuario: { id: u.id, nome: u.nome, usuario: u.usuario } };
}

export { login, listarUsuarios, salvarUsuario, trocarSenha, verificarAdmin, verificarOperador,
         autorizarDescontoAdmin, descontoLivre };