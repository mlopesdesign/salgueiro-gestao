// Locais de estoque — almoxarifado central, loja(s), pessoa que pegou peças
// para vender, venda online…
//
// REGRA DE OURO: `variacoes.estoque` continua sendo o TOTAL do Salgueiro e é a
// fonte de verdade para tudo que já existia (PDV, dashboard, relatórios,
// etiquetas). Os locais apenas repartem esse total em `estoque_saldos`:
//
//   total (variacoes.estoque) = soma dos saldos de todos os locais
//
//   • Entrada de compra    → total +N  e  saldo do almoxarifado +N
//   • Venda                → total −N  e  saldo do local que vendeu −N
//   • Transferência        → total igual; origem −N, destino +N
//
// Assim o balanço da loja sempre fecha contra o total.
import { auditar } from './util.js';

const arred = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ── Locais ──────────────────────────────────────────────────────────────────
function listar(db, p) {
  const todos = p && p.todos;
  const linhas = db.prepare(`
    SELECT e.id, e.nome, e.tipo, e.loja_id, e.responsavel, e.principal, e.ativo,
           COALESCE(s.pecas, 0) AS pecas,
           COALESCE(s.itens, 0) AS itens
    FROM estoques e
    LEFT JOIN (
      SELECT estoque_id, SUM(qtd) pecas, COUNT(*) itens
      FROM estoque_saldos WHERE qtd <> 0 GROUP BY estoque_id
    ) s ON s.estoque_id = e.id
    ${todos ? '' : 'WHERE e.ativo = 1'}
    ORDER BY e.principal DESC, e.tipo, e.nome
  `).all();
  for (const l of linhas) l.pecas = arred(l.pecas);
  return { ok: true, estoques: linhas };
}

function principal(db) {
  return db.prepare('SELECT * FROM estoques WHERE principal=1 AND ativo=1 LIMIT 1').get()
      || db.prepare('SELECT * FROM estoques WHERE ativo=1 ORDER BY id LIMIT 1').get()
      || null;
}

// Estoque ligado a uma loja; se não houver, cai no almoxarifado central.
function daLoja(db, lojaId) {
  // Cada loja tem lojas.estoque_id apontando para qual estoque usar nas vendas.
  // Fallback para o Almoxarifado Central se a coluna ainda não existir (cold start).
  if (lojaId) {
    try {
      const loja = db.prepare('SELECT estoque_id FROM lojas WHERE id=?').get(lojaId);
      if (loja && loja.estoque_id) {
        const e = db.prepare('SELECT * FROM estoques WHERE id=? AND ativo=1').get(loja.estoque_id);
        if (e) return e;
      }
    } catch { /* coluna ainda não existe — a migração ainda não rodou */ }
  }
  return principal(db);
}

function salvar(db, p, quem) {
  const nome = String(p && p.nome || '').trim();
  if (!nome) return { ok: false, erro: 'Informe o nome do estoque.' };
  const tipos = ['almoxarifado', 'loja', 'pessoa', 'online', 'outro'];
  const tipo = tipos.includes(p.tipo) ? p.tipo : 'outro';
  const resp = String(p.responsavel || '').trim() || null;
  const dup = db.prepare('SELECT id, ativo FROM estoques WHERE LOWER(nome)=LOWER(?) AND id<>?')
    .get(nome, Number(p.id) || 0);
  if (dup) {
    if (!dup.ativo) {  // reativa em vez de reclamar
      db.prepare('UPDATE estoques SET ativo=1, tipo=?, responsavel=? WHERE id=?').run(tipo, resp, dup.id);
      auditar(db, quem, 'estoque_local_reativado', nome);
      return { ok: true, id: dup.id, reativado: true };
    }
    return { ok: false, erro: 'Já existe um estoque com esse nome.' };
  }
  if (p.id) {
    db.prepare('UPDATE estoques SET nome=?, tipo=?, responsavel=? WHERE id=?')
      .run(nome, tipo, resp, Number(p.id));
    auditar(db, quem, 'estoque_local_editado', nome);
    return { ok: true, id: Number(p.id) };
  }
  const r = db.prepare('INSERT INTO estoques (nome, tipo, loja_id, responsavel) VALUES (?,?,?,?)')
    .run(nome, tipo, Number(p.loja_id) || null, resp);
  auditar(db, quem, 'estoque_local_criado', nome);
  return { ok: true, id: Number(r.lastInsertRowid) };
}

function desativar(db, id, quem) {
  const e = db.prepare('SELECT * FROM estoques WHERE id=?').get(Number(id));
  if (!e) return { ok: false, erro: 'Estoque não encontrado.' };
  if (e.principal) return { ok: false, erro: 'O almoxarifado central não pode ser desativado.' };
  const saldo = db.prepare('SELECT COALESCE(SUM(qtd),0) n FROM estoque_saldos WHERE estoque_id=?').get(Number(id));
  if ((saldo.n || 0) > 0) {
    return { ok: false, erro: `Este estoque ainda tem ${arred(saldo.n)} peça(s). Transfira tudo antes de desativar.` };
  }
  db.prepare('UPDATE estoques SET ativo=0 WHERE id=?').run(Number(id));
  auditar(db, quem, 'estoque_local_desativado', e.nome);
  return { ok: true };
}

// Cria (ou reaproveita) o estoque de uma loja. Chamado ao criar a loja.
function garantirDaLoja(db, lojaId, nomeLoja) {
  const ex = db.prepare('SELECT id FROM estoques WHERE loja_id=?').get(Number(lojaId));
  if (ex) { db.prepare('UPDATE estoques SET ativo=1 WHERE id=?').run(ex.id); return ex.id; }
  // não repetir "Loja" quando a loja já se chama "Loja Quadra"
  const cru = String(nomeLoja || '').trim();
  const nome = /^loja\b/i.test(cru) ? cru : `Loja ${cru}`.trim();
  let final = nome, n = 2;
  while (db.prepare('SELECT 1 FROM estoques WHERE LOWER(nome)=LOWER(?)').get(final)) final = `${nome} (${n++})`;
  const r = db.prepare("INSERT INTO estoques (nome, tipo, loja_id) VALUES (?,'loja',?)")
    .run(final, Number(lojaId));
  return Number(r.lastInsertRowid);
}

// ── Saldos ──────────────────────────────────────────────────────────────────
function saldo(db, estoqueId, variacaoId) {
  const r = db.prepare('SELECT qtd FROM estoque_saldos WHERE estoque_id=? AND variacao_id=?')
    .get(Number(estoqueId), Number(variacaoId));
  return r ? Number(r.qtd) : 0;
}

// Soma `delta` (pode ser negativo) ao saldo do local. NÃO mexe no total.
function aplicar(db, estoqueId, variacaoId, delta) {
  if (!estoqueId || !delta) return;
  db.prepare(`INSERT INTO estoque_saldos (estoque_id, variacao_id, qtd) VALUES (?,?,?)
              ON CONFLICT(estoque_id, variacao_id) DO UPDATE SET qtd = qtd + excluded.qtd`)
    .run(Number(estoqueId), Number(variacaoId), arred(delta));
}

// Saldo de uma variação em cada local (para a tela de Estoque)
function porVariacao(db, variacaoId) {
  return db.prepare(`
    SELECT e.id, e.nome, e.tipo, COALESCE(s.qtd,0) qtd
    FROM estoques e
    LEFT JOIN estoque_saldos s ON s.estoque_id = e.id AND s.variacao_id = ?
    WHERE e.ativo = 1
    ORDER BY e.principal DESC, e.tipo, e.nome
  `).all(Number(variacaoId));
}

// Listagem completa de um local, para conferência/balanço.
// Traz também as linhas zeradas (peça que já esteve aqui e saiu): a tela filtra
// e por padrão esconde, mas o usuário pode pedir "somente zerados" para conferir
// o que acabou naquele local. (v3.25.39)
function conteudo(db, p) {
  const id = Number(p && p.estoque_id) || 0;
  if (!id) return { ok: false, erro: 'Informe o estoque.' };
  const e = db.prepare('SELECT * FROM estoques WHERE id=?').get(id);
  if (!e) return { ok: false, erro: 'Estoque não encontrado.' };
  const itens = db.prepare(`
    SELECT s.variacao_id, s.qtd, pr.id AS produto_id, pr.nome produto, COALESCE(pr.referencia,'') referencia,
           COALESCE(c.nome,'Sem categoria') categoria,
           va.cor, va.tamanho, COALESCE(va.codigo_barras,'') codigo_barras,
           pr.preco_custo, pr.preco_venda, va.estoque AS total_geral,
           COALESCE(va.foto, pr.foto) AS foto,
           COALESCE(pr.consignado,0) AS consignado,
           pr.fornecedor_id,
           COALESCE(fo.nome,'') AS fornecedor
    FROM estoque_saldos s
    JOIN variacoes va ON va.id = s.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    LEFT JOIN categorias c ON c.id = pr.categoria_id
    LEFT JOIN fornecedores fo ON fo.id = pr.fornecedor_id
    WHERE s.estoque_id = ?
    ORDER BY pr.nome, va.cor, va.tamanho
  `).all(id);
  const comSaldo = itens.filter(i => i.qtd !== 0);
  const pecas = arred(comSaldo.reduce((s, i) => s + i.qtd, 0));
  const custo = arred(comSaldo.reduce((s, i) => s + i.qtd * (i.preco_custo || 0), 0));
  const venda = arred(comSaldo.reduce((s, i) => s + i.qtd * (i.preco_venda || 0), 0));
  return { ok: true, estoque: e, itens, totais: { pecas, custo, venda, itens: comSaldo.length, zerados: itens.length - comSaldo.length } };
}

// Variações de UM produto com o saldo no local escolhido (v3.5.0).
// A transferência antes obrigava a achar peça por peça na busca: um produto com
// 6 cores × 5 tamanhos exigia 30 buscas. Agora escolhe-se o PRODUTO e a grade
// inteira aparece de uma vez, cada linha com o que há na origem.
function variacoesNoLocal(db, p) {
  const produtoId = Number(p && p.produto_id) || 0;
  const estoqueId = Number(p && p.estoque_id) || 0;
  if (!produtoId) return { ok: false, erro: 'Informe o produto.' };
  const prod = db.prepare(
    'SELECT id, nome, COALESCE(referencia,\'\') referencia, preco_venda FROM produtos WHERE id=?'
  ).get(produtoId);
  if (!prod) return { ok: false, erro: 'Produto não encontrado.' };

  const variacoes = db.prepare(`
    SELECT va.id, va.cor, va.tamanho, COALESCE(va.codigo_barras,'') codigo_barras,
           va.estoque AS total_geral,
           COALESCE((SELECT s.qtd FROM estoque_saldos s
                      WHERE s.variacao_id = va.id AND s.estoque_id = ?), 0) AS disponivel
    FROM variacoes va
    WHERE va.produto_id = ? AND va.ativo = 1
    ORDER BY va.cor, va.tamanho
  `).all(estoqueId, produtoId);

  return {
    ok: true, produto: prod, variacoes,
    total_local: arred(variacoes.reduce((s, v) => s + (Number(v.disponivel) || 0), 0))
  };
}

