// Produtos, categorias e grade (cor × tamanho)
import { codigoInterno, auditar } from './util.js';
import * as estoques from './estoques.js';

// ---- Categorias ------------------------------------------------------------
function listarCategorias(db) {
  const linhas = db.prepare(`
    SELECT c.id, c.nome, c.pai_id,
           (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id = c.id AND p.ativo = 1) AS qtd_produtos
    FROM categorias c WHERE c.ativo = 1 ORDER BY c.nome
  `).all();
  return { ok: true, categorias: linhas };
}

function salvarCategoria(db, p, quem) {
  const nome = String(p.nome || '').trim();
  if (!nome) return { ok: false, erro: 'Informe o nome da categoria.' };
  try {
    if (p.id) {
      db.prepare('UPDATE categorias SET nome=?, pai_id=? WHERE id=?').run(nome, p.pai_id || null, p.id);
      auditar(db, quem, 'categoria_editada', nome);
      return { ok: true, id: p.id };
    }
    // Verifica se existe categoria desativada com o mesmo nome — reativa em vez de criar nova
    const existente = db.prepare('SELECT id FROM categorias WHERE nome=? COLLATE NOCASE').get(nome);
    if (existente) {
      db.prepare('UPDATE categorias SET ativo=1, nome=?, pai_id=? WHERE id=?').run(nome, p.pai_id || null, existente.id);
      auditar(db, quem, 'categoria_reativada', nome);
      return { ok: true, id: existente.id };
    }
    const r = db.prepare('INSERT INTO categorias (nome, pai_id) VALUES (?,?)').run(nome, p.pai_id || null);
    auditar(db, quem, 'categoria_criada', nome);
    return { ok: true, id: Number(r.lastInsertRowid) };
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return { ok: false, erro: 'Já existe uma categoria com esse nome.' };
    throw e;
  }
}

function excluirCategoria(db, id, quem) {
  const emUso = db.prepare('SELECT COUNT(*) AS n FROM produtos WHERE categoria_id=? AND ativo=1').get(id);
  if (emUso.n > 0) return { ok: false, erro: `Há ${emUso.n} produto(s) nesta categoria. Mova-os antes de excluir.` };
  db.prepare('UPDATE categorias SET ativo=0 WHERE id=?').run(id);
  auditar(db, quem, 'categoria_excluida', `#${id}`);
  return { ok: true };
}

// ---- Produtos ---------------------------------------------------------------
function listarProdutos(db, filtro) {
  const termo = `%${String(filtro.busca || '').trim()}%`;
  const catSql = filtro.categoria_id ? 'AND p.categoria_id = ?' : '';
  const params = [termo, termo, termo];
  if (filtro.categoria_id) params.push(filtro.categoria_id);

  const linhas = db.prepare(`
    SELECT p.id, p.referencia, p.nome, p.preco_custo, p.preco_venda, p.estoque_minimo, p.foto,
           c.nome AS categoria,
           COALESCE((SELECT SUM(v.estoque) FROM variacoes v WHERE v.produto_id = p.id AND v.ativo = 1), 0) AS estoque_total,
           (SELECT COUNT(*) FROM variacoes v WHERE v.produto_id = p.id AND v.ativo = 1) AS qtd_variacoes,
           (SELECT COUNT(*) FROM variacoes v WHERE v.produto_id = p.id AND v.ativo = 1
            AND (v.estoque_minimo > 0 OR p.estoque_minimo > 0)
            AND v.estoque <= CASE WHEN v.estoque_minimo > 0 THEN v.estoque_minimo ELSE p.estoque_minimo END
           ) AS variacoes_abaixo
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo = 1
      AND (p.nome LIKE ? OR p.referencia LIKE ? OR EXISTS
           (SELECT 1 FROM variacoes v WHERE v.produto_id = p.id AND v.codigo_barras LIKE ?))
      ${catSql}
    ORDER BY p.nome
    LIMIT 500
  `).all(...params);
  return { ok: true, produtos: linhas };
}

