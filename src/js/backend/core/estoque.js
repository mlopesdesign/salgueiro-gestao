// Movimentação de estoque, kardex e reposição
import { auditar } from './util.js';
import * as estoques from './estoques.js';

// Busca variações por código de barras, nome ou referência (para o form de movimentação)
function buscarVariacoes(db, termo) {
  const t = String(termo || '').trim();
  if (!t) return { ok: true, variacoes: [] };
  const like = `%${t}%`;
  const linhas = db.prepare(`
    SELECT v.id, v.cor, v.tamanho, v.codigo_barras, v.estoque,
           p.id AS produto_id, p.nome AS produto, p.referencia, p.preco_custo, p.preco_venda,
           COALESCE(v.foto, p.foto) AS foto
    FROM variacoes v
    JOIN produtos p ON p.id = v.produto_id
    WHERE v.ativo = 1 AND p.ativo = 1
      AND (v.codigo_barras = ? OR p.nome LIKE ? OR p.referencia LIKE ?)
    ORDER BY p.nome, v.cor, v.tamanho
    LIMIT 40
  `).all(t, like, like);
  return { ok: true, variacoes: linhas };
}

// tipo: 'entrada' | 'saida' | 'ajuste'
// entrada: soma qtd (custo_unit opcional atualiza custo médio do produto)
// saida:   subtrai qtd (bloqueia estoque negativo)
// ajuste:  define o estoque para exatamente qtd (inventário/correção)
function movimentar(db, p, quem) {
  const v = db.prepare(`
    SELECT v.id, v.estoque, v.produto_id, p.preco_custo,
           COALESCE((SELECT SUM(x.estoque) FROM variacoes x
                     WHERE x.produto_id = v.produto_id AND x.ativo = 1), 0) AS estoque_produto
    FROM variacoes v JOIN produtos p ON p.id = v.produto_id
    WHERE v.id = ?
  `).get(p.variacao_id);
  if (!v) return { ok: false, erro: 'Variação não encontrada.' };

  const tipo = p.tipo;
  const qtd = Number(p.qtd);
  if (!['entrada', 'saida', 'ajuste'].includes(tipo)) return { ok: false, erro: 'Tipo inválido.' };
  if (!Number.isFinite(qtd) || qtd < 0 || (tipo !== 'ajuste' && qtd <= 0)) {
    return { ok: false, erro: 'Quantidade inválida.' };
  }

  let novoEstoque, qtdMovimento;
  if (tipo === 'entrada') { novoEstoque = v.estoque + qtd; qtdMovimento = qtd; }
  else if (tipo === 'saida') {
    if (qtd > v.estoque) return { ok: false, erro: `Estoque insuficiente (disponível: ${v.estoque}).` };
    novoEstoque = v.estoque - qtd; qtdMovimento = -qtd;
  } else { // ajuste
    novoEstoque = qtd; qtdMovimento = qtd - v.estoque;
    if (qtdMovimento === 0) return { ok: false, erro: 'O estoque já é esse valor.' };
  }

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE variacoes SET estoque=? WHERE id=?').run(novoEstoque, v.id);
    // o movimento cai no local escolhido (padrão: almoxarifado central)
    const alvo = Number(p.estoque_id) > 0
      ? db.prepare('SELECT * FROM estoques WHERE id=? AND ativo=1').get(Number(p.estoque_id))
      : estoques.principal(db);
    const alvoId = alvo ? alvo.id : null;
    db.prepare(`
      INSERT INTO movimentos_estoque (variacao_id, tipo, qtd, custo_unit, motivo, usuario_id, estoque_id)
      VALUES (?,?,?,?,?,?,?)
    `).run(v.id, tipo, qtdMovimento, p.custo_unit || null, p.motivo || null, quem ? quem.id : null, alvoId);
    if (alvoId) estoques.aplicar(db, alvoId, v.id, qtdMovimento);

    // custo médio ponderado do produto (apenas em entradas com custo informado)
    const custoUnit = Number(p.custo_unit) || 0;
    if (tipo === 'entrada' && custoUnit > 0) {
      const atual = v.estoque_produto;
      const custoMedio = atual + qtd > 0
        ? ((atual * v.preco_custo) + (qtd * custoUnit)) / (atual + qtd)
        : custoUnit;
      db.prepare('UPDATE produtos SET preco_custo=? WHERE id=?')
        .run(Math.round(custoMedio * 100) / 100, v.produto_id);
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }

  auditar(db, quem, `estoque_${tipo}`, `variação #${v.id}: ${qtdMovimento > 0 ? '+' : ''}${qtdMovimento}`);
  return { ok: true, estoque: novoEstoque };
}

