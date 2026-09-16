# GRAPHIFY — Salgueiro Gestão

> Mapa técnico gerado automaticamente por `tools/graphify.js`.
> **Não edite à mão.** Regere com `node tools/graphify.js` a cada alteração estrutural.

**Versão:** 3.26.1 · **Gerado em:** 2026-09-16
**Aplicação:** `br.com.mllopes.salgueirogestao` (Neutralino 6 + WebView2)
**Cliente:** Boutique do Salgueiro · **Autor:** ML Lopes Design

---

## 1. Identidade (imutável)

| Item | Valor |
|---|---|
| applicationId | `br.com.mllopes.salgueirogestao` |
| binaryName | `salgueiro-gestao` |
| Pasta de dados | `%APPDATA%/SalgueiroGestao/dados` |
| Banco | `salgueiro.db` (sql.js asm no WebView) |
| Porta da rede | 8750 (TCP) |

> Mudar qualquer um destes quebra a atualização automática e o banco dos clientes.

---

## 2. Arquitetura em uma passada

```
index.html  (BOM UTF-8 + meta charset — sem isso o WebView2 quebra os acentos)
   │
   ├── js/app.js ─────────── shell, menu, permissões, roteamento de telas
   │     └── api(canal, payload)
   │            ├── Neutralino presente → js/backend/servidor.js  (local)
   │            └── senão              → fetch('/api')            (terminal em rede)
   │
   ├── js/<tela>.js ──────── uma por área do menu
   │
   └── js/backend/
         ├── servidor.js ─── despacha canal → core/*, aplica PERMISSAO_ROTA
         ├── db.js ────────── wrapper sql.js (API better-sqlite3) + migrações
         ├── ambiente.js ──── tudo que toca o SO (arquivos, impressão, versão)
         └── core/*.js ────── regra de negócio pura (testável com Node)
```

---

## 3. Telas do menu

| id | Rótulo | Arquivo |
|---|---|---|
| `dashboard` | 📊 Painel | — (em app.js) |
| `pdv` | 🛒 PDV — Vendas | `src/js/pdv.js` |
| `produtos` | 👗 Produtos | — (em app.js) |
| `categorias` | 🏷️ Categorias | — (em app.js) |
| `estoque` | 📦 Estoque | `src/js/estoque.js` |
| `estoques` | 🏢 Estoques (locais) | `src/js/estoques.js` |
| `compras` | 🚚 Compras | `src/js/compras.js` |
| `clientes` | 👥 Clientes | `src/js/clientes.js` |
| `financeiro` | 💰 Financeiro | `src/js/financeiro.js` |
| `relatorios` | 📈 Relatórios | `src/js/relatorios.js` |
| `ranking` | 🏆 Ranking | `src/js/ranking.js` |
| `vales` | 🎫 Vales-Troca | — (em app.js) |
| `catalogo` | 📔 Catálogo | `src/js/catalogo.js` |
| `mensagens` | 💬 Mensagens | `src/js/mensagens.js` |
| `config` | ⚙️ Configurações | — (em app.js) |

---

## 4. Módulos de regra de negócio (`src/js/backend/core`)

