// Clientes — cadastro, categorias, importação e exportação
const { auditar } = require('./util');

// ---- Categorias de Clientes ----

function listarCategorias(db) {
  const rows = db.prepare("SELECT id, nome FROM categorias_clientes WHERE ativo=1 ORDER BY nome").all();
  return { ok: true, categorias: rows };
}

function salvarCategoria(db, p, quem) {
  const nome = String(p.nome || '').trim();
  if (!nome) return { ok: false, erro: 'Informe o nome da categoria.' };
  if (p.id) {
    const exist = db.prepare('SELECT id FROM categorias_clientes WHERE nome=? AND id!=?').get(nome, p.id);
    if (exist) return { ok: false, erro: 'Já existe uma categoria com esse nome.' };
    db.prepare('UPDATE categorias_clientes SET nome=? WHERE id=?').run(nome, p.id);
    auditar(db, quem, 'categoria_cliente_editada', `#${p.id} ${nome}`);
    return { ok: true, id: p.id };
  }
  try {
    const r = db.prepare('INSERT INTO categorias_clientes (nome) VALUES (?)').run(nome);
    auditar(db, quem, 'categoria_cliente_criada', nome);
    return { ok: true, id: Number(r.lastInsertRowid) };
  } catch (e) {
    if (String(e).includes('UNIQUE')) return { ok: false, erro: 'Já existe uma categoria com esse nome.' };
    throw e;
  }
}

function excluirCategoria(db, id, quem) {
  const uso = db.prepare('SELECT COUNT(*) AS n FROM clientes WHERE categoria_id=? AND ativo=1').get(id);
  if (uso.n > 0) return { ok: false, erro: `Categoria em uso por ${uso.n} cliente(s). Remova antes de excluir.` };
  db.prepare('UPDATE categorias_clientes SET ativo=0 WHERE id=?').run(id);
  auditar(db, quem, 'categoria_cliente_excluida', `#${id}`);
  return { ok: true };
}

// ---- Clientes ----

function listar(db, p) {
  const like = `%${String(p.busca || '').trim()}%`;
  const catId = p.categoria_id ? Number(p.categoria_id) : null;
  const linhas = db.prepare(`
    SELECT c.id, c.nome, c.cpf, c.telefone, c.limite_credito,
           COALESCE(c.pontos, 0) AS pontos,
           c.categoria_id,
           cc.nome AS categoria,
           COALESCE((SELECT SUM(cp.valor - COALESCE(cp.valor_pago, 0))
                     FROM crediario_parcelas cp
                     WHERE cp.cliente_id = c.id AND cp.pago_em IS NULL), 0) AS saldo_devedor
    FROM clientes c
    LEFT JOIN categorias_clientes cc ON cc.id = c.categoria_id
    WHERE c.ativo = 1
      AND (c.nome LIKE ? OR c.cpf LIKE ? OR c.telefone LIKE ?)
      AND (? IS NULL OR c.categoria_id = ?)
    ORDER BY c.nome LIMIT 200
  `).all(like, like, like, catId, catId);
  return { ok: true, clientes: linhas };
}

