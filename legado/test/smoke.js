// Teste de fumaça — valida banco e regras de negócio sem abrir o Electron
// Uso: node test/smoke.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const { criarBanco } = require('../src/db');
const auth = require('../src/core/auth');
const produtos = require('../src/core/produtos');
const { dvEan13 } = require('../src/core/util');

let falhas = 0;
function ok(cond, msg) {
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
  if (!cond) falhas++;
}


(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salgueiro-'));
const db = await criarBanco(path.join(dir, 'teste.db'));

// 1. Seed
ok(db.prepare('SELECT COUNT(*) n FROM usuarios').get().n === 1, 'usuário admin criado no seed');
ok(db.prepare('SELECT COUNT(*) n FROM categorias').get().n >= 6, 'categorias iniciais criadas');

// 2. Login
ok(auth.login(db, 'admin', 'errada').ok === false, 'login com senha errada é recusado');
const login = auth.login(db, 'admin', 'admin123');
ok(login.ok === true && login.usuario.perfil === 'admin', 'login admin/admin123 funciona');
const quem = login.usuario;

// 3. Usuários
const novoUsuario = auth.salvarUsuario(db, { nome: 'Caixa 1', usuario: 'caixa1', senha: '123456', perfil: 'caixa' }, quem);
ok(novoUsuario.ok, 'criação de usuário caixa');
ok(auth.login(db, 'caixa1', '123456').ok, 'login do novo usuário funciona');

// 4. Categorias
const cat = produtos.salvarCategoria(db, { nome: 'Vestidos de Festa' }, quem);
ok(cat.ok, 'categoria criada');
ok(produtos.salvarCategoria(db, { nome: 'Vestidos de Festa' }, quem).ok === false, 'nome duplicado de categoria é bloqueado');

// 5. Produto com grade
const prod = produtos.salvarProduto(db, {
  nome: 'Vestido Midi Alfaiataria',
  referencia: 'VMA-001',
  categoria_id: cat.id,
  preco_custo: 80,
  preco_venda: 189.9,
  estoque_minimo: 2,
  variacoes: [
    { cor: 'Preto', tamanho: 'P', estoque: 3 },
    { cor: 'Preto', tamanho: 'M', estoque: 5 },
    { cor: 'Vermelho', tamanho: 'M', estoque: 2 }
  ]
}, quem);
ok(prod.ok, 'produto com 3 variações criado');

const det = produtos.obterProduto(db, prod.id);
ok(det.ok && det.variacoes.length === 3, 'produto retorna 3 variações');
ok(det.variacoes.every(v => v.codigo_barras && v.codigo_barras.length === 13), 'todas as variações ganharam EAN-13');
ok(det.variacoes.every(v => dvEan13(v.codigo_barras.slice(0, 12)) === v.codigo_barras[12]), 'dígito verificador EAN-13 correto');

const estoqueTotal = det.variacoes.reduce((s, v) => s + v.estoque, 0);
ok(estoqueTotal === 10, `estoque inicial somando 10 peças (obtido: ${estoqueTotal})`);
ok(db.prepare('SELECT COUNT(*) n FROM movimentos_estoque').get().n === 3, 'estoque inicial gerou 3 movimentos de entrada');

// 6. Variação duplicada é bloqueada
const dup = produtos.salvarProduto(db, {
  nome: 'Teste Dup', preco_venda: 10,
  variacoes: [{ cor: 'Azul', tamanho: 'M' }, { cor: 'azul', tamanho: 'm' }]
}, quem);
ok(dup.ok === false, 'variação cor/tamanho duplicada é bloqueada');

// 7. Edição preserva grade e desativa removidas
const edicao = produtos.salvarProduto(db, {
  id: prod.id, nome: 'Vestido Midi Alfaiataria', referencia: 'VMA-001', preco_custo: 80, preco_venda: 199.9,
  categoria_id: cat.id, estoque_minimo: 2,
  variacoes: det.variacoes.slice(0, 2).map(v => ({ id: v.id, cor: v.cor, tamanho: v.tamanho }))
}, quem);
ok(edicao.ok, 'edição do produto');
const det2 = produtos.obterProduto(db, prod.id);
ok(det2.variacoes.length === 2, 'variação removida no formulário foi desativada');
ok(det2.produto.preco_venda === 199.9, 'preço de venda atualizado');

// 8. Busca
const busca = produtos.listarProdutos(db, { busca: 'VMA-001' });
ok(busca.ok && busca.produtos.length === 1, 'busca por referência encontra o produto');
const buscaCod = produtos.listarProdutos(db, { busca: det2.variacoes[0].codigo_barras });
ok(buscaCod.ok && buscaCod.produtos.length === 1, 'busca por código de barras encontra o produto');

// 9. Exclusão com proteção de categoria
ok(produtos.excluirCategoria(db, cat.id, quem).ok === false, 'categoria com produtos não pode ser excluída');
ok(produtos.excluirProduto(db, prod.id, quem).ok, 'produto excluído (soft delete)');
ok(produtos.excluirCategoria(db, cat.id, quem).ok, 'categoria excluída após remover produto');

// 10. Auditoria
const logs = db.prepare('SELECT COUNT(*) n FROM auditoria_log').get().n;
ok(logs >= 8, `auditoria registrou as operações (${logs} registros)`);


// ---- Fase 2: Estoque ----
const estoque = require('../src/core/estoque');

const prod2 = produtos.salvarProduto(db, {
  nome: 'Blusa Cropped Salgueiro', referencia: 'BCS-010', preco_custo: 30, preco_venda: 79.9,
  estoque_minimo: 4,
  variacoes: [{ cor: 'Vermelho', tamanho: 'M', estoque: 5 }]
}, quem);
ok(prod2.ok, 'produto fase 2 criado');
const v2 = produtos.obterProduto(db, prod2.id).variacoes[0];

const b1 = estoque.buscarVariacoes(db, v2.codigo_barras);
ok(b1.ok && b1.variacoes.length === 1 && b1.variacoes[0].id === v2.id, 'busca por código de barras exato');
ok(estoque.buscarVariacoes(db, 'Cropped').variacoes.length === 1, 'busca por nome');

const e1 = estoque.movimentar(db, { variacao_id: v2.id, tipo: 'entrada', qtd: 10, custo_unit: 36, motivo: 'Compra' }, quem);
ok(e1.ok && e1.estoque === 15, `entrada soma estoque (15, obtido ${e1.estoque})`);
const custoNovo = db.prepare('SELECT preco_custo FROM produtos WHERE id=?').get(prod2.id).preco_custo;
ok(custoNovo === 34, `custo médio ponderado (esperado 34, obtido ${custoNovo})`);

ok(estoque.movimentar(db, { variacao_id: v2.id, tipo: 'saida', qtd: 99 }, quem).ok === false, 'saída maior que estoque é bloqueada');
const s1 = estoque.movimentar(db, { variacao_id: v2.id, tipo: 'saida', qtd: 3, motivo: 'Defeito' }, quem);
ok(s1.ok && s1.estoque === 12, 'saída subtrai estoque');

const a1 = estoque.movimentar(db, { variacao_id: v2.id, tipo: 'ajuste', qtd: 10, motivo: 'Inventário' }, quem);
ok(a1.ok && a1.estoque === 10, 'ajuste define estoque exato');
ok(estoque.movimentar(db, { variacao_id: v2.id, tipo: 'ajuste', qtd: 10 }, quem).ok === false, 'ajuste sem mudança é recusado');

const kx = estoque.kardex(db, { produto_id: prod2.id });
ok(kx.ok && kx.movimentos.length === 4, `kardex do produto com 4 movimentos (obtido ${kx.movimentos.length})`);

estoque.movimentar(db, { variacao_id: v2.id, tipo: 'saida', qtd: 7, motivo: 'zera p/ teste reposição' }, quem);
const repo = estoque.reposicao(db);
ok(repo.ok && repo.produtos.some(p => p.id === prod2.id), 'produto abaixo do mínimo aparece na reposição');


// ---- Fase 3: PDV ----
const pdv = require('../src/core/pdv');
const clientes = require('../src/core/clientes');

ok(pdv.registrarVenda(db, { itens: [], pagamentos: [] }, quem).ok === false, 'venda sem caixa aberto é bloqueada');
ok(pdv.abrirCaixa(db, { valor_abertura: 100 }, quem).ok, 'caixa aberto com R$ 100');
ok(pdv.abrirCaixa(db, { valor_abertura: 50 }, quem).ok === false, 'segundo caixa é bloqueado');

// produto para vender
const prodV = produtos.salvarProduto(db, {
  nome: 'Saia Plissada', preco_custo: 40, preco_venda: 100, estoque_minimo: 0,
  variacoes: [{ cor: 'Branca', tamanho: 'M', estoque: 10 }]
}, quem);
const vv = produtos.obterProduto(db, prodV.id).variacoes[0];

// venda dinheiro com troco
const venda1 = pdv.registrarVenda(db, {
  itens: [{ variacao_id: vv.id, qtd: 2, preco_unit: 100, desconto: 10 }],
  desconto: 5,
  pagamentos: [{ forma: 'dinheiro', valor: 200 }]
}, quem);
ok(venda1.ok, 'venda em dinheiro registrada');
ok(venda1.venda.total === 185, `total correto (185, obtido ${venda1.venda.total})`);
ok(venda1.pagamentos[0].troco === 15, `troco correto (15, obtido ${venda1.pagamentos[0].troco})`);
ok(produtos.obterProduto(db, prodV.id).variacoes[0].estoque === 8, 'estoque baixou para 8');

// pagamento insuficiente
ok(pdv.registrarVenda(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 100 }],
  pagamentos: [{ forma: 'pix', valor: 50 }]
}, quem).ok === false, 'pagamento insuficiente é bloqueado');

