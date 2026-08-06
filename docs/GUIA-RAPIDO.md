# Guia Rápido — Salgueiro Gestão

**As principais funções do dia a dia, em uma folha.**

---

## Começando o dia

1. Abra o **Salgueiro Gestão** pelo ícone da área de trabalho
2. Digite seu **usuário** e **senha**
3. Vá em **🛒 PDV — Vendas** e clique em **Abrir caixa**
4. Informe quanto tem de dinheiro na gaveta (troco inicial) e confirme

> Sem caixa aberto não é possível vender.

---

## Fazer uma venda

| Passo | O que fazer |
|---|---|
| 1 | Bipe o código de barras da peça (ou digite o nome) |
| 2 | Repita para cada peça |
| 3 | Se o cliente é cadastrado, aperte **F4** e busque pelo nome |
| 4 | Aperte **F10** para finalizar |
| 5 | Escolha a forma de pagamento e confirme |

**Teclas de atalho no PDV:**

- **F2** — ir para o campo de busca
- **F3** — consultar preço (sem lançar na venda)
- **F4** — identificar o cliente
- **F6** — fazer uma troca
- **F10** — finalizar a venda

**Mudar a quantidade de uma peça:** clique no campo **Qtd**, digite o número por cima
e aperte **Enter**. Também funciona pelas setinhas ▲▼ ou bipando a peça de novo.

**Formas de pagamento:** Dinheiro · PIX · Cartão Débito · Cartão Crédito · Crediário · Vale-troca · **Cortesia (brinde)**

> Pagamentos em dinheiro ou PIX podem ter desconto automático à vista, se estiver configurado.

---

## Dar uma peça de cortesia (brinde)

1. Faça a venda normalmente e aperte **F10**
2. Em forma de pagamento, escolha **Cortesia (brinde)**
3. Preencha os dois campos **obrigatórios**:
   - **Autorizado por** — quem liberou
   - **Para quem foi** — quem recebeu
4. Confirme

> A venda entra com **valor zero** (não conta como faturamento, não mexe no caixa),
> mas a **peça sai do estoque** normalmente.
> Sem preencher os dois campos o sistema não deixa fechar a venda.

---

## Devolução (cliente traz a peça de volta e quer o dinheiro)

1. No PDV, clique em **Vendas** (ou **Histórico**)
2. Localize a venda e clique em **↩ Devolver**
3. Marque quantas peças voltaram
4. Escolha o reembolso: **Dinheiro**, **Estorno/cartão** ou **Vale-troca**
5. Confirme

> Se escolher **Vale-troca**, o sistema gera um código **VT-XXXXXX**. Anote e entregue ao cliente.

---

## Troca (cliente leva outra peça no lugar)

Qualquer vendedor pode fazer. Precisa de **caixa aberto**.

1. No PDV, clique em **🔄 Troca** (ou aperte **F6**)
2. Ache a venda: já abre nas vendas de **hoje** — bipe o cupom, digite o número
   da venda ou o nome da cliente. Compra de outro dia? Mude as datas **De/Até**.
3. Clique em **🔄 Trocar** na linha da venda
4. **Lado esquerdo** — marque as peças que voltaram (o crédito aparece sozinho)
5. **Lado direito** — busque e adicione as peças que a cliente vai levar
6. Resolva a diferença e confirme

| Diferença | O que fazer |
|---|---|
| Peça nova **mais cara** | Cliente paga a diferença — escolha Dinheiro, PIX, Débito ou Crédito |
| **Mesmo valor** | Nada a acertar. É só confirmar |
| Peça nova **mais barata** | Escolha o destino da sobra (tabela abaixo) |

**Teve desconto na compra? O desconto acompanha a troca.**
Peça de R$ 100 comprada com 10% (pagou R$ 90):

| Troca por | Peça nova sai por | Resultado |
|---|---|---|
| Outra de R$ 100 | R$ 90 | nada a acertar |
| Uma de R$ 200 | R$ 180 | paga R$ 90 |
| Uma de R$ 50 | R$ 45 | sobram R$ 45 |

> A loja fica com a mesma margem da venda original em todos os casos.

**Sobrou dinheiro a favor da cliente — 4 opções:**

| Opção | O que acontece |
|---|---|
| 🎫 Vale-troca | Gera um código com validade para usar depois |
| 💵 Dinheiro | Sai da gaveta agora (entra como sangria no fechamento) |
| 💳 Estorno no cartão | Só o registro — **o estorno você faz na maquininha** |
| — Nada | A cliente abre mão da diferença |