function obterProduto(db, id) {
  const produto = db.prepare('SELECT * FROM produtos WHERE id=?').get(id);
  if (!produto) return { ok: false, erro: 'Produto não encontrado.' };
  const variacoes = db.prepare(
    'SELECT id, cor, tamanho, codigo_barras, estoque, estoque_minimo, foto FROM variacoes WHERE produto_id=? AND ativo=1 ORDER BY cor, tamanho'
  ).all(id);
  return { ok: true, produto, variacoes };
}

function salvarProduto(db, p, quem) {
  const nome = String(p.nome || '').trim();
  if (!nome) return { ok: false, erro: 'Informe o nome do produto.' };
  const precoVenda = Number(p.preco_venda) || 0;
  if (precoVenda <= 0) return { ok: false, erro: 'Informe o preço de venda.' };
  let foto = p.foto == null ? null : String(p.foto);
  if (foto) {
    if (!foto.startsWith('data:image/')) return { ok: false, erro: 'Formato de foto inválido.' };
    if (foto.length > 1.6e6) return { ok: false, erro: 'Foto muito grande. Use uma imagem menor.' };
  }
  // Consignação: fornecedor + percentual do fornecedor (a loja fica com o resto)
  const consignado = p.consignado ? 1 : 0;
  const pctFornecedor = Number(p.pct_fornecedor) || 0;
  const fornecedorId = Number(p.fornecedor_id) || null;
  if (consignado) {
    if (!fornecedorId) return { ok: false, erro: 'Produto consignado precisa de um fornecedor.' };
    if (pctFornecedor <= 0 || pctFornecedor >= 100) {
      return { ok: false, erro: 'Percentual do fornecedor deve ficar entre 1 e 99.' };
    }
  }

  const variacoes = Array.isArray(p.variacoes) && p.variacoes.length
    ? p.variacoes
    // Produto salvo sem nenhuma linha na grade: cria a variação padrão.
    // O estoque vem de `p.estoque_inicial` quando a tela mandar — assim quem
    // digita só a quantidade não perde o número (ver app.js).
    : [{ cor: 'Única', tamanho: 'U', estoque: Number(p.estoque_inicial) || 0 }];

  // valida duplicidade cor+tamanho no formulário
  const chaves = new Set();
  for (const v of variacoes) {
    const chave = `${String(v.cor || 'Única').trim().toLowerCase()}|${String(v.tamanho || 'U').trim().toLowerCase()}`;
    if (chaves.has(chave)) return { ok: false, erro: `Variação repetida: ${v.cor} / ${v.tamanho}.` };
    chaves.add(chave);
  }

  db.exec('BEGIN');
  try {
    let produtoId = p.id;
    if (produtoId) {
      db.prepare(`
        UPDATE produtos SET referencia=?, nome=?, categoria_id=?, preco_custo=?, preco_venda=?,
               estoque_minimo=?, foto=?, fornecedor_id=?, consignado=?, pct_fornecedor=?,
               atualizado_em=datetime('now','localtime') WHERE id=?
      `).run(p.referencia || null, nome, p.categoria_id || null,
             Number(p.preco_custo) || 0, precoVenda, Number(p.estoque_minimo) || 0, foto,
             fornecedorId, consignado, consignado ? pctFornecedor : 0, produtoId);
    } else {
      const r = db.prepare(`
        INSERT INTO produtos (referencia, nome, categoria_id, preco_custo, preco_venda, estoque_minimo, foto,
                              fornecedor_id, consignado, pct_fornecedor)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(p.referencia || null, nome, p.categoria_id || null,
             Number(p.preco_custo) || 0, precoVenda, Number(p.estoque_minimo) || 0, foto,
             fornecedorId, consignado, consignado ? pctFornecedor : 0);
      produtoId = Number(r.lastInsertRowid);
    }

    const idsEnviados = [];
    for (const v of variacoes) {
      const cor = String(v.cor || 'Única').trim() || 'Única';
      const tamanho = String(v.tamanho || 'U').trim() || 'U';
      const minVar = Number(v.estoque_minimo) || 0;
      // foto da variação: valida e normaliza igual à foto do produto
      let vfoto = v.foto == null ? undefined : String(v.foto);
      if (vfoto) {
        if (!vfoto.startsWith('data:image/') || vfoto.length > 1.6e6) vfoto = undefined;
      }
      if (v.id) {
        const upd = vfoto !== undefined
          ? 'UPDATE variacoes SET cor=?, tamanho=?, estoque_minimo=?, foto=? WHERE id=? AND produto_id=?'
          : 'UPDATE variacoes SET cor=?, tamanho=?, estoque_minimo=? WHERE id=? AND produto_id=?';
        vfoto !== undefined
          ? db.prepare(upd).run(cor, tamanho, minVar, vfoto || null, v.id, produtoId)
          : db.prepare(upd).run(cor, tamanho, minVar, v.id, produtoId);
        idsEnviados.push(v.id);
      } else {
        const r = db.prepare(
          'INSERT INTO variacoes (produto_id, cor, tamanho, estoque, estoque_minimo, foto) VALUES (?,?,?,0,?,?)'
        ).run(produtoId, cor, tamanho, minVar, vfoto || null);
        const varId = Number(r.lastInsertRowid);
        // código de barras: informado ou gerado internamente (EAN-13 iniciado em 2)
        const codigo = String(v.codigo_barras || '').trim() || codigoInterno(varId);
        db.prepare('UPDATE variacoes SET codigo_barras=? WHERE id=?').run(codigo, varId);
        idsEnviados.push(varId);
        // estoque inicial vira movimento de entrada
        const estoqueInicial = Number(v.estoque) || 0;
        if (estoqueInicial > 0) {
          db.prepare('UPDATE variacoes SET estoque=? WHERE id=?').run(estoqueInicial, varId);
          const central = estoques.principal(db); // estoque inicial entra no central
          db.prepare(`
            INSERT INTO movimentos_estoque (variacao_id, tipo, qtd, custo_unit, motivo, usuario_id, estoque_id)
            VALUES (?,?,?,?,?,?,?)
          `).run(varId, 'entrada', estoqueInicial, Number(p.preco_custo) || 0,
                 'Estoque inicial (cadastro)', quem ? quem.id : null, central ? central.id : null);
          if (central) estoques.aplicar(db, central.id, varId, estoqueInicial);
        }
      }
    }
    // variações removidas no formulário → desativa (histórico preservado)
    if (p.id) {
      const atuais = db.prepare('SELECT id FROM variacoes WHERE produto_id=? AND ativo=1').all(produtoId);
      for (const a of atuais) {
        if (!idsEnviados.includes(a.id)) {
          db.prepare('UPDATE variacoes SET ativo=0 WHERE id=?').run(a.id);
        }
      }
    }

    db.exec('COMMIT');
    auditar(db, quem, p.id ? 'produto_editado' : 'produto_criado', `#${produtoId} ${nome}`);
    return { ok: true, id: produtoId };
  } catch (e) {
    db.exec('ROLLBACK');
    if (String(e.message).includes('UNIQUE') && String(e.message).includes('codigo_barras')) {
      return { ok: false, erro: 'Código de barras já usado em outro produto.' };
    }
    throw e;
  }
}

function excluirProduto(db, id, quem) {
  db.prepare('UPDATE produtos SET ativo=0 WHERE id=?').run(id);
  auditar(db, quem, 'produto_excluido', `#${id}`);
  return { ok: true };
}

export {
  listarCategorias, salvarCategoria, excluirCategoria,
  listarProdutos, obterProduto, salvarProduto, excluirProduto
};