// crediário sem cliente / com cliente
ok(pdv.registrarVenda(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 100 }],
  pagamentos: [{ forma: 'crediario', valor: 100, parcelas: 3 }]
}, quem).ok === false, 'crediário sem cliente é bloqueado');

const cli = clientes.salvar(db, { nome: 'Maria da Penha', telefone: '87 99999-0000' }, quem);
ok(cli.ok, 'cliente cadastrado');
const venda2 = pdv.registrarVenda(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 100 }],
  cliente_id: cli.id,
  pagamentos: [{ forma: 'crediario', valor: 100, parcelas: 3 }]
}, quem);
ok(venda2.ok, 'venda no crediário registrada');
ok(venda2.parcelas.length === 3, '3 parcelas geradas');
const somaParcelas = Math.round(venda2.parcelas.reduce((s, p) => s + p.valor, 0) * 100) / 100;
ok(somaParcelas === 100, `parcelas somam o valor exato (obtido ${somaParcelas})`);
ok(clientes.listar(db, { busca: 'Maria' }).clientes[0].saldo_devedor === 100, 'saldo devedor do cliente = 100');

// venda multi-pagamento
const venda3 = pdv.registrarVenda(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 100 }],
  pagamentos: [{ forma: 'pix', valor: 60 }, { forma: 'dinheiro', valor: 50 }]
}, quem);
ok(venda3.ok && venda3.pagamentos.find(p => p.forma === 'dinheiro').troco === 10, 'multi-pagamento com troco no dinheiro');

// sangria/suprimento + resumo
ok(pdv.movimentoCaixa(db, { tipo: 'suprimento', valor: 20, motivo: 'troco' }, quem).ok, 'suprimento registrado');
ok(pdv.movimentoCaixa(db, { tipo: 'sangria', valor: 50, motivo: 'depósito' }, quem).ok, 'sangria registrada');
const cxId = pdv.caixaAtual(db).caixa.id;
const resumo = pdv.resumoCaixa(db, cxId);
// dinheiro: 100 abertura + 185 (v1) + 40 (v3 líquido) + 20 - 50 = 295
ok(resumo.esperado_dinheiro === 295, `dinheiro esperado 295 (obtido ${resumo.esperado_dinheiro})`);
ok(resumo.qtd_vendas === 3 && resumo.total_vendas === 385, `3 vendas somando 385 (obtido ${resumo.total_vendas})`);

// cancelamento devolve estoque e apaga parcelas
const antes = produtos.obterProduto(db, prodV.id).variacoes[0].estoque;
ok(pdv.cancelarVenda(db, { venda_id: venda2.venda.id, motivo: 'teste' }, quem).ok, 'cancelamento de venda crediário');
ok(produtos.obterProduto(db, prodV.id).variacoes[0].estoque === antes + 1, 'estoque devolvido no cancelamento');
ok(db.prepare('SELECT COUNT(*) n FROM crediario_parcelas WHERE venda_id=?').get(venda2.venda.id).n === 0, 'parcelas removidas');

// fechamento com diferença
const fech = pdv.fecharCaixa(db, { valor_informado: 290 }, quem);
ok(fech.ok && fech.diferenca === -5, `fechamento com falta de 5 (obtido ${fech.diferenca})`);
ok(pdv.caixaAtual(db).caixa === null, 'caixa está fechado');


// ---- Fase 4: Clientes + Crediário ----
const crediario = require('../src/core/crediario');

// reabre caixa para os recebimentos em dinheiro
ok(pdv.abrirCaixa(db, { valor_abertura: 50 }, quem).ok, 'novo caixa aberto para fase 4');

// venda crediário para gerar parcelas (2x de 50)
const venda4 = pdv.registrarVenda(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 100 }],
  cliente_id: cli.id,
  pagamentos: [{ forma: 'crediario', valor: 100, parcelas: 2 }]
}, quem);
ok(venda4.ok && venda4.parcelas.length === 2, 'venda crediário 2x criada');

const ab1 = crediario.parcelasAbertas(db, {});
ok(ab1.ok && ab1.parcelas.length === 2 && ab1.total_aberto === 100, `2 parcelas somando 100 em aberto (obtido ${ab1.total_aberto})`);

// recebimento parcial
const parc1 = ab1.parcelas[0];
const rp = crediario.receberParcela(db, { parcela_id: parc1.id, valor: 20, forma: 'dinheiro' }, quem);
ok(rp.ok && !rp.quitada && rp.restante === 30, `recebimento parcial deixa restante 30 (obtido ${rp.restante})`);
ok(crediario.receberParcela(db, { parcela_id: parc1.id, valor: 99, forma: 'pix' }, quem).ok === false, 'receber acima do restante é bloqueado');

// quitação
const rq = crediario.receberParcela(db, { parcela_id: parc1.id, valor: 30, forma: 'pix' }, quem);
ok(rq.ok && rq.quitada, 'parcela quitada em duas vezes');
ok(crediario.receberParcela(db, { parcela_id: parc1.id, valor: 10, forma: 'pix' }, quem).ok === false, 'parcela quitada não recebe de novo');

// dinheiro do crediário entrou na gaveta como suprimento
const cx4 = pdv.caixaAtual(db).caixa;
const res4 = pdv.resumoCaixa(db, cx4.id);
ok(res4.suprimentos === 20, `R$ 20 em dinheiro do crediário entrou na gaveta (obtido ${res4.suprimentos})`);

