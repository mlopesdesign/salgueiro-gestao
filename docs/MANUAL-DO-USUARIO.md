# Manual do Usuário — Salgueiro Gestão

**Sistema de gestão para loja de roupas**
Versão 3.7.0 · ML Lopes Design

---

## Sumário

1. [Instalação e primeiro acesso](#1-instalação-e-primeiro-acesso)
2. [Conhecendo a tela](#2-conhecendo-a-tela)
3. [Painel](#3-painel)
4. [PDV — Vendas](#4-pdv--vendas)
5. [Devoluções, trocas e vales](#5-devoluções-trocas-e-vales)
6. [Produtos](#6-produtos)
7. [Categorias](#7-categorias)
8. [Estoque](#8-estoque)
9. [Estoques por local (almoxarifado e loja)](#9-estoques-por-local-almoxarifado-e-loja)
10. [Etiquetas](#10-etiquetas)
11. [Clientes](#11-clientes)
12. [Compras e fornecedores](#12-compras-e-fornecedores)
13. [Financeiro](#13-financeiro)
14. [Relatórios](#14-relatórios)
15. [Ranking](#15-ranking)
16. [Configurações](#16-configurações)
17. [Usuários e permissões](#17-usuários-e-permissões)
18. [Backup e segurança](#18-backup-e-segurança)
19. [Terminal em rede](#19-terminal-em-rede)
20. [Atualizações](#20-atualizações)
21. [Solução de problemas](#21-solução-de-problemas)

---

## 1. Instalação e primeiro acesso

### Instalando

1. Execute o arquivo **Salgueiro Gestao Setup.exe**
2. Confirme a pasta de instalação (o padrão já é o recomendado)
3. Clique em **Instalar**
4. O Windows pode pedir autorização para liberar a porta de rede — aceite

O instalador cria um atalho na área de trabalho e no menu Iniciar.

### Primeiro acesso

Abra o sistema pelo atalho. Na tela de login, use o usuário administrador fornecido na entrega.

> **Importante:** troque a senha do administrador no primeiro acesso, em Configurações → Usuários.

### Onde ficam seus dados

O banco de dados, os backups e o ícone personalizado ficam em:

```
C:\Users\<seu usuário>\AppData\Roaming\SalgueiroGestao\dados
```

Essa pasta **nunca é apagada** por atualizações do sistema.

---

## 2. Conhecendo a tela

A tela é dividida em duas partes:

**Menu lateral (esquerda)** — todas as áreas do sistema. O que aparece depende das suas permissões:

| Ícone | Área | Para quê |
|---|---|---|
| 📊 | Painel | Visão geral do negócio |
| 🛒 | PDV — Vendas | Vender, abrir e fechar caixa |
| 👗 | Produtos | Cadastro de peças |
| 🏷️ | Categorias | Organizar os produtos |
| 📦 | Estoque | Entradas, saídas e conferência |
| 🏢 | Estoques (locais) | Onde cada peça está: almoxarifado, loja, WhatsApp |
| 🚚 | Compras | Pedidos a fornecedores |
| 👥 | Clientes | Cadastro e crediário |
| 💰 | Financeiro | Contas a pagar e receber |
| 📈 | Relatórios | Análises de venda e fechamento de evento |
| 🏆 | Ranking | Produtos mais vendidos |
| 🎫 | Vales-Troca | Créditos emitidos |
| ⚙️ | Configurações | Ajustes do sistema |

No rodapé do menu aparece o usuário logado, o link **sair** e a versão instalada.

**Área principal (direita)** — o conteúdo da área escolhida.

---

## 3. Painel

É a tela inicial. Mostra:

**Cartões do topo**

- **Vendas de hoje** — total vendido no dia e quantidade de vendas. Se houve devolução, aparece uma linha em âmbar logo abaixo com o valor devolvido.
- **Vendas do mês** — mesmo raciocínio, no acumulado do mês.
- **Lucro bruto do mês** — vendas menos o custo das peças vendidas, já descontando devoluções. Mostra também a margem em %.
- **Estoque a preço de venda** — quanto vale seu estoque se tudo for vendido.

> Vendedores sem permissão financeira veem apenas a **quantidade** de vendas, sem valores.

**Gráfico dos últimos 14 dias** — evolução das vendas por dia.

**Precisa de atenção** — alertas clicáveis: variações abaixo do estoque mínimo, contas vencidas, clientes em atraso, aniversariantes do mês.

**Mais vendidos no mês** — top 5 produtos.

**Panorama rápido** — situação do caixa, crediário em aberto, contas a vencer.

> O Painel não atualiza sozinho. Para recarregar, clique em **📊 Painel** no menu.

---

## 4. PDV — Vendas

### Abrindo o caixa

Ao entrar no PDV sem caixa aberto, o sistema pede o **valor inicial** (o troco que você colocou na gaveta). Informe e confirme.

Enquanto o caixa estiver fechado não é possível vender, devolver ou trocar.

### Lançando produtos

No campo de busca (atalho **F2**):

- **Bipe o código de barras** — a peça entra direto na venda
- **Digite o nome ou a referência** — aparece uma lista para escolher

Cada item lançado aparece na lista com quantidade e valor.

### Mudando a quantidade

A coluna **Qtd** aceita as três formas:

- **Bipar de novo** a mesma peça — soma 1
- **Setinhas ▲▼** do campo — sobe ou desce de 1 em 1
- **Digitar o número** — clique no campo (o valor já vem selecionado), digite por cima e aperte **Enter**

Serve para 3 peças iguais sem precisar bipar três vezes. O total da linha muda enquanto você digita. Se pedir mais do que tem em estoque, o sistema avisa e volta para o máximo disponível.

> Isso vale também para os campos de quantidade da **devolução** e da **troca**.

Para tirar uma peça da venda, clique no **✕** da linha.

### Identificando o cliente

Aperte **F4** e busque pelo nome, CPF ou telefone. Isso é obrigatório para vendas no crediário e necessário para acumular pontos.

Se o cliente pertence a uma categoria com desconto (ex.: "VIP — 10%"), o desconto é aplicado automaticamente.

### Descontos

- **Desconto por item** — na própria linha do produto
- **Desconto geral na venda** — pede justificativa (veja abaixo)
- **Desconto automático à vista** — se configurado, aplica um percentual quando o pagamento é em dinheiro ou PIX (não acumula com desconto de categoria)
- **Desconto de categoria do cliente** — aplicado sozinho quando a cliente é identificada

### Desconto na venda — quem autorizou

Até a versão 3.2.1 o desconto exigia **login e senha de administrador**. Parava a fila no balcão e, pior, não registrava nada: a venda guardava só o valor, sem quem liberou nem por quê.

Agora quem está no caixa resolve na hora. Ao finalizar uma venda com desconto, o sistema pede:

| Campo | O que preencher |
|---|---|
| **Autorizado por** | Nome de quem liberou. Campo livre — vale para o dono, o gerente por telefone, um sócio |
| **Motivo** | Por que o desconto foi dado. Ex.: peça com defeito, cliente antiga, fechamento de evento |
| **Sua senha** | A senha de quem está operando o caixa — confirma que o lançamento foi seu |

Os três são obrigatórios. Sem eles a venda não fecha.

> **Não é mais preciso chamar o administrador.** Vendedor, caixa e gerente resolvem sozinhos.

**Onde isso aparece depois:** Relatórios → Evento / Pós-venda → seção **🏷️ Descontos autorizados**, com a venda, a data, o cliente, quem lançou, quem autorizou, o motivo e o valor. O controle deixou de ser uma trava e virou registro.

> Desconto de **categoria de cliente** e resgate de **pontos** não pedem justificativa — vêm da tabela, não da mão do operador.

### Finalizando (F10)

Escolha a forma de pagamento:

| Forma | Observação |
|---|---|
| Dinheiro | Informe o valor recebido; o sistema calcula o troco |
| PIX | — |
| Cartão Débito | — |
| Cartão Crédito | Informe o número de parcelas |
| Crediário | Exige cliente identificado; gera as parcelas |
| Vale-troca | Digite o código VT-XXXXXX; o saldo é abatido |
| Cortesia (brinde) | A peça é dada de graça. Exige informar quem autorizou e para quem foi |

É possível **dividir o pagamento** entre várias formas na mesma venda.

Ao confirmar, o cupom é impresso automaticamente (se a impressora estiver configurada).

### Cortesia (brinde)

Use quando a peça vai sair sem o cliente pagar — brinde para influenciador, presente
para um parceiro, cortesia autorizada pelo dono.

1. Finalize a venda normalmente (**F10**)
2. Em forma de pagamento, escolha **Cortesia (brinde)**
3. Aparecem dois campos **obrigatórios**:
   - **Autorizado por** — quem liberou o brinde
   - **Para quem foi** — quem recebeu
4. Confirme

Sem preencher os dois campos o sistema **não deixa fechar a venda**. Isso existe de
propósito: cortesia sem responsável vira buraco no estoque.

**O que acontece por trás:**

- A venda entra com **valor zero** — não conta como faturamento e não mexe no caixa
- A **peça sai do estoque normalmente**, como em qualquer venda
- **Não há taxa de maquininha**, porque nada foi cobrado
- Se a peça for **consignada**, a comissão do fornecedor é gerada do mesmo jeito —
  a peça é dele e ele precisa receber. Nesse caso a cortesia sai do seu bolso.

> Você pode dar cortesia só de uma parte da venda: coloque a Cortesia como uma das
> formas de pagamento e o restante em dinheiro, cartão ou PIX.

Todas as cortesias aparecem no **Relatório de Evento**, com o valor de tabela e
**quanto custou de verdade para a loja** (pelo preço de custo).

### Consultar preço (F3)

Abre uma busca que mostra preço e estoque **sem lançar nada na venda**. Útil quando o cliente só quer saber o valor.

### Sangria e suprimento

- **Sangria** — retirada de dinheiro do caixa (ex.: levar ao banco)
- **Suprimento** — entrada de dinheiro no caixa (ex.: reforço de troco)

Ambos ficam registrados e entram no fechamento.

### Histórico de vendas

Botão **Histórico** — lista as vendas com filtro por período e busca. Em cada linha você pode:

- **🖨️ Reimprimir** o cupom
- **↩️ Devolver**
- **🔄 Troca**

O status aparece como uma etiqueta colorida: **ok**, **dev. parcial**, **devolvida** ou **cancelada**.

### Cancelar uma venda

No botão **Vendas**, escolha **Cancelar** na linha desejada e informe o motivo.

> **Cancelar** é diferente de **devolver**. Cancelar anula a venda por completo (ela sai dos relatórios e do Painel) e devolve as peças ao estoque. Use quando a venda foi lançada errada. Para o cliente que comprou e depois trouxe a peça de volta, use **Devolver**.

### Fechando o caixa

Clique em **Fechar caixa**. O sistema mostra o esperado por forma de pagamento. Informe quanto há de dinheiro na gaveta — ele calcula a diferença (sobra ou falta) e registra o fechamento.

---

## 5. Devoluções, trocas e vales

### Devolução

Cliente traz a peça e quer o dinheiro de volta.

1. **Vendas** ou **Histórico** → **↩ Devolver** na venda
2. Marque a quantidade que voltou de cada peça
3. Escolha o reembolso:
   - **Dinheiro** — sai do caixa
   - **Estorno/cartão** — registra o estorno
   - **Vale-troca** — gera crédito para uso futuro
4. Informe o motivo (opcional) e confirme

As peças voltam ao estoque automaticamente. Se a venda teve desconto geral, o valor devolvido é calculado proporcionalmente.

### Troca

Cliente traz uma peça e leva outra no lugar. **Qualquer pessoa que opera o PDV pode fazer troca** — vendedor, caixa ou gerente. Não precisa chamar o administrador.

#### Onde fica o botão

Na barra de cima do PDV existe o botão **🔄 Troca** (atalho **F6**). Ele também continua aparecendo em **Vendas do caixa** e no **Histórico**, na linha de cada venda.

#### Passo a passo

1. No PDV, clique em **🔄 Troca** (ou aperte **F6**)
2. **Encontre a venda de origem.** A tela já abre mostrando as vendas de **hoje**. Bipe o cupom, digite o número da venda ou o nome da cliente. Se a compra foi em outro dia, mude as datas **De** e **Até**.
3. Clique em **🔄 Trocar** na linha da venda
4. **Lado esquerdo — O que voltou:** informe a quantidade de cada peça devolvida. O **crédito** é calculado sozinho.
5. **Lado direito — O que vai levar:** busque os produtos e adicione ao carrinho.
6. Veja a **diferença** e resolva conforme o caso (tabela abaixo)
7. Escreva o motivo (opcional) e confirme

#### O desconto da compra acompanha a troca

Se a compra original teve desconto — à vista, de categoria de cliente ou autorizado na hora — **o mesmo percentual vale para a peça nova, inteira**. O painel avisa em verde: *"A compra teve 10% de desconto — o mesmo desconto vale para a peça nova"*.

É como devolver o valor cheio e dar o mesmo desconto na peça nova.

Exemplo: peça de **R$ 100** comprada com **10%** de desconto (a cliente pagou **R$ 90**).

| Ela troca por | Preço de tabela | Com o desconto | Crédito | Resultado |
|---|---|---|---|---|
| Outra de R$ 100 | R$ 100 | R$ 90 | R$ 90 | **nada a acertar** |
| Uma de R$ 200 | R$ 200 | R$ 180 | R$ 90 | cliente paga **R$ 90** |
| Uma de R$ 50 | R$ 50 | R$ 45 | R$ 90 | sobram **R$ 45** a favor dela |

> **A loja não perde em nenhum caso.** Em todos eles a loja fica com 90% da tabela da peça que entregou — exatamente a mesma margem da venda original.

O painel mostra as três linhas antes de você confirmar: preço de tabela, desconto herdado e total já com desconto.

> Compra sem desconto continua igual: a peça nova entra pelo preço cheio.
> Peça dada como **cortesia** fica de fora — não houve valor pago, então a peça nova vai pelo preço de tabela.

#### Os três casos

| Situação | O que o sistema faz |
|---|---|
| **Peça nova mais cara** | Abre o campo de pagamento com o valor já preenchido (já com o desconto herdado). Escolha Dinheiro, PIX, Débito ou Crédito. Não deixa confirmar com valor a menos. |
| **Mesmo valor** | Avisa "nada a acertar". É só confirmar. |
| **Peça nova mais barata** | Você escolhe o que fazer com a diferença a favor da cliente (opções abaixo). |

#### O que fazer com a diferença a favor da cliente

| Opção | O que acontece |
|---|---|
| 🎫 **Vale-troca** | Gera um código com validade para a cliente usar depois. O caixa não é mexido. |
| 💵 **Devolver em dinheiro** | Sai da gaveta agora. Entra como sangria no fechamento do caixa. |
| 💳 **Estornar no cartão** | Fica só o registro no sistema. **O estorno em si você faz na maquininha.** |
| — **Nada** | A cliente abre mão da diferença. A troca fecha sem devolver nada. |

O texto embaixo da opção escolhida explica em uma linha o que vai acontecer, antes de você confirmar.

#### O que acontece por trás

Tudo entra numa **única operação**, que só é gravada se der certo do começo ao fim:

- a peça que voltou **entra no estoque** (total e no estoque do local da loja)
- a peça que a cliente levou **sai do estoque** (total e local)
- é criada uma **nova venda** com o crédito da troca abatendo o valor
- se você escolheu vale, ele é emitido; se escolheu dinheiro, sai a sangria do caixa

> Precisa de **caixa aberto** para fazer troca. Sem caixa aberto o sistema recusa.

### Vales-troca

Um vale é um crédito com código **VT-XXXXXX**.

**Como surge:** de uma devolução com reembolso em vale, ou da diferença a favor da cliente numa troca.

#### O vale sai impresso

Assim que o vale é gerado, o sistema **imprime sozinho** na impressora de cupom — a mesma do comprovante de venda. O papel traz:

- o **código** em destaque
- o **valor**
- até quando é **válido**
- a venda de origem e o nome da cliente
- a explicação de como usar

Entregue o papel à cliente. Se a impressão falhar ou você quiser outra via na hora, o botão **🖨️ Imprimir o vale** fica no próprio aviso.

> Não é preciso mais anotar o código nem pedir para a cliente tirar foto.
> Em terminal na rede, abre a janela de impressão do navegador.

#### Segunda via

A cliente perdeu o papel? Menu **🎫 Vales-Troca** → botão **🖨️ 2ª via** na linha do vale.

> A segunda via sai com o **saldo atual**, não com o valor original. Se o vale era de R$ 150 e ela já usou R$ 50, a 2ª via mostra R$ 100 — o que ela realmente tem para gastar.

**Como usar:** no PDV, ao finalizar a venda, escolha **Vale-troca** como forma de pagamento e digite o código. O sistema mostra o saldo disponível e abate do total. Se sobrar saldo, o vale continua válido.

**Validade:** todo vale nasce com prazo. O padrão é **90 dias** e você muda em **Configurações → PDV**. Depois do vencimento o sistema recusa o código e explica em que dia venceu. Colocando **0** dias, os vales passam a ser emitidos sem vencimento.

> Mudar a validade vale para os vales emitidos **daqui em diante**. Os que já existem mantêm a data que receberam.

**Onde consultar:** menu **🎫 Vales-Troca** — lista todos com valor total, quanto já foi usado, saldo, situação e **até quando vale**. Vale vencido aparece esmaecido, marcado como *vencido*.

---

## 6. Produtos

### Cadastrando

**Produtos** → **+ Novo produto**

**Dados principais:**

- **Nome** (obrigatório)
- **Referência** — seu código interno
- **Categoria**
- **Preço de custo** — quanto você pagou (visível só para quem tem permissão)
- **Preço de venda** (obrigatório)
- **Mínimo padrão** — quando o estoque chegar nesse número, o Painel avisa
- **Foto** — opcional, ajuda a identificar a peça

**Grade — cores e tamanhos:**

Cada linha é uma variação (uma combinação de cor e tamanho). Informe:

| Campo | O que é |
|---|---|
| 📷 Foto | Foto específica desta variação. Clique no ícone para escolher. Útil quando a peça tem cores diferentes |
| Cor | Ex.: Preto. Deixe "Única" se a peça não tem variação de cor |
| Tamanho | Ex.: M. Deixe "U" se é tamanho único |
| Estoque inicial | Quantas peças você tem agora |
| Mínimo | Alerta específico desta variação (se vazio, usa o mínimo do produto) |
| Código de barras | Deixe vazio para o sistema gerar automaticamente |

Use **+ Variação** para adicionar mais linhas e o **✕** para remover.

> Os campos de quantidade começam vazios, com um "0" cinza como dica. Deixar em branco significa zero.

**Peça sem variação de cor ou tamanho:** deixe **Cor** e **Tamanho** em branco e preencha só a quantidade. O sistema cria a variação como **Única / U** com o estoque que você digitou, já lançado no Almoxarifado Central.

> Até a versão 3.5.1 esse caso perdia a quantidade: o produto nascia zerado e era preciso dar entrada pelo módulo Estoque. Corrigido na 3.5.2.

**Ampliar fotos:** passe o mouse sobre qualquer miniatura para ver uma pré-visualização. Clique para abrir em tela cheia. Para trocar a foto de uma variação, clique na miniatura dela — o seletor de arquivos abre. O **✕** que aparece no canto remove a foto.

**Produto consignado:** marque a caixa **🤝 Produto consignado** se a peça é de um fornecedor e você repassa uma parte da venda. Informe o fornecedor e o percentual dele — a cada venda o repasse fica registrado para o acerto.

### Editando

Clique no botão de editar na linha do produto. O campo **Estoque** fica bloqueado na edição — ajustes de quantidade devem ser feitos pela tela **Estoque**, para manter o histórico.

### Duplicar um produto

Serve para cadastrar uma peça parecida com uma que já existe: mesma modelagem em outra estampa, mesma coleção em outra cor.

1. Na linha do produto, clique em **Duplicar**
2. O cadastro abre **já preenchido** com os dados da peça original
3. Ajuste o que muda — nome, referência, preço
4. Salvar

**O que vem junto:** nome (com "(cópia)" no fim), categoria, preços, mínimo, consignação, foto do produto, e toda a grade de cor e tamanho com as fotos das variações.

**O que não vem:** o **estoque começa zerado** e cada variação ganha um **código de barras novo** — dois produtos nunca podem dividir o mesmo código.

> Nada é gravado até você clicar em salvar. Se abrir por engano, é só fechar.
> A referência vem em branco de propósito, para você não ficar com duas peças iguais na busca.

### Duplicar uma variação

Dentro do cadastro, na grade de cor e tamanho, cada linha tem um botão de **duplicar** (⎘).

Clique nele e a linha é copiada logo abaixo, já com a **cor**, o **mínimo** e a **foto** — o cursor vai direto para o campo Tamanho, que é quase sempre o que muda. Serve para cadastrar P, M, G e GG da mesma cor sem redigitar tudo.

A cópia nasce com estoque vazio e ganha código de barras próprio ao salvar.

### Exportar lista

Botão **📋 Exportar lista**. Um formulário permite escolher:

- **Categoria** — todas ou uma específica
- **Estoque** — todos, só com estoque, ou só sem estoque
- **Colunas** — referência, categoria, cor/tamanho, código de barras, estoque, custo, preço de venda, total, e uma coluna em branco **"Conferido"** para marcar à mão
- **Organização** — agrupado por categoria (com subtotais) ou lista alfabética
- **Formato** — PDF (abre para imprimir) ou Excel

---

## 7. Categorias

Organizam os produtos (ex.: Blusas, Calças, Vestidos). Servem para filtrar telas, agrupar relatórios e organizar a lista de conferência.

**Categorias** → **+ Nova categoria** → nome → salvar.

Ao excluir, a categoria é apenas desativada — o histórico é preservado. Se você criar depois uma categoria com o mesmo nome, o sistema reativa a antiga.

---

## 8. Estoque

Três abas:

### Movimentar

Busque a peça (bipe ou digite) e registre:

- **Entrada** — chegou mercadoria
- **Saída** — perda, doação, uso próprio
- **Ajuste** — correção após contagem física

Sempre informe o motivo. Toda movimentação fica registrada com data, usuário e motivo.

### Histórico (Kardex)

Todas as movimentações de uma peça em ordem cronológica: vendas, entradas, devoluções, ajustes. Use para investigar diferenças de estoque.

### Reposição

Lista as variações que estão **no ou abaixo do estoque mínimo**, ordenadas pela urgência. É a sua lista de compras.

O sistema usa o mínimo específico da variação; se ela não tiver um, usa o mínimo do produto.

### Exportar

Os botões **📄 Exportar PDF** e **📊 Exportar Excel** no topo geram um relatório completo do estoque com valores de custo e venda.

---

## 9. Estoques por local (almoxarifado e loja)

Menu **🏢 Estoques (locais)**.

A tela **Estoque** (a anterior) responde *"quantas peças eu tenho no total?"*.
Esta responde *"**onde** essas peças estão?"*.

### A ideia em uma frase

O total do Salgueiro é sempre a soma de todos os locais.

Se você tem 18 camisas no total e desceu 4 para a loja, ficam 14 no almoxarifado e
4 na loja — 14 + 4 = 18. **Transferir não cria nem destrói peça, só muda de lugar.**

| O que acontece | Total | Almoxarifado | Loja |
|---|---|---|---|
| Chega mercadoria (compra) | sobe | sobe | igual |
| Desce 10 peças para a loja | **igual** | cai 10 | sobe 10 |
| Vende 1 peça na loja | cai 1 | igual | cai 1 |
| Sobe 3 peças de volta | **igual** | sobe 3 | cai 3 |

### Os cartões do topo

Cada cartão é um local, com o total de peças e quantos tipos diferentes há nele.
Clique num cartão para ver o conteúdo dele embaixo.

O **Almoxarifado Central** vem marcado com a etiqueta `central`. É o depósito
principal e não pode ser apagado.

### Que locais posso ter

| Tipo | Para quê |
|---|---|
| 🏢 Almoxarifado | O depósito central, onde fica o grosso da mercadoria |
| 🏪 Loja | O que está na arara, pronto para vender |
| 🧍 Pessoa | Alguém pegou peças para vender fora |
| 📱 Venda online | Peças separadas para WhatsApp, Instagram etc. |
| 📦 Outro | Qualquer outro caso |

**Toda loja que você cadastrar já nasce com o estoque dela**, vazio.
Para criar os demais, use **+ Novo estoque**.

> Para editar um local, clique nele **com o botão direito**.

### Descer peças para a loja (transferência)

Você escolhe o **produto** e todas as cores e tamanhos dele aparecem de uma vez, com o que há na origem. Digite quanto quer mandar de cada um e transfira.

1. **🏢 Estoques** → **📥 Transferir peças**
2. Confira **De** (origem) e **Para** (destino)
3. No campo **Escolha o produto**, digite o nome, a referência ou bipe o código de barras
4. Clique no produto — a grade abre com todas as variações:

```
VESTIDO LONGO  Ref. R1              [Levar tudo] [Limpar] [✕]
  Cor      Tamanho   Na origem   Transferir
  Preto    G                 0   (sem peças)
  Preto    M                 7   [   7 ]
  Vinho    M                 8   [   3 ]
  Vinho    P                 5   [     ]
```

5. Digite a quantidade em cada linha que quiser mandar
6. Repita a busca para acrescentar **outros produtos** ao mesmo romaneio
7. Escreva a observação (ex.: "descida para a feijoada")
8. **Transferir e gerar romaneio**

| Botão | O que faz |
|---|---|
| **Levar tudo** | Preenche cada linha com o total que há na origem |
| **Limpar** | Zera as quantidades daquele produto |
| **✕** | Tira o produto do romaneio |

A coluna **Total na loja**, ao lado de "Na origem", mostra o total daquela cor e tamanho somando **todos os locais**. Se a peça aparece com 0 na origem mas 5 no total, ela existe — está em outro estoque.

O cabeçalho do produto conta quantas variações ele tem e quantas têm peça na origem escolhida. Serve para conferir de bate-pronto se está faltando alguma.

> **Só entra no romaneio o que você digitou.** Linha em branco é ignorada.
> Variação sem peças na origem aparece esmaecida e não aceita quantidade, mas
> continua na lista — você vê que ela existe.
> Se digitar mais do que existe, o sistema avisa e volta para o máximo disponível.

No rodapé aparece o resumo: quantas peças de quantos produtos vão no romaneio.


### O romaneio

Ao confirmar a transferência, um aviso clicável aparece no canto da tela. Clique
nele para abrir o romaneio na hora. O sistema também abre o **visualizador do romaneio**,
que mostra:

- Número, data e hora
- De onde saiu e para onde foi
- Quem fez
- A lista das peças com código de barras
- Uma coluna **"Conferido"** em branco, para marcar peça por peça na conferência
- Duas assinaturas: **entregue por** e **recebido por**

Na janela do romaneio há dois botões:

- **🖨️ Imprimir** — abre a impressora para imprimir em papel
- **📄 Baixar PDF** — salva o romaneio como arquivo PDF, pronto para mandar pelo **WhatsApp ou e-mail** sem precisar imprimir

Todos os romaneios ficam guardados na parte de baixo da tela. Clique em **📋 Ver**
em qualquer um para abrir o visualizador e imprimir ou baixar o PDF novamente.

O botão **📊 Relatório PDF** (no topo da seção de romaneios) gera um PDF com o
histórico completo de todas as transferências — útil para conferência geral.

### Balanço de um local

Selecione o local no cartão. A tabela mostra, para cada peça:

- Quanto tem **neste estoque**
- Quanto é o **total do Salgueiro** (para comparar)
- O valor de venda

Os botões **🖨️ Imprimir balanço** e **📊 Excel** geram a lista para conferência.
O Excel traz uma coluna **"Conferido"** em branco.

### Quando a peça acaba na loja

Se durante a venda a peça já tiver acabado na loja, o sistema **avisa** que ela
acabou e que é para buscar no Almoxarifado Central — mas **não trava a venda**.
Isso evita parar o atendimento no meio de um evento. Depois você registra a descida
para as contas voltarem a bater.

### Começando a usar

Na primeira vez, **todo o estoque vai para o Almoxarifado Central** e as lojas ficam
zeradas. Isso é de propósito: você faz o balanço do que realmente está na arara e
desce essas peças por romaneio. A partir daí os dois números andam certos.

---

## 10. Etiquetas

As etiquetas são de **60×40mm** (padrão Pimaco TR6040) e trazem o nome da loja, o nome da peça, cor, referência, o tamanho em destaque e o código de barras EAN-13.

**Etiqueta de um produto:** em **Produtos**, clique no botão **🏷️** da linha. Escolha quantas etiquetas de cada variação e o que mostrar (preço, referência, cor/tamanho).

**Etiquetas em lote:** marque as caixinhas dos produtos desejados e clique em **🏷️ Imprimir etiquetas**. Escolha entre um número fixo de cópias por peça ou uma etiqueta para cada unidade em estoque.

> Cor "Única" e tamanho "U" são omitidos automaticamente, deixando a etiqueta limpa para peças sem variação.

---

## 11. Clientes

### Cadastro

**Clientes** → **+ Novo cliente**. Nome, CPF, telefone, e-mail, endereço e data de nascimento.

A data de nascimento alimenta o alerta de aniversariantes do mês no Painel.

### Categorias de clientes

Permitem agrupar clientes e dar **desconto automático** (ex.: "VIP — 10%"). Quando o cliente é identificado no PDV com **F4**, o desconto entra sozinho.

Somente administradores podem criar, editar ou excluir categorias de clientes.

### Crediário

Vendas no crediário geram parcelas vinculadas ao cliente. Na ficha do cliente você vê o que está em aberto e registra os recebimentos.

O Painel avisa sobre clientes em atraso.

### Importar e exportar

Disponível apenas para administradores, permite trazer uma lista de clientes de outro sistema ou exportar a sua base.

---

## 12. Compras e fornecedores

### Fornecedores

Cadastro com nome, CNPJ ou CPF e contato. Necessário para pedidos de compra e para produtos consignados.

### Pedidos de compra

1. **Compras** → novo pedido
2. Escolha o fornecedor
3. Adicione os produtos e as quantidades
4. Salve

Quando a mercadoria chegar, use **Receber** — o estoque é atualizado automaticamente e a conta a pagar é gerada no Financeiro.

Pedidos podem ser cancelados enquanto não recebidos.

---

## 13. Financeiro

### Contas

Lançamentos a **pagar** e a **receber**, com vencimento, categoria e situação. Use **Baixar** para marcar como pago.

Contas vencidas aparecem como alerta no Painel.

### Fluxo do mês

Resumo do mês: entradas (vendas, já descontando devoluções), saídas e o resultado. Mostra também o custo das mercadorias vendidas.

### Consignados

Acompanha as peças de terceiros vendidas e quanto você deve repassar a cada fornecedor. O botão **Acertar** registra o pagamento do repasse.

---

## 14. Relatórios

### Vendas

Escolha o período. Traz o total vendido, número de vendas, ticket médio, e as quebras por dia, por vendedor e por forma de pagamento. Devoluções já são descontadas.

### Por loja

Comparativo de faturamento entre lojas, quando há mais de uma cadastrada.

### Consignados

Vendas de peças consignadas por fornecedor, com o valor do repasse.

### Curva ABC

Classifica os produtos por participação no faturamento:

- **Classe A** — os poucos produtos que representam a maior parte do faturamento
- **Classe B** — participação intermediária
- **Classe C** — muitos produtos com pouca representatividade

Use para decidir onde concentrar compras e espaço na loja.

### Peças paradas

Produtos sem venda no período escolhido. Candidatos a promoção ou liquidação.

### 🎪 Evento / Pós-venda

Este é o fechamento de um evento — a feijoada, o sábado de samba, o dia de venda.

**Por que é diferente dos outros relatórios:** a loja abre num dia e fecha no outro.
Um evento que começa sábado às 20h e termina domingo às 4h da manhã não cabe num
relatório "por dia". Por isso aqui o período é por **data E hora**.

**Como usar:**

1. **Início** e **Fim** — informe data e hora. O botão **Sáb 20h → Dom 4h** já
   preenche o formato mais comum
2. **Pix recebido** — escolha se o Pix do evento entrou **na chave** (sem taxa) ou
   **na maquininha** (0,49%)
3. Marque quais **dados entram no relatório** (veja abaixo)
4. **Gerar relatório**

**O que você pode incluir:**

| Seção | O que mostra |
|---|---|
| Resumo do evento | Os cartões e o fechamento com o líquido a receber |
| Produtos vendidos | Lista de tudo que saiu, com a quantidade de cada peça |
| Lista de vendas | Cada venda, com cliente, forma de pagamento e taxa |
| Itens de cada venda | Os produtos dentro de cada venda (já vêm abertos) |
| Formas de pagamento e taxas | Quanto entrou por forma e quanto a maquininha cobrou |
| Comissão de consignados | Quanto pagar a cada fornecedor |
| Cortesias (brindes) | O que foi dado, para quem, quem autorizou e o custo |
| Por vendedor(a) / Por categoria | Quebras extras |

**O fechamento** segue esta conta, de cima para baixo:

```
   Faturamento bruto
(–) Devoluções
=   Faturamento líquido
(–) Taxas da maquininha
(–) Comissão de consignados
=   LÍQUIDO A RECEBER
```

**Taxas usadas** (Mercado Pago Smart 2):

| Forma | Taxa |
|---|---|
| Pix na chave | 0% |
| Pix na maquininha | 0,49% |
| Débito | 0,99% |
| Crédito à vista | 3,05% |
| Crédito 2x a 6x | 3,25% |

**Exportar:** **🖨️ Imprimir / PDF** (na janela de impressão escolha "Salvar como
PDF" para enviar por WhatsApp) e **📊 Excel**, que gera uma aba para cada seção.

---

### 📦 Estoque (conferência e inventário)

A tela **Estoque** mostra uma lista corrida, variação por variação, sem somar nada. Este relatório é o estoque **organizado e somado**:

```
VESTIDO LONGO                    Almox.  Loja   TOTAL
  Vinho / M                          4     2       6
  Vinho / G                          3     0       3
  Preto / M                          1     5       6
  Total do produto                   8     7      15

BLUSA SEDA
  Preto / P                          2     1       3
  Total do produto                   2     1       3

TOTAL GERAL                         10     8      18
```

#### Para que serve

| Situação | O que fazer |
|---|---|
| **Bater o estoque com o físico** | Marque **Coluna "Contado"**, imprima e conte peça por peça. O papel sai com espaço em branco para escrever a contagem e a diferença |
| **Conferir uma remessa que chegou** | Preencha **Cadastrados de/até** com o dia do recebimento |
| **Conferir uma remessa antiga** | Em **Agrupar por**, escolha **Data de cadastro**: cada dia vira um bloco separado, com o total daquele dia |
| **Ver onde está cada peça** | Deixe **Colunas por local** marcado |
| **Saber quanto vale o estoque** | Deixe **Valor de custo** e **Valor de venda** marcados |

#### Filtros

- **Categoria** e **Fornecedor**
- **Situação:** só com estoque · todos · só zerados
- **Cadastrados de / até** — o período em que os produtos foram cadastrados
- **Agrupar por:** Produto · Data de cadastro · Categoria

#### O que o relatório destaca

- Peça **abaixo do estoque mínimo** aparece com a linha marcada e um ▼ ao lado do total
- Se alguma peça está no total mas **sem lugar definido**, aparece um aviso em âmbar no topo. Isso acontece quando a peça entrou no sistema mas nunca foi distribuída entre os locais — resolva em **🏢 Estoques**

#### Bater o começo dos trabalhos com hoje

Marque **Mostrar movimentação**. Aparecem quatro colunas novas ao lado do que está em estoque:

| Coluna | O que é |
|---|---|
| **Entrou** | Tudo que entrou: estoque inicial do cadastro e compras recebidas |
| **Vendeu** | Peças vendidas |
| **Devolv.** | Peças que voltaram por devolução ou troca |
| **Outros** | Ajustes manuais e inventário |
| **Deveria ter** | Entrou − Vendeu + Devolvido ± Outros |

Ao lado fica **Em estoque** (o que o sistema diz que tem hoje) e **Dif.** — a diferença entre os dois. Um **✓** significa que bate.

O quadro **Fechamento**, no alto da folha, resume a conta:

```
   Entrou                 150
(−) Vendido                32
(+) Devolvido               3
(±) Ajustes                 0
=   Deveria ter           121
    Em estoque hoje       121
    Diferença               ✓ bate
```

> **Transferência entre locais não entra nessa conta** — ela só muda a peça de lugar, o total da loja não muda.

**Período das vendas:** deixe **Vendas de/até** em branco para contar desde sempre — é assim que se bate o começo dos trabalhos com hoje. Preencha só quando quiser um recorte (ex.: o que vendeu nesta semana).

> Se aparecer diferença, na maioria das vezes é estoque que já existia antes do período escolhido. Limpe as datas de venda e gere de novo.

#### Totais por grupo

Quando você agrupa por **data** ou **categoria**, cada grupo ganha a própria linha de total no fim — além do TOTAL GERAL. Assim dá para fechar remessa por remessa.

Desmarcando **Mostrar cada variação**, o relatório fica só com os totais por produto: uma folha para a visão geral, em vez do detalhamento.

> Este relatório é uma **foto de agora**. As datas do topo da tela de Relatórios não valem aqui: quem manda são os filtros da própria aba.

Botões **🖨️ Imprimir** e **📄 PDF** no topo da tela, e **📊 Excel** na própria aba. As colunas exportadas são as mesmas que você marcou.

---

## 15. Ranking

Menu **🏆 Ranking**. Mostra os produtos mais vendidos.

### Escolhendo o período

A loja não abre todo dia, então não adianta um ranking fixo de "hoje". Você escolhe:

**🎪 Por evento** (o mais usado) — o sistema **descobre sozinho** os dias em que a
loja vendeu e monta a lista para você escolher:

```
sáb 01/08 21:20 → dom 02/08 02:15 · 12 venda(s) · R$ 3.750,00
qui 30/07 19:30 → 21:00 · 5 venda(s) · R$ 890,00
sáb 25/07 20:15 → dom 26/07 03:05 · 18 venda(s) · R$ 4.120,00
```

Vendas separadas por mais de 6 horas viram eventos diferentes — por isso o sábado
que vira domingo aparece como **um evento só**.

**📅 Data e hora** — para informar um período na mão.

**Mês atual** e **Ano atual** — atalhos.

### Comparar com

Ao lado do evento há o campo **Comparar com**. O padrão é **evento anterior
(automático)**, mas você pode escolher um evento específico ou não comparar.

É daqui que sai a coluna de posição:

| Sinal | Significado |
|---|---|
| ▲3 | Subiu 3 posições em relação ao outro evento |
| ▼2 | Caiu 2 posições |
| novo | Não tinha vendido no evento comparado |
| — | Ficou na mesma posição |

### Peças ou receita

O botão **Peças vendidas / Receita** troca a ordenação. Vale olhar os dois: um
chaveiro de R$ 15 pode liderar em quantidade e sumir no ranking de dinheiro.

### O que mais aparece

- **🏷️ Categorias mais vendidas**
- **📐 Cor e tamanho que mais saem** — com o **estoque atual** ao lado. Quando está
  zerado aparece em vermelho: é a sua lista de reposição
- **👑 Melhores clientes** — quem mais gastou
- **⏰ Movimento por hora** — em que horário a loja mais vendeu

### Imprimir

Na tela aparecem os **10 primeiros**. A **impressão/PDF** e o **Excel** trazem a
**lista completa**, sem corte.

---

## 16. Configurações

### Aparência

- **Nome e subtítulo da loja** — aparecem no menu e nos documentos
- **Logo do sistema** — exibida no menu lateral
- **Logo do cupom térmico** — pode ser diferente da logo do sistema
- **Ícone do aplicativo** — o ícone da barra de tarefas e do atalho. Aceita arquivo `.ico` ou uma imagem PNG quadrada (convertida automaticamente). Fica guardado na pasta de dados, então **não é perdido em atualizações**. O botão **Voltar ao padrão** restaura o original.
- **Temas prontos e cores** — cor principal, cor do menu e cor de destaque. Aplicadas na hora em todo o sistema.

### Dados da loja

Razão social, CNPJ, endereço e contato. Usados nos documentos impressos.

### Lojas

Cadastro de filiais, quando houver mais de um ponto de venda.

Ao criar ou editar uma loja, você escolhe qual **estoque ela usa** quando faz uma venda:

| Opção | Quando usar |
|---|---|
| Criar estoque próprio | Loja tem seu próprio depósito/arara separada |
| Almoxarifado Central | Loja retira direto do central, sem controle local |
| Estoque de outra loja | Duas lojas compartilham o mesmo espaço — ex.: "Loja WhatsApp" usa o estoque da loja física |

> Cada venda nessa loja vai debitar do estoque escolhido. Se a peça acabar nesse estoque, o caixa recebe um aviso mas não é bloqueado.

### Pontos

Programa de fidelidade: define quantos pontos o cliente ganha por real gasto e quanto vale cada ponto.

### PDV

- **Desconto automático à vista** — ativa ou desativa, define o percentual e o valor mínimo da compra
- **Validade do vale-troca** — quantos dias o vale vale a partir da emissão. Padrão **90 dias**; **0** emite sem vencimento. Vale vencido é recusado no pagamento. A mudança só afeta os vales emitidos daqui em diante.

### Impressoras

Escolha a impressora do **cupom térmico** (80mm) e a de **etiquetas** (60×40mm). Há um botão de teste para cada uma.

A impressão é silenciosa — não abre janela de diálogo.

### Rede

Ativa o acesso de outros computadores da loja. Veja a seção [Terminal em rede](#19-terminal-em-rede).

### Backup

Backup manual e restauração. Veja [Backup e segurança](#18-backup-e-segurança).

### Nuvem

Backup automático em Google Drive ou OneDrive.

### Licença

Situação da licença e validade.

### Atualização

Verifica se há versão nova e instala.

### Usuários

Cadastro de usuários e permissões.

### Categorias de clientes

Grupos de clientes com desconto automático.

---

## 17. Usuários e permissões

Cada pessoa deve ter seu próprio usuário. Isso permite saber quem fez cada venda, devolução ou ajuste de estoque.

**Perfis:**

- **Administrador** — acesso total
- **Demais usuários** — acesso conforme as permissões marcadas

**Permissões** controlam o que a pessoa vê e faz: vender, cancelar venda, fazer devolução, ver custo dos produtos, ver dados financeiros, movimentar estoque, gerenciar clientes, alterar configurações, entre outras.

> Um vendedor sem a permissão financeira não vê faturamento, lucro nem valor de estoque no Painel — apenas a quantidade de vendas.

Para trocar a senha de alguém, entre em Configurações → Usuários, edite o usuário e defina a nova senha.

---

## 18. Backup e segurança

### Backup automático

O sistema faz uma cópia do banco **uma vez por dia**, na primeira vez que é aberto. Mantém as **últimas 30 cópias**, em:

```
C:\Users\<seu usuário>\AppData\Roaming\SalgueiroGestao\dados\backups
```

### Backup manual

Configurações → **💾 Backup** → **Fazer backup agora**. Escolha onde salvar.

> **Recomendação:** faça um backup manual em pendrive ou nuvem pelo menos uma vez por semana. O backup automático fica no mesmo computador — se o HD falhar, você perde tudo.

### Backup na nuvem

Configurações → **☁️ Nuvem** — conecta com Google Drive ou OneDrive para envio automático.

### Restaurando

Configurações → **💾 Backup**. A tela lista todas as cópias disponíveis, e cada linha mostra:

| Coluna | O que é |
|---|---|
| **Data e hora** | Quando a cópia foi feita |
| **Origem** | 🛡️ antes de atualizar · ✋ manual · 🗓️ automático do dia |
| **Conteúdo** | Quantas vendas, produtos e clientes existem naquela cópia |
| **Tamanho** | O tamanho do arquivo |

Clique em **↩️ Restaurar** na linha desejada. Antes de trocar qualquer coisa, o sistema mostra os números lado a lado — o que você tem hoje contra o que a cópia tem — e **avisa quando o backup tem menos dados que o atual**. Confirmando, o sistema restaura e **reinicia sozinho**.

> **Backup danificado não ganha botão de restaurar.** O sistema abre cada cópia e confere se as tabelas essenciais estão lá antes de oferecê-la.

Para restaurar um arquivo `.db` que você guardou em pendrive ou nuvem, use **↩️ Restaurar de um arquivo…**.

> A restauração **substitui todos os dados atuais**. O sistema faz uma cópia de segurança do estado atual antes de trocar.

### Proteções automáticas

- **Antes de qualquer atualização** o sistema faz um backup sozinho. Se o backup falhar, a atualização é **cancelada** — nunca começa sem ponto de retorno.
- Antes de reiniciar para aplicar a atualização, tudo que estava em aberto é gravado.
- **No boot**, se o banco vier vazio ou sem alguma tabela essencial, o sistema procura a cópia boa mais recente, restaura sozinho, guarda o arquivo com problema à parte e avisa você na tela.

---

### Quando chega mensagem

Três avisos ao mesmo tempo, porque nem toda máquina da loja tem som:

- Uma **etiqueta amarela** ao lado do balão, com quantas mensagens não lidas você tem. Ela **fica na tela até você ler**
- Um **aviso rápido** mostrando quem mandou e o começo do texto — clique nele para abrir a conversa. Some sozinho em alguns segundos
- O número no **balão** e um bip, se o computador tiver caixa de som

> Dispensar o aviso rápido no ✕ **não** apaga a etiqueta. Ela só sai quando você abre e lê.

---

## 19. Terminal em rede

Permite que outro computador, **celular ou tablet** da loja acesse o sistema pelo navegador, usando o mesmo banco de dados.

### Ligando

1. No computador principal: **Configurações → 🌐 Rede** → ativar
2. O sistema mostra o endereço, algo como `http://192.168.0.10:8750`
3. No outro aparelho, abra o navegador e digite esse endereço
4. Faça login normalmente, com o usuário de cada pessoa

> O computador principal precisa ficar **ligado e com o sistema aberto** — é ele que guarda os dados.
> Todos precisam estar na **mesma rede** (mesmo Wi‑Fi ou cabo).

### No celular e no tablet

O sistema se adapta à tela do aparelho:

- O menu vira uma **gaveta**: toque no **☰** no canto superior esquerdo para abrir, escolha a tela e ele fecha sozinho
- Botões e campos ficam **maiores**, próprios para o dedo
- No PDV, o carrinho fica em cima e os totais embaixo
- O botão **Finalizar venda** fica fixo na base da tela
- Tabelas largas (estoque, relatórios) **rolam para o lado** em vez de espremer tudo

> **Dica:** no navegador do celular, use "Adicionar à tela de início". O sistema abre como se fosse um aplicativo, sem a barra de endereço.

**O que muda no aparelho pela rede:** a impressão sai pela janela de impressão do próprio aparelho, não pela impressora térmica do balcão. Cupom e vale continuam sendo impressos silenciosamente **só no computador principal**.


## 20. Atualizações

O sistema verifica atualizações sozinho pouco depois de abrir. Havendo versão nova, aparece um aviso no menu lateral e uma mensagem na tela.

Para atualizar: Configurações → **🔄 Atualização** → **Baixar e instalar**. O sistema reinicia sozinho ao terminar.

Seus dados, configurações e o ícone personalizado **não são afetados** pela atualização.

### O que mudou em cada versão

Na mesma tela, do lado direito, fica o quadro **📢 O que mudou**: a lista de todas as
versões e o que cada uma trouxe, escrita em linguagem simples.

- A versão que você está usando aparece com o selo verde **INSTALADA**
- Se houver uma versão mais nova que a sua, ela aparece com o selo âmbar **DISPONÍVEL**
- Clique em qualquer versão para abrir a lista de mudanças

Use isso depois de atualizar, para saber o que apareceu de novo no sistema.

---

## 21. Solução de problemas

| Problema | O que fazer |
|---|---|
| **"Nenhum caixa aberto"** | PDV → Abrir caixa |
| **Cupom não imprime** | Configurações → Impressoras → confira a impressora e use o botão de teste |
| **Etiqueta sai cortada** | Confirme que o papel é 60×40mm e que a impressora certa está selecionada |
| **Painel com número estranho** | Clique em 📊 Painel no menu para recarregar |
| **Terminal não conecta** | Veja a seção [Terminal em rede](#19-terminal-em-rede) |
| **Esqueci a senha** | Peça a um administrador para redefinir |
| **Produto não aparece na busca** | Verifique se está ativo e se tem o código de barras correto |
| **Estoque diferente da contagem** | Estoque → Kardex para ver o histórico; corrija com um Ajuste |
| **"Acabou na loja, pegue no almoxarifado"** | A peça saiu da arara sem a descida ter sido registrada. Faça a transferência em 🏢 Estoques (locais) |
| **A loja aparece com 0 peças** | Normal logo após a atualização: tudo começa no Almoxarifado Central. Faça o balanço e desça por romaneio |
| **Ranking vazio** | Você está vendo um período sem venda. Troque para **Por evento** e escolha um evento da lista |
| **Não consigo fechar a cortesia** | Os campos "Autorizado por" e "Para quem foi" são obrigatórios |
| **Pede senha de administrador no desconto** | Corrigido na 3.3.0. Agora é a sua própria senha, mais quem autorizou e o motivo |
| **Não sei quem deu um desconto** | Relatórios → Evento → seção 🏷️ Descontos autorizados |
| **A foto da variação some ao salvar** | Corrigido na 3.3.0. Atualize o aplicativo |
| **Categoria de cliente perdeu o desconto** | Bug corrigido na 3.3.0. Reponha o percentual em Clientes → Categorias |
| **Preciso conferir o estoque na mão** | Relatórios → 📦 Estoque → marque "Coluna Contado" → Imprimir |
| **Chegou mercadoria e quero conferir** | Relatórios → 📦 Estoque → preencha "Cadastrados de/até" |
| **Não conferi no dia do recebimento** | Relatórios → 📦 Estoque → Agrupar por **Data de cadastro** |
| **Quero bater o estoque desde o começo** | Relatórios → 📦 Estoque → marque "Mostrar movimentação" e deixe as datas de venda em branco |
| **O relatório acusa diferença** | Costuma ser estoque anterior ao período. Limpe "Vendas de/até" e gere de novo |
| **Aviso de peça sem lugar definido** | A peça existe no total mas não foi distribuída. Vá em 🏢 Estoques e faça a distribuição |
| **Preciso cadastrar peça igual a outra** | Botão **Duplicar** na linha do produto |
| **A cliente perdeu o vale-troca** | 🎫 Vales-Troca → botão **🖨️ 2ª via** na linha (sai com o saldo atual) |
| **O vale não imprimiu** | Clique em **🖨️ Imprimir o vale** no próprio aviso. Sem impressora configurada, abre a janela de impressão |
| **Cadastrei peça e o estoque ficou zerado** | Corrigido na 3.5.2. Atualize e confira em Relatórios → 📦 Estoque, filtro "Cadastrados de/até" |
| **Escrevi no chat e ninguém viu** | Corrigido na 3.6.0 — o canal geral não avisava a equipe |
| **Não consigo excluir o Consumidor final** | É cliente do sistema: recebe as vendas sem identificação |
| **Não consigo digitar a quantidade** | Corrigido na versão 3.2.0. Clique no campo Qtd (o valor já vem selecionado), digite por cima e aperte Enter |
| **A troca não conclui** | Corrigido na versão 3.2.0 — o sistema travava ao confirmar. Atualize o aplicativo |
| **Não acho o botão de troca** | Está na barra de cima do PDV: **🔄 Troca** (ou tecla **F6**) |
| **"Nenhum caixa aberto" ao trocar** | A troca gera uma venda, então precisa de caixa aberto. Abra o caixa e refaça |
| **Não acho a venda para trocar** | A busca começa no dia de hoje. Mude as datas **De** e **Até** se a compra foi outro dia |
| **A venda não tem botão 🔄 Trocar** | A venda foi cancelada ou já teve todas as peças devolvidas |
| **"Este vale-troca venceu em..."** | O vale passou do prazo. O prazo padrão fica em Configurações → PDV |
| **Sistema não abre** | Reinicie o computador. Persistindo, entre em contato com o suporte |

### Diferença entre cancelar e devolver

Esta confusão é comum e afeta os relatórios:

- **Cancelar** — a venda não deveria ter acontecido (lançamento errado). Ela some do Painel e dos relatórios.
- **Devolver** — a venda aconteceu, mas o cliente trouxe a peça de volta. A venda continua no histórico e o valor devolvido aparece separado.

---

**Suporte técnico**
ML Lopes Design — mlopesdesign@gmail.com

*Manual referente à versão 3.7.0*
