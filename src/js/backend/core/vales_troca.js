// Vales-troca — emissão, consulta e consumo
// Todas as funções operam sem gerenciar transação própria;
// quem chama é responsável pelo BEGIN/COMMIT/ROLLBACK.
import { auditar } from './util.js';
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

// Validade padrão do vale, em dias. Configurável em `config.vale_validade_dias`.
// 0 (ou vazio) = vale sem data de vencimento.
const VALIDADE_PADRAO_DIAS = 90;

function validadeDiasConfig(db) {
  try {
    const r = db.prepare("SELECT valor FROM config WHERE chave='vale_validade_dias'").get();
    if (r && r.valor !== null && r.valor !== '') {
      const n = Math.max(0, Math.round(Number(r.valor) || 0));
      return n;
    }
  } catch { /* config ausente: cai no padrão */ }
  return VALIDADE_PADRAO_DIAS;
}

// 'YYYY-MM-DD' de hoje + N dias (horário local, igual ao resto do sistema)
function dataMaisDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function hojeISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Vencido = tem validade e a validade já passou. O status no banco continua
// 'ativo'/'parcial' — não existe status 'expirado' (evita reconstruir o CHECK).
function estaVencido(vale) {
  if (!vale || !vale.validade) return false;
  return String(vale.validade) < hojeISO();
}

// Cria um vale. Deve ser chamado dentro de uma transação já aberta.
function criar(db, { valor, clienteId, devolucaoId, validadeDias }, quem) {
  const codigo = gerarCodigo(db);
  const dias = (validadeDias === undefined || validadeDias === null)
    ? validadeDiasConfig(db)
    : Math.max(0, Math.round(Number(validadeDias) || 0));
  const validade = dias > 0 ? dataMaisDias(dias) : null;
  const r = db.prepare(
    'INSERT INTO vales_troca (codigo, valor_total, valor_usado, cliente_id, devolucao_id, validade) VALUES (?,?,0,?,?,?)'
  ).run(codigo, arred(valor), clienteId || null, devolucaoId || null, validade);
  auditar(db, quem, 'vale_emitido',
    `${codigo} R$ ${arred(valor).toFixed(2)}${validade ? ` val. ${validade}` : ''}`);
  return {
    id: Number(r.lastInsertRowid), codigo,
    valor_total: arred(valor), saldo: arred(valor), validade
  };
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
  if (estaVencido(vale)) {
    const [a, m, d] = String(vale.validade).split('-');
    return { ok: false, erro: `Este vale-troca venceu em ${d}/${m}/${a}.` };
  }
  const saldo = arred(vale.valor_total - vale.valor_usado);
  return { ok: true, vale: { ...vale, saldo, vencido: false } };
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
  for (const v of vales) v.vencido = estaVencido(v);
  return { ok: true, vales };
}

export { criar, consultar, usar, listar, estaVencido, VALIDADE_PADRAO_DIAS };