| Arquivo | Linhas | Funções | Exporta |
|---|---|---|---|
| `auth.js` | 185 | 8 | autorizarDescontoAdmin, descontoLivre, listarUsuarios, login, salvarUsuario, trocarSenha, verificarAdmin, verificarOperador |
| `clientes.js` | 223 | 7 | excluirCategoria, exportar, importar, listar, listarCategorias, salvar, salvarCategoria |
| `compras.js` | 157 | 8 | cancelarCompra, criarCompra, excluirFornecedor, listarCompras, listarFornecedores, obterCompra, receberCompra, salvarFornecedor |
| `config.js` | 73 | 2 | obter, salvar |
| `consignacao.js` | 95 | 3 | acertar, listar, resumo |
| `crediario.js` | 108 | 5 | aniversariantes, excluirCliente, obterCliente, parcelasAbertas, receberParcela |
| `dashboard.js` | 214 | 2 | resumo |
| `devolucoes.js` | 127 | 3 | itensVenda, listar, registrar |
| `estoque.js` | 176 | 5 | buscarVariacoes, kardex, listarCompleto, movimentar, reposicao |
| `estoques.js` | 413 | 19 | aplicar, aplicarEstrito, arred, conferirSaldo, conteudo, daLoja, desativar, garantirDaLoja, +12 |
| `financeiro.js` | 138 | 5 | baixar, excluir, fluxo, listar, salvar |
| `importar-vendas.js` | 303 | 6 | COLUNAS, analisar, confirmar |
| `licenca.js` | 288 | 25 | DEV_USUARIO, MODULOS, NOME_PLANO, PLANOS, SETORES, devAplicar, devEntrar, devRemover, +14 |
| `logo-default.js` | 4 | 0 | LOGO_DEFAULT |
| `lojas.js` | 91 | 5 | arred, desativar, excluir, listar, lojaPadrao, salvar |
| `mensagens.js` | 406 | 21 | JANELA_POPUP_H, ONLINE_TTL_S, confirmarAviso, contatos, encerrarAviso, enviar, enviarAviso, historico, +4 |
| `nuvem.js` | 353 | 14 | desconectar, fazerBackup, fazerBackupTodos, iniciarOAuth, obterStatus, precisaBackupDiario, registrarOAuthListener, salvarClientId |
| `pdv.js` | 592 | 13 | abrirCaixa, caixaAtual, cancelarVenda, fecharCaixa, listarVendas, listarVendasGeral, movimentoCaixa, obterVenda, +3 |
| `permissoes.js` | 94 | 3 | CATALOGO, DEFAULTS, TODAS, efetivas, normalizar, pode |
| `pontos.js` | 110 | 9 | ajustar, calcularGanho, calcularResgate, creditar, debitar, getConfig, historico, saldo, +1 |
| `produtos.js` | 328 | 7 | excluirCategoria, excluirProduto, listarCategorias, listarProdutos, obterProduto, salvarCategoria, salvarProduto |
| `rede.js` | 150 | 3 | SOMENTE_LOCAL, imprimir, iniciar, listarImpressoras, parar, preparar, status |
| `relatorios.js` | 1419 | 21 | TAXAS_PADRAO, comprasAcompanhadas, consignadosMensal, curvaAbc, estoqueDetalhado, eventosVenda, pecasParadas, ranking, +5 |
| `trocas.js` | 417 | 3 | DESTINOS, registrar, registrarRapida |
| `updater.js` | 50 | 1 | verificarAtualizacao |
| `util.js` | 68 | 4 | auditar, codigoInterno, dvEan13, hashSenha, verificarSenha |
| `vales_troca.js` | 122 | 9 | VALIDADE_PADRAO_DIAS, consultar, criar, estaVencido, listar, usar |

## 5. Backend (raiz)

| Arquivo | Linhas | Funções |
|---|---|---|
| `ambiente.js` | 316 | 6 |
| `db.js` | 565 | 5 |
| `servidor-rede-embutido.js` | 615 | 17 |
| `servidor.js` | 2700 | 15 |

## 6. Telas (`src/js`)

| Arquivo | Linhas | Exporta |
|---|---|---|
| `app.js` | 1756 | EM_REDE, api, aplicarTema, ehAdmin, el |
| `catalogo.js` | 262 | viewCatalogo |
| `clientes.js` | 528 | viewClientes |
| `compras.js` | 229 | viewCompras |
| `configuracoes.js` | 1527 | viewConfiguracoes |
| `estoque.js` | 824 | abrirEtiquetas, ean13Svg, formMovimento, formMovimentoProduto, viewEstoque |
| `estoques.js` | 928 | viewEstoques |
| `etiquetas.js` | 153 | abrirEtiquetasLote |
| `financeiro.js` | 261 | viewFinanceiro |
| `mensagens.js` | 758 | abrirBalao, encerrarTelaMensagens, iniciarMensagens, pararMensagens, viewMensagens |
| `neutralino.js` | 2 | — |
| `novidades.js` | 900 | CSS_NOVIDADES, NOVIDADES, htmlNovidades |
| `pdv.js` | 2326 | calcResgateLocal, imprimirVale, modalValeEmitido, viewPdv |
| `ranking.js` | 361 | viewRanking |
| `relatorios.js` | 1690 | viewRelatorios |

---

## 7. Rotas da API (157)

