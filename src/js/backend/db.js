// Camada de banco de dados — Salgueiro Gestão V2
// sql.js (SQLite em JavaScript puro, build asm.js) rodando no WebView.
// A API exposta é a de better-sqlite3: db.prepare(sql).all()/.get()/.run(),
// db.exec(sql). Persistência: bytes exportados → ambiente.salvarBanco()
// com debounce de 300ms + salvarAgora() ao fechar (gravação atômica).
//
// Portado de legado/src/db.js — mesma lógica de migração e seed.
/* global initSqlJs */

import { hashSenha } from './core/util.js';

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
  run(...params) { return this._exec(params, true); }

  // Escrita VOLÁTIL: aplica no banco em memória mas NÃO agenda gravação em disco.
  // Para dados descartáveis de altíssima frequência. Cada gravação reescreve o
  // banco INTEIRO no disco — repetir isso a cada poucos segundos multiplica o
  // risco de o processo ser morto no meio de uma gravação.
  runVolatil(...params) { return this._exec(params, false); }

  _exec(params, persistir) {
    const flat = this._flat(params);
    this._w._db.run(this._sql, flat.length ? flat : undefined);
    const changes = this._w._db.getRowsModified();
    let lastInsertRowid = 0;
    const stmt = this._w._db.prepare('SELECT last_insert_rowid() AS id');
    try { if (stmt.step()) lastInsertRowid = stmt.getAsObject().id; } finally { stmt.free(); }
    if (persistir) this._w._agendarSalvar();
    return { changes, lastInsertRowid };
  }
}

class SqlJsWrapper {
  constructor(dbInst, salvarBytes) {
    this._db = dbInst;
    this._salvarBytes = salvarBytes; // async (Uint8Array) => void
    this._salvarTimer = null;
  }
  prepare(sql) { return new SqlJsStatement(this, sql); }
  exec(sql) {
    this._db.exec(sql);
    this._agendarSalvar();
  }
  exportar() { return this._db.export(); }
  _agendarSalvar() {
    if (this._salvarTimer) clearTimeout(this._salvarTimer);
    this._salvarTimer = setTimeout(() => this._salvarEmDisco(), 300);
    if (this._salvarTimer.unref) this._salvarTimer.unref();
  }
  async _salvarEmDisco() {
    try {
      await this._salvarBytes(this._db.export());
    } catch (e) {
      console.error('[db] erro ao salvar em disco:', e.message || e);
    }
  }
  async salvarAgora() {
    if (this._salvarTimer) { clearTimeout(this._salvarTimer); this._salvarTimer = null; }
    await this._salvarEmDisco();
  }
  async close() {
    await this.salvarAgora();
    this._db.close();
  }
}

// Módulo sql.js inicializado uma única vez (o vendor sql-asm.js define
// o global initSqlJs — no browser via <script>, nos testes via harness)
let _SQL = null;
async function _initSqlJs() {
  if (_SQL) return _SQL;
  _SQL = await initSqlJs();
  return _SQL;
}

// Abre um banco a partir de bytes (ou vazio) — sem tocar em disco.
export async function abrirDeBytes(bytes, salvarBytes) {
  const SQL = await _initSqlJs();
  const dbInst = (bytes && bytes.length) ? new SQL.Database(bytes) : new SQL.Database();
  return new SqlJsWrapper(dbInst, salvarBytes || (async () => {}));
}

// Banco "vazio" = inexistente ou sem movimento (só o seed inicial) —
// nesse caso o app adota o banco inicial embutido (dados da Boutique).
export async function estaVazio(bytes) {
  if (!bytes || !bytes.length) return true;
  let t;
  try {
    t = await abrirDeBytes(bytes, async () => {});
    const n = (sql) => { try { return t.prepare(sql).get().n; } catch { return 0; } };
    return n('SELECT COUNT(*) AS n FROM produtos') === 0 &&
           n('SELECT COUNT(*) AS n FROM vendas') === 0 &&
           n('SELECT COUNT(*) AS n FROM clientes') === 0;
  } catch { return false; } finally { try { if (t) t._db.close(); } catch {} }
}

