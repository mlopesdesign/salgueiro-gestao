-- Salgueiro Gestão — esquema do banco (SQLite)
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL DEFAULT 'caixa' CHECK (perfil IN ('admin','caixa','estoque')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  pai_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS marcas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS colecoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS fornecedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cnpj TEXT,
  telefone TEXT,
  email TEXT,
  obs TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referencia TEXT,
  nome TEXT NOT NULL,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  marca_id INTEGER REFERENCES marcas(id) ON DELETE SET NULL,
  colecao_id INTEGER REFERENCES colecoes(id) ON DELETE SET NULL,
  fornecedor_id INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL,
  preco_custo REAL NOT NULL DEFAULT 0,
  preco_venda REAL NOT NULL DEFAULT 0,
  preco_promo REAL,
  promo_inicio TEXT,
  promo_fim TEXT,
  estoque_minimo INTEGER NOT NULL DEFAULT 0,
  foto TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS variacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  cor TEXT NOT NULL DEFAULT 'Única',
  tamanho TEXT NOT NULL DEFAULT 'U',
  codigo_barras TEXT UNIQUE,
  estoque REAL NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 0,
  foto TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  UNIQUE (produto_id, cor, tamanho)
);

CREATE TABLE IF NOT EXISTS movimentos_estoque (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variacao_id INTEGER NOT NULL REFERENCES variacoes(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste','venda','devolucao','inventario','transferencia')),
  qtd REAL NOT NULL,
  custo_unit REAL,
  motivo TEXT,
  usuario_id INTEGER REFERENCES usuarios(id),
  estoque_id INTEGER REFERENCES estoques(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ── Locais de estoque ───────────────────────────────────────────────────────
-- variacoes.estoque continua sendo o TOTAL do Salgueiro (soma de todos os
-- locais). Cada local guarda o seu saldo em estoque_saldos. O almoxarifado
-- central é o local `principal`. Criar uma loja cria o estoque dela junto.
-- ATENCAO: nunca use ponto-e-virgula dentro de comentario neste arquivo. O
-- criarBanco() divide o schema por esse caractere e parte o CREATE TABLE.
CREATE TABLE IF NOT EXISTS estoques (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL DEFAULT 'outro' CHECK (tipo IN ('almoxarifado','loja','pessoa','online','outro')),
  loja_id INTEGER REFERENCES lojas(id),
  responsavel TEXT,
  principal INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS estoque_saldos (
  estoque_id INTEGER NOT NULL REFERENCES estoques(id) ON DELETE CASCADE,
  variacao_id INTEGER NOT NULL REFERENCES variacoes(id) ON DELETE CASCADE,
  qtd REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (estoque_id, variacao_id)
);
CREATE INDEX IF NOT EXISTS idx_saldo_var ON estoque_saldos(variacao_id);

-- Romaneio de transferência entre locais (descer para a loja, subir de volta…)
CREATE TABLE IF NOT EXISTS transferencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origem_id INTEGER NOT NULL REFERENCES estoques(id),
  destino_id INTEGER NOT NULL REFERENCES estoques(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  obs TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS transferencia_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transferencia_id INTEGER NOT NULL REFERENCES transferencias(id) ON DELETE CASCADE,
  variacao_id INTEGER NOT NULL REFERENCES variacoes(id),
  qtd REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  nascimento TEXT,
  limite_credito REAL NOT NULL DEFAULT 0,
  obs TEXT,
  -- 1 = cliente do sistema, não é pessoa real. Hoje só o "Consumidor final",
  -- que recebe as vendas sem identificação. Fica FORA de ranking de melhores
  -- clientes, pontos, crediário e aniversariantes — senão lideraria tudo.
  generico INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS lojas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  estoque_id INTEGER REFERENCES estoques(id),
  sem_desconto INTEGER NOT NULL DEFAULT 0,      -- v3.30.0: loja que nunca dá desconto (ex.: venda online)
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS caixas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loja_id INTEGER REFERENCES lojas(id),
  aberto_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  fechado_em TEXT,
  usuario_abertura INTEGER REFERENCES usuarios(id),
  usuario_fechamento INTEGER REFERENCES usuarios(id),
  valor_abertura REAL NOT NULL DEFAULT 0,
  valor_fechamento_informado REAL,
  valor_fechamento_calculado REAL,
  obs TEXT
);

CREATE TABLE IF NOT EXISTS caixa_movimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caixa_id INTEGER NOT NULL REFERENCES caixas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('sangria','suprimento')),
  valor REAL NOT NULL,
  motivo TEXT,
  usuario_id INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS vendas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caixa_id INTEGER REFERENCES caixas(id),
  loja_id INTEGER REFERENCES lojas(id),
  cliente_id INTEGER REFERENCES clientes(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  subtotal REAL NOT NULL DEFAULT 0,
  desconto REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida','cancelada','orcamento','condicional','troca')),
  obs TEXT,
  -- Desconto avulso: quem liberou e por quê. Preenchido pelo PDV quando o
  -- operador lança desconto manual (v3.3.0). Campo livre de propósito: quem
  -- autoriza nem sempre tem login (dono, gerente por telefone, sócio).
  desconto_autorizado_por TEXT,
  desconto_motivo TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS venda_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  variacao_id INTEGER NOT NULL REFERENCES variacoes(id),
  qtd REAL NOT NULL,
  preco_unit REAL NOT NULL,
  desconto REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS venda_pagamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  forma TEXT NOT NULL CHECK (forma IN ('dinheiro','pix','debito','credito','crediario','vale','cortesia','troca')),
  valor REAL NOT NULL,
  parcelas INTEGER NOT NULL DEFAULT 1,
  troco REAL NOT NULL DEFAULT 0,
  -- Cortesia: a venda entra com total 0 (o valor vira desconto), mas o estoque
  -- baixa normalmente. Autorizador e beneficiário são obrigatórios.
  autorizado_por TEXT,
  beneficiario TEXT,
  cortesia_valor REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crediario_parcelas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id INTEGER NOT NULL REFERENCES vendas(id),
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  numero INTEGER NOT NULL,
  valor REAL NOT NULL,
  vencimento TEXT NOT NULL,
  pago_em TEXT,
  valor_pago REAL
);

CREATE TABLE IF NOT EXISTS compras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  numero_nf TEXT,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','recebida','cancelada')),
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  recebido_em TEXT
);

CREATE TABLE IF NOT EXISTS compra_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  compra_id INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  variacao_id INTEGER NOT NULL REFERENCES variacoes(id),
  qtd REAL NOT NULL,
  custo_unit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK (tipo IN ('pagar','receber')),
  descricao TEXT NOT NULL,
  categoria TEXT,
  valor REAL NOT NULL,
  vencimento TEXT,
  pago_em TEXT,
  valor_pago REAL,
  origem TEXT,
  origem_id INTEGER,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Consignação: cada venda de produto consignado gera um movimento pendente;
-- o acerto com o fornecedor agrupa os pendentes numa conta a pagar.
CREATE TABLE IF NOT EXISTS consignacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id INTEGER NOT NULL REFERENCES vendas(id),
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
  qtd INTEGER NOT NULL,
  valor_venda REAL NOT NULL,
  valor_custo REAL NOT NULL DEFAULT 0,
  pct_fornecedor REAL NOT NULL,
  valor_fornecedor REAL NOT NULL,
  valor_loja REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','acertado','cancelado')),
  acerto_id INTEGER REFERENCES financeiro_lancamentos(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_consig_fornecedor ON consignacoes(fornecedor_id, status);

CREATE TABLE IF NOT EXISTS auditoria_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  acao TEXT NOT NULL,
  detalhe TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT
);

CREATE TABLE IF NOT EXISTS devolucoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id INTEGER REFERENCES vendas(id),
  cliente_id INTEGER REFERENCES clientes(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  caixa_id INTEGER REFERENCES caixas(id),
  tipo TEXT NOT NULL DEFAULT 'devolucao' CHECK (tipo IN ('devolucao','troca')),
  valor_devolvido REAL NOT NULL DEFAULT 0,
  forma_reembolso TEXT,
  motivo TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  troca_venda_id INTEGER,          -- v3.28.0: a venda (status 'troca') que esta troca gerou
  excedente REAL NOT NULL DEFAULT 0 -- v3.28.0: credito que sobrou alem da peca levada
);

CREATE TABLE IF NOT EXISTS devolucao_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  devolucao_id INTEGER NOT NULL REFERENCES devolucoes(id) ON DELETE CASCADE,
  variacao_id INTEGER NOT NULL REFERENCES variacoes(id),
  qtd REAL NOT NULL,
  valor_unit REAL NOT NULL,
  total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS vales_troca (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  valor_total REAL NOT NULL,
  valor_usado REAL NOT NULL DEFAULT 0,
  cliente_id INTEGER REFERENCES clientes(id),
  devolucao_id INTEGER REFERENCES devolucoes(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  usado_em TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','parcial','usado')),
  validade TEXT
);

CREATE TABLE IF NOT EXISTS clientes_pontos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('credito','debito','ajuste')),
  pontos INTEGER NOT NULL,
  origem TEXT,
  origem_id INTEGER,
  obs TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS categorias_clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  desconto_percent REAL NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_variacoes_produto ON variacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_variacoes_codigo ON variacoes(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_mov_estoque_variacao ON movimentos_estoque(variacao_id);
CREATE INDEX IF NOT EXISTS idx_vendas_criado ON vendas(criado_em);
CREATE INDEX IF NOT EXISTS idx_parcelas_cliente ON crediario_parcelas(cliente_id, pago_em);
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