Toda comunicação tela ↔ backend passa por `api('canal:acao', payload)`.
A coluna **Permissão** vem de `PERMISSAO_ROTA` em `servidor.js` — sem entrada ali,
a rota exige apenas sessão válida.


### `app:*`

| Canal | Permissão | Destino |
|---|---|---|
| `app:versao` | — | `({ ok: true, version: ambiente.versaoApp() })` |
| `app:recuperacao` | — | `({ ok: true, recuperacao: RECUPERACAO_BOOT })` |
| `app:garantirExtensao` | — | `{ await ambiente.garantirExtensaoRede(); return { ok: true }…` |

### `auth:*`

| Canal | Permissão | Destino |
|---|---|---|
| `auth:login` | — | `{` |
| `auth:logout` | — | `({ ok: true })` |
| `auth:sessao` | — | `({ ok: true, usuario: sessao.usuario })` |
| `auth:listarUsuarios` | `usuarios.gerenciar` | `auth.listarUsuarios(db)` |
| `auth:salvarUsuario` | `usuarios.gerenciar` | `auth.salvarUsuario(db, p, sessao.usuario)` |
| `auth:trocarSenha` | — | `auth.trocarSenha(db, p, sessao.usuario)` |
| `auth:autorizarDesconto` | — | `{` |

### `avisos:*`

| Canal | Permissão | Destino |
|---|---|---|
| `avisos:enviar` | `mensagens.avisar` | `mensagens.enviarAviso(db, sessao.usuario, p)` |
| `avisos:confirmar` | — | `mensagens.confirmarAviso(db, sessao.usuario, p)` |
| `avisos:listar` | — | `mensagens.listarAvisos(db, sessao.usuario, p)` |
| `avisos:encerrar` | `mensagens.avisar` | `mensagens.encerrarAviso(db, sessao.usuario, p)` |

### `backup:*`

| Canal | Permissão | Destino |
|---|---|---|
| `backup:manual` | `config.gerenciar` | `{` |
| `backup:restaurar` | `config.gerenciar` | `{` |
| `backup:restaurarLocal` | `config.gerenciar` | `{` |
| `backup:listarLocais` | `config.gerenciar` | `{` |
| `backup:preAtualizacao` | `config.gerenciar` | `{` |
| `backup:salvarAgora` | `config.gerenciar` | `{ await db.salvarAgora(); return { ok: true }; }` |

### `catalogo:*`

| Canal | Permissão | Destino |
|---|---|---|
| `catalogo:categorias` | `produtos.ver` | `{` |
| `catalogo:gerar` | `produtos.ver` | `{` |

### `categorias:*`

| Canal | Permissão | Destino |
|---|---|---|
| `categorias:listar` | `produtos.ver` | `produtos.listarCategorias(db)` |
| `categorias:salvar` | `produtos.editar` | `produtos.salvarCategoria(db, p, sessao.usuario)` |
| `categorias:excluir` | `produtos.editar` | `produtos.excluirCategoria(db, p.id, sessao.usuario)` |

### `clientes:*`

| Canal | Permissão | Destino |
|---|---|---|
| `clientes:listar` | `clientes.ver` | `clientes.listar(db, p \|\| {})` |
| `clientes:salvar` | `clientes.gerenciar` | `clientes.salvar(db, p, sessao.usuario)` |
| `clientes:obter` | `clientes.ver` | `crediario.obterCliente(db, p.id)` |
| `clientes:excluir` | `clientes.gerenciar` | `crediario.excluirCliente(db, p.id, sessao.usuario)` |
| `clientes:listarCategorias` | `clientes.ver` | `clientes.listarCategorias(db)` |
| `clientes:salvarCategoria` | `clientes.gerenciar` | `clientes.salvarCategoria(db, p, sessao.usuario)` |
| `clientes:excluirCategoria` | `clientes.gerenciar` | `clientes.excluirCategoria(db, p.id, sessao.usuario)` |
| `clientes:exportarDados` | `clientes.ver` | `{` |
| `clientes:exportar` | `clientes.ver` | `{` |
| `clientes:importar` | `clientes.gerenciar` | `{` |
| `clientes:aniversariantes` | `clientes.ver` | `crediario.aniversariantes(db)` |

### `compras:*`