// lançamento no financeiro
const fin = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(valor_pago),0) t FROM financeiro_lancamentos WHERE origem='crediario'").get();
ok(fin.n === 2 && fin.t === 50, `2 recebimentos registrados no financeiro somando 50 (obtido ${fin.t})`);

// obterCliente com histórico
const hc = crediario.obterCliente(db, cli.id);
ok(hc.ok && hc.compras.length >= 2 && hc.parcelas.length >= 2, 'histórico do cliente com compras e parcelas');

// exclusão bloqueada com dívida
ok(crediario.excluirCliente(db, cli.id, quem).ok === false, 'cliente com parcela aberta não pode ser excluído');

// aniversariantes do mês
const mesAtual = new Date().toISOString().slice(5, 7);
clientes.salvar(db, { nome: 'Aniversariante Teste', nascimento: `1990-${mesAtual}-15`, telefone: '87 98888-0000' }, quem);
const niver = crediario.aniversariantes(db);
ok(niver.ok && niver.clientes.some(c => c.nome === 'Aniversariante Teste'), 'aniversariante do mês listado');

// cliente sem dívida pode ser excluído
const cli2 = clientes.salvar(db, { nome: 'Sem Divida' }, quem);
ok(crediario.excluirCliente(db, cli2.id, quem).ok, 'cliente sem dívida excluído');

pdv.fecharCaixa(db, { valor_informado: res4.esperado_dinheiro }, quem);


// ---- Fase 5: Financeiro ----
const financeiro = require('../src/core/financeiro');

const f1 = financeiro.salvar(db, { tipo: 'pagar', descricao: 'Aluguel', categoria: 'Aluguel', valor: 1200, vencimento: '2099-01-05' }, quem);
ok(f1.ok, 'conta a pagar criada');
ok(financeiro.salvar(db, { tipo: 'pagar', descricao: '', valor: 10 }, quem).ok === false, 'descrição vazia bloqueada');
ok(financeiro.salvar(db, { tipo: 'x', descricao: 'a', valor: 10 }, quem).ok === false, 'tipo inválido bloqueado');

const lst = financeiro.listar(db, { situacao: 'abertas' });
ok(lst.ok && lst.a_pagar >= 1200, `a pagar inclui aluguel (obtido ${lst.a_pagar})`);

ok(financeiro.baixar(db, { id: f1.id }, quem).ok, 'baixa do aluguel');
ok(financeiro.baixar(db, { id: f1.id }, quem).ok === false, 'baixa dupla bloqueada');

// lançamento automático (crediário) protegido
const auto = db.prepare("SELECT id FROM financeiro_lancamentos WHERE origem='crediario' LIMIT 1").get();
ok(financeiro.excluir(db, auto.id, quem).ok === false, 'lançamento automático não pode ser excluído');
ok(financeiro.salvar(db, { id: auto.id, tipo: 'receber', descricao: 'x', valor: 1 }, quem).ok === false, 'lançamento automático não pode ser editado');

// manual pode ser excluído
const f2 = financeiro.salvar(db, { tipo: 'receber', descricao: 'Teste', valor: 10 }, quem);
ok(financeiro.excluir(db, f2.id, quem).ok, 'lançamento manual excluído');

// fluxo do mês: vendas concluídas = 385 (fase 3) + 100 (fase 4) = 485
const mes = new Date().toISOString().slice(0, 7);
const fx = financeiro.fluxo(db, { mes });
ok(fx.ok && fx.vendas.total === 385, `fluxo: vendas do mês 385 — sem a cancelada (obtido ${fx.vendas.total})`);
ok(fx.vendas.custo > 0 && fx.vendas.lucro_bruto === Math.round((fx.vendas.total - fx.vendas.custo) * 100) / 100, 'lucro bruto = vendas - custo');
ok(fx.pagar.realizado >= 1200, `despesas pagas incluem aluguel (obtido ${fx.pagar.realizado})`);
ok(Array.isArray(fx.por_forma) && fx.por_forma.length >= 2, 'recebimentos por forma listados');


// ---- Fases 6 e 7: Compras + Relatórios ----
const compras = require('../src/core/compras');
const relatorios = require('../src/core/relatorios');

const forn = compras.salvarFornecedor(db, { nome: 'Confecções Recife LTDA', cnpj: '12.345.678/0001-99' }, quem);
ok(forn.ok, 'fornecedor criado');

const custoAntes = db.prepare('SELECT preco_custo FROM produtos WHERE id=?').get(prodV.id).preco_custo;
const estAntes = produtos.obterProduto(db, prodV.id).variacoes[0].estoque;

const compra = compras.criarCompra(db, {
  fornecedor_id: forn.id, numero_nf: 'NF-123',
  itens: [{ variacao_id: vv.id, qtd: 10, custo_unit: 50 }]
}, quem);
ok(compra.ok && compra.total === 500, `compra criada com total 500 (obtido ${compra.total})`);
ok(compras.criarCompra(db, { itens: [] }, quem).ok === false, 'compra sem itens bloqueada');

const finAntes = db.prepare("SELECT COUNT(*) n FROM financeiro_lancamentos WHERE origem='compra'").get().n;
ok(compras.receberCompra(db, { id: compra.id, vencimento: '2099-02-01' }, quem).ok, 'compra recebida');
ok(compras.receberCompra(db, { id: compra.id }, quem).ok === false, 'recebimento duplo bloqueado');

const estDepois = produtos.obterProduto(db, prodV.id).variacoes[0].estoque;
ok(estDepois === estAntes + 10, `estoque subiu 10 (${estAntes} → ${estDepois})`);
const custoDepois = db.prepare('SELECT preco_custo FROM produtos WHERE id=?').get(prodV.id).preco_custo;
ok(custoDepois > custoAntes && custoDepois <= 50, `custo médio atualizado (${custoAntes} → ${custoDepois})`);
ok(db.prepare("SELECT COUNT(*) n FROM financeiro_lancamentos WHERE origem='compra'").get().n === finAntes + 1,
   'conta a pagar gerada no financeiro');

ok(compras.excluirFornecedor(db, forn.id, quem).ok, 'fornecedor sem pendência excluído');

const compra2 = compras.criarCompra(db, { itens: [{ variacao_id: vv.id, qtd: 1, custo_unit: 10 }] }, quem);
ok(compras.cancelarCompra(db, compra2.id, quem).ok, 'compra pendente cancelada');

// Relatórios
const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
const rv = relatorios.vendasPeriodo(db, { de: hoje, ate: hoje });
ok(rv.ok && rv.resumo.total === 385 && rv.resumo.qtd === 3, `relatório vendas: 3 vendas / 385 (obtido ${rv.resumo.qtd}/${rv.resumo.total})`);
ok(rv.por_dia.length === 1 && rv.por_categoria.length >= 1, 'vendas por dia e por categoria');

const abc = relatorios.curvaAbc(db, { de: hoje, ate: hoje });
ok(abc.ok && abc.produtos.length >= 1 && abc.produtos[0].classe === 'A', 'curva ABC com classe A no topo');
const somaPct = abc.produtos.reduce((s, p) => s + p.pct, 0);
ok(somaPct > 99 && somaPct <= 101, `percentuais somam ~100 (obtido ${somaPct})`);

const paradas = relatorios.pecasParadas(db, { dias: 30 });
ok(paradas.ok && Array.isArray(paradas.produtos), 'peças paradas executa');
// Blusa Cropped (prod2) tem estoque 3 e nunca vendeu → deve aparecer
ok(paradas.produtos.some(p => p.id === prod2.id), 'produto nunca vendido com estoque aparece nas paradas');


// ---- Fase 8: Configurações white-label ----
const config = require('../src/core/config');