function salvar(db, p, quem) {
  const nome = String(p.nome || '').trim();
  if (!nome) return { ok: false, erro: 'Informe o nome do cliente.' };
  const catId = p.categoria_id ? Number(p.categoria_id) : null;
  if (catId) {
    const cat = db.prepare('SELECT id FROM categorias_clientes WHERE id=? AND ativo=1').get(catId);
    if (!cat) return { ok: false, erro: 'Categoria inválida.' };
  }

  // Validação: CPF único (ignora vazio; não pode haver dois clientes ativos com o mesmo CPF)
  const cpf = p.cpf ? String(p.cpf).replace(/\D/g, '') : null;
  if (cpf && cpf.length > 0) {
    const dup = db.prepare(
      'SELECT id FROM clientes WHERE cpf=? AND ativo=1 AND id != ?'
    ).get(cpf, p.id || 0);
    if (dup) return { ok: false, erro: 'Já existe um cliente cadastrado com este CPF.' };
  }

  if (p.id) {
    db.prepare(`UPDATE clientes SET nome=?, cpf=?, telefone=?, email=?, endereco=?,
                nascimento=?, limite_credito=?, obs=?, categoria_id=? WHERE id=?`)
      .run(nome, cpf || null, p.telefone || null, p.email || null, p.endereco || null,
           p.nascimento || null, Number(p.limite_credito) || 0, p.obs || null, catId, p.id);
    auditar(db, quem, 'cliente_editado', `#${p.id} ${nome}`);
    return { ok: true, id: p.id };
  }
  const r = db.prepare(`INSERT INTO clientes (nome, cpf, telefone, email, endereco, nascimento, limite_credito, obs, categoria_id)
                        VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(nome, cpf || null, p.telefone || null, p.email || null, p.endereco || null,
         p.nascimento || null, Number(p.limite_credito) || 0, p.obs || null, catId);
  auditar(db, quem, 'cliente_criado', nome);
  return { ok: true, id: Number(r.lastInsertRowid) };
}

// ---- Importação ----
// Aceita array de objetos com colunas em PT ou EN, maiúsculas/minúsculas
function importar(db, linhas, quem) {
  if (!Array.isArray(linhas) || linhas.length === 0) return { ok: false, erro: 'Nenhuma linha para importar.' };

  // Cache de categorias por nome normalizado → id
  const catCache = {};
  const getCatId = (nomeCategoria) => {
    if (!nomeCategoria) return null;
    const key = String(nomeCategoria).trim().toLowerCase();
    if (!key) return null;
    if (catCache[key] !== undefined) return catCache[key];
    const ex = db.prepare('SELECT id FROM categorias_clientes WHERE LOWER(nome)=? AND ativo=1').get(key);
    if (ex) { catCache[key] = ex.id; return ex.id; }
    const r = db.prepare('INSERT INTO categorias_clientes (nome) VALUES (?)').run(String(nomeCategoria).trim());
    const newId = Number(r.lastInsertRowid);
    catCache[key] = newId;
    return newId;
  };

  const normalize = (row, ...keys) => {
    for (const k of keys) {
      const pattern = k.toLowerCase().replace(/[^a-z]/g, '');
      const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/[^a-z]/g, '') === pattern);
      if (found !== undefined && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
        return String(row[found]).trim();
      }
    }
    return null;
  };

  let importados = 0, ignorados = 0;
  const erros = [];

  const insStmt = db.prepare(`INSERT INTO clientes (nome, cpf, telefone, email, endereco, nascimento, limite_credito, obs, categoria_id)
                               VALUES (?,?,?,?,?,?,?,?,?)`);
  const updStmt = db.prepare(`UPDATE clientes SET
    telefone=COALESCE(?,telefone), email=COALESCE(?,email),
    endereco=COALESCE(?,endereco), nascimento=COALESCE(?,nascimento),
    obs=COALESCE(?,obs), categoria_id=COALESCE(?,categoria_id) WHERE id=?`);

  db.exec('BEGIN');
  try {
    for (let i = 0; i < linhas.length; i++) {
      const row = linhas[i];
      const nome = normalize(row, 'nome', 'name');
      if (!nome) { erros.push({ linha: i + 2, erro: 'Nome obrigatório' }); ignorados++; continue; }

      const cpf = normalize(row, 'cpf', 'documento', 'document');
      const tel = normalize(row, 'telefone', 'celular', 'phone', 'tel');
      const email = normalize(row, 'email');
      const end = normalize(row, 'endereco', 'endereço', 'address');
      const nasc = normalize(row, 'nascimento', 'datanascimento', 'birthday');
      const limite = Number(normalize(row, 'limitecredito', 'limite', 'creditlimit') || 0) || 0;
      const obs = normalize(row, 'obs', 'observacao', 'notes');
      const catNome = normalize(row, 'categoria', 'category', 'grupo', 'group');
      const catId = getCatId(catNome);

      // Deduplicação por CPF (prioritário) ou nome exato
      let existe = null;
      if (cpf) existe = db.prepare('SELECT id FROM clientes WHERE cpf=? AND ativo=1').get(cpf);
      if (!existe) existe = db.prepare('SELECT id FROM clientes WHERE nome=? AND ativo=1 LIMIT 1').get(nome);

      if (existe) {
        updStmt.run(tel, email, end, nasc, obs, catId, existe.id);
        importados++;
      } else {
        insStmt.run(nome, cpf, tel, email, end, nasc, limite, obs, catId);
        importados++;
      }
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); return { ok: false, erro: e.message }; }

  auditar(db, quem, 'clientes_importados', `${importados} clientes`);
  return { ok: true, importados, ignorados, erros };
}

// ---- Exportação ----
function exportar(db) {
  const rows = db.prepare(`
    SELECT c.nome, c.cpf, c.telefone, c.email, c.endereco, c.nascimento,
           c.limite_credito, c.obs, cc.nome AS categoria,
           COALESCE(c.pontos, 0) AS pontos
    FROM clientes c
    LEFT JOIN categorias_clientes cc ON cc.id = c.categoria_id
    WHERE c.ativo=1
    ORDER BY c.nome
  `).all();
  return { ok: true, clientes: rows };
}

module.exports = { listar, salvar, listarCategorias, salvarCategoria, excluirCategoria, importar, exportar };