| Canal | Permissão | Destino |
|---|---|---|
| `compras:criar` | `compras.gerenciar` | `compras.criarCompra(db, p, sessao.usuario)` |
| `compras:listar` | `compras.ver` | `compras.listarCompras(db)` |
| `compras:obter` | `compras.ver` | `compras.obterCompra(db, p.id)` |
| `compras:receber` | `compras.gerenciar` | `compras.receberCompra(db, p, sessao.usuario)` |
| `compras:cancelar` | `compras.gerenciar` | `compras.cancelarCompra(db, p.id, sessao.usuario)` |

### `config:*`

| Canal | Permissão | Destino |
|---|---|---|
| `config:obter` | — | `config.obter(db)` |
| `config:salvar` | `config.gerenciar` | `config.salvar(db, p, sessao.usuario)` |
| `config:iconeStatus` | — | `{` |
| `config:definirIcone` | `config.gerenciar` | `{` |
| `config:removerIcone` | `config.gerenciar` | `{` |
| `config:listarImpressoras` | — | `{` |
| `config:imprimir` | — | `{` |

### `consignacao:*`

| Canal | Permissão | Destino |
|---|---|---|
| `consignacao:resumo` | `financeiro.ver` | `consignacao.resumo(db)` |
| `consignacao:listar` | `financeiro.ver` | `consignacao.listar(db, p)` |
| `consignacao:acertar` | `financeiro.gerenciar` | `consignacao.acertar(db, p, sessao.usuario)` |

### `crediario:*`

| Canal | Permissão | Destino |
|---|---|---|
| `crediario:abertas` | `clientes.ver` | `crediario.parcelasAbertas(db, p \|\| {})` |
| `crediario:receber` | `crediario.receber` | `crediario.receberParcela(db, p, sessao.usuario)` |
| `crediario:aniversariantes` | `clientes.ver` | `crediario.aniversariantes(db), // alias legado` |

### `dashboard:*`

| Canal | Permissão | Destino |
|---|---|---|
| `dashboard:resumo` | `dashboard.ver` | `dashboard.resumo(db, sessao.usuario)` |

### `dev:*`

| Canal | Permissão | Destino |
|---|---|---|
| `dev:entrar` | — | `licenca.devEntrar(p.usuario, p.senha)` |
| `dev:aplicar` | — | `licenca.devAplicar(p)` |
| `dev:remover` | — | `licenca.devRemover(p.senha)` |
| `dev:trocarSenha` | — | `licenca.devTrocarSenha(p.senha_atual, p.nova_senha)` |
| `dev:setores` | — | `licenca.devSetores(p.senha, p.bloqueados)` |
| `dev:resetarFabrica` | — | `{` |

### `devolucoes:*`

| Canal | Permissão | Destino |
|---|---|---|
| `devolucoes:itensVenda` | `pdv.devolucao` | `devolucoes.itensVenda(db, p.venda_id)` |
| `devolucoes:registrar` | `pdv.devolucao` | `devolucoes.registrar(db, p, sessao.usuario)` |
| `devolucoes:listar` | `pdv.devolucao` | `devolucoes.listar(db)` |

### `estoque:*`

| Canal | Permissão | Destino |
|---|---|---|
| `estoque:buscar` | `estoque.ver` | `{` |
| `estoque:movimentar` | `estoque.movimentar` | `estoque.movimentar(db, p, sessao.usuario)` |
| `estoque:kardex` | `estoque.ver` | `estoque.kardex(db, p \|\| {})` |
| `estoque:reposicao` | `estoque.ver` | `estoque.reposicao(db)` |
| `estoque:listarCompleto` | `estoque.ver` | `estoque.listarCompleto(db)` |
| `estoque:exportarXlsx` | `estoque.ver` | `{` |
| `estoque:exportarXlsxFiltrado` | `produtos.ver` | `{` |

### `estoques:*`

