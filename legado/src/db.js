// Camada de banco de dados — Salgueiro Gestão
// Ordem de preferência (nenhuma exige compilação na máquina do cliente):
//   1. node:sqlite  — embutido no Node/Electron (arquivo .db real, rápido)
//   2. better-sqlite3 — só se já estiver instalado (dev)
//   3. sql.js (asm.js) — 100% JavaScript, funciona em qualquer lugar
//
// A API exposta é a de better-sqlite3: db.prepare(sql).all()/.get()/.run(),
// db.exec(sql), db.close(). criarBanco() é ASSÍNCRONO (await obrigatório).
const fs = require('fs');
const path = require('path');

const { hashSenha } = require('./core/util');

// ── Wrapper sql.js → API better-sqlite3 ─────────────────────────────────────
class SqlJsStatement {
  constructor(wrapper, sql) {
    this._w = wrapper;
    this._sql = sql;
  }
  _flat(params) {
    return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  }
  all(...params) {
    const flat = this._flat(params);
    const stmt = this._w._db.prepare(this._sql);
    try {
      if (flat.length) stmt.bind(flat);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally { stmt.free(); }
  }
  get(...params) {
    const flat = this._flat(params);
    const stmt = this._w._db.prepare(this._sql);
    try {
      if (flat.length) stmt.bind(flat);
      return stmt.step() ? stmt.getAsObject() : undefined;
    } finally { stmt.free(); }
  }
  run(...params) {
    const flat = this._flat(params);
    this._w._db.run(this._sql, flat.length ? flat : undefined);
    const changes = this._w._db.getRowsModified();
    let lastInsertRowid = 0;
    const stmt = this._w._db.prepare('SELECT last_insert_rowid() AS id');
    try { if (stmt.step()) lastInsertRowid = stmt.getAsObject().id; } finally { stmt.free(); }
    this._w._agendarSalvar();
    return { changes, lastInsertRowid };
  }
}

class SqlJsWrapper {
  constructor(dbInst, arquivo) {
    this._db = dbInst;
    this._arquivo = arquivo;
    this._salvarTimer = null;
  }
  prepare(sql) { return new SqlJsStatement(this, sql); }
  exec(sql) {
    this._db.exec(sql);
    this._agendarSalvar();
  }
  // Persistência: sql.js opera em memória; gravamos em disco após alterações
  // (debounce de 300ms) e sempre em salvarAgora()/close().
  _agendarSalvar() {
    if (this._salvarTimer) clearTimeout(this._salvarTimer);
    this._salvarTimer = setTimeout(() => this._salvarEmDisco(), 300);
    if (this._salvarTimer.unref) this._salvarTimer.unref();
  }
  _salvarEmDisco() {
    try {
      const data = this._db.export();
      const tmp = this._arquivo + '.tmp';
      fs.writeFileSync(tmp, Buffer.from(data));
      fs.renameSync(tmp, this._arquivo); // gravação atômica: nunca corrompe o .db
    } catch (e) {
      console.error('[db] erro ao salvar em disco:', e.message);
    }
  }
  salvarAgora() {
    if (this._salvarTimer) { clearTimeout(this._salvarTimer); this._salvarTimer = null; }
    this._salvarEmDisco();
  }
  close() {
    this.salvarAgora();
    this._db.close();
  }
}

// Módulo sql.js inicializado uma única vez (init é assíncrono por natureza)
let _SQL = null;
async function _initSqlJs() {
  if (_SQL) return _SQL;
  // Build asm.js: 100% JS, sem arquivo .wasm externo — empacota no asar sem dor
  const initSqlJs = require('sql.js/dist/sql-asm.js');
  _SQL = await initSqlJs();
  return _SQL;
}

async function abrirSqlJs(arquivo) {
  const SQL = await _initSqlJs();
  const dbInst = fs.existsSync(arquivo)
    ? new SQL.Database(fs.readFileSync(arquivo))
    : new SQL.Database();
  return new SqlJsWrapper(dbInst, arquivo);
}

// ── Abertura com fallback ────────────────────────────────────────────────────
// SALGUEIRO_DB=sqljs força o fallback puro-JS (usado nos testes).
async function abrir(arquivo) {
  if (process.env.SALGUEIRO_DB !== 'sqljs') {
    try {
      const { DatabaseSync } = require('node:sqlite');
      return new DatabaseSync(arquivo);
    } catch (_) {}
    try {
      const Better = require('better-sqlite3');
      return new Better(arquivo);
    } catch (_) {}
  }
  return abrirSqlJs(arquivo);
}

// Valida se um arquivo é um banco do Salgueiro (usado na restauração de backup)
async function validarBackup(arquivo) {
  let teste;
  try {
    teste = await abrir(arquivo);
    teste.prepare('SELECT COUNT(*) AS n FROM usuarios').get();
    return true;
  } catch (_) {
    return false;
  } finally {
    try { if (teste) teste.close(); } catch (_) {}
  }
}

async function criarBanco(arquivo) {
  const db = await abrir(arquivo);
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Executa statement a statement (schema não contém triggers/procedures)
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try { db.exec(stmt + ';'); } catch (e) {
      if (!/already exists/i.test(e.message)) console.error('[schema]', e.message);
    }
  }
  migrar(db);
  semear(db);
  if (db.salvarAgora) db.salvarAgora();
  return db;
}

