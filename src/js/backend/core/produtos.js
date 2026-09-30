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

  // Filtro de consignação (v3.8.0): 'sim' mostra só peça de fornecedor em
  // consignação, 'nao' só peça própria da loja, vazio mostra tudo.
  // `p.consignado` entrou por migração e é 0/1; bancos antigos podem ter NULL,
  // daí o COALESCE — sem ele a peça própria com NULL sumiria dos dois filtros.
  const cons = String(filtro.consignado || '').toLowerCase();
  const consSql = cons === 'sim' ? 'AND COALESCE(p.consignado,0) = 1'
                : cons === 'nao' ? 'AND COALESCE(p.consignado,0) = 0'
                : '';

  const params = [termo, termo, termo];
  if (filtro.categoria_id) params.push(filtro.categoria_id);

  const linhas = db.prepare(`
    SELECT p.id, p.referencia, p.nome, p.preco_custo, p.preco_venda, p.estoque_minimo, p.foto,
           COALESCE(p.consignado,0) AS consignado,
           COALESCE(p.pct_fornecedor,0) AS pct_fornecedor,
           p.fornecedor_id,
           COALESCE(fo.nome,'') AS fornecedor,
           c.nome AS categoria,
           COALESCE((SELECT SUM(v.estoque) FROM variacoes v WHERE v.produto_id = p.id AND v.ativo = 1), 0) AS estoque_total,
           (SELECT COUNT(*) FROM variacoes v WHERE v.produto_id = p.id AND v.ativo = 1) AS qtd_variacoes,
           (SELECT COUNT(*) FROM variacoes v WHERE v.produto_id = p.id AND v.ativo = 1
            AND (v.estoque_minimo > 0 OR p.estoque_minimo > 0)
            AND v.estoque <= CASE WHEN v.estoque_minimo > 0 THEN v.estoque_minimo ELSE p.estoque_minimo END
           ) AS variacoes_abaixo
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN fornecedores fo ON fo.id = p.fornecedor_id
    WHERE p.ativo = 1
      AND (p.nome LIKE ? OR p.referencia LIKE ? OR EXISTS
           (SELECT 1 FROM variacoes v WHERE v.produto_id = p.id AND v.codigo_barras LIKE ?))
      ${catSql}
      ${consSql}
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
  // A rota grava a foto em arquivo ANTES de chamar aqui e passa o NOME do arquivo.
  // Aceitamos também data URI (compatibilidade: banco antigo / caminho de teste).
  let foto = p.foto == null ? null : String(p.foto);
  if (foto) {
    const ehArquivo = /^[\w.\-]+\.(jpe?g|png|webp|gif)$/i.test(foto);
    const ehDataUri = foto.startsWith('data:image/');
    if (!ehArquivo && !ehDataUri) return { ok: false, erro: 'Formato de foto inválido.' };
    if (ehDataUri && foto.length > 1.6e6) return { ok: false, erro: 'Foto muito grande. Use uma imagem menor.' };
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

  // ── Estoque editado direto na grade do produto (v3.26.0) ──────────────────
  //
  // ANTES: o campo Estoque das variações que já existem vinha DESABILITADO na
  // tela (app.js) e este core ignorava o valor — só o estoque inicial de uma
  // variação NOVA era gravado, e sempre no almoxarifado central. Para corrigir
  // 10 → 20 o usuário tinha que sair do produto, abrir o módulo Estoque e mexer
  // variação por variação, depois voltar para imprimir etiqueta.
  //
  // AGORA: o número na grade é o TOTAL NOVO daquela variação. A diferença vira
  // movimento de verdade, com kardex e auditoria. As peças que ENTRAM caem no
  // almoxarifado central (decisão do Marcio: depois transfere pela tela de
  // Estoques), ou no local mandado em `p.estoque_destino_id`.
  //
  // Só ADMIN. O campo fica travado para os outros perfis na tela, mas a trava
  // que vale é esta, no servidor — terminal em rede monta payload à mão.
  const ehAdmin = !!quem && quem.perfil === 'admin';
  const destino = Number(p.estoque_destino_id) > 0
    ? db.prepare('SELECT * FROM estoques WHERE id=? AND ativo=1').get(Number(p.estoque_destino_id))
    : estoques.principal(db);
  // ── Estoque repartido por LOCAL direto no produto (v3.29.0) ─────────────
  //
  // Pedido do Marcio: "em produtos tem que deixar a gente movimentar o estoque
  // completamente. 40 peças: 10 para uma loja, 10 para outra e o resto para o
  // almoxarifado. A única trava é que só o administrador pode mexer."
  //
  // A tela manda, por variação, `saldos = { estoque_id: quantidade QUE DEVE
  // FICAR ali }`. Aqui vira movimento de verdade, com kardex:
  //   • o que sai de um local e aparece em outro → TRANSFERÊNCIA (romaneio;
  //     o total do Salgueiro não muda);
  //   • o que sobra subindo → ENTRADA (peça nova; vai para a etiqueta);
  //   • o que sobra descendo → SAÍDA.
  // Estoque negativo continua não existindo.
  const planos = new Map();                    // variação do payload → [{estoque_id, delta}]
  let locaisAtivos = null;
  const comLocais = variacoes.filter(v => v && v.saldos && typeof v.saldos === 'object');
  if (comLocais.length) {
    if (!ehAdmin) {
      return { ok: false, erro: 'Só administrador pode mexer no estoque pela tela de Produtos.' };
    }
    locaisAtivos = new Map(db.prepare('SELECT id, nome FROM estoques WHERE ativo=1').all()
      .map(e => [Number(e.id), e]));
    for (const v of comLocais) {
      if (v.id && !db.prepare('SELECT 1 FROM variacoes WHERE id=? AND produto_id=? AND ativo=1').get(v.id, p.id)) {
        return { ok: false, erro: 'Uma variação da grade não pertence mais a este produto. Reabra o produto.' };
      }
      const plano = [];
      for (const [k, bruto] of Object.entries(v.saldos)) {
        if (bruto === '' || bruto === null || bruto === undefined) continue;   // não mexe
        const eid = Number(k);
        const local = locaisAtivos.get(eid);
        if (!local) return { ok: false, erro: 'Um dos estoques da grade não existe mais. Reabra o produto.' };
        const alvo = Math.round(Number(bruto));
        if (!Number.isFinite(alvo)) return { ok: false, erro: `Quantidade inválida em ${local.nome}.` };
        const atual = v.id ? estoques.saldo(db, eid, v.id) : 0;
        if (alvo === atual) continue;
        if (alvo < 0) return { ok: false, erro: `Quantidade negativa em ${local.nome} — estoque negativo não existe.` };
        plano.push({ estoque_id: eid, delta: alvo - atual });
      }
      planos.set(v, plano);
    }
  }

  const ajustes = [];
  for (const v of variacoes) {
    if (!v.id) continue;                       // variação nova: segue o caminho do estoque inicial
    if (planos.has(v)) continue;               // estoque veio repartido por local (acima)
    if (v.estoque === undefined || v.estoque === null || String(v.estoque).trim() === '') continue;
    const alvo = Math.round(Number(v.estoque));
    if (!Number.isFinite(alvo) || alvo < 0) {
      return { ok: false, erro: 'Quantidade de estoque inválida na grade.' };
    }
    const atualRow = db.prepare('SELECT estoque FROM variacoes WHERE id=? AND produto_id=? AND ativo=1')
      .get(v.id, p.id);
    if (!atualRow) continue;
    const delta = alvo - Number(atualRow.estoque || 0);
    if (delta === 0) continue;                 // nada mudou (é o caso de quem não é admin)
    if (!ehAdmin) {
      return { ok: false, erro: 'Só administrador pode alterar o estoque pela tela de Produtos.' };
    }
    if (!destino) return { ok: false, erro: 'Nenhum estoque cadastrado para receber a entrada.' };
    // Saída pela grade: a peça sai do local de destino, e ele precisa ter saldo.
    // Sem isso o total cairia e o local ficaria negativo — o que não existe.
    if (delta < 0) {
      const c = estoques.conferirSaldo(db, destino.id, v.id, -delta);
      if (!c.ok) {
        const d = db.prepare('SELECT cor, tamanho FROM variacoes WHERE id=?').get(v.id);
        return { ok: false, erro:
          `Não dá para baixar ${-delta} de ${d ? d.cor + '/' + d.tamanho : 'uma variação'}: `
          + `${c.nome} tem só ${c.saldo}. Baixe pelo local certo em Estoques.` };
      }
    }
    ajustes.push({ variacao_id: v.id, delta, total: alvo });
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
        const vArq = /^[\w.\-]+\.(jpe?g|png|webp|gif)$/i.test(vfoto);
        const vData = vfoto.startsWith('data:image/');
        if ((!vArq && !vData) || (vData && vfoto.length > 1.6e6)) vfoto = undefined;
      }
      if (v.id) {
        const upd = vfoto !== undefined
          ? 'UPDATE variacoes SET cor=?, tamanho=?, estoque_minimo=?, foto=? WHERE id=? AND produto_id=?'
          : 'UPDATE variacoes SET cor=?, tamanho=?, estoque_minimo=? WHERE id=? AND produto_id=?';
        vfoto !== undefined
          ? db.prepare(upd).run(cor, tamanho, minVar, vfoto || null, v.id, produtoId)
          : db.prepare(upd).run(cor, tamanho, minVar, v.id, produtoId);
        idsEnviados.push(v.id);
        v._varId = v.id;
      } else {
        // Se a variação foi excluída antes (ativo=0), reativa em vez de inserir — evita
        // violar o UNIQUE (produto_id, cor, tamanho) que permanece mesmo em soft-delete.
        const inativa = db.prepare(
          'SELECT id FROM variacoes WHERE produto_id=? AND cor=? AND tamanho=? AND ativo=0'
        ).get(produtoId, cor, tamanho);
        let varId;
        if (inativa) {
          if (vfoto !== undefined) {
            db.prepare('UPDATE variacoes SET ativo=1, estoque=0, estoque_minimo=?, foto=? WHERE id=?')
              .run(minVar, vfoto || null, inativa.id);
          } else {
            db.prepare('UPDATE variacoes SET ativo=1, estoque=0, estoque_minimo=? WHERE id=?')
              .run(minVar, inativa.id);
          }
          varId = inativa.id;
        } else {
          const r = db.prepare(
            'INSERT INTO variacoes (produto_id, cor, tamanho, estoque, estoque_minimo, foto) VALUES (?,?,?,0,?,?)'
          ).run(produtoId, cor, tamanho, minVar, vfoto || null);
          varId = Number(r.lastInsertRowid);
        }
        // código de barras: informado ou gerado internamente (EAN-13 iniciado em 2)
        const codigo = String(v.codigo_barras || '').trim() || codigoInterno(varId);
        db.prepare('UPDATE variacoes SET codigo_barras=? WHERE id=?').run(codigo, varId);
        idsEnviados.push(varId);
        v._varId = varId;
        // estoque inicial vira movimento de entrada — a não ser que tenha vindo
        // repartido por local (aí quem grava é o bloco `planos`, mais abaixo)
        const estoqueInicial = planos.has(v) ? 0 : (Number(v.estoque) || 0);
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

    // Aplica as correções de estoque da grade (calculadas antes da transação).
    // `entradas` volta para a tela para imprimir etiqueta SÓ do que entrou.
    const entradas = [];
    for (const a of ajustes) {
      db.prepare('UPDATE variacoes SET estoque=? WHERE id=?').run(a.total, a.variacao_id);
      db.prepare(`
        INSERT INTO movimentos_estoque (variacao_id, tipo, qtd, custo_unit, motivo, usuario_id, estoque_id)
        VALUES (?,?,?,?,?,?,?)
      `).run(a.variacao_id, a.delta > 0 ? 'entrada' : 'saida', a.delta,
             a.delta > 0 ? (Number(p.preco_custo) || null) : null,
             `Correção pela tela de Produtos (total ${a.total})`,
             quem ? quem.id : null, destino.id);
      estoques.aplicarEstrito(db, destino.id, a.variacao_id, a.delta);
      if (a.delta > 0) {
        const d = db.prepare(`SELECT id, cor, tamanho, codigo_barras FROM variacoes WHERE id=?`)
          .get(a.variacao_id);
        if (d) entradas.push({ ...d, estoque: a.delta });
      }
    }

    // Estoque repartido por local (v3.29.0) — ver o bloco `planos` lá em cima.
    let nEnt = 0, nSai = 0, nTrf = 0;
    const tocadas = new Set();
    if (planos.size) {
      const insMov = db.prepare(`INSERT INTO movimentos_estoque
        (variacao_id, tipo, qtd, custo_unit, motivo, usuario_id, estoque_id) VALUES (?,?,?,?,?,?,?)`);
      const quemId = quem ? quem.id : null;
      const custo = Number(p.preco_custo) || null;
      const romaneios = new Map();             // 'origem>destino' → [{variacao_id, qtd}]
      for (const [v, plano] of planos) {
        if (!plano.length) continue;
        const vid = v._varId;
        const sobe  = plano.filter(x => x.delta > 0).map(x => ({ ...x, r: x.delta }));
        const desce = plano.filter(x => x.delta < 0).map(x => ({ ...x, r: -x.delta }));
        // 1) saiu de um local e apareceu em outro = transferência
        for (const d of desce) for (const u of sobe) {
          const q = Math.min(d.r, u.r);
          if (q <= 0) continue;
          d.r -= q; u.r -= q;
          const k = `${d.estoque_id}>${u.estoque_id}`;
          if (!romaneios.has(k)) romaneios.set(k, []);
          romaneios.get(k).push({ variacao_id: vid, qtd: q });
        }
        // 2) o que ainda sobe é peça NOVA entrando
        let entrou = 0;
        for (const u of sobe) {
          if (u.r <= 0) continue;
          insMov.run(vid, 'entrada', u.r, custo,
            v.id ? 'Entrada pela tela de Produtos' : 'Estoque inicial (cadastro)', quemId, u.estoque_id);
          estoques.aplicar(db, u.estoque_id, vid, u.r);
          entrou += u.r; nEnt += u.r;
        }
        // 3) o que ainda desce é peça SAINDO do Salgueiro
        for (const d of desce) {
          if (d.r <= 0) continue;
          insMov.run(vid, 'saida', -d.r, null, 'Saída pela tela de Produtos', quemId, d.estoque_id);
          estoques.aplicarEstrito(db, d.estoque_id, vid, -d.r);
          nSai += d.r;
        }
        if (entrou > 0) {
          const d = db.prepare('SELECT id, cor, tamanho, codigo_barras FROM variacoes WHERE id=?').get(vid);
          if (d) entradas.push({ ...d, estoque: entrou });
        }
        tocadas.add(vid);
      }
      // Um romaneio por par origem → destino, com todas as variações do produto:
      // aparece na lista de Transferências como qualquer outra.
      for (const [k, itens] of romaneios) {
        const [o, d] = k.split('>').map(Number);
        const eo = locaisAtivos.get(o), ed = locaisAtivos.get(d);
        const rt = db.prepare('INSERT INTO transferencias (origem_id, destino_id, usuario_id, obs) VALUES (?,?,?,?)')
          .run(o, d, quemId, `Pela tela de Produtos — #${produtoId} ${nome}`);
        const tid = Number(rt.lastInsertRowid);
        for (const i of itens) {
          db.prepare('INSERT INTO transferencia_itens (transferencia_id, variacao_id, qtd) VALUES (?,?,?)')
            .run(tid, i.variacao_id, i.qtd);
          estoques.aplicarEstrito(db, o, i.variacao_id, -i.qtd);
          estoques.aplicar(db, d, i.variacao_id, i.qtd);
          const mot = `Transf. #${tid}: ${eo.nome} → ${ed.nome}`;
          insMov.run(i.variacao_id, 'transferencia', -i.qtd, null, mot, quemId, o);
          insMov.run(i.variacao_id, 'transferencia', i.qtd, null, mot, quemId, d);
          nTrf += i.qtd;
        }
      }
      // Total do Salgueiro = soma dos locais (mesma regra da zeragem).
      for (const vid of tocadas) {
        db.prepare(`UPDATE variacoes SET estoque = COALESCE(
          (SELECT SUM(qtd) FROM estoque_saldos WHERE variacao_id = ?), 0) WHERE id = ?`).run(vid, vid);
      }
    }

    db.exec('COMMIT');
    auditar(db, quem, p.id ? 'produto_editado' : 'produto_criado', `#${produtoId} ${nome}`);
    if (nEnt || nSai || nTrf) {
      auditar(db, quem, 'estoque_grade_produto',
        `#${produtoId} ${nome}: entraram ${nEnt}, saíram ${nSai}, transferidas ${nTrf}`);
    }
    if (ajustes.length) {
      auditar(db, quem, 'estoque_grade_produto',
        `#${produtoId} ${nome}: ${ajustes.map(a => (a.delta > 0 ? '+' : '') + a.delta).join(', ')} em ${destino.nome}`);
    }
    const partes = [];
    if (nEnt) partes.push(`${nEnt} entraram`);
    if (nTrf) partes.push(`${nTrf} mudaram de estoque`);
    if (nSai) partes.push(`${nSai} saíram`);
    return { ok: true, id: produtoId, entradas, destino: destino ? destino.nome : null,
             resumo_estoque: partes.join(' · ') };
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