| Canal | Permissão | Destino |
|---|---|---|
| `estoques:listar` | `estoque.ver` | `estoques.listar(db, p \|\| {})` |
| `estoques:salvar` | `estoque.movimentar` | `estoques.salvar(db, p \|\| {}, sessao.usuario)` |
| `estoques:desativar` | `estoque.movimentar` | `estoques.desativar(db, p.id, sessao.usuario)` |
| `estoques:conteudo` | `estoque.ver` | `estoques.conteudo(db, p \|\| {})` |
| `estoques:variacoesNoLocal` | `estoque.ver` | `estoques.variacoesNoLocal(db, p \|\| {})` |
| `estoques:porVariacao` | `estoque.ver` | `({ ok: true, locais: estoques.porVariacao(db, p.variacao_id)…` |
| `estoques:mapaLocais` | `estoque.ver` | `({ ok: true, ...estoques.mapaLocais(db) })` |
| `estoques:transferir` | `estoque.movimentar` | `estoques.transferir(db, p \|\| {}, sessao.usuario)` |
| `estoques:transferirTudo` | `estoque.movimentar` | `estoques.transferirTudo(db, p \|\| {}, sessao.usuario)` |
| `estoques:transferencias` | `estoque.ver` | `estoques.listarTransferencias(db, p \|\| {})` |
| `estoques:romaneio` | `estoque.ver` | `estoques.obterTransferencia(db, p.id)` |
| `estoques:conteudoXlsx` | `estoque.ver` | `{` |

### `financeiro:*`

| Canal | Permissão | Destino |
|---|---|---|
| `financeiro:listar` | `financeiro.ver` | `financeiro.listar(db, p \|\| {})` |
| `financeiro:salvar` | `financeiro.gerenciar` | `financeiro.salvar(db, p, sessao.usuario)` |
| `financeiro:baixar` | `financeiro.gerenciar` | `financeiro.baixar(db, p, sessao.usuario)` |
| `financeiro:excluir` | `financeiro.gerenciar` | `financeiro.excluir(db, p.id, sessao.usuario)` |
| `financeiro:fluxo` | `financeiro.ver` | `financeiro.fluxo(db, p \|\| {})` |

### `fornecedores:*`

| Canal | Permissão | Destino |
|---|---|---|
| `fornecedores:listar` | `compras.ver` | `compras.listarFornecedores(db, p \|\| {})` |
| `fornecedores:salvar` | `compras.gerenciar` | `compras.salvarFornecedor(db, p, sessao.usuario)` |
| `fornecedores:excluir` | `compras.gerenciar` | `compras.excluirFornecedor(db, p.id, sessao.usuario)` |

### `fotos:*`

| Canal | Permissão | Destino |
|---|---|---|
| `fotos:obter` | — | `{` |
| `fotos:obterVarias` | — | `{` |

### `licenca:*`

| Canal | Permissão | Destino |
|---|---|---|
| `licenca:status` | — | `({ ok: true, ...licenca.estado() })` |
| `licenca:renovar` | — | `licenca.renovar(p.codigo)` |

### `lojas:*`

| Canal | Permissão | Destino |
|---|---|---|
| `lojas:listar` | `pdv.ver` | `lojas.listar(db, p \|\| {})` |
| `lojas:salvar` | `config.gerenciar` | `lojas.salvar(db, p, sessao.usuario)` |
| `lojas:excluir` | `config.gerenciar` | `lojas.excluir(db, p.id, sessao.usuario)` |

### `mensagens:*`

| Canal | Permissão | Destino |
|---|---|---|
| `mensagens:resumo` | — | `mensagens.resumo(db, sessao.usuario, p)` |
| `mensagens:contatos` | `mensagens.usar` | `mensagens.contatos(db, sessao.usuario)` |
| `mensagens:historico` | `mensagens.usar` | `mensagens.historico(db, sessao.usuario, p)` |
| `mensagens:enviar` | `mensagens.usar` | `mensagens.enviar(db, sessao.usuario, p)` |
| `mensagens:marcarLido` | `mensagens.usar` | `mensagens.marcarLido(db, sessao.usuario, p)` |
| `mensagens:terminais` | — | `mensagens.terminais(db, sessao.usuario)` |

### `nuvem:*`

| Canal | Permissão | Destino |
|---|---|---|
| `nuvem:status` | `config.gerenciar` | `nuvem.obterStatus()` |
| `nuvem:salvarClientId` | `config.gerenciar` | `nuvem.salvarClientId(p.provider, p.client_id)` |
| `nuvem:conectar` | `config.gerenciar` | `nuvem.iniciarOAuth(p.provider)` |
| `nuvem:desconectar` | `config.gerenciar` | `nuvem.desconectar(p.provider)` |
| `nuvem:backup` | `config.gerenciar` | `nuvem.fazerBackup(db, p.provider)` |

