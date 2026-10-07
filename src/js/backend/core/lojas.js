// Lojas (unidades) — cadastro e receita por loja.
// Todas as lojas compartilham o mesmo banco; a separação é financeira:
// cada caixa pertence a uma loja e cada venda herda a loja do caixa.
import { auditar } from './util.js';
import * as estoques from './estoques.js';
const arred = (n) => Math.round(n * 100) / 100;

function listar(db, p) {
  const incluirInativas = p && p.todas;
  const linhas = db.prepare(`
    SELECT l.id, l.nome, l.ativo, l.estoque_id, COALESCE(l.sem_desconto,0) AS sem_desconto,
           e.nome  AS estoque_nome,
           e.tipo  AS estoque_tipo,
           e.principal AS estoque_principal,
           (SELECT COUNT(*) FROM caixas cx WHERE cx.loja_id = l.id) AS qtd_caixas
    FROM lojas l
    LEFT JOIN estoques e ON e.id = l.estoque_id
    ${incluirInativas ? '' : 'WHERE l.ativo = 1'}
    ORDER BY l.ativo DESC, l.nome
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
      // edição: atualiza nome e, se o campo vier, o estoque vinculado
      db.prepare('UPDATE lojas SET nome=? WHERE id=?').run(nome, p.id);
      if (p.sem_desconto !== undefined) {
        db.prepare('UPDATE lojas SET sem_desconto=? WHERE id=?').run(p.sem_desconto ? 1 : 0, p.id);
      }
      if (p.estoque_id !== undefined && p.estoque_id !== null && p.estoque_id !== '') {
        const eid = Number(p.estoque_id) || null;
        db.prepare('UPDATE lojas SET estoque_id=? WHERE id=?').run(eid, p.id);
      }
      auditar(db, quem, 'loja_editada', `#${p.id} ${nome}`);
      return { ok: true, id: Number(p.id) };
    }
    // criação
    const r = db.prepare('INSERT INTO lojas (nome) VALUES (?)').run(nome);
    const idLoja = Number(r.lastInsertRowid);
    if (p.sem_desconto) db.prepare('UPDATE lojas SET sem_desconto=1 WHERE id=?').run(idLoja);

    // estoque_id pode ser:
    //   'proprio' (ou omitido) → criar estoque próprio vazio para esta loja
    //   número                 → usar estoque existente (central ou de outra loja)
    let estoqueId = null;
    const opcao = String(p && p.estoque_id !== undefined ? p.estoque_id : 'proprio');
    if (opcao === 'proprio') {
      // cria o estoque vazio e aponta a loja para ele
      try { estoqueId = estoques.garantirDaLoja(db, idLoja, nome); }
      catch (e) { console.error('[loja] estoque próprio não criado:', e.message); }
    } else {
      // usar estoque já existente (número)
      estoqueId = Number(opcao) || null;
    }

    if (estoqueId) db.prepare('UPDATE lojas SET estoque_id=? WHERE id=?').run(estoqueId, idLoja);
    auditar(db, quem, 'loja_criada', `${nome} (estoque ${estoqueId || 'central'})`);
    return { ok: true, id: idLoja };
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

export { listar, lojaPadrao, salvar, excluir, desativar, arred };