> A peça que voltou entra no estoque e a que saiu é baixada, tudo de uma vez.

---

## Dar desconto na venda

1. Digite o desconto no campo **Desconto geral** (ou por item)
2. Aperte **F10** e o sistema pede três coisas:
   - **Autorizado por** — quem liberou (nome livre)
   - **Motivo** — por quê
   - **Sua senha** — a de quem está no caixa
3. Confirme e siga para o pagamento

> **Não precisa mais chamar o administrador.** Fica tudo registrado na venda e
> aparece em Relatórios → Evento → **🏷️ Descontos autorizados**.

---

## Cadastrar peça parecida com outra

**Produto inteiro:** em **👗 Produtos**, clique em **Duplicar** na linha da peça.
O cadastro abre preenchido — ajuste nome e preço e salve.

**Só mais um tamanho:** dentro do cadastro, na grade de cor e tamanho, clique no botão de
**duplicar** da linha. Ela é copiada com a cor e a foto, e o cursor vai para o Tamanho.

> Nos dois casos o estoque começa zerado e o código de barras é novo.

---

## Usar um vale-troca

1. Faça a venda normalmente
2. Aperte **F10** para finalizar
3. Em forma de pagamento, escolha **Vale-troca**
4. Digite o código **VT-XXXXXX**
5. O sistema mostra o saldo e abate do total

> Para consultar vales em aberto: menu **🎫 Vales-Troca** — mostra saldo e **até quando vale**.

> Todo vale tem **prazo** (padrão 90 dias). Vencido, o sistema recusa e avisa a data.
> O prazo se ajusta em Configurações → PDV.

---

## Cadastrar um produto

1. Menu **👗 Produtos** → **+ Novo produto**
2. Preencha **Nome** e **Preço de venda** (obrigatórios)
3. Na **Grade**, informe cor, tamanho e quantidade de cada variação
4. Use **+ Variação** para adicionar mais linhas
5. Salvar

> Os campos de quantidade começam vazios. Deixar em branco = zero.
> O código de barras é gerado automaticamente se você não digitar um.

---

## Imprimir etiquetas

**Um produto:** em **Produtos**, clique no botão **🏷️** da linha do produto e escolha a quantidade por variação.

**Vários produtos:** marque as caixinhas dos produtos e clique em **🏷️ Imprimir etiquetas**.

---

## Lista de produtos para conferência

1. Menu **👗 Produtos** → **📋 Exportar lista**
2. Escolha a categoria, o filtro de estoque e quais colunas quer
3. Marque **Coluna "Conferido"** se for contar peça por peça
4. Escolha **PDF** (imprimir) ou **Excel**
5. **Gerar lista**

---

## Conferir o estoque (inventário ou recebimento)

1. Menu **📈 Relatórios** → aba **📦 Estoque**
2. Escolha os filtros e clique em **Gerar relatório**
3. Marque **Coluna "Contado"** para sair espaço em branco
4. **🖨️ Imprimir** e contar peça por peça

O relatório sai assim: o produto, embaixo cada cor e tamanho, o **total do
produto**, e no fim o **TOTAL GERAL**. Uma coluna para cada lugar
(Almoxarifado, Loja).

**Chegou mercadoria?** Preencha **Cadastrados de/até** com o dia do
recebimento. Se já passou e você não conferiu no dia, escolha
**Agrupar por → Data de cadastro**: cada dia vira um bloco com o total dele.

**Bater o começo dos trabalhos com hoje:** marque **Mostrar movimentação** e
deixe as datas de venda em branco. Saem as colunas:

```
Entrou  −  Vendeu  +  Devolvido  =  Deveria ter   |   Em estoque hoje   |   Dif.
```

O quadro **Fechamento** no alto fecha a conta. **✓ bate** = tudo certo.

> Peça abaixo do mínimo sai destacada. Exporta em **Excel** também.
> Agrupando por data ou categoria, cada grupo ganha o total dele no fim.

---

## Fechando o dia

1. No PDV, clique em **Fechar caixa**
2. Confira os valores por forma de pagamento
3. Informe quanto tem de dinheiro na gaveta
4. O sistema mostra se sobrou ou faltou
5. Confirme

---

## Descer peças do almoxarifado para a loja

1. Menu **🏢 Estoques (locais)** → **📥 Transferir peças**
2. **De:** Almoxarifado Central · **Para:** a loja
3. Busque a peça (ou bipe o código) e clique nela
4. Ajuste a **quantidade** de cada linha
5. Escreva a **observação** (ex.: "descida para a feijoada")
6. **Transferir e gerar romaneio**