### `pdv:*`

| Canal | Permissão | Destino |
|---|---|---|
| `pdv:trocarLoja` | `pdv.vender` | `pdv.trocarLoja(db, p \|\| {}, sessao.usuario)` |
| `pdv:caixaAtual` | `pdv.ver` | `pdv.caixaAtual(db)` |
| `pdv:abrirCaixa` | `caixa.abrir_fechar` | `pdv.abrirCaixa(db, p, sessao.usuario)` |
| `pdv:movimentoCaixa` | `caixa.sangria` | `pdv.movimentoCaixa(db, p, sessao.usuario)` |
| `pdv:resumoCaixa` | `pdv.ver` | `pdv.resumoCaixa(db, p.caixa_id)` |
| `pdv:fecharCaixa` | `caixa.abrir_fechar` | `{` |
| `pdv:venda` | `pdv.vender` | `pdv.registrarVenda(db, p, sessao.usuario)` |
| `pdv:obterVenda` | `pdv.ver` | `pdv.obterVenda(db, p.id)` |
| `pdv:listarVendas` | `pdv.ver` | `pdv.listarVendas(db, p \|\| {})` |
| `pdv:listarVendasGeral` | `pdv.ver` | `pdv.listarVendasGeral(db, p \|\| {})` |
| `pdv:cancelarVenda` | `pdv.cancelar` | `pdv.cancelarVenda(db, p, sessao.usuario)` |

### `permissoes:*`

| Canal | Permissão | Destino |
|---|---|---|
| `permissoes:catalogo` | `usuarios.gerenciar` | `({ ok: true, catalogo: permissoes.CATALOGO, defaults: permis…` |

### `pontos:*`

| Canal | Permissão | Destino |
|---|---|---|
| `pontos:config` | `pdv.ver` | `pontos.getConfig(db)` |
| `pontos:salvarConfig` | `config.gerenciar` | `pontos.salvarConfig(db, p, sessao.usuario)` |
| `pontos:saldo` | `pdv.ver` | `pontos.saldo(db, p.cliente_id)` |
| `pontos:historico` | `clientes.ver` | `pontos.historico(db, p.cliente_id)` |
| `pontos:ajustar` | `config.gerenciar` | `pontos.ajustar(db, p, sessao.usuario)` |

### `produtos:*`

| Canal | Permissão | Destino |
|---|---|---|
| `produtos:listar` | `produtos.ver` | `{` |
| `produtos:obter` | `produtos.ver` | `{` |
| `produtos:salvar` | `produtos.editar` | `{` |
| `produtos:excluir` | `produtos.excluir` | `produtos.excluirProduto(db, p.id, sessao.usuario)` |

### `rede:*`

| Canal | Permissão | Destino |
|---|---|---|
| `rede:status` | `config.gerenciar` | `{` |
| `rede:abrirNavegador` | `config.gerenciar` | `{` |
| `rede:aplicar` | `config.gerenciar` | `{` |

### `relatorios:*`

| Canal | Permissão | Destino |
|---|---|---|
| `relatorios:vendas` | `relatorios.ver` | `relatorios.vendasPeriodo(db, p \|\| {})` |
| `relatorios:abc` | `relatorios.ver` | `relatorios.curvaAbc(db, p \|\| {})` |
| `relatorios:paradas` | `relatorios.ver` | `relatorios.pecasParadas(db, p \|\| {})` |
| `relatorios:estoque` | `estoque.ver` | `relatorios.estoqueDetalhado(db, p \|\| {})` |
| `relatorios:receitaPorLoja` | `dashboard.financeiro` | `relatorios.receitaPorLoja(db, p \|\| {})` |
| `relatorios:consignados` | `relatorios.ver` | `relatorios.consignadosMensal(db, p \|\| {})` |
| `relatorios:evento` | `relatorios.ver` | `relatorios.relatorioEvento(db, p \|\| {})` |
| `relatorios:acompanhadas` | `relatorios.ver` | `relatorios.comprasAcompanhadas(db, p \|\| {})` |
| `relatorios:acompanhadasXlsx` | `relatorios.ver` | `{` |
| `relatorios:ranking` | `relatorios.ver` | `relatorios.ranking(db, p \|\| {})` |
| `relatorios:eventos` | `relatorios.ver` | `relatorios.eventosVenda(db, p \|\| {})` |
| `relatorios:rankingPeriodo` | `relatorios.ver` | `relatorios.rankingPeriodo(db, p \|\| {})` |
| `relatorios:rankingPeriodoXlsx` | `relatorios.ver` | `{` |
| `relatorios:rankingXlsx` | `relatorios.ver` | `{` |
| `relatorios:eventoXlsx` | `relatorios.ver` | `{` |
| `relatorios:listarVendasFornecedor` | `relatorios.ver` | `{` |
| `relatorios:reciboConsignado` | `relatorios.ver` | `{` |

