// Lojas (unidades) — cadastro e receita por loja.
// Todas as lojas compartilham o mesmo banco; a separação é financeira:
// cada caixa pertence a uma loja e cada venda herda a loja do caixa.
const { auditar } = require('./util');
const arred = (n) => Math.round(n * 100) / 100;

function listar(db, p) {
  const incluirInativas = p && p.todas;
  const linhas = db.prepare(`
    SELECT id, nome, ativo,
           (SELECT COUNT(*) FROM caixas cx WHERE cx.loja_id = l.id) AS qtd_caixas
    FROM lojas l ${incluirInativas ? '' : 'WHERE ativo = 1'}
    ORDER BY ativo DESC, nome
  `).all();
  return { ok: true, lojas: linhas };
}

function lojaPadrao(db) {
  return db.prepare('SELECT id, nome FROM lojas WHERE ativo=1 ORDER BY id LIMIT 1').get() || null;
}

function salvar(db, p, quem) {
  const nome = String(p && p.nome || '').trim();
  if (!nome) return { ok: false, erro: 'Informe o nome da loja.' };
  try {
    if (p.id) {
      db.prepare('UPDATE lojas SET nome=? WHERE id=?').run(nome, p.id);
      auditar(db, quem, 'loja_editada', `#${p.id} ${nome}`);
      return { ok: true, id: Number(p.id) };
    }
    const r = db.prepare('INSERT INTO lojas (nome) VALUES (?)').run(nome);
    auditar(db, quem, 'loja_criada', nome);
    return { ok: true, id: Number(r.lastInsertRowid) };
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return { ok: false, erro: 'Já existe uma loja com esse nome.' };
    throw e;
  }
}

function excluir(db, id, quem) {
  const lojaId = Number(id) || 0;
  if (!lojaId) return { ok: false, erro: 'Loja não informada.' };
  const ativas = db.prepare('SELECT COUNT(*) AS n FROM lojas WHERE ativo=1').get();
  if (ativas.n <= 1) return { ok: false, erro: 'É preciso manter pelo menos uma loja ativa.' };
  const emUso = db.prepare('SELECT COUNT(*) AS n FROM caixas WHERE loja_id=?').get(lojaId);
  if (emUso.n > 0) return { ok: false, erro: `Esta loja já tem ${emUso.n} caixa(s) no histórico. Ela será desativada em vez de excluída.` };
  db.prepare('UPDATE lojas SET ativo=0 WHERE id=?').run(lojaId);
  auditar(db, quem, 'loja_excluida', `#${lojaId}`);
  return { ok: true };
}

// Desativa (mantém histórico) uma loja que já tem movimento
function desativar(db, id, quem) {
  const lojaId = Number(id) || 0;
  const ativas = db.prepare('SELECT COUNT(*) AS n FROM lojas WHERE ativo=1').get();
  if (ativas.n <= 1) return { ok: false, erro: 'É preciso manter pelo menos uma loja ativa.' };
  db.prepare('UPDATE lojas SET ativo=0 WHERE id=?').run(lojaId);
  auditar(db, quem, 'loja_desativada', `#${lojaId}`);
  return { ok: true };
}

module.exports = { listar, lojaPadrao, salvar, excluir, desativar, arred };
