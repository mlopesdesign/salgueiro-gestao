// CAIXA POR COMPUTADOR (v3.31.1)
// ---------------------------------------------------------------------------
// Relato do Marcio: "o PDV está trocando de loja sozinho... as pessoas estão
// trabalhando na loja principal, quando vem a venda está sendo feita na loja
// errada. Cada computador trabalha com seu PDV, sendo ele web ou não, e não
// interfere no outro jamais."
//
// A CAUSA: o sistema tinha UM caixa aberto para todo mundo. Toda consulta era
// "o último caixa aberto" (`WHERE fechado_em IS NULL ORDER BY id DESC LIMIT 1`).
// O computador principal e o navegador do Camarote usavam o MESMO caixa: quando
// um trocava de loja, o outro passava a vender na loja dele; quando um abria
// caixa, o outro passava a usar o novo; quando um fechava, fechava o dos dois.
//
// AGORA: cada caixa pertence a um computador/navegador (`caixas.terminal`).
// O terminal é identificado por um código guardado no próprio aparelho
// (app.js → `_terminal` em todo pedido). Toda consulta de "caixa aberto"
// passa por AQUI e procura SÓ o caixa daquele terminal. Nunca há "último caixa
// aberto de qualquer um" — essa consulta não pode voltar a existir.

// Código do terminal de um pedido. `__SALG_TERMINAL_TESTE` existe SÓ para os
// testes automáticos (testes/harness.mjs) — o sistema nunca o define.
export function terminalDe(terminal) {
  return String(terminal || globalThis.__SALG_TERMINAL_TESTE || '').trim();
}

export function caixaDoTerminal(db, terminal) {
  const t = terminalDe(terminal);
  if (!t) return null;
  return db.prepare(`
    SELECT cx.*, u.nome AS aberto_por, lj.nome AS loja,
           COALESCE(lj.sem_desconto,0) AS loja_sem_desconto,
           COALESCE(lj.usa_frete,0) AS loja_usa_frete
      FROM caixas cx
      LEFT JOIN usuarios u ON u.id = cx.usuario_abertura
      LEFT JOIN lojas lj ON lj.id = cx.loja_id
     WHERE cx.fechado_em IS NULL AND cx.terminal = ?
     ORDER BY cx.id DESC LIMIT 1
  `).get(t) || null;
}

// Caixas abertos que NÃO são deste terminal — para a tela de abertura poder
// oferecer "assumir" (computador formatado, navegador limpo, ou o caixa que
// estava aberto antes desta versão, que não tinha dono).
export function caixasDeOutros(db, terminal) {
  const t = terminalDe(terminal);
  return db.prepare(`
    SELECT cx.id, cx.aberto_em, cx.valor_abertura, cx.terminal, cx.terminal_desc,
           u.nome AS aberto_por, lj.nome AS loja,
           (SELECT COUNT(*) FROM vendas v WHERE v.caixa_id = cx.id) AS vendas
      FROM caixas cx
      LEFT JOIN usuarios u ON u.id = cx.usuario_abertura
      LEFT JOIN lojas lj ON lj.id = cx.loja_id
     WHERE cx.fechado_em IS NULL AND (cx.terminal IS NULL OR cx.terminal <> ?)
     ORDER BY cx.id DESC
  `).all(t);
}

export function descricaoTerminal(p) {
  if (p && p._rede) return `navegador ${p._ip || ''}`.trim();
  return 'computador principal (programa instalado)';
}

// CAIXA ESQUECIDO ABERTO (v3.35.0). Regra única usada pelo painel, pelo PDV e
// pelo aviso ao fechar o sistema. Em out/2026 um caixa ficou aberto de sexta a
// segunda. Um expediente (mesmo de evento, 20h → 4h) não passa de 14 horas.
export const CAIXA_HORAS_ALERTA = 14;
export function horasAberto(caixa, agora) {
  if (!caixa || !caixa.aberto_em) return 0;
  const ini = new Date(String(caixa.aberto_em).replace(' ', 'T')).getTime();
  if (!Number.isFinite(ini)) return 0;
  return Math.max(0, ((agora || Date.now()) - ini) / 3600000);
}
export function textoCaixaAberto(caixa, agora) {
  const h = horasAberto(caixa, agora);
  const d = String(caixa.aberto_em || '');
  const quando = d ? `${d.slice(8, 10)}/${d.slice(5, 7)} às ${d.slice(11, 16)}` : '—';
  const tempo = h >= 48 ? `${Math.floor(h / 24)} dias` : h >= 1 ? `${Math.floor(h)} h` : `${Math.max(1, Math.round(h * 60))} min`;
  return { horas: h, quando, tempo, esquecido: h >= CAIXA_HORAS_ALERTA };
}