### `trocas:*`

| Canal | Permissão | Destino |
|---|---|---|
| `trocas:registrarRapida` | `pdv.ver` | `trocas.registrarRapida(db, p \|\| {}, sessao.usuario)` |
| `trocas:registrar` | `pdv.ver` | `trocas.registrar(db, p, sessao.usuario)` |

### `updater:*`

| Canal | Permissão | Destino |
|---|---|---|
| `updater:verificar` | `config.gerenciar` | `updater.verificarAtualizacao(p.versaoAtual \|\| '0.0.0')` |

### `vales_troca:*`

| Canal | Permissão | Destino |
|---|---|---|
| `vales_troca:consultar` | `vales.ver` | `valesTroca.consultar(db, p.codigo)` |
| `vales_troca:listar` | `vales.ver` | `valesTroca.listar(db)` |

### `vendas:*`

| Canal | Permissão | Destino |
|---|---|---|
| `vendas:importarAnalisar` | `pdv.vender` | `importarVendas.analisar(db, p \|\| {})` |
| `vendas:importarConfirmar` | `pdv.vender` | `importarVendas.confirmar(db, p \|\| {}, sessao.usuario)` |

---

## 8. Banco de dados (37 tabelas)

| Tabela | Colunas |
|---|---|
| `usuarios` | id, nome, usuario, senha_hash, perfil, ativo, criado_em |
| `categorias` | id, nome, pai_id, ativo |
| `marcas` | id, nome |
| `colecoes` | id, nome |
| `fornecedores` | id, nome, cnpj, telefone, email, obs, ativo, criado_em |
| `produtos` | id, referencia, nome, categoria_id, marca_id, colecao_id, fornecedor_id, preco_custo, preco_venda, preco_promo, promo_inicio, promo_fim, estoque_minimo, foto, ativo, criado_em, atualizado_em |
| `variacoes` | id, produto_id, cor, tamanho, codigo_barras, estoque, estoque_minimo, foto, ativo |
| `movimentos_estoque` | id, variacao_id, tipo, qtd, custo_unit, motivo, usuario_id, estoque_id, criado_em |
| `estoques` | id, nome, tipo, loja_id, responsavel, principal, ativo, criado_em |
| `estoque_saldos` | estoque_id, variacao_id, qtd |
| `transferencias` | id, origem_id, destino_id, usuario_id, obs, criado_em |
| `transferencia_itens` | id, transferencia_id, variacao_id, qtd |
| `clientes` | id, nome, cpf, telefone, email, endereco, nascimento, limite_credito, obs, generico, ativo, criado_em |
| `lojas` | id, nome, estoque_id, ativo, criado_em |
| `caixas` | id, loja_id, aberto_em, fechado_em, usuario_abertura, usuario_fechamento, valor_abertura, valor_fechamento_informado, valor_fechamento_calculado, obs |
| `caixa_movimentos` | id, caixa_id, tipo, valor, motivo, usuario_id, criado_em |
| `vendas` | id, caixa_id, loja_id, cliente_id, usuario_id, subtotal, desconto, total, status, obs, desconto_autorizado_por, desconto_motivo, criado_em |
| `venda_itens` | id, venda_id, variacao_id, qtd, preco_unit, desconto, total |
| `venda_pagamentos` | id, venda_id, forma, valor, parcelas, troco, autorizado_por, beneficiario, cortesia_valor |
| `crediario_parcelas` | id, venda_id, cliente_id, numero, valor, vencimento, pago_em, valor_pago |
| `compras` | id, fornecedor_id, numero_nf, total, status, criado_em, recebido_em |
| `compra_itens` | id, compra_id, variacao_id, qtd, custo_unit |
| `financeiro_lancamentos` | id, tipo, descricao, categoria, valor, vencimento, pago_em, valor_pago, origem, origem_id, criado_em |
| `consignacoes` | id, venda_id, produto_id, fornecedor_id, qtd, valor_venda, valor_custo, pct_fornecedor, valor_fornecedor, valor_loja, status, acerto_id, criado_em |
| `auditoria_log` | id, usuario_id, acao, detalhe, criado_em |
| `config` | chave, valor |
| `devolucoes` | id, venda_id, cliente_id, usuario_id, caixa_id, tipo, valor_devolvido, forma_reembolso, motivo, criado_em |
| `devolucao_itens` | id, devolucao_id, variacao_id, qtd, valor_unit, total |
| `vales_troca` | id, codigo, valor_total, valor_usado, cliente_id, devolucao_id, criado_em, usado_em, status, validade |
| `clientes_pontos` | id, cliente_id, tipo, pontos, origem, origem_id, obs, criado_em |
| `categorias_clientes` | id, nome, desconto_percent, ativo |
| `conversas` | id, tipo, chave, criado_em |
| `conversa_membros` | conversa_id, usuario_id, lido_ate |
| `mensagens` | id, conversa_id, autor_id, texto, criado_em |
| `avisos` | id, autor_id, titulo, texto, prioridade, alvo, alvo_ids, ativo, criado_em |
| `aviso_confirmacoes` | aviso_id, usuario_id, confirmado_em |
| `presenca` | usuario_id, origem, tela, ultimo_ping |