// Radiografia de um banco: quantas linhas tem em cada tabela que importa.
// Usada para MOSTRAR ao usuário o que há dentro de cada backup antes de
// restaurar, e para o boot detectar que o banco em uso está quebrado.
// `tabelasOk` false = tabela essencial ausente (banco truncado/corrompido).
export async function radiografar(bytes) {
  let t;
  try {
    t = await abrirDeBytes(bytes, async () => {});
    const n = (tab) => {
      try { return t.prepare(`SELECT COUNT(*) AS n FROM ${tab}`).get().n; } catch { return -1; }
    };
    const r = {
      usuarios: n('usuarios'), produtos: n('produtos'),
      vendas: n('vendas'), clientes: n('clientes')
    };
    r.tabelasOk = Object.values(r).every(v => v >= 0);
    r.totalDados = Math.max(0, r.produtos) + Math.max(0, r.vendas) + Math.max(0, r.clientes);
    r.temDados = r.totalDados > 0;
    return r;
  } catch {
    return { usuarios: -1, produtos: -1, vendas: -1, clientes: -1,
             tabelasOk: false, totalDados: 0, temDados: false };
  } finally { try { if (t) t._db.close(); } catch {} }
}

// Valida se bytes são um banco do Salgueiro (restauração de backup).
//
// ANTES: só testava `SELECT COUNT(*) FROM usuarios` — um banco VAZIO passava.
// Por isso restaurar um backup em branco "dava certo" e o sistema continuava
// zerado. Agora exige que todas as tabelas essenciais existam e devolve a
// radiografia para a tela avisar quando o backup tem menos dados que o atual.
export async function validarBackup(bytes) {
  if (!bytes || bytes.length < 1024) return false;
  const r = await radiografar(bytes);
  return r.tabelasOk && r.usuarios > 0;
}

export async function criarBanco({ bytes, schema, salvarBytes }) {
  const db = await abrirDeBytes(bytes, salvarBytes);
  // Executa statement a statement (schema não contém triggers/procedures)
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try { db._db.exec(stmt + ';'); } catch (e) {
      if (!/already exists/i.test(e.message)) console.error('[schema]', e.message);
    }
  }
  migrar(db);
  await semear(db);
  await db.salvarAgora();
  return db;
}

