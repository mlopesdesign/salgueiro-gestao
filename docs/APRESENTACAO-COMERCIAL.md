# Sistema de Gestão e PDV

**Software de gestão para varejo de moda, lojas de conveniência e operações de evento**

ML Lopes Design · Julho de 2026

---

## O que é

Um sistema completo de gestão de loja com frente de caixa (PDV), instalado no
computador da loja. Ele cobre a operação inteira: vender, controlar estoque,
cadastrar clientes, acompanhar o financeiro e entender os números do negócio.

Não é um sistema genérico adaptado. Foi construído a partir da rotina real de uma
loja física — inclusive das situações que os sistemas de prateleira não resolvem
bem, como venda em evento, peça consignada de terceiros e mercadoria dividida
entre depósito e loja.

**Em um número:** 127 operações diferentes, 31 tabelas de dados, 25 módulos de
regra de negócio. É um sistema maduro, não um protótipo.

---

## A tecnologia — e por que ela importa para quem vende

A escolha técnica não é detalhe: ela define o custo mensal, a velocidade no caixa e
o que acontece quando a internet cai.

### Funciona sem internet

O sistema roda **inteiramente no computador da loja**. O banco de dados fica na
máquina, não num servidor remoto.

**O que isso significa na prática:** internet caiu no meio do sábado à noite? A
loja continua vendendo, imprimindo cupom e fechando caixa. Nada trava. A internet
só é necessária para receber atualizações e para o backup na nuvem.

Sistemas 100% online — a maioria do mercado hoje — param quando a conexão cai.
Numa loja de evento, isso é a diferença entre faturar e mandar o cliente embora.

### Sem mensalidade de servidor

Não há servidor na nuvem para manter, nem custo que cresce conforme o volume de
vendas. O software é instalado e é da loja.

### Instalação em um minuto

Um único instalador. Duplo clique, avançar, pronto — com atalho na área de
trabalho e a rede já liberada no firewall. Não exige técnico, não exige configurar
banco de dados, não exige nada instalado antes.

### Atualização automática

O sistema verifica sozinho se há versão nova e se atualiza com um clique, sem
reinstalar nada. Os dados, as configurações e a personalização visual **nunca são
tocados** por uma atualização.

Cada versão traz, dentro do próprio sistema, a lista do que mudou — escrita em
linguagem simples, para a equipe da loja saber o que apareceu de novo.

### Vários computadores, um só sistema

Um segundo caixa, o computador do escritório ou um notebook no estoque acessam o
mesmo sistema pela rede da loja, pelo navegador. Sem instalar nada nas outras
máquinas e sem custo por terminal adicional.

### A cara da loja

Nome, logotipo, cores e até o ícone do programa são configuráveis. O sistema não
parece um software de terceiros: parece da loja.

---

## O que o sistema faz hoje

### Frente de caixa (PDV)

- Venda por leitor de código de barras ou busca por nome
- Abertura e fechamento de caixa com conferência de gaveta, sangria e suprimento
- **Sete formas de pagamento**, combináveis na mesma venda: dinheiro, PIX, débito,
  crédito parcelado, crediário, vale-troca e cortesia
- Desconto por item, desconto geral com autorização por senha e desconto
  automático à vista configurável
- Consulta de preço sem lançar na venda
- Impressão silenciosa do cupom térmico, sem janela de diálogo
- Identificação do cliente com desconto automático por categoria

### Devoluções, trocas e créditos

- Devolução total ou parcial, com reembolso em dinheiro, estorno ou vale-troca
- **Troca em uma única operação**: o que voltou, o que sai no lugar, e a diferença
  calculada sozinha — se sobrar crédito, vira vale automaticamente
- Vales-troca com código, saldo e uso parcial
- A contabilidade acompanha: relatórios e painel sempre mostram o valor líquido

### Estoque

