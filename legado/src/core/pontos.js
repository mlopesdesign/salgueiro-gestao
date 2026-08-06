// Programa de pontos de fidelidade
// Configuração via tabela config (chaves: pontos.ativo, pontos.por_real, pontos.minimo_resgate, pontos.valor_resgate)
const { auditar } = require('./util');

// Padrões caso não haja config salva
const DEFAULTS = {
  ativo: '0',          // desativado por padrão; loja ativa em Configurações
  por_real: '1',       // 1 ponto por R$ 1 gasto (truncado)
  minimo_resgate: '100', // mínimo de pontos para resgatar
  valor_resgate: '10'  // R$ 10 de desconto a cada 100 pontos resgatados
};

function getConfig(db) {
  const rows = db.prepare("SELECT chave, valor FROM config WHERE chave LIKE 'pontos.%'").all();
  const cfg = { ...DEFAULTS };
  for (const r of rows) {
    const k = r.chave.replace('pontos.', '');
    cfg[k] = r.valor;
  }
  return {
    ativo: cfg.ativo === '1',
    por_real: Number(cfg.por_real) || 1,
    minimo_resgate: Number(cfg.minimo_resgate) || 100,
    valor_resgate: Number(cfg.valor_resgate) || 10
  };
}

function salvarConfig(db, p, quem) {
  const set = db.prepare("INSERT OR REPLACE INTO config (chave, valor) VALUES (?,?)");
  if (typeof p.ativo !== 'undefined') set.run('pontos.ativo', p.ativo ? '1' : '0');
  if (typeof p.por_real !== 'undefined') set.run('pontos.por_real', String(Number(p.por_real) || 1));
  if (typeof p.minimo_resgate !== 'undefined') set.run('pontos.minimo_resgate', String(Math.max(1, Number(p.minimo_resgate) || 100)));
  if (typeof p.valor_resgate !== 'undefined') set.run('pontos.valor_resgate', String(Number(p.valor_resgate) || 10));
  auditar(db, quem, 'pontos_config_alterada', JSON.stringify(p));
  return { ok: true, config: getConfig(db) };
}

function saldo(db, clienteId) {
  const cli = db.prepare('SELECT id, nome, pontos FROM clientes WHERE id=?').get(clienteId);
  if (!cli) return { ok: false, erro: 'Cliente não encontrado.' };
  return { ok: true, cliente: cli.nome, pontos: cli.pontos || 0 };
}

function historico(db, clienteId) {
  const linhas = db.prepare(`
    SELECT cp.id, cp.tipo, cp.pontos, cp.origem, cp.origem_id, cp.obs, cp.criado_em
    FROM clientes_pontos cp
    WHERE cp.cliente_id = ?
    ORDER BY cp.id DESC LIMIT 100
  `).all(clienteId);
  return { ok: true, historico: linhas };
}

// Calcula pontos ganhos em uma compra (trunca frações)
function calcularGanho(db, total) {
  const cfg = getConfig(db);
  if (!cfg.ativo) return 0;
  return Math.floor((total || 0) * cfg.por_real);
}

// Calcula desconto em R$ para N pontos a resgatar
function calcularResgate(db, pontos) {
  const cfg = getConfig(db);
  if (!cfg.ativo || pontos < cfg.minimo_resgate) return 0;
  // proporção: cfg.valor_resgate reais por cfg.minimo_resgate pontos
  return Math.floor(pontos / cfg.minimo_resgate) * cfg.valor_resgate;
}

// Credita pontos após venda (chamado dentro da transação da venda)
function creditar(db, { clienteId, pontos, origem, origemId, obs }, quem) {
  if (!clienteId || pontos <= 0) return { ok: true, pontos: 0 };
  db.prepare('UPDATE clientes SET pontos = pontos + ? WHERE id=?').run(pontos, clienteId);
  db.prepare(`INSERT INTO clientes_pontos (cliente_id, tipo, pontos, origem, origem_id, obs)
              VALUES (?,?,?,?,?,?)`)
    .run(clienteId, 'credito', pontos, origem || null, origemId || null, obs || null);
  const novo = db.prepare('SELECT pontos FROM clientes WHERE id=?').get(clienteId).pontos;
  return { ok: true, pontos, saldo_novo: novo };
}

// Debita pontos no resgate (chamado dentro da transação da venda)
function debitar(db, { clienteId, pontos, origem, origemId, obs }, quem) {
  const cli = db.prepare('SELECT pontos FROM clientes WHERE id=?').get(clienteId);
  if (!cli) return { ok: false, erro: 'Cliente não encontrado.' };
  if ((cli.pontos || 0) < pontos) return { ok: false, erro: 'Saldo de pontos insuficiente.' };
  db.prepare('UPDATE clientes SET pontos = pontos - ? WHERE id=?').run(pontos, clienteId);
  db.prepare(`INSERT INTO clientes_pontos (cliente_id, tipo, pontos, origem, origem_id, obs)
              VALUES (?,?,?,?,?,?)`)
    .run(clienteId, 'debito', pontos, origem || null, origemId || null, obs || null);
  const novo = db.prepare('SELECT pontos FROM clientes WHERE id=?').get(clienteId).pontos;
  return { ok: true, pontos, saldo_novo: novo };
}

// Ajuste manual de pontos (admin)
function ajustar(db, { clienteId, pontos, obs }, quem) {
  if (!quem || quem.perfil !== 'admin') return { ok: false, erro: 'Apenas administradores ajustam pontos.' };
  const cli = db.prepare('SELECT pontos FROM clientes WHERE id=?').get(clienteId);
  if (!cli) return { ok: false, erro: 'Cliente não encontrado.' };
  const delta = Math.round(Number(pontos) || 0);
  if (delta === 0) return { ok: false, erro: 'Informe a quantidade de pontos.' };
  const novoSaldo = (cli.pontos || 0) + delta;
  if (novoSaldo < 0) return { ok: false, erro: 'Ajuste deixaria saldo negativo.' };
  db.prepare('UPDATE clientes SET pontos = ? WHERE id=?').run(novoSaldo, clienteId);
  db.prepare(`INSERT INTO clientes_pontos (cliente_id, tipo, pontos, origem, obs)
              VALUES (?,?,?,?,?)`)
    .run(clienteId, 'ajuste', Math.abs(delta), delta > 0 ? 'ajuste_credito' : 'ajuste_debito', obs || null);
  auditar(db, quem, 'pontos_ajustados', `cliente #${clienteId}: ${delta > 0 ? '+' : ''}${delta} pts`);
  return { ok: true, saldo_novo: novoSaldo };
}

module.exports = { getConfig, salvarConfig, saldo, historico, calcularGanho, calcularResgate, creditar, debitar, ajustar };