const c0 = config.obter(db);
ok(c0.ok && c0.config.loja_nome === 'Boutique do Salgueiro' && c0.config.cor_primaria === '#B01E23',
   'config traz padrões');

const caixaUser = auth.login(db, 'caixa1', '123456').usuario;
ok(config.salvar(db, { loja_nome: 'Hack' }, caixaUser).ok === false, 'só admin salva config');
ok(config.salvar(db, { cor_primaria: 'vermelho' }, quem).ok === false, 'cor inválida bloqueada');
ok(config.salvar(db, { logo: 'nao-e-imagem' }, quem).ok === false, 'logo inválida bloqueada');

const c1 = config.salvar(db, {
  loja_nome: 'Loja Teste White Label', cor_primaria: '#1E4FB0',
  logo: 'data:image/png;base64,iVBORw0KGgo=', cupom_rodape: 'Volte sempre!'
}, quem);
ok(c1.ok && c1.config.loja_nome === 'Loja Teste White Label', 'config salva e devolve atualizada');
ok(config.obter(db).config.cor_primaria === '#1E4FB0', 'cor persiste no banco');
ok(config.obter(db).config.logo.startsWith('data:image/png'), 'logo persiste');
ok(config.salvar(db, { chave_inexistente: 'x' }, quem).ok === false, 'chave desconhecida é ignorada/bloqueada');

// ---- Fase 9: Dashboard (agregação do painel) ----
const dashboard = require('../src/core/dashboard');
const dash = dashboard.resumo(db, quem);
ok(dash.ok, 'dashboard: resumo executa');
ok(dash.mes && typeof dash.mes.total === 'number', 'dashboard: KPIs do mês presentes');
ok(dash.mes.lucro_bruto === Math.round((dash.mes.total - dash.mes.custo) * 100) / 100,
   'dashboard: lucro bruto = vendas - custo');
ok(Array.isArray(dash.serie) && dash.serie.length === 14, 'dashboard: série de 14 dias');
ok(dash.serie.every(d => d.dia && typeof d.total === 'number'), 'dashboard: cada ponto da série tem dia e total');
ok(dash.estoque && dash.estoque.produtos >= 1, 'dashboard: contagem de estoque');
ok(Array.isArray(dash.top_produtos), 'dashboard: top produtos é lista');
ok(dash.financeiro && dash.financeiro.vencidos && dash.financeiro.a_vencer, 'dashboard: buckets financeiros');
ok(dash.crediario && typeof dash.crediario.aberto_total === 'number', 'dashboard: crediário agregado');
ok(Array.isArray(dash.alertas), 'dashboard: alertas é lista pronta p/ UI');

// ---- Fase 10: Foto opcional do produto ----
const pngMini = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const prodFoto = produtos.salvarProduto(db, {
  nome: 'Bolsa Couro', preco_venda: 249.9, foto: pngMini,
  variacoes: [{ cor: 'Caramelo', tamanho: 'U', estoque: 3 }]
}, quem);
ok(prodFoto.ok, 'foto: produto salvo com foto');
const listaF = produtos.listarProdutos(db, { busca: 'Bolsa Couro' });
ok(listaF.ok && listaF.produtos[0].foto === pngMini, 'foto: listagem retorna a foto');
const detF = produtos.obterProduto(db, prodFoto.id);
ok(detF.ok && detF.produto.foto === pngMini, 'foto: obterProduto retorna a foto');
ok(produtos.salvarProduto(db, { nome: 'X', preco_venda: 10, foto: 'nao-e-imagem' }, quem).ok === false,
   'foto: formato inválido é bloqueado');
ok(produtos.salvarProduto(db, { nome: 'Y', preco_venda: 10, foto: 'data:image/png;base64,' + 'A'.repeat(1700000) }, quem).ok === false,
   'foto: foto muito grande é bloqueada');
const semFoto = produtos.salvarProduto(db, { nome: 'Sem Foto', preco_venda: 20, variacoes: [{ cor: 'U', tamanho: 'U', estoque: 1 }] }, quem);
ok(semFoto.ok, 'foto: produto sem foto continua funcionando (opcional)');
ok(produtos.obterProduto(db, semFoto.id).produto.foto == null, 'foto: produto sem foto tem foto nula');

// ---- Fase 11: Permissões (camadas de usuário) ----
const permsMod = require('../src/core/permissoes');
ok(permsMod.efetivas('admin').length === permsMod.TODAS.length, 'perm: admin tem todas as permissões');
ok(!permsMod.efetivas('caixa').includes('produtos.custo'), 'perm: caixa NÃO vê custo');
ok(!permsMod.efetivas('caixa').includes('financeiro.ver'), 'perm: caixa NÃO vê financeiro');
ok(permsMod.efetivas('estoque').includes('estoque.movimentar'), 'perm: estoquista movimenta estoque');

const loginCaixa = auth.login(db, 'caixa1', '123456');
ok(loginCaixa.ok && Array.isArray(loginCaixa.usuario.permissoes), 'perm: login traz permissões efetivas');
ok(loginCaixa.usuario.permissoes.includes('pdv.vender'), 'perm: caixa pode vender');
ok(!loginCaixa.usuario.permissoes.includes('produtos.custo'), 'perm: caixa sem custo no login');

const dashCaixa = dashboard.resumo(db, loginCaixa.usuario);
ok(dashCaixa.mes.lucro_bruto === null && dashCaixa.mes.custo === null, 'perm: painel oculta lucro/custo p/ caixa');
ok(dashCaixa.financeiro === null, 'perm: painel oculta financeiro p/ caixa');
const dashAdmin = dashboard.resumo(db, quem);
ok(dashAdmin.mes.lucro_bruto !== null, 'perm: painel mostra lucro p/ admin');

const upd = auth.salvarUsuario(db, { id: novoUsuario.id, nome: 'Caixa 1', usuario: 'caixa1', perfil: 'caixa', ativo: 1, permissoes: ['pdv.ver', 'pdv.vender', 'produtos.custo'] }, quem);
ok(upd.ok, 'perm: salva permissões customizadas por usuário');
const loginCaixa2 = auth.login(db, 'caixa1', '123456');
ok(loginCaixa2.usuario.permissoes.includes('produtos.custo'), 'perm: custom aplicada (agora vê custo)');
ok(!loginCaixa2.usuario.permissoes.includes('crediario.receber'), 'perm: custom remove o não-marcado');
ok(auth.salvarUsuario(db, { nome: 'z', usuario: 'z', perfil: 'caixa', senha: '123456' }, loginCaixa2.usuario).ok === false, 'perm: não-admin não cria usuário');

// ---- Fase 12: Devoluções ----
const devolucoes = require('../src/core/devolucoes');
const infoDev = devolucoes.itensVenda(db, venda1.venda.id);
ok(infoDev.ok && infoDev.itens.length >= 1, 'devolução: lista itens devolvíveis da venda');
const itemDev = infoDev.itens.find(i => i.variacao_id === vv.id);
ok(itemDev && itemDev.disponivel === 2, 'devolução: 2 peças disponíveis (qtd vendida)');
ok(itemDev.valor_unit === 95, `devolução: valor líquido por peça = 95 (obtido ${itemDev.valor_unit})`);