- Cadastro em grade de cor e tamanho, com código de barras gerado automaticamente
- Entradas, saídas e ajustes, todos com histórico de quem fez, quando e por quê
- Ficha de movimentação por peça (kardex), para investigar qualquer diferença
- Estoque mínimo por variação, com alerta de reposição no painel
- **Estoque por local**: almoxarifado central, loja, pessoa que levou peças para
  vender, venda por WhatsApp — cada um com seu saldo
- **Romaneio de transferência** numerado, impresso ou em PDF, com campo de
  conferência e assinatura de quem entregou e de quem recebeu
- Balanço por local, na tela, impresso ou em Excel, com coluna para conferir

### Etiquetas

Etiquetas 60×40mm com logotipo, nome da peça, cor, referência, tamanho em destaque
e código de barras EAN-13. Impressão de uma peça ou em lote, com a opção de gerar
uma etiqueta para cada unidade em estoque.

### Clientes e fidelidade

- Cadastro completo, com importação e exportação em Excel
- Categorias de cliente com desconto automático aplicado no caixa
- Programa de pontos configurável
- Crediário com parcelas, controle de atraso e recebimento
- Alerta de aniversariantes do mês

### Compras e fornecedores

Pedido de compra, recebimento com entrada automática no estoque e geração da conta
a pagar. Custo médio ponderado recalculado a cada entrada.

### Consignação

Peças de terceiros com percentual acordado por fornecedor. A cada venda o sistema
registra quanto é da loja e quanto é do fornecedor, e o acerto é feito com um
clique. **Poucos sistemas de varejo tratam consignação de verdade** — normalmente
é preciso controlar por fora, em planilha.

### Financeiro

Contas a pagar e a receber, fluxo do mês com entradas, saídas e custo da mercadoria
vendida, e o extrato de consignados.

### Relatórios

- Vendas por período, por dia, por vendedor e por categoria
- **Curva ABC** — quais produtos realmente sustentam o faturamento
- Peças paradas — o que está travando capital
- Receita separada por loja
- **Relatório de Evento** (detalhado adiante)

### Ranking

Produtos mais vendidos, com comparação entre períodos: o que subiu, o que caiu e o
que é novidade. Traz também ranking de categorias, de cor e tamanho — este com o
estoque atual ao lado, virando lista de reposição — melhores clientes e o horário
de pico de venda.

### Segurança e controle

- Usuário individual por pessoa, com senha criptografada
- Permissões detalhadas: quem pode vender, cancelar, dar desconto, ver custo, ver
  faturamento, mexer no estoque, alterar configurações
- Registro de auditoria de quem fez cada operação sensível
- **Backup automático diário**, com as últimas 30 cópias mantidas
- Backup manual e backup na nuvem (Google Drive ou OneDrive)

---

## Três coisas que o mercado não resolve bem

### 1. Venda em evento que atravessa a madrugada

Uma loja que abre sábado às 20h e fecha domingo às 4h não cabe em relatório "por
dia" — o faturamento aparece partido em dois.

O sistema tem um **Relatório de Evento** com período por data **e hora**. Ele
identifica sozinho as sessões de venda e apresenta o fechamento completo:

```
    Faturamento bruto
(–) Devoluções
=   Faturamento líquido
(–) Taxas da maquininha (por bandeira e parcelamento)
(–) Comissão dos consignados
=   LÍQUIDO A RECEBER
```

Com a lista de vendas detalhada, os produtos vendidos com quantidade, as cortesias
concedidas e exportação em PDF e Excel. O lojista sabe **quanto sobrou de verdade**,
não quanto passou na maquininha.

### 2. Mercadoria em dois lugares

Quase todo sistema trata estoque como um número só. Na prática existe o que está no
depósito e o que está na arara — e o dono precisa dos dois batendo.

Aqui cada local tem seu saldo, a movimentação gera romaneio assinado, e o total
nunca deixa de fechar com a soma dos locais. Se a peça acabar na loja durante a
venda, o caixa é avisado para buscar no depósito — **sem travar o atendimento**.

### 3. Brinde e cortesia com responsável

