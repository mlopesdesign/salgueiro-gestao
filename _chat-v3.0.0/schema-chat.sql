-- Tabelas do chat interno e avisos (v3.0.0) — preservadas para religar depois.
-- ATENCAO: nunca use ponto-e-virgula dentro de comentario neste arquivo. O
-- criarBanco() divide o schema por esse caractere e parte o CREATE TABLE.
--
-- Estas 6 tabelas JA EXISTEM no banco do cliente (a v3.0.0 as criou) e
-- continuam la, inertes, na v3.0.1. As conversas antigas nao foram perdidas.
-- Ao religar o chat, basta colar este bloco no final de src/schema.sql.

CREATE TABLE IF NOT EXISTS conversas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL DEFAULT 'direta' CHECK (tipo IN ('direta','geral')),
  chave TEXT NOT NULL UNIQUE,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS conversa_membros (
  conversa_id INTEGER NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  lido_ate INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (conversa_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversa_id INTEGER NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  texto TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS avisos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('normal','urgente')),
  alvo TEXT NOT NULL DEFAULT 'todos' CHECK (alvo IN ('todos','usuarios')),
  alvo_ids TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS aviso_confirmacoes (
  aviso_id INTEGER NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  confirmado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (aviso_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS presenca (
  usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id),
  origem TEXT NOT NULL DEFAULT 'local',
  tela TEXT,
  ultimo_ping TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens(conversa_id, id);
CREATE INDEX IF NOT EXISTS idx_avisos_ativo ON avisos(ativo, id);