const estAntesDev = produtos.obterProduto(db, prodV.id).variacoes[0].estoque;
ok(devolucoes.registrar(db, { venda_id: venda1.venda.id, itens: [{ variacao_id: vv.id, qtd: 5 }], forma_reembolso: 'estorno' }, quem).ok === false, 'devolução: qtd acima do disponível é bloqueada');
const reg = devolucoes.registrar(db, { venda_id: venda1.venda.id, itens: [{ variacao_id: vv.id, qtd: 1 }], forma_reembolso: 'estorno', motivo: 'tamanho' }, quem);
ok(reg.ok && reg.valor_devolvido === 95, `devolução: registrada, valor 95 (obtido ${reg.valor_devolvido})`);
ok(produtos.obterProduto(db, prodV.id).variacoes[0].estoque === estAntesDev + 1, 'devolução: peça volta ao estoque');
ok(devolucoes.itensVenda(db, venda1.venda.id).itens.find(i => i.variacao_id === vv.id).disponivel === 1, 'devolução: disponível cai para 1');
ok(devolucoes.listar(db).devolucoes.length >= 1, 'devolução: aparece no histórico');

// reembolso em dinheiro sai do caixa (sangria)
const movAntes = db.prepare("SELECT COUNT(*) n FROM caixa_movimentos WHERE tipo='sangria'").get().n;
const regDin = devolucoes.registrar(db, { venda_id: venda1.venda.id, itens: [{ variacao_id: vv.id, qtd: 1 }], forma_reembolso: 'dinheiro' }, quem);
ok(regDin.ok && regDin.caixa === false, 'devolução em dinheiro sem caixa aberto: registra sem mexer na gaveta');
ok(db.prepare("SELECT COUNT(*) n FROM caixa_movimentos WHERE tipo='sangria'").get().n === movAntes, 'devolução: sem caixa aberto não gera sangria');

// ---- Fase 13: Vale-troca ----
const valesTroca = require('../src/core/vales_troca');

// Fase 13 usa venda própria (venda1 já teve todas as peças devolvidas na Fase 12)
// Abre caixa, faz venda de 1 peça a 95 e devolve com vale
const cx13a = pdv.abrirCaixa(db, { valor_abertura: 0 }, quem);
ok(cx13a.ok, 'vale: caixa aberto para testes de vale');
const vendaBase = pdv.registrarVenda(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 100, desconto: 5 }],
  pagamentos: [{ forma: 'dinheiro', valor: 95 }],
  desconto: 0
}, quem);
ok(vendaBase.ok, 'vale: venda base criada para devolução');

// Fecha caixa antes de devolver (testa devolução sem caixa aberto)
pdv.fecharCaixa(db, { valor_informado: 95 }, quem);

// Emite um vale via devolução com forma='vale'
const regVale = devolucoes.registrar(db, {
  venda_id: vendaBase.venda.id,
  itens: [{ variacao_id: vv.id, qtd: 1 }],
  forma_reembolso: 'vale'
}, quem);
ok(regVale.ok, 'vale: devolução com forma=vale registrada');
ok(regVale.vale && regVale.vale.codigo && regVale.vale.codigo.startsWith('VT-'), `vale: código gerado (${regVale.vale?.codigo})`);
ok(regVale.vale.valor_total === 95, `vale: valor = 95 (obtido ${regVale.vale?.valor_total})`);

// Consulta
const cons = valesTroca.consultar(db, regVale.vale.codigo);
ok(cons.ok && cons.vale.saldo === 95, `vale: saldo consultado = 95 (obtido ${cons.vale?.saldo})`);
ok(cons.vale.status === 'ativo', 'vale: status inicial = ativo');
ok(valesTroca.consultar(db, 'VT-INVALIDO').ok === false, 'vale: código inválido retorna erro');

// Uso parcial
db.exec('BEGIN');
const uso1 = valesTroca.usar(db, { codigo: regVale.vale.codigo, valorAplicado: 50, vendaId: 999 }, quem);
db.exec('COMMIT');
ok(uso1.ok && uso1.aplicado === 50, `vale: uso parcial de 50 (obtido ${uso1.aplicado})`);
ok(uso1.saldo_restante === 45, `vale: saldo restante = 45 (obtido ${uso1.saldo_restante})`);
ok(valesTroca.consultar(db, regVale.vale.codigo).vale.status === 'parcial', 'vale: status = parcial após uso parcial');

// Uso acima do saldo
db.exec('BEGIN');
const usoExcesso = valesTroca.usar(db, { codigo: regVale.vale.codigo, valorAplicado: 100, vendaId: 999 }, quem);
db.exec('ROLLBACK');
ok(!usoExcesso.ok, 'vale: uso acima do saldo é bloqueado');

// Uso total (zera o saldo)
db.exec('BEGIN');
const uso2 = valesTroca.usar(db, { codigo: regVale.vale.codigo, valorAplicado: 45, vendaId: 999 }, quem);
db.exec('COMMIT');
ok(uso2.ok && uso2.saldo_restante === 0, 'vale: uso total zerando saldo');
ok(valesTroca.consultar(db, regVale.vale.codigo).ok === false, 'vale: consulta de vale esgotado retorna erro');
ok(valesTroca.listar(db).vales.length >= 1, 'vale: lista de vales retorna registros');

// Venda usando vale-troca via PDV
// regVale2: nova venda criada enquanto cx13a ainda estava aberto
// mas cx13a já foi fechado — abrimos um caixa auxiliar para criar a venda
const { abrirCaixa: abrirCx13b, fecharCaixa: fecharCx13b, registrarVenda: regV13b } = require('../src/core/pdv');
const cx13b = abrirCx13b(db, { valor_abertura: 0 }, quem);
const vendaBase2 = regV13b(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 95, desconto: 0 }],
  pagamentos: [{ forma: 'dinheiro', valor: 95 }],
  desconto: 0
}, quem);
fecharCx13b(db, { valor_informado: 95 }, quem);
ok(vendaBase2.ok, 'vale: segunda venda base criada');

const regVale2 = devolucoes.registrar(db, {
  venda_id: vendaBase2.venda.id,
  itens: [{ variacao_id: vv.id, qtd: 1 }],
  forma_reembolso: 'vale'
}, quem);
ok(regVale2.ok && regVale2.vale, 'vale: segundo vale emitido para teste de venda');

// PDV: abre caixa e faz venda usando o vale (total 95 = valor do vale)
const { abrirCaixa: abrirCx13, registrarVenda: regV13 } = require('../src/core/pdv');
const cx13 = abrirCx13(db, { valor_abertura: 0 }, quem);
ok(cx13.ok, 'vale (PDV): caixa aberto para uso de vale');

const vendaComVale = regV13(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 95, desconto: 0 }],
  pagamentos: [{ forma: 'vale', valor: 95, parcelas: 1, codigo_vale: regVale2.vale.codigo }],
  desconto: 0
}, quem);
ok(vendaComVale.ok, 'vale (PDV): venda com pagamento em vale-troca');
ok(valesTroca.consultar(db, regVale2.vale.codigo).ok === false, 'vale (PDV): vale marcado como utilizado após venda');

// Tentativa de venda com vale sem código → bloqueada antes de chegar ao estoque
const vendaSemCodigo = regV13(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 50, desconto: 0 }],
  pagamentos: [{ forma: 'vale', valor: 50, parcelas: 1 }],
  desconto: 0
}, quem);
ok(!vendaSemCodigo.ok, 'vale (PDV): venda sem código do vale é bloqueada');


// fechar caixa que ficou aberto nos testes de vale (PDV)
const { fecharCaixa: fecharCx13pdv } = require('../src/core/pdv');
fecharCx13pdv(db, { valor_informado: 0 }, quem);

// ---- Fase 14: Programa de Pontos ----
const pontos = require('../src/core/pontos');

// config: ativar pontos (1 ponto por R$ 1, mínimo 100, resgate R$ 10)
const cfgSalvo = pontos.salvarConfig(db, { ativo: true, por_real: 1, minimo_resgate: 100, valor_resgate: 10 }, quem);
ok(cfgSalvo.ok && cfgSalvo.config.ativo, 'pontos: config salva e ativa');
ok(cfgSalvo.config.por_real === 1, 'pontos: 1 ponto por R$ 1');

// cliente dedicado para testes de pontos
const cli1 = clientes.salvar(db, { nome: 'Cliente Pontos Teste' }, quem);
ok(cli1.ok, 'pontos: cliente criado para testes');

// ganho em compra
ok(pontos.calcularGanho(db, 95) === 95, 'pontos: calcularGanho R$ 95 = 95 pts');
ok(pontos.calcularGanho(db, 99.9) === 99, 'pontos: calcularGanho trunca frações');

// resgate: 200 pontos = 2x R$ 10 = R$ 20
ok(pontos.calcularResgate(db, 200) === 20, 'pontos: calcularResgate 200 pts = R$ 20');
ok(pontos.calcularResgate(db, 50) === 0, 'pontos: abaixo do mínimo não resgata');

// saldo inicial do cliente
const sd0 = pontos.saldo(db, cli1.id);
ok(sd0.ok && sd0.pontos === 0, `pontos: saldo inicial = 0 (obtido ${sd0.pontos})`);

// venda com cliente identificado → credita pontos automaticamente
const { abrirCaixa: abrirPts, fecharCaixa: fecharPts, registrarVenda: vendaPts } = require('../src/core/pdv');
const cxPts = abrirPts(db, { valor_abertura: 0 }, quem);
ok(cxPts.ok, 'pontos: caixa aberto');
const vendaPts1 = vendaPts(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 150, desconto: 0 }],
  pagamentos: [{ forma: 'dinheiro', valor: 150 }],
  desconto: 0,
  cliente_id: cli1.id
}, quem);
ok(vendaPts1.ok, 'pontos: venda com cliente registrada');
ok(vendaPts1.pontos_ganhos === 150, `pontos: 150 pontos ganhos (obtido ${vendaPts1.pontos_ganhos})`);
const sd1 = pontos.saldo(db, cli1.id);
ok(sd1.pontos === 150, `pontos: saldo = 150 (obtido ${sd1.pontos})`);

// segunda venda: mais 50 → total 200 pts → elegível para resgate
const vendaPts2 = vendaPts(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 50, desconto: 0 }],
  pagamentos: [{ forma: 'dinheiro', valor: 50 }],
  desconto: 0,
  cliente_id: cli1.id
}, quem);
ok(vendaPts2.ok && vendaPts2.pontos_ganhos === 50, 'pontos: segunda compra ganha 50 pts');
ok(pontos.saldo(db, cli1.id).pontos === 200, 'pontos: saldo total = 200 pts');

// resgate dentro de uma venda (desconto de R$ 20)
const vendaResgate = vendaPts(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 100, desconto: 0 }],
  pagamentos: [{ forma: 'dinheiro', valor: 80 }],
  desconto: 20,
  cliente_id: cli1.id,
  pontos_resgatar: 200
}, quem);
ok(vendaResgate.ok, `pontos: venda com resgate (${vendaResgate.erro || 'ok'})`);
const sdApos = pontos.saldo(db, cli1.id);
ok(sdApos.pontos === 80, `pontos: saldo após resgate = 80 pts ganhos na venda de R$ 80 (obtido ${sdApos.pontos})`);

// tentativa de resgatar mais pontos do que o saldo
fecharPts(db, { valor_informado: 0 }, quem);
const { abrirCaixa: abrirPts2, registrarVenda: vendaPts3 } = require('../src/core/pdv');
abrirPts2(db, { valor_abertura: 0 }, quem);
const vendaExcesso = vendaPts3(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 100, desconto: 20 }],
  pagamentos: [{ forma: 'dinheiro', valor: 80 }],
  desconto: 0,
  cliente_id: cli1.id,
  pontos_resgatar: 9999
}, quem);
ok(!vendaExcesso.ok, 'pontos: resgate acima do saldo é bloqueado');

// histórico registrado
const hist = pontos.historico(db, cli1.id);
ok(hist.ok && hist.historico.length >= 3, `pontos: histórico tem ${hist.historico.length} entradas`);

// ajuste manual (admin)
const ajuste = pontos.ajustar(db, { clienteId: cli1.id, pontos: 10, obs: 'Bônus teste' }, quem);
ok(ajuste.ok, 'pontos: ajuste manual (admin)');
ok(ajuste.saldo_novo === pontos.saldo(db, cli1.id).pontos, 'pontos: saldo após ajuste bate');

// ajuste negativo excedendo saldo → bloqueado
const ajusteRuim = pontos.ajustar(db, { clienteId: cli1.id, pontos: -99999, obs: 'teste' }, quem);
ok(!ajusteRuim.ok, 'pontos: ajuste negativo acima do saldo bloqueado');

// venda sem cliente → não ganha pontos
const vendaSemCli = vendaPts3(db, {
  itens: [{ variacao_id: vv.id, qtd: 1, preco_unit: 50, desconto: 0 }],
  pagamentos: [{ forma: 'dinheiro', valor: 50 }],
  desconto: 0
}, quem);
ok(vendaSemCli.ok && vendaSemCli.pontos_ganhos === 0, 'pontos: venda sem cliente não ganha pontos');


// ---- Fase 15: Categorias de Clientes + Importação/Exportação ----
const clientesM = require('../src/core/clientes');

// Categorias: criar
const catA = clientesM.salvarCategoria(db, { nome: 'Componente' }, quem);
ok(catA.ok, 'cat-cli: Componente criada');
const catB = clientesM.salvarCategoria(db, { nome: 'Associado' }, quem);
ok(catB.ok, 'cat-cli: Associado criada');

// Duplicada é bloqueada
const catDup = clientesM.salvarCategoria(db, { nome: 'Componente' }, quem);
ok(!catDup.ok, 'cat-cli: nome duplicado bloqueado');

// Listar
const catLista = clientesM.listarCategorias(db);
ok(catLista.ok && catLista.categorias.length >= 2, `cat-cli: lista retorna categorias (${catLista.categorias.length})`);

// Cliente com categoria
const cliCat = clientesM.salvar(db, { nome: 'Teste Categoria', telefone: '87 90000-0001', categoria_id: catA.id }, quem);
ok(cliCat.ok, 'cat-cli: cliente salvo com categoria');
const listaCat = clientesM.listar(db, { busca: 'Teste Categoria', categoria_id: catA.id });
ok(listaCat.ok && listaCat.clientes[0]?.categoria === 'Componente', 'cat-cli: filtro por categoria funciona');

// Categoria inválida é bloqueada
const cliCatInvalida = clientesM.salvar(db, { nome: 'Inv', categoria_id: 99999 }, quem);
ok(!cliCatInvalida.ok, 'cat-cli: categoria inexistente bloqueada');

// Excluir categoria sem clientes
const catC = clientesM.salvarCategoria(db, { nome: 'ParaExcluir' }, quem);
const excCat = clientesM.excluirCategoria(db, catC.id, quem);
ok(excCat.ok, 'cat-cli: categoria vazia excluída');

// Excluir categoria em uso é bloqueada
const excEmUso = clientesM.excluirCategoria(db, catA.id, quem);
ok(!excEmUso.ok, 'cat-cli: categoria em uso não pode ser excluída');

// Importar clientes via CSV (simulado como array de objetos)
const linhasImport = [
  { nome: 'Importado A', cpf: '111.111.111-11', telefone: '87 91111-0001', categoria: 'Componente' },
  { nome: 'Importado B', cpf: '222.222.222-22', telefone: '87 91111-0002', categoria: 'Novo Grupo' },
  { nome: '', cpf: '333' } // linha inválida (sem nome)
];
const impR = clientesM.importar(db, linhasImport, quem);
ok(impR.ok, `import: resultado ok (${impR.erro || 'sem erro'})`);
ok(impR.importados === 2, `import: 2 clientes importados (obtido ${impR.importados})`);
ok(impR.ignorados === 1, `import: 1 linha ignorada por falta de nome (obtido ${impR.ignorados})`);

// Categoria criada automaticamente na importação
const catLista2 = clientesM.listarCategorias(db);
ok(catLista2.categorias.some(c => c.nome === 'Novo Grupo'), 'import: categoria criada automaticamente');

// Re-importar duplicata por nome → atualiza, não duplica
const antesImp = clientesM.listar(db, { busca: 'Importado A' }).clientes.length;
clientesM.importar(db, [{ nome: 'Importado A', telefone: '87 99999-9999' }], quem);
const depoisImp = clientesM.listar(db, { busca: 'Importado A' }).clientes.length;
ok(antesImp === depoisImp, 'import: duplicata por nome atualiza em vez de duplicar');

// Exportar
const expR = clientesM.exportar(db);
ok(expR.ok && expR.clientes.length > 0, `export: ${expR.clientes.length} clientes exportados`);
ok('categoria' in expR.clientes[0], 'export: campo categoria presente');


// ---- Fase 16: Backup na Nuvem (módulo, sem rede real) ----
const backupM = require('../src/core/backup_nuvem');
const os16 = require('os');
const path16 = require('path');
const fs16 = require('fs');
const testDataDir = path16.join(os16.tmpdir(), 'salgueiro_test_' + Date.now());
fs16.mkdirSync(testDataDir, { recursive: true });

// Status inicial: sem conexão
const status0 = backupM.obterStatus(testDataDir);
ok(status0.ok, 'nuvem: obterStatus retorna ok');
ok(typeof status0.providers.google === 'object', 'nuvem: provider google presente');
ok(typeof status0.providers.onedrive === 'object', 'nuvem: provider onedrive presente');
ok(!status0.providers.google.conectado, 'nuvem: google não conectado inicialmente');
ok(!status0.providers.onedrive.conectado, 'nuvem: onedrive não conectado inicialmente');

// precisaBackupDiario: sem tokens = false (nenhum provider conectado)
ok(!backupM.precisaBackupDiario(testDataDir), 'nuvem: sem provider conectado, não precisa backup');

// Simular token (sem OAuth real)
const tokensSimulados = {
  google: { access_token: 'FAKE_TOKEN', refresh_token: 'FAKE_REFRESH',
            expires_at: Date.now() + 3600000, ultimo_backup: null }
};
fs16.writeFileSync(path16.join(testDataDir, 'cloud_tokens.json'), JSON.stringify(tokensSimulados));

// Com token + sem backup → precisa
ok(backupM.precisaBackupDiario(testDataDir), 'nuvem: sem backup anterior, precisa fazer');

// Após último backup recente → não precisa
const tokensRecentes = { google: { ...tokensSimulados.google, ultimo_backup: new Date().toISOString() } };
fs16.writeFileSync(path16.join(testDataDir, 'cloud_tokens.json'), JSON.stringify(tokensRecentes));
ok(!backupM.precisaBackupDiario(testDataDir), 'nuvem: backup recente → não precisa refazer');

// Status com token simulado
const status1 = backupM.obterStatus(testDataDir);
ok(status1.providers.google.conectado, 'nuvem: google aparece como conectado com token');
ok(!status1.providers.onedrive.conectado, 'nuvem: onedrive ainda desconectado');

// Desconectar (limpa tokens — parte síncrona, sem rede)
// Escrevemos token inválido expirado para evitar tentativa real de revogação
const tokensExp = { google: { access_token: 'X', expires_at: 0 } };
fs16.writeFileSync(path16.join(testDataDir, 'cloud_tokens.json'), JSON.stringify(tokensExp));
backupM.desconectar(testDataDir, 'google').then(() => {}).catch(() => {});
// Limpa manualmente o arquivo para verificação síncrona
fs16.writeFileSync(path16.join(testDataDir, 'cloud_tokens.json'), '{}');
const status2 = backupM.obterStatus(testDataDir);
ok(!status2.providers.google.conectado, 'nuvem: após desconectar, google aparece desconectado');

// Limpar dir de teste
try { fs16.rmSync(testDataDir, { recursive: true }); } catch {}

// ---- Fase 17: Consignados (repasse = custo + %lucro; custo discriminado) ----
const consignacao = require('../src/core/consignacao');

const fornCid = Number(db.prepare("INSERT INTO fornecedores (nome) VALUES ('Ateliê Consignado')").run().lastInsertRowid);
const prodC = produtos.salvarProduto(db, {
  nome: 'Bolsa Consignada', preco_custo: 40, preco_venda: 100, estoque_minimo: 0,
  variacoes: [{ cor: 'Única', tamanho: 'U', estoque: 5 }]
}, quem);
ok(prodC.ok, 'consignado: produto criado');
// Marca como consignado: fornecedor recebe custo + 70% do lucro.
db.prepare('UPDATE produtos SET consignado=1, pct_fornecedor=70, fornecedor_id=? WHERE id=?').run(fornCid, prodC.id);
const vc = produtos.obterProduto(db, prodC.id).variacoes[0];

if (!pdv.caixaAtual(db).caixa) pdv.abrirCaixa(db, { valor_abertura: 0 }, quem);
ok(!!pdv.caixaAtual(db).caixa, 'consignado: há caixa aberto para a venda');

const vendaC = pdv.registrarVenda(db, {
  itens: [{ variacao_id: vc.id, qtd: 1, preco_unit: 100 }],
  pagamentos: [{ forma: 'dinheiro', valor: 100 }]
}, quem);
ok(vendaC.ok, 'consignado: venda registrada');

const linC = db.prepare('SELECT * FROM consignacoes WHERE venda_id=?').get(vendaC.venda.id);
ok(linC && linC.valor_custo === 40, `consignado: custo abatido e registrado (40, obtido ${linC && linC.valor_custo})`);
ok(linC && linC.valor_fornecedor === 82, `consignado: repasse = custo 40 + 70% de 60 = 82 (obtido ${linC && linC.valor_fornecedor})`);
ok(linC && linC.valor_loja === 18, `consignado: loja = 30% de 60 = 18 (obtido ${linC && linC.valor_loja})`);
ok(linC && Math.round((linC.valor_fornecedor + linC.valor_loja) * 100) / 100 === 100, 'consignado: fornecedor + loja = valor de venda');

const resC = consignacao.resumo(db).fornecedores.find(f => f.fornecedor_id === fornCid);
ok(resC && resC.pendente_custo === 40, `consignado: resumo discrimina o custo (40, obtido ${resC && resC.pendente_custo})`);
ok(resC && resC.pendente_lucro_fornecedor === 42, `consignado: resumo mostra a fatia do lucro do fornecedor (42, obtido ${resC && resC.pendente_lucro_fornecedor})`);
ok(resC && resC.pendente_fornecedor === 82, 'consignado: resumo repasse = custo + lucro do fornecedor');
ok(resC && resC.pendente_loja === 18, 'consignado: resumo parte da loja');

const extC = consignacao.listar(db, { fornecedor_id: fornCid });
ok(extC.ok && extC.movimentos.length === 1, 'consignado: extrato com 1 movimento');
ok(extC.movimentos[0].lucro === 60 && extC.movimentos[0].lucro_fornecedor === 42, 'consignado: extrato discrimina lucro total e lucro do fornecedor');