Peça dada de cortesia costuma virar buraco no estoque, sem ninguém saber quem
autorizou. No sistema, a cortesia é uma forma de pagamento que **exige** informar
quem liberou e para quem foi. A venda entra com valor zero — não infla faturamento
nem mexe no caixa — mas a peça baixa do estoque e o custo real aparece no
relatório do evento.

---

## O que ainda não faz

Ser claro sobre os limites evita frustração depois da venda.

| Recurso | Situação |
|---|---|
| Emissão de NF-e / NFC-e (nota fiscal) | Não implementado. É o próximo grande passo |
| Aplicativo de celular | Não há. O acesso em rede funciona pelo navegador |
| Integração com e-commerce / marketplace | Não implementado |
| Integração com maquininha (TEF) | Não há. O pagamento é conferido e registrado manualmente |
| Contagem de inventário com correção assistida por local | Parcial: o ajuste existe, a tela de contagem guiada não |

---

## Até onde este produto pode ir

A base técnica já está pronta para crescer. O sistema é modular: cada área é um
módulo independente, o que permite acrescentar sem arriscar o que já funciona.

### Curto prazo

- **Emissão fiscal (NFC-e)** — integração com a SEFAZ, o recurso mais pedido pelo
  varejo formal
- **Inventário guiado por local** — contagem no leitor, comparação com o sistema e
  correção assistida
- **Metas de venda** — meta por período com acompanhamento no painel
- **Integração com TEF** — a maquininha conversando com o caixa, sem digitação

### Médio prazo

- **Aplicativo de consulta** — o dono acompanha as vendas pelo celular, em tempo real
- **Envio automático por WhatsApp** — romaneio, cupom e fechamento de evento
- **Catálogo digital** — vitrine do estoque para venda por WhatsApp e Instagram
- **Multi-empresa** — várias lojas de donos diferentes na mesma instalação

### Longo prazo

- **Sincronização entre unidades** — filiais em locais distintos com base unificada
- **Integração com marketplaces** — estoque único para loja física e online
- **Previsão de reposição** — o sistema sugere a compra a partir do histórico de venda
- **Comissionamento de vendedores** — cálculo automático por regra configurável

Nada disso exige refazer o sistema. É construção sobre uma base que já está de pé
e em produção.

---

## Como funciona a entrega

| Etapa | O que acontece |
|---|---|
| **Instalação** | Um instalador, sem exigência técnica na máquina do cliente |
| **Personalização** | Nome, logotipo, cores e ícone com a identidade da loja |
| **Carga inicial** | Importação de produtos e clientes de planilha ou de outro sistema |
| **Treinamento** | Manual do usuário completo e guia rápido de uma folha, escritos para quem nunca usou sistema |
| **Suporte** | Atendimento direto com quem desenvolveu, sem intermediário |
| **Evolução** | Atualizações entregues pelo próprio sistema, sem reinstalação |

O cliente recebe dois documentos impressos: o **Manual do Usuário**, com o
funcionamento completo explicado passo a passo, e o **Guia Rápido**, com a rotina
do dia a dia em uma folha para deixar ao lado do caixa.

---

## Por que este sistema e não outro

| | Sistema de prateleira | Este sistema |
|---|---|---|
| Funciona sem internet | Raramente | Sim, integralmente |
| Mensalidade de servidor | Sim, e cresce com o uso | Não |
| Terminais adicionais | Cobrados por posto | Inclusos, pela rede local |
| Consignação de terceiros | Por fora, em planilha | Nativo, com acerto automático |
| Venda em evento noturno | Relatório parte ao meio | Tratado por data e hora |
| Estoque em dois locais | Número único | Local a local, com romaneio |
| Ajuste sob medida | Depende da fila do fabricante | Falado direto com quem desenvolve |

---

**ML Lopes Design**
Marcio Lopes · mlopesdesign@gmail.com

*Documento técnico-comercial · Sistema em produção na versão 2.6.1*