Um aviso clicável aparece na tela — clique para abrir o romaneio. Na janela do romaneio:
- **🖨️ Imprimir** — imprime em papel
- **📄 Baixar PDF** — salva como PDF para mandar pelo **WhatsApp ou e-mail** (não precisa impressora)

> Transferir **não cria nem some peça** — só muda de lugar. O total continua o mesmo.
> Para ver um romaneio antigo, clique em **📋 Ver** na lista de romaneios.
> O botão **📊 Relatório PDF** gera um histórico de todas as transferências.

**Onde vejo o que tem em cada lugar?** Clique no cartão do local. A tabela mostra o
que tem ali e o total do Salgueiro ao lado, com botões de **imprimir** e **Excel**
para o balanço.

---

## Fechar um evento (feijoada, sábado de samba)

1. Menu **📈 Relatórios** → aba **🎪 Evento / Pós-venda**
2. Informe **Início** e **Fim** com **data e hora** (o botão **Sáb 20h → Dom 4h**
   já preenche)
3. Diga se o **Pix** entrou na chave (sem taxa) ou na maquininha (0,49%)
4. Marque o que quer no relatório
5. **Gerar relatório**

Você recebe o fechamento pronto:

```
   Faturamento bruto
(–) Devoluções
(–) Taxas da maquininha
(–) Comissão de consignados
=   LÍQUIDO A RECEBER
```

Mais a lista de vendas, os produtos vendidos com quantidade e as cortesias.
Exporte em **PDF** ou **Excel**.

---

## Ver os mais vendidos de um evento

1. Menu **🏆 Ranking**
2. Deixe em **🎪 Por evento** e escolha o evento na lista
   (o sistema monta a lista sozinho, com data, horário e faturamento)
3. Em **Comparar com**, deixe **Evento anterior** para ver quem subiu e quem caiu

> ▲3 = subiu 3 posições · ▼2 = caiu 2 · "novo" = não vendeu no evento anterior

Troque entre **Peças vendidas** e **Receita** — as duas contas mostram coisas
diferentes. Na tela ficam os 10 primeiros; a impressão e o Excel trazem a lista toda.

---

## Onde ver os números

- **📊 Painel** — vendas de hoje e do mês, alertas de estoque, resumo geral
- **📈 Relatórios** — vendas por período, fechamento de evento, curva ABC, peças paradas
- **🏆 Ranking** — os mais vendidos por evento, mês ou ano
- **🏢 Estoques (locais)** — onde cada peça está e balanço por local
- **💰 Financeiro** — contas a pagar e receber, fluxo do mês

---

## Problemas comuns

| Situação | Solução |
|---|---|
| "Nenhum caixa aberto" | PDV → **Abrir caixa** |
| Cupom não imprime | Configurações → **🖨️ Impressoras** → verifique a impressora selecionada |
| Painel com número errado | Clique em **📊 Painel** no menu para recarregar |
| Esqueci a senha | Peça a um administrador para redefinir em Configurações → Usuários |
| "Acabou na loja, pegue no almoxarifado" | A peça saiu sem a descida ter sido registrada. Faça a transferência em **🏢 Estoques (locais)** |
| A loja aparece com 0 peças | Normal logo após a atualização. Faça o balanço e desça as peças por romaneio |
| Ranking ou relatório vazio | Você está olhando um período sem venda. Use **Por evento** e escolha um evento da lista |
| Não fecha a cortesia | "Autorizado por" e "Para quem foi" são obrigatórios |
| Pede senha de admin no desconto | Corrigido na 3.3.0 — agora é a sua senha + justificativa |
| Quero cadastrar peça igual a outra | Botão **Duplicar** na linha do produto |
| Não dá para digitar a quantidade | Clique no campo **Qtd**, digite por cima e aperte **Enter** |
| Não acho o botão de troca | Barra de cima do PDV: **🔄 Troca** — ou tecla **F6** |
| "Nenhum caixa aberto" ao trocar | A troca gera uma venda: abra o caixa antes |
| A venda não tem botão 🔄 Trocar | Ela foi cancelada ou já teve tudo devolvido |
| "Este vale-troca venceu em…" | O vale passou do prazo. Ajuste em Configurações → PDV |

---

## Novidades de cada versão

Configurações → **🔄 Atualização**. No lado direito, o quadro **📢 O que mudou**
lista todas as versões e o que cada uma trouxe. A sua aparece com o selo verde
**INSTALADA**. Clique numa versão para ver os detalhes.

---

**Suporte:** ML Lopes Design — mlopesdesign@gmail.com

*Guia referente à versão 3.4.1*
