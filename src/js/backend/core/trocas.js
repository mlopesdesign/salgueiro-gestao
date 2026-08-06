// Troca direta: devolução + nova venda em uma única transação atômica.
// Crédito da devolução abate o valor dos novos itens.
//
// Diferença (novo > crédito) → cliente paga a diferença (pagamento extra).
// Excedente (crédito > novo)  → destino escolhido pelo operador:
//     'vale'     → emite vale-troca (com validade)
//     'dinheiro' → sai da gaveta (sangria no caixa)
//     'estorno'  → só registro (o estorno é feito na maquininha)
//     'nada'     → nenhum acerto (a loja fica com o excedente)
// Sem diferença (mesmo valor) → nada a fazer.
//
// ARMADILHAS JÁ PAGAS (não reintroduzir):
//  · `vendas` NÃO tem coluna `fechado_em` — o INSERT quebrava toda troca.
//  · `venda_pagamentos.forma` só aceita 'troca' a partir da migração v3.2.0.
//  · `caixa_movimentos.tipo` aceita apenas 'sangria'/'suprimento'. Venda em
//    dinheiro NÃO entra ali: `resumoCaixa` já soma por `venda_pagamentos`.
//  · O SELECT da venda precisa trazer `loja_id`, senão `estoques.daLoja()`
//    recebe undefined e `estoque_saldos` deixa de bater com `variacoes.estoque`.
import * as valesTroca from './vales_troca.js';
import { auditar } from './util.js';
import * as estoques from './estoques.js';
const arred = n => Math.round((Number(n) || 0) * 100) / 100;

const DESTINOS = ['vale', 'dinheiro', 'estorno', 'nada'];

function moedaF(v) {
  return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');
}