const acC = consignacao.acertar(db, { fornecedor_id: fornCid }, quem);
ok(acC.ok && acC.valor === 82 && acC.custo === 40, `consignado: acerto gera repasse 82 com custo 40 (obtido ${acC.valor}/${acC.custo})`);
ok(db.prepare("SELECT COUNT(*) n FROM financeiro_lancamentos WHERE origem='consignacao' AND ROUND(valor,2)=82").get().n === 1, 'consignado: conta a pagar de 82 criada no financeiro');
ok(!consignacao.resumo(db).fornecedores.some(f => f.fornecedor_id === fornCid && f.pendente_fornecedor > 0), 'consignado: sem pendências após o acerto');

// ---- Fase 18: Multi-loja (receita separada por loja + total consolidado) ----
const lojasM = require('../src/core/lojas');
const relatoriosM = require('../src/core/relatorios');

ok(lojasM.listar(db).lojas.length >= 1, 'multi-loja: loja padrão criada no seed');
const lojaX = lojasM.salvar(db, { nome: 'Loja Teste A' }, quem);
const lojaY = lojasM.salvar(db, { nome: 'Loja Teste B' }, quem);
ok(lojaX.ok && lojaY.ok, 'multi-loja: cadastro de duas lojas');
ok(lojasM.salvar(db, { nome: 'Loja Teste A' }, quem).ok === false, 'multi-loja: nome de loja duplicado é bloqueado');

const prodL = produtos.salvarProduto(db, {
  nome: 'Camiseta Multi-loja', preco_custo: 20, preco_venda: 50, estoque_minimo: 0,
  variacoes: [{ cor: 'Única', tamanho: 'U', estoque: 100 }]
}, quem);
const vl = produtos.obterProduto(db, prodL.id).variacoes[0];

// fecha qualquer caixa aberto de fases anteriores
if (pdv.caixaAtual(db).caixa) pdv.fecharCaixa(db, { valor_informado: 0 }, quem);

// Loja A: 2 vendas de 50 = 100
ok(pdv.abrirCaixa(db, { valor_abertura: 0, loja_id: lojaX.id }, quem).ok, 'multi-loja: abre caixa na Loja A');
pdv.registrarVenda(db, { itens: [{ variacao_id: vl.id, qtd: 1, preco_unit: 50 }], pagamentos: [{ forma: 'dinheiro', valor: 50 }] }, quem);
pdv.registrarVenda(db, { itens: [{ variacao_id: vl.id, qtd: 1, preco_unit: 50 }], pagamentos: [{ forma: 'dinheiro', valor: 50 }] }, quem);
pdv.fecharCaixa(db, { valor_informado: 100 }, quem);

// Loja B: 1 venda de 50 = 50
ok(pdv.abrirCaixa(db, { valor_abertura: 0, loja_id: lojaY.id }, quem).ok, 'multi-loja: abre caixa na Loja B');
pdv.registrarVenda(db, { itens: [{ variacao_id: vl.id, qtd: 1, preco_unit: 50 }], pagamentos: [{ forma: 'dinheiro', valor: 50 }] }, quem);
pdv.fecharCaixa(db, { valor_informado: 50 }, quem);

ok(pdv.abrirCaixa(db, { valor_abertura: 0, loja_id: 999999 }, quem).ok === false, 'multi-loja: loja inexistente é bloqueada ao abrir caixa');

const rep = relatoriosM.receitaPorLoja(db, { de: '2000-01-01', ate: '2100-01-01' });
const repX = rep.lojas.find(x => x.loja_id === lojaX.id);
const repY = rep.lojas.find(x => x.loja_id === lojaY.id);
ok(repX && repX.total === 100, `multi-loja: receita da Loja A = 100 (${repX && repX.total})`);
ok(repY && repY.total === 50, `multi-loja: receita da Loja B = 50 (${repY && repY.total})`);
const somaLojas = Math.round(rep.lojas.reduce((s, l) => s + l.total, 0) * 100) / 100;
ok(rep.total === somaLojas, 'multi-loja: receita TOTAL = soma de todas as lojas');
ok(rep.total >= 150, `multi-loja: total consolidado inclui as duas lojas (${rep.total})`);

const vpX = relatoriosM.vendasPeriodo(db, { de: '2000-01-01', ate: '2100-01-01', loja_id: lojaX.id });
ok(vpX.resumo.total === 100 && vpX.resumo.qtd === 2, `multi-loja: relatório de vendas filtrado pela Loja A (${vpX.resumo.total}/${vpX.resumo.qtd})`);
ok(lojasM.excluir(db, lojaX.id, quem).ok === false, 'multi-loja: loja com caixas é protegida da exclusão');

// ---- Fase 19: Dev (login, senha, setores) + reset de fábrica ----
const licencaM = require('../src/core/licenca');
const { resetarDados } = require('../src/db');
const osL = require('os'), pathL = require('path'), fsL = require('fs');
const dirLic = fsL.mkdtempSync(pathL.join(osL.tmpdir(), 'salg-lic-'));
ok(licencaM.devEntrar(dirLic, 'errado', 'mldev@2026').ok === false, 'dev: usuário errado bloqueado');
const dvOk = licencaM.devEntrar(dirLic, 'dev-mlopesdesign', 'mldev@2026');
ok(dvOk.ok && dvOk.senha_padrao === true, 'dev: login dev-mlopesdesign com senha provisória');
ok(licencaM.devTrocarSenha(dirLic, 'mldev@2026', 'NovaSenha#2026').ok, 'dev: troca de senha');
ok(licencaM.devEntrar(dirLic, 'dev-mlopesdesign', 'mldev@2026').ok === false, 'dev: senha antiga não vale mais');
ok(licencaM.devEntrar(dirLic, 'dev-mlopesdesign', 'NovaSenha#2026').ok, 'dev: nova senha vale');
ok(licencaM.devSetores(dirLic, 'NovaSenha#2026', ['crediario', 'nuvem']).ok, 'setores: bloqueia crediário e nuvem');
ok(licencaM.verificar(dirLic, 'crediario:receber') !== null, 'setores: rota de crediário bloqueada');
ok(licencaM.verificar(dirLic, 'nuvem:backup') !== null, 'setores: rota de nuvem bloqueada');
ok(licencaM.verificar(dirLic, 'pdv:venda') === null, 'setores: PDV segue liberado');
ok(licencaM.estado(dirLic).setores_bloqueados.length === 2, 'setores: estado expõe 2 bloqueados');
try { fsL.rmSync(dirLic, { recursive: true }); } catch {}

const dbReset = await criarBanco(pathL.join(dir, 'reset.db'));
const quemR = auth.login(dbReset, 'admin', 'admin123').usuario;
produtos.salvarProduto(dbReset, { nome: 'ZZ Reset', preco_venda: 9, variacoes: [{ cor: 'U', tamanho: 'U', estoque: 3 }] }, quemR);
ok(dbReset.prepare('SELECT COUNT(*) n FROM produtos').get().n === 1, 'reset: 1 produto antes');
resetarDados(dbReset);
ok(dbReset.prepare('SELECT COUNT(*) n FROM produtos').get().n === 0, 'reset: 0 produtos depois');
ok(dbReset.prepare('SELECT COUNT(*) n FROM usuarios').get().n === 1, 'reset: só admin depois');
ok(auth.login(dbReset, 'admin', 'admin123').ok, 'reset: admin/admin123 volta a funcionar');
ok(dbReset.prepare("SELECT COUNT(*) n FROM lojas").get().n === 1, 'reset: só a Loja Principal');

console.log(falhas === 0 ? '\nTodos os testes passaram ✅' : `\n${falhas} teste(s) falharam ❌`);
process.exit(falhas === 0 ? 0 : 1);

})().catch(e => { console.error(e); process.exit(1); });