function kardex(db, p) {
  const filtroProduto = p.produto_id ? 'AND v.produto_id = ?' : '';
  const params = p.produto_id ? [p.produto_id] : [];
  const linhas = db.prepare(`
    SELECT m.id, m.tipo, m.qtd, m.custo_unit, m.motivo, m.criado_em,
           v.cor, v.tamanho, v.codigo_barras,
           pr.nome AS produto, u.nome AS usuario
    FROM movimentos_estoque m
    JOIN variacoes v ON v.id = m.variacao_id
    JOIN produtos pr ON pr.id = v.produto_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE 1=1 ${filtroProduto}
    ORDER BY m.id DESC
    LIMIT ${p.produto_id ? 300 : 100}
  `).all(...params);
  return { ok: true, movimentos: linhas };
}

function reposicao(db) {
  // Alerta por variação: usa mínimo da variação se definido, senão herda o mínimo do produto
  const linhas = db.prepare(`
    SELECT p.id AS produto_id, p.nome, p.referencia, c.nome AS categoria,
           v.id AS variacao_id, v.cor, v.tamanho, v.estoque,
           CASE WHEN v.estoque_minimo > 0 THEN v.estoque_minimo ELSE p.estoque_minimo END AS minimo_efetivo
    FROM variacoes v
    JOIN produtos p ON p.id = v.produto_id
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo = 1 AND v.ativo = 1
      AND (v.estoque_minimo > 0 OR p.estoque_minimo > 0)
      AND v.estoque <= CASE WHEN v.estoque_minimo > 0 THEN v.estoque_minimo ELSE p.estoque_minimo END
    ORDER BY (CASE WHEN v.estoque_minimo > 0 THEN v.estoque_minimo ELSE p.estoque_minimo END - v.estoque) DESC,
             p.nome, v.cor, v.tamanho
  `).all();
  return { ok: true, produtos: linhas };
}

// Lista completo do estoque para exportação (PDF/Excel)
function listarCompleto(db) {
  const linhas = db.prepare(`
    SELECT p.id AS produto_id, p.nome, p.referencia,
           COALESCE(c.nome,'Sem categoria') AS categoria,
           v.id AS variacao_id, v.cor, v.tamanho, v.codigo_barras,
           v.estoque, p.preco_custo, p.preco_venda
    FROM variacoes v
    JOIN produtos p ON p.id = v.produto_id
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE v.ativo = 1 AND p.ativo = 1
    ORDER BY p.nome, v.cor, v.tamanho
  `).all();
  const totalPecas = linhas.reduce((a, l) => a + (l.estoque || 0), 0);
  const totalCusto = linhas.reduce((a, l) => a + (l.estoque || 0) * (l.preco_custo || 0), 0);
  const totalVenda = linhas.reduce((a, l) => a + (l.estoque || 0) * (l.preco_venda || 0), 0);
  return { ok: true, variacoes: linhas, totalPecas,
    totalCusto: Math.round(totalCusto * 100) / 100,
    totalVenda: Math.round(totalVenda * 100) / 100 };
}

export { buscarVariacoes, movimentar, kardex, reposicao, listarCompleto };