// ── Transferência (romaneio) ────────────────────────────────────────────────
function transferir(db, p, quem) {
  const origem = Number(p && p.origem_id) || 0;
  const destino = Number(p && p.destino_id) || 0;
  const itens = Array.isArray(p && p.itens) ? p.itens : [];
  if (!origem || !destino) return { ok: false, erro: 'Escolha o estoque de origem e o de destino.' };
  if (origem === destino) return { ok: false, erro: 'Origem e destino precisam ser diferentes.' };
  if (!itens.length) return { ok: false, erro: 'Adicione ao menos uma peça para transferir.' };

  const eo = db.prepare('SELECT * FROM estoques WHERE id=? AND ativo=1').get(origem);
  const ed = db.prepare('SELECT * FROM estoques WHERE id=? AND ativo=1').get(destino);
  if (!eo || !ed) return { ok: false, erro: 'Estoque de origem ou destino não encontrado.' };

  // valida tudo ANTES de gravar qualquer coisa
  const limpos = [];
  for (const i of itens) {
    const vid = Number(i.variacao_id) || 0;
    const qtd = arred(i.qtd);
    if (!vid || !(qtd > 0)) return { ok: false, erro: 'Peça com quantidade inválida.' };
    const disp = saldo(db, origem, vid);
    if (qtd > disp) {
      const v = db.prepare(`SELECT pr.nome, va.cor, va.tamanho FROM variacoes va
        JOIN produtos pr ON pr.id=va.produto_id WHERE va.id=?`).get(vid);
      const nome = v ? `${v.nome} (${v.cor}/${v.tamanho})` : `variação ${vid}`;
      return { ok: false, erro: `${nome}: ${eo.nome} tem só ${arred(disp)} peça(s), você pediu ${qtd}.` };
    }
    limpos.push({ variacao_id: vid, qtd });
  }

  db.exec('BEGIN');
  try {
    const r = db.prepare('INSERT INTO transferencias (origem_id, destino_id, usuario_id, obs) VALUES (?,?,?,?)')
      .run(origem, destino, quem ? quem.id : null, String(p.obs || '').trim() || null);
    const id = Number(r.lastInsertRowid);
    const insItem = db.prepare('INSERT INTO transferencia_itens (transferencia_id, variacao_id, qtd) VALUES (?,?,?)');
    const insMov = db.prepare(`INSERT INTO movimentos_estoque
      (variacao_id, tipo, qtd, motivo, usuario_id, estoque_id) VALUES (?,?,?,?,?,?)`);
    for (const i of limpos) {
      insItem.run(id, i.variacao_id, i.qtd);
      aplicar(db, origem, i.variacao_id, -i.qtd);
      aplicar(db, destino, i.variacao_id, i.qtd);
      // o total NÃO muda numa transferência — só o local
      insMov.run(i.variacao_id, 'transferencia', -i.qtd,
        `Transf. #${id}: ${eo.nome} → ${ed.nome}`, quem ? quem.id : null, origem);
      insMov.run(i.variacao_id, 'transferencia', i.qtd,
        `Transf. #${id}: ${eo.nome} → ${ed.nome}`, quem ? quem.id : null, destino);
    }
    db.exec('COMMIT');
    auditar(db, quem, 'transferencia_estoque', `#${id} ${eo.nome} → ${ed.nome} (${limpos.length} item(ns))`);
    return { ok: true, id, origem: eo.nome, destino: ed.nome };
  } catch (e) { db.exec('ROLLBACK'); return { ok: false, erro: e.message }; }
}