// ── Migrações leves e idempotentes (idênticas à V1) ─────────────────────────
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
  if (!temColuna('categorias_clientes', 'desconto_percent')) {
    try { db.exec('ALTER TABLE categorias_clientes ADD COLUMN desconto_percent REAL NOT NULL DEFAULT 0'); } catch {}
  }
  if (!temColuna('caixas', 'loja_id')) {
    try { db.exec('ALTER TABLE caixas ADD COLUMN loja_id INTEGER REFERENCES lojas(id)'); } catch {}
  }
  if (!temColuna('vendas', 'loja_id')) {
    try { db.exec('ALTER TABLE vendas ADD COLUMN loja_id INTEGER REFERENCES lojas(id)'); } catch {}
  }
  if (!temColuna('variacoes', 'estoque_minimo')) {
    try { db.exec('ALTER TABLE variacoes ADD COLUMN estoque_minimo INTEGER NOT NULL DEFAULT 0'); } catch {}
  }

  // ── Cortesia (v2.2.0) ─────────────────────────────────────────────────────
  // Colunas novas são simples de adicionar…
  if (!temColuna('venda_pagamentos', 'autorizado_por')) {
    try { db.exec('ALTER TABLE venda_pagamentos ADD COLUMN autorizado_por TEXT'); } catch {}
  }
  if (!temColuna('venda_pagamentos', 'beneficiario')) {
    try { db.exec('ALTER TABLE venda_pagamentos ADD COLUMN beneficiario TEXT'); } catch {}
  }
  if (!temColuna('venda_pagamentos', 'cortesia_valor')) {
    try { db.exec('ALTER TABLE venda_pagamentos ADD COLUMN cortesia_valor REAL NOT NULL DEFAULT 0'); } catch {}
  }
  // …mas o CHECK de `forma` não aceita ALTER: a tabela precisa ser reconstruída.
  // Feito em transação e só troca a tabela antiga depois de conferir a contagem.
  try {
    const def = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='venda_pagamentos'").get();
    // ATENÇÃO: procurar 'cortesia' COM aspas. Sem elas o teste casa com a coluna
    // cortesia_valor (adicionada logo acima) e a reconstrução nunca aconteceria.
    if (def && def.sql && !def.sql.includes("'cortesia'")) {
      const antes = db.prepare('SELECT COUNT(*) AS n FROM venda_pagamentos').get().n;
      db.exec('PRAGMA foreign_keys=off');
      db.exec('BEGIN');
      try {
        db.exec(`CREATE TABLE venda_pagamentos_novo (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venda_id INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
          forma TEXT NOT NULL CHECK (forma IN ('dinheiro','pix','debito','credito','crediario','vale','cortesia')),
          valor REAL NOT NULL,
          parcelas INTEGER NOT NULL DEFAULT 1,
          troco REAL NOT NULL DEFAULT 0,
          autorizado_por TEXT,
          beneficiario TEXT,
          cortesia_valor REAL NOT NULL DEFAULT 0
        )`);
        db.exec(`INSERT INTO venda_pagamentos_novo
          (id, venda_id, forma, valor, parcelas, troco, autorizado_por, beneficiario, cortesia_valor)
          SELECT id, venda_id, forma, valor, parcelas, troco,
                 autorizado_por, beneficiario, COALESCE(cortesia_valor,0)
          FROM venda_pagamentos`);
        const depois = db.prepare('SELECT COUNT(*) AS n FROM venda_pagamentos_novo').get().n;
        if (depois !== antes) throw new Error(`cortesia: copiou ${depois} de ${antes} pagamentos`);
        db.exec('DROP TABLE venda_pagamentos');
        db.exec('ALTER TABLE venda_pagamentos_novo RENAME TO venda_pagamentos');
        db.exec('COMMIT');
        console.log(`[migração] venda_pagamentos aceita cortesia (${antes} pagamentos preservados)`);
      } catch (e) {
        db.exec('ROLLBACK');
        try { db.exec('DROP TABLE IF EXISTS venda_pagamentos_novo'); } catch {}
        console.error('[migração] cortesia falhou, banco intacto:', e.message);
      }
      db.exec('PRAGMA foreign_keys=on');
    }
  } catch (e) { console.error('[migração] cortesia:', e.message); }

  // ── Locais de estoque (v2.6.0) ────────────────────────────────────────────
  // As tabelas novas nascem do schema.sql (CREATE TABLE IF NOT EXISTS roda a
  // cada boot). Aqui só falta o que o schema não consegue alterar sozinho.
  if (tabelaExiste('movimentos_estoque') && !temColuna('movimentos_estoque', 'estoque_id')) {
    try { db.exec('ALTER TABLE movimentos_estoque ADD COLUMN estoque_id INTEGER'); } catch {}
  }
  // CHECK de `tipo` precisa aceitar 'transferencia' — exige reconstruir a tabela.
  // Mesma armadilha da cortesia: testar COM aspas, senão casa com outra coisa.
  try {
    const def = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='movimentos_estoque'").get();
    if (def && def.sql && !def.sql.includes("'transferencia'")) {
      const antes = db.prepare('SELECT COUNT(*) AS n FROM movimentos_estoque').get().n;
      db.exec('PRAGMA foreign_keys=off');
      db.exec('BEGIN');
      try {
        db.exec(`CREATE TABLE movimentos_estoque_novo (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          variacao_id INTEGER NOT NULL REFERENCES variacoes(id),
          tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste','venda','devolucao','inventario','transferencia')),
          qtd REAL NOT NULL,
          custo_unit REAL,
          motivo TEXT,
          usuario_id INTEGER REFERENCES usuarios(id),
          estoque_id INTEGER,
          criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )`);
        db.exec(`INSERT INTO movimentos_estoque_novo
          (id, variacao_id, tipo, qtd, custo_unit, motivo, usuario_id, estoque_id, criado_em)
          SELECT id, variacao_id, tipo, qtd, custo_unit, motivo, usuario_id, estoque_id, criado_em
          FROM movimentos_estoque`);
        const depois = db.prepare('SELECT COUNT(*) AS n FROM movimentos_estoque_novo').get().n;
        if (depois !== antes) throw new Error(`copiou ${depois} de ${antes} movimentos`);
        db.exec('DROP TABLE movimentos_estoque');
        db.exec('ALTER TABLE movimentos_estoque_novo RENAME TO movimentos_estoque');
        db.exec('COMMIT');
        console.log(`[migração] movimentos_estoque aceita transferência (${antes} movimentos preservados)`);
      } catch (e) {
        db.exec('ROLLBACK');
        try { db.exec('DROP TABLE IF EXISTS movimentos_estoque_novo'); } catch {}
        console.error('[migração] transferência falhou, banco intacto:', e.message);
      }
      db.exec('PRAGMA foreign_keys=on');
    }
  } catch (e) { console.error('[migração] transferência:', e.message); }

  // Primeira carga dos locais: TODO o estoque atual vai para o Almoxarifado
  // Central. A loja começa zerada de propósito — o Marcio faz o balanço e
  // depois desce as peças pelo romaneio.
  try {
    if (tabelaExiste('estoques')) {
      const qtdLocais = db.prepare('SELECT COUNT(*) AS n FROM estoques').get().n;
      if (qtdLocais === 0) {
        db.exec('BEGIN');
        try {
          const r = db.prepare(
            "INSERT INTO estoques (nome, tipo, principal) VALUES ('Almoxarifado Central','almoxarifado',1)").run();
          const central = Number(r.lastInsertRowid);
          db.prepare(`INSERT INTO estoque_saldos (estoque_id, variacao_id, qtd)
                      SELECT ?, id, estoque FROM variacoes WHERE estoque <> 0`).run(central);
          // um estoque (vazio) para cada loja já cadastrada
          for (const l of db.prepare('SELECT id, nome FROM lojas WHERE ativo=1').all()) {
            const nome = /^loja\b/i.test(l.nome) ? l.nome : `Loja ${l.nome}`;
            try {
              db.prepare("INSERT INTO estoques (nome, tipo, loja_id) VALUES (?,'loja',?)").run(nome, l.id);
            } catch { /* nome repetido: ignora, a loja fica sem estoque próprio */ }
          }
          db.exec('COMMIT');
          const tot = db.prepare('SELECT COALESCE(SUM(qtd),0) AS n FROM estoque_saldos').get().n;
          console.log(`[migração] locais de estoque criados; ${tot} peça(s) no Almoxarifado Central`);
        } catch (e) {
          db.exec('ROLLBACK');
          console.error('[migração] locais de estoque falharam, banco intacto:', e.message);
        }
      }
    }
  } catch (e) { console.error('[migração] locais de estoque:', e.message); }

  // Migração: lojas.estoque_id — cada loja aponta para qual estoque usa nas vendas.
  // Sem esse campo, daLoja() buscava por estoques.loja_id; agora lê a coluna direto.
  if (tabelaExiste('lojas') && tabelaExiste('estoques') && !temColuna('lojas', 'estoque_id')) {
    try {
      db.exec('ALTER TABLE lojas ADD COLUMN estoque_id INTEGER REFERENCES estoques(id)');
      // preencher: cada loja aponta para o seu estoque existente (ou para o central)
      const central = db.prepare('SELECT id FROM estoques WHERE principal=1 LIMIT 1').get();
      for (const l of db.prepare('SELECT id FROM lojas').all()) {
        const e = db.prepare('SELECT id FROM estoques WHERE loja_id=? AND ativo=1 LIMIT 1').get(l.id);
        const eid = e ? e.id : (central ? central.id : null);
        if (eid) db.prepare('UPDATE lojas SET estoque_id=? WHERE id=?').run(eid, l.id);
      }
      console.log('[migração] lojas.estoque_id preenchido');
    } catch (e) { console.error('[migração] lojas.estoque_id:', e.message); }
  }

  // v2.7.0 — foto por variação
  if (tabelaExiste('variacoes') && !temColuna('variacoes', 'foto')) {
    try {
      db.exec('ALTER TABLE variacoes ADD COLUMN foto TEXT');
      console.log('[migração] variacoes.foto adicionado');
    } catch (e) { console.error('[migração] variacoes.foto:', e.message); }
  }

  // ── v3.2.0 — Troca no PDV ──────────────────────────────────────────────────
  // O crédito da troca entra como pagamento da nova venda com forma 'troca'.
  // O CHECK de `forma` não aceita ALTER: reconstruir a tabela (mesmo rito da
  // cortesia). ATENÇÃO: procurar 'troca' COM aspas — sem elas o teste casa com
  // qualquer outra ocorrência da palavra no SQL e a reconstrução nunca roda.
  try {
    const def = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='venda_pagamentos'").get();
    if (def && def.sql && !def.sql.includes("'troca'")) {
      const antes = db.prepare('SELECT COUNT(*) AS n FROM venda_pagamentos').get().n;
      db.exec('PRAGMA foreign_keys=off');
      db.exec('BEGIN');
      try {
        db.exec(`CREATE TABLE venda_pagamentos_novo (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venda_id INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
          forma TEXT NOT NULL CHECK (forma IN ('dinheiro','pix','debito','credito','crediario','vale','cortesia','troca')),
          valor REAL NOT NULL,
          parcelas INTEGER NOT NULL DEFAULT 1,
          troco REAL NOT NULL DEFAULT 0,
          autorizado_por TEXT,
          beneficiario TEXT,
          cortesia_valor REAL NOT NULL DEFAULT 0
        )`);
        db.exec(`INSERT INTO venda_pagamentos_novo
          (id, venda_id, forma, valor, parcelas, troco, autorizado_por, beneficiario, cortesia_valor)
          SELECT id, venda_id, forma, valor, parcelas, troco,
                 autorizado_por, beneficiario, COALESCE(cortesia_valor,0)
          FROM venda_pagamentos`);
        const depois = db.prepare('SELECT COUNT(*) AS n FROM venda_pagamentos_novo').get().n;
        if (depois !== antes) throw new Error(`troca: copiou ${depois} de ${antes} pagamentos`);
        db.exec('DROP TABLE venda_pagamentos');
        db.exec('ALTER TABLE venda_pagamentos_novo RENAME TO venda_pagamentos');
        db.exec('COMMIT');
        console.log(`[migração] venda_pagamentos aceita troca (${antes} pagamentos preservados)`);
      } catch (e) {
        db.exec('ROLLBACK');
        try { db.exec('DROP TABLE IF EXISTS venda_pagamentos_novo'); } catch {}
        console.error('[migração] troca falhou, banco intacto:', e.message);
      }
      db.exec('PRAGMA foreign_keys=on');
    }
  } catch (e) { console.error('[migração] troca:', e.message); }

  // ── v3.3.0 — desconto avulso com justificativa ────────────────────────────
  // Quem autorizou e por quê. Colunas simples: ALTER resolve.
  if (!temColuna('vendas', 'desconto_autorizado_por')) {
    try { db.exec('ALTER TABLE vendas ADD COLUMN desconto_autorizado_por TEXT'); } catch {}
  }
  if (!temColuna('vendas', 'desconto_motivo')) {
    try { db.exec('ALTER TABLE vendas ADD COLUMN desconto_motivo TEXT'); } catch {}
  }

  // ── v3.3.0 — Consumidor final vira cliente de verdade ─────────────────────
  // Toda venda sem identificação passa a apontar para ele. `generico=1` o
  // mantém fora de ranking de melhores clientes, pontos, crediário e
  // aniversariantes — senão ele lideraria todas as listas.
  if (tabelaExiste('clientes') && !temColuna('clientes', 'generico')) {
    try {
      db.exec('ALTER TABLE clientes ADD COLUMN generico INTEGER NOT NULL DEFAULT 0');
      console.log('[migração] clientes.generico adicionado');
    } catch (e) { console.error('[migração] clientes.generico:', e.message); }
  }
  try {
    if (tabelaExiste('clientes') && tabelaExiste('categorias_clientes')) {
      // Categoria própria, desconto 0 — o Marcio ajusta se quiser dar desconto
      // padrão a quem não é cadastrado.
      let cat = db.prepare("SELECT id FROM categorias_clientes WHERE nome='Consumidor final'").get();
      if (!cat) {
        const rc = db.prepare(
          "INSERT INTO categorias_clientes (nome, desconto_percent) VALUES ('Consumidor final', 0)").run();
        cat = { id: Number(rc.lastInsertRowid) };
        console.log('[migração] categoria "Consumidor final" criada');
      }
      const ja = db.prepare('SELECT id FROM clientes WHERE generico=1 LIMIT 1').get();
      if (!ja) {
        const rcl = db.prepare(
          "INSERT INTO clientes (nome, categoria_id, generico, obs) VALUES ('Consumidor final', ?, 1, ?)"
        ).run(cat.id, 'Cliente do sistema: recebe as vendas sem identificação. Não excluir.');
        const idGen = Number(rcl.lastInsertRowid);
        // Vendas antigas sem cliente passam a apontar para ele, para o histórico
        // ficar coerente com o que o PDV grava daqui em diante.
        const n = db.prepare('UPDATE vendas SET cliente_id=? WHERE cliente_id IS NULL').run(idGen).changes;
        console.log(`[migração] cliente "Consumidor final" criado (#${idGen}); ${n} venda(s) antiga(s) vinculada(s)`);
      }
    }
  } catch (e) { console.error('[migração] consumidor final:', e.message); }

  // Validade do vale-troca. Coluna simples: ALTER resolve, sem reconstruir.
  // Vale vencido NÃO vira status novo (o CHECK de status continua intacto) —
  // o vencimento é calculado pela data em vales_troca.js.
  if (tabelaExiste('vales_troca') && !temColuna('vales_troca', 'validade')) {
    try {
      db.exec('ALTER TABLE vales_troca ADD COLUMN validade TEXT');
      console.log('[migração] vales_troca.validade adicionado');
    } catch (e) { console.error('[migração] vales_troca.validade:', e.message); }
  }
}

// ── Dados iniciais na primeira execução ─────────────────────────────────────
async function semear(db) {
  const temUsuario = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get();
  if (temUsuario.n === 0) {
    db.prepare(
      "INSERT INTO usuarios (nome, usuario, senha_hash, perfil) VALUES (?,?,?,?)"
    ).run('Administrador', 'admin', await hashSenha('admin123'), 'admin');
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
export async function resetarDados(db) {
  const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  db.exec('PRAGMA foreign_keys=OFF');
  db.exec('BEGIN');
  try {
    for (const t of tabelas) db.exec(`DELETE FROM "${t.name}"`);
    try { db.exec('DELETE FROM sqlite_sequence'); } catch {}
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); db.exec('PRAGMA foreign_keys=ON'); throw e; }
  db.exec('PRAGMA foreign_keys=ON');
  await semear(db);
  await db.salvarAgora();
}
