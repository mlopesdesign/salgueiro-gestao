// Vales-troca — emissão, consulta e consumo
// Todas as funções operam sem gerenciar transação própria;
// quem chama é responsável pelo BEGIN/COMMIT/ROLLBACK.
const { auditar } = require('./util');
const arred = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Gera um código único no formato "VT-XXXXXX" (sem I, O, 0, 1 para evitar confusão visual)
function gerarCodigo(db) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let t = 0; t < 30; t++) {
    let c = 'VT-';
    for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
    if (!db.prepare('SELECT id FROM vales_troca WHERE codigo=?').get(c)) return c;
  }
  throw new Error('Falha ao gerar código único para vale-troca.');
}

// Cria um vale. Deve ser chamado dentro de uma transação já aberta.
function criar(db, { valor, clienteId, devolucaoId }, quem) {
  const codigo = gerarCodigo(db);
  const r = db.prepare(
    'INSERT INTO vales_troca (codigo, valor_total, valor_usado, cliente_id, devolucao_id) VALUES (?,?,0,?,?)'
  ).run(codigo, arred(valor), clienteId || null, devolucaoId || null);
  auditar(db, quem, 'vale_emitido', `${codigo} R$ ${arred(valor).toFixed(2)}`);
  return { id: Number(r.lastInsertRowid), codigo, valor_total: arred(valor), saldo: arred(valor) };
}

// Consulta saldo de um vale (leitura — pode ser chamada a qualquer momento).
function consultar(db, codigo) {
  if (!codigo) return { ok: false, erro: 'Informe o código do vale-troca.' };
  const vale = db.prepare(`
    SELECT v.*, c.nome AS cliente_nome FROM vales_troca v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE v.codigo = ?
  `).get(String(codigo).trim().toUpperCase());
  if (!vale) return { ok: false, erro: 'Vale-troca não encontrado.' };
  if (vale.status === 'usado') return { ok: false, erro: 'Este vale-troca já foi totalmente utilizado.' };
  const saldo = arred(vale.valor_total - vale.valor_usado);
  return { ok: true, vale: { ...vale, saldo } };
}

// Consome parcial ou totalmente o vale. Deve ser chamado dentro de uma transação já aberta.
function usar(db, { codigo, valorAplicado, vendaId }, quem) {
  const r = consultar(db, codigo);
  if (!r.ok) return r;
  const { vale } = r;
  const aplicar = arred(Number(valorAplicado));
  if (aplicar <= 0) return { ok: false, erro: 'Valor a aplicar inválido.' };
  // tolerância de 1 centavo para arredondamento
  if (aplicar > vale.saldo + 0.009) {
    return { ok: false, erro: `Saldo insuficiente no vale-troca (disponível: R$ ${vale.saldo.toFixed(2)}).` };
  }
  const efetivo = Math.min(aplicar, vale.saldo);
  const novoUsado = arred(vale.valor_usado + efetivo);
  const novoStatus = novoUsado >= vale.valor_total - 0.009 ? 'usado' : 'parcial';
  db.prepare(
    "UPDATE vales_troca SET valor_usado=?, status=?, usado_em=datetime('now','localtime') WHERE id=?"
  ).run(novoUsado, novoStatus, vale.id);
  auditar(db, quem, 'vale_usado', `${vale.codigo} R$ ${efetivo.toFixed(2)} venda #${vendaId}`);
  return { ok: true, aplicado: efetivo, saldo_restante: arred(vale.saldo - efetivo) };
}

// Lista todos os vales (tela de gestão).
function listar(db) {
  const vales = db.prepare(`
    SELECT v.*, c.nome AS cliente_nome, (v.valor_total - v.valor_usado) AS saldo
    FROM vales_troca v LEFT JOIN clientes c ON c.id = v.cliente_id
    ORDER BY v.id DESC LIMIT 500
  `).all();
  return { ok: true, vales };
}

module.exports = { criar, consultar, usar, listar };