function registrar(db, p, quem) {
  // ── 1. Validar venda de origem ──────────────────────────────────────────────
  const venda = db.prepare(
    'SELECT id, status, cliente_id, loja_id, total, subtotal, desconto FROM vendas WHERE id=?'
  ).get(p.venda_id);
  if (!venda) return { ok: false, erro: 'Venda de origem não encontrada.' };
  if (venda.status !== 'concluida') return { ok: false, erro: 'Só é possível trocar itens de vendas concluídas.' };

  const sub = arred(Number(venda.subtotal) || 0);
  const tot = arred(Number(venda.total) || 0);
  const fator = sub > 0 ? tot / sub : 1; // proporciona desconto geral da venda original

  // REGRA (decidida pelo Marcio em 04/08/2026): o desconto da compra original
  // acompanha a troca. Se a cliente comprou uma peça de R$100 com 10% e volta
  // para trocar por outra de R$100, o TOTAL TEM QUE SER O MESMO — ela não pode
  // ser cobrada dos R$10. Antes o crédito saía líquido (com desconto) e a peça
  // nova entrava pelo preço cheio de tabela: a troca por peça igual cobrava a
  // diferença do desconto.
  // O mesmo percentual vale para a peça nova INTEIRA, inclusive a parte que
  // exceder o crédito.
  // Cortesia (total 0) fica de fora: o fator seria 0 e a peça nova sairia de
  // graça. Nesse caso a peça nova vai pelo preço de tabela.
  const fatorNovo = (sub > 0 && tot > 0) ? tot / sub : 1;
  const pctDesconto = Math.round((1 - fatorNovo) * 10000) / 100; // ex.: 10 = 10%

  // ── 2. Itens que voltaram ───────────────────────────────────────────────────
  const itensDevolver = (p.itens_devolver || []).filter(i => Number(i.qtd) > 0);
  if (!itensDevolver.length) return { ok: false, erro: 'Selecione os itens que voltaram.' };

  const devInfos = [];
  let credito = 0;
  const getDisp = db.prepare(`
    SELECT vi.variacao_id, vi.qtd, vi.total,
           COALESCE((SELECT SUM(di.qtd) FROM devolucao_itens di
             JOIN devolucoes d ON d.id=di.devolucao_id
             WHERE d.venda_id=vi.venda_id AND di.variacao_id=vi.variacao_id),0) AS devolvido
    FROM venda_itens vi WHERE vi.venda_id=? AND vi.variacao_id=?
  `);
  for (const it of itensDevolver) {
    const vi = getDisp.get(p.venda_id, it.variacao_id);
    if (!vi) return { ok: false, erro: 'Item não pertence a esta venda.' };
    const disp = vi.qtd - vi.devolvido;
    if (it.qtd > disp) return { ok: false, erro: `Quantidade acima do disponível (${disp} disponíveis).` };
    const valorUnit = arred((vi.total / vi.qtd) * fator);
    const total = arred(it.qtd * valorUnit);
    devInfos.push({ variacao_id: it.variacao_id, qtd: it.qtd, valor_unit: valorUnit, total });
    credito += total;
  }
  credito = arred(credito);

  // ── 3. Itens novos (o que o cliente vai levar) ──────────────────────────────
  // `itens_novo[].preco_unit` é sempre o preço de TABELA. O desconto herdado é
  // aplicado aqui, no backend — fonte de verdade única. A tela só exibe.
  const itensNovo = (p.itens_novo || []).filter(i => Number(i.qtd) > 0);
  let subtotalNovo = 0, totalNovo = 0;
  const novosInfos = [];
  for (const it of itensNovo) {
    const va = db.prepare(`
      SELECT va.id, va.estoque, p.nome, p.preco_venda, p.preco_custo
      FROM variacoes va JOIN produtos p ON p.id=va.produto_id WHERE va.id=?
    `).get(it.variacao_id);
    if (!va) return { ok: false, erro: `Produto de variação ${it.variacao_id} não encontrado.` };
    if (va.estoque < it.qtd) return { ok: false, erro: `Estoque insuficiente: ${va.nome} (tem ${va.estoque}).` };
    const precoTabela = arred(Number(it.preco_unit) || va.preco_venda || 0);
    const precoComDesc = arred(precoTabela * fatorNovo);
    const bruto = arred(it.qtd * precoTabela);
    const tt = arred(it.qtd * precoComDesc);
    novosInfos.push({
      variacao_id: it.variacao_id, qtd: it.qtd,
      preco_tabela: precoTabela, preco_unit: precoComDesc,
      bruto, total: tt
    });
    subtotalNovo += bruto;
    totalNovo += tt;
  }
  subtotalNovo = arred(subtotalNovo);
  totalNovo = arred(totalNovo);
  const descontoNovo = arred(subtotalNovo - totalNovo);

  // ── 4. Diferença, pagamentos extras e destino do excedente ─────────────────
  const diferenca = arred(totalNovo - credito); // > 0 → cliente paga; < 0 → excedente
  const extras = (p.pagamentos_extra || []).filter(pg => Number(pg.valor) > 0);
  if (diferenca > 0.01) {
    const totalPago = arred(extras.reduce((s, pg) => s + Number(pg.valor), 0));
    if (totalPago < diferenca - 0.01) {
      return { ok: false, erro: `Diferença de ${moedaF(diferenca)} não coberta pelos pagamentos.` };
    }
  }
  const excedente = arred(credito - totalNovo);
  const destino = DESTINOS.includes(p.destino_excedente) ? p.destino_excedente : 'vale';

  // ── 5. Transação ────────────────────────────────────────────────────────────
  // Peça devolvida volta e peça nova sai do mesmo local da venda de origem
  const _local = estoques.daLoja(db, venda.loja_id);
  const _localId = _local ? _local.id : null;
  db.exec('BEGIN');
  try {
    const caixa = db.prepare(
      'SELECT id, loja_id FROM caixas WHERE fechado_em IS NULL ORDER BY id DESC LIMIT 1'
    ).get();
    if (!caixa) { db.exec('ROLLBACK'); return { ok: false, erro: 'Nenhum caixa aberto. Abra o caixa antes de fazer trocas.' }; }

    // 5a. Criar devolução. forma_reembolso guarda o destino do excedente
    // ('troca' quando não sobrou nada) — é o que o histórico e os relatórios leem.
    const formaReembolso = excedente > 0.01 ? destino : 'troca';
    const rd = db.prepare(`
      INSERT INTO devolucoes (venda_id, cliente_id, usuario_id, caixa_id, tipo, valor_devolvido, forma_reembolso, motivo)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(venda.id, venda.cliente_id, quem?.id || null, caixa.id,
           'troca', credito, formaReembolso, p.motivo || 'Troca');
    const devId = Number(rd.lastInsertRowid);

    const insDevItem = db.prepare(
      'INSERT INTO devolucao_itens (devolucao_id, variacao_id, qtd, valor_unit, total) VALUES (?,?,?,?,?)'
    );
    for (const it of devInfos) {
      insDevItem.run(devId, it.variacao_id, it.qtd, it.valor_unit, it.total);
      db.prepare('UPDATE variacoes SET estoque=estoque+? WHERE id=?').run(it.qtd, it.variacao_id);
      db.prepare('INSERT INTO movimentos_estoque (variacao_id, tipo, qtd, motivo, usuario_id, estoque_id) VALUES (?,?,?,?,?,?)')
        .run(it.variacao_id, 'devolucao', it.qtd, `Troca (venda #${venda.id})`, quem?.id || null, _localId);
      if (_localId) estoques.aplicar(db, _localId, it.variacao_id, it.qtd);
    }

    // 5b. Criar nova venda (se houver itens novos)
    let novaVendaId = null;
    let vale = null;

    if (novosInfos.length > 0) {
      // ATENÇÃO: `vendas` não tem `fechado_em`. Colunas idênticas às de
      // pdv.registrarVenda, incluindo loja_id (relatórios por loja dependem dele).
      // subtotal = preços de tabela · desconto = o herdado · total = já líquido.
      // Gravar assim mantém o mesmo formato de pdv.registrarVenda, então
      // `devolucoes.itensVenda` recalcula o fator certo se ESTA venda for
      // trocada de novo — o desconto se propaga por toda a cadeia de trocas.
      const rv = db.prepare(`
        INSERT INTO vendas (caixa_id, loja_id, cliente_id, usuario_id, subtotal, desconto, total, obs, status)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(caixa.id, venda.loja_id || caixa.loja_id || null,
             p.cliente_id || venda.cliente_id || null, quem?.id || null,
             subtotalNovo, descontoNovo, totalNovo,
             `Troca — venda origem #${venda.id}` +
             (descontoNovo > 0 ? ` (desconto de ${pctDesconto}% herdado da compra)` : ''),
             'concluida');
      novaVendaId = Number(rv.lastInsertRowid);

      for (const it of novosInfos) {
        // venda_itens guarda o preço de TABELA e total BRUTO; o desconto fica em
        // vendas.desconto e é proporcionado na leitura — exatamente como faz
        // pdv.registrarVenda com o desconto geral. Gravar líquido aqui aplicaria
        // o desconto duas vezes numa devolução futura.
        db.prepare(
          'INSERT INTO venda_itens (venda_id, variacao_id, qtd, preco_unit, desconto, total) VALUES (?,?,?,?,?,?)'
        ).run(novaVendaId, it.variacao_id, it.qtd, it.preco_tabela, 0, it.bruto);
        db.prepare('UPDATE variacoes SET estoque=estoque-? WHERE id=?').run(it.qtd, it.variacao_id);
        db.prepare('INSERT INTO movimentos_estoque (variacao_id, tipo, qtd, motivo, usuario_id, estoque_id) VALUES (?,?,?,?,?,?)')
          .run(it.variacao_id, 'venda', -it.qtd, `Troca (nova venda #${novaVendaId})`, quem?.id || null, _localId);
        if (_localId) estoques.aplicar(db, _localId, it.variacao_id, -it.qtd);
      }

      // Pagamento: crédito da troca (abate automático)
      const creditoAplicado = arred(Math.min(credito, totalNovo));
      if (creditoAplicado > 0) {
        db.prepare('INSERT INTO venda_pagamentos (venda_id, forma, valor, parcelas, troco) VALUES (?,?,?,?,?)')
          .run(novaVendaId, 'troca', creditoAplicado, 1, 0);
      }

      // Pagamentos extras do cliente (diferença).
      // NÃO lançar em caixa_movimentos: o CHECK só aceita sangria/suprimento e
      // `resumoCaixa` já soma o dinheiro da venda por `venda_pagamentos`.
      for (const pg of extras) {
        const v = arred(Number(pg.valor));
        db.prepare('INSERT INTO venda_pagamentos (venda_id, forma, valor, parcelas, troco) VALUES (?,?,?,?,?)')
          .run(novaVendaId, pg.forma, v, pg.parcelas || 1, 0);
      }
    }

    // 5c. Destino do excedente (crédito > totalNovo)
    let excedentePago = 0;
    if (excedente > 0.01) {
      if (destino === 'vale') {
        vale = valesTroca.criar(db,
          { valor: excedente, clienteId: venda.cliente_id || null, devolucaoId: devId },
          quem
        );
      } else if (destino === 'dinheiro') {
        // dinheiro devolvido sai da gaveta — mesmo rito da devolução comum
        db.prepare('INSERT INTO caixa_movimentos (caixa_id, tipo, valor, motivo, usuario_id) VALUES (?,?,?,?,?)')
          .run(caixa.id, 'sangria', excedente, `Troca venda #${venda.id} — diferença devolvida`, quem?.id || null);
        excedentePago = excedente;
      } else if (destino === 'estorno') {
        // estorno é feito na maquininha; aqui fica só o registro na devolução
        excedentePago = excedente;
      }
      // 'nada': o cliente abriu mão da diferença — nenhum lançamento
    }

    db.exec('COMMIT');
    auditar(db, quem, 'troca_registrada',
      `dev#${devId} orig#${venda.id}${novaVendaId ? ` nova#${novaVendaId}` : ''}` +
      (excedente > 0.01 ? ` exced ${moedaF(excedente)} → ${destino}` : ''));
    return {
      ok: true,
      devolucao_id: devId,
      venda_nova_id: novaVendaId,
      credito,
      subtotal_novo: subtotalNovo,
      desconto_herdado: descontoNovo,
      pct_desconto: pctDesconto,
      total_novo: totalNovo,
      diferenca,
      excedente,
      destino_excedente: excedente > 0.01 ? destino : null,
      excedente_pago: excedentePago,
      vale
    };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export { registrar, DESTINOS };