> **Armadilha do schema:** `criarBanco()` divide o `schema.sql` pelo caractere
> ponto-e-vírgula. Um ponto-e-vírgula dentro de comentário parte o `CREATE TABLE`
> seguinte, que deixa de ser criado silenciosamente (o erro aparece como
> `[schema] near "x": syntax error`).

> **Armadilha do CHECK:** SQLite não altera `CHECK`. Para aceitar um valor novo
> em `forma`/`tipo` é preciso reconstruir a tabela (ver migrações em `db.js`).
> A guarda da migração deve testar o valor **entre aspas** — sem elas o teste casa
> com nomes de coluna parecidos e a reconstrução nunca roda.

---

## 9. Regra de ouro do estoque

```
variacoes.estoque  =  TOTAL do Salgueiro  =  SUM(estoque_saldos.qtd)
```

O total é a fonte de verdade de tudo que já existia. Os locais em `estoque_saldos`
apenas **repartem** esse total.

| Operação | Total | Local |
|---|---|---|
| Entrada (compra, cadastro) | +N | almoxarifado central +N |
| Venda | −N | local da loja do caixa −N |
| Devolução / cancelamento | +N | local da venda +N |
| Transferência | **igual** | origem −N, destino +N |

### Pontos que mexem em estoque

| Arquivo | Escreve o total | Aplica no local |
|---|---|---|
| `compras.js` | 1 | 1 |
| `devolucoes.js` | 1 | 1 |
| `estoque.js` | 1 | 1 |
| `importar-vendas.js` | 1 | 0 |
| `pdv.js` | 2 | 1 |
| `produtos.js` | 2 | 1 |
| `trocas.js` | 4 | 4 |

> Ao acrescentar um ponto novo que mexa em estoque, ele precisa aparecer nas
> **duas** colunas, senão o total e a soma dos locais divergem.

---

## 10. Invariantes a verificar antes de entregar

1. `node --check` em todo arquivo tocado
2. Todo statement do `schema.sql` executa isolado (o app o divide por ponto-e-vírgula)
3. `variacoes.estoque = SUM(estoque_saldos.qtd)` para toda variação
4. Teste visual no sandbox com login real e 0 erro de JavaScript no console
5. SHA256 conferido entre a origem e o que foi copiado para `Portable/`
6. `docs/MANUAL-DO-USUARIO.md`, `docs/GUIA-RAPIDO.md` e este GRAPHIFY regerados
7. Bloco novo no topo de `src/js/novidades.js` (senão a versão fica sem o selo)