// Esvaziar a origem: move o saldo INTEIRO de CADA variação (positivo E negativo)
// para o destino, de modo que a origem fique EXATAMENTE zerada e o total da loja
// (variacoes.estoque) não mude. É o "Levar tudo da origem" — a transferência
// item-a-item só move quantidades positivas e deixava saldos negativos para trás,
// fazendo a origem terminar negativa. Aqui a origem zera sempre.
function transferirTudo(db, p, quem) {
  const origem = Number(p && p.origem_id) || 0;
  const destino = Number(p && p.destino_id) || 0;
  if (!origem || !destino) return { ok: false, erro: 'Escolha o estoque de origem e o de destino.' };
  if (origem === destino) return { ok: false, erro: 'Origem e destino precisam ser diferentes.' };
  const eo = db.prepare('SELECT * FROM estoques WHERE id=? AND ativo=1').get(origem);
  const ed = db.prepare('SELECT * FROM estoques WHERE id=? AND ativo=1').get(destino);
  if (!eo || !ed) return { ok: false, erro: 'Estoque de origem ou destino não encontrado.' };

  const rows = db.prepare('SELECT variacao_id, qtd FROM estoque_saldos WHERE estoque_id=? AND qtd<>0').all(origem);
  if (!rows.length) return { ok: false, erro: `Não há nada em ${eo.nome} para transferir.` };

  db.exec('BEGIN');
  try {
    const r = db.prepare('INSERT INTO transferencias (origem_id, destino_id, usuario_id, obs) VALUES (?,?,?,?)')
      .run(origem, destino, quem ? quem.id : null, String(p.obs || '').trim() || null);
    const id = Number(r.lastInsertRowid);
    const insItem = db.prepare('INSERT INTO transferencia_itens (transferencia_id, variacao_id, qtd) VALUES (?,?,?)');
    const insMov = db.prepare(`INSERT INTO movimentos_estoque
      (variacao_id, tipo, qtd, motivo, usuario_id, estoque_id) VALUES (?,?,?,?,?,?)`);
    let pecas = 0, negativos = 0;
    for (const row of rows) {
      const q = arred(row.qtd);              // saldo inteiro (pode ser negativo)
      if (q < 0) negativos++;
      pecas = arred(pecas + q);
      insItem.run(id, row.variacao_id, q);
      aplicar(db, origem, row.variacao_id, -q);   // origem − saldo  ⇒  origem = 0
      aplicar(db, destino, row.variacao_id, q);   // destino + saldo (total intacto)
      insMov.run(row.variacao_id, 'transferencia', -q,
        `Transf. #${id} (tudo): ${eo.nome} → ${ed.nome}`, quem ? quem.id : null, origem);
      insMov.run(row.variacao_id, 'transferencia', q,
        `Transf. #${id} (tudo): ${eo.nome} → ${ed.nome}`, quem ? quem.id : null, destino);
    }
    db.exec('COMMIT');
    auditar(db, quem, 'transferencia_estoque_tudo',
      `#${id} ${eo.nome} → ${ed.nome} (${rows.length} itens, ${negativos} negativo(s), origem zerada)`);
    return { ok: true, id, origem: eo.nome, destino: ed.nome, itens: rows.length, pecas, negativos };
  } catch (e) { db.exec('ROLLBACK'); return { ok: false, erro: e.message }; }
}

function listarTransferencias(db, p) {
  const limite = Number(p && p.limite) || 50;
  const linhas = db.prepare(`
    SELECT t.id, t.criado_em, t.obs,
           eo.nome origem, ed.nome destino, COALESCE(u.nome,'') usuario,
           COALESCE(SUM(ti.qtd),0) pecas, COUNT(ti.id) itens
    FROM transferencias t
    JOIN estoques eo ON eo.id = t.origem_id
    JOIN estoques ed ON ed.id = t.destino_id
    LEFT JOIN usuarios u ON u.id = t.usuario_id
    LEFT JOIN transferencia_itens ti ON ti.transferencia_id = t.id
    GROUP BY t.id ORDER BY t.id DESC LIMIT ?
  `).all(limite);
  for (const l of linhas) l.pecas = arred(l.pecas);
  return { ok: true, transferencias: linhas };
}

function obterTransferencia(db, id) {
  const t = db.prepare(`
    SELECT t.*, eo.nome origem, ed.nome destino, COALESCE(u.nome,'') usuario
    FROM transferencias t
    JOIN estoques eo ON eo.id = t.origem_id
    JOIN estoques ed ON ed.id = t.destino_id
    LEFT JOIN usuarios u ON u.id = t.usuario_id
    WHERE t.id=?`).get(Number(id));
  if (!t) return { ok: false, erro: 'Romaneio não encontrado.' };
  const itens = db.prepare(`
    SELECT ti.qtd, pr.nome produto, COALESCE(pr.referencia,'') referencia,
           va.cor, va.tamanho, COALESCE(va.codigo_barras,'') codigo_barras
    FROM transferencia_itens ti
    JOIN variacoes va ON va.id = ti.variacao_id
    JOIN produtos pr ON pr.id = va.produto_id
    WHERE ti.transferencia_id=? ORDER BY pr.nome, va.cor, va.tamanho`).all(Number(id));
  return { ok: true, transferencia: t, itens, pecas: arred(itens.reduce((s, i) => s + i.qtd, 0)) };
}

export {
  variacoesNoLocal,
  listar, principal, daLoja, salvar, desativar, garantirDaLoja,
  saldo, aplicar, porVariacao, conteudo,
  transferir, transferirTudo, listarTransferencias, obterTransferencia, arred
};