// ── Migrações leves e idempotentes ──────────────────────────────────────────
function migrar(db) {
  function temColuna(tabela, coluna) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${tabela})`).all();
      return cols.some(c => c.name === coluna);
    } catch { return false; }
  }
  function tabelaExiste(tabela) {
    try {
      const r = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name=?").get(tabela);
      return r && r.n > 0;
    } catch { return false; }
  }

  if (!temColuna('usuarios', 'permissoes')) {
    try { db.exec('ALTER TABLE usuarios ADD COLUMN permissoes TEXT'); } catch {}
  }
  if (!temColuna('produtos', 'consignado')) {
    try { db.exec('ALTER TABLE produtos ADD COLUMN consignado INTEGER NOT NULL DEFAULT 0'); } catch {}
  }
  if (!temColuna('produtos', 'pct_fornecedor')) {
    try { db.exec('ALTER TABLE produtos ADD COLUMN pct_fornecedor REAL NOT NULL DEFAULT 0'); } catch {}
  }
  if (tabelaExiste('consignacoes') && !temColuna('consignacoes', 'valor_custo')) {
    try { db.exec('ALTER TABLE consignacoes ADD COLUMN valor_custo REAL NOT NULL DEFAULT 0'); } catch {}
  }
  if (!temColuna('clientes', 'pontos')) {
    try { db.exec('ALTER TABLE clientes ADD COLUMN pontos INTEGER NOT NULL DEFAULT 0'); } catch {}
  }
  if (!temColuna('clientes', 'categoria_id')) {
    try { db.exec('ALTER TABLE clientes ADD COLUMN categoria_id INTEGER REFERENCES categorias_clientes(id)'); } catch {}
  }
  if (!temColuna('caixas', 'loja_id')) {
    try { db.exec('ALTER TABLE caixas ADD COLUMN loja_id INTEGER REFERENCES lojas(id)'); } catch {}
  }
  if (!temColuna('vendas', 'loja_id')) {
    try { db.exec('ALTER TABLE vendas ADD COLUMN loja_id INTEGER REFERENCES lojas(id)'); } catch {}
  }
}

// ── Dados iniciais na primeira execução ─────────────────────────────────────
function semear(db) {
  const temUsuario = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get();
  if (temUsuario.n === 0) {
    db.prepare(
      "INSERT INTO usuarios (nome, usuario, senha_hash, perfil) VALUES (?,?,?,?)"
    ).run('Administrador', 'admin', hashSenha('admin123'), 'admin');
  }
  const temCategoria = db.prepare('SELECT COUNT(*) AS n FROM categorias').get();
  if (temCategoria.n === 0) {
    const ins = db.prepare('INSERT INTO categorias (nome) VALUES (?)');
    for (const c of ['Vestidos', 'Blusas', 'Calcas', 'Saias', 'Acessorios', 'Calcados']) {
      ins.run(c);
    }
  }
  // Multi-loja: garante ao menos uma loja
  try {
    const temLoja = db.prepare('SELECT COUNT(*) AS n FROM lojas').get();
    if (temLoja.n === 0) {
      db.prepare("INSERT INTO lojas (nome) VALUES ('Loja Principal')").run();
    }
    const lojaPad = db.prepare('SELECT id FROM lojas WHERE ativo=1 ORDER BY id LIMIT 1').get();
    if (lojaPad) {
      db.prepare('UPDATE caixas SET loja_id=? WHERE loja_id IS NULL').run(lojaPad.id);
      db.prepare('UPDATE vendas SET loja_id=? WHERE loja_id IS NULL').run(lojaPad.id);
    }
  } catch (e) { console.error('[semear lojas]', e.message); }
}

// ── Reset de fábrica ─────────────────────────────────────────────────────────
function resetarDados(db) {
  const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  db.exec('PRAGMA foreign_keys=OFF');
  db.exec('BEGIN');
  try {
    for (const t of tabelas) db.exec(`DELETE FROM "${t.name}"`);
    try { db.exec('DELETE FROM sqlite_sequence'); } catch {}
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); db.exec('PRAGMA foreign_keys=ON'); throw e; }
  db.exec('PRAGMA foreign_keys=ON');
  semear(db);
  if (db.salvarAgora) db.salvarAgora();
}

module.exports = { criarBanco, resetarDados, validarBackup };
