## v3.33.1 — Recuperação automática passa a escolher a cópia MAIS NOVA

### 🛑 O que aconteceu

Ao abrir, o sistema achou o banco de dados incompleto e restaurou sozinho uma cópia de segurança — mas escolheu a de **13/08/2026** (antes de atualizar para a 3.9.0), e não a mais recente.

### 🔎 A causa (provada em teste)

A lista de cópias de segurança era ordenada pelo **nome do arquivo**, não pela data:

- "salgueiro-**pre-atualizacao**…" vinha antes de "salgueiro-**2026**…" (letra antes de número);
- e "v3.**9**.0" vinha antes de "v3.**33**.0" (o 9 é maior que o 3).

Resultado: a "mais nova" era sempre a de agosto. Pelo mesmo motivo, a limpeza que mantém 30 cópias apagava justamente as **diárias recentes** e guardava as antigas.

### ✅ Correção

- As cópias passam a ser ordenadas pela **data** gravada no nome. A recuperação pega a mais nova que tenha dados.
- A limpeza mantém as **30 diárias mais recentes** e as **20 mais recentes** de antes de atualizar ou restaurar, apagando sempre as mais velhas.
- O aviso de recuperação diz **de quando é a cópia**. Se tiver 2 dias ou mais, manda **parar de vender** e chamar o suporte.
- Em Configurações → Backup aparecem também o **banco guardado pela recuperação** e as cópias de antes de cada restauração, com o que tem dentro (vendas, produtos, clientes). Dá para restaurar qualquer um pela tela.

### 🛡️ Proteções novas

- Se o arquivo do banco existir mas não puder ser lido na hora (preso por antivírus, sincronização ou o sistema ainda fechando), o sistema **tenta de novo e, se não der, fecha sem mexer em nada**. Antes ele abria um banco vazio e gravava por cima.
- Uma gravação comum **nunca reduz o banco à metade de uma vez**. Se isso tentar acontecer, a gravação é recusada e fica registrada no Diagnóstico, e o arquivo bom continua no disco.
- A recuperação automática fica registrada no Diagnóstico com o que tinha no banco e de onde restaurou.

---

## v3.33.0 — Relatório por loja completo: loja, abertura e fechamento, produtos e mais vendidos

### 🏬 Relatórios → Por loja

A aba passou a ser o **relatório completo**, igual ao do Evento, só que de **uma loja**:

1. Escolha a **loja**;
2. Informe a **abertura** (data e hora) e o **fechamento** (data e hora) — a loja pode abrir num dia e fechar no outro;
3. O relatório sai na hora.

### 📋 O que vem no relatório da loja

- **Abertura e fechamento:** cada caixa da loja que esteve aberto no período, com a hora em que abriu e fechou, quem abriu, quem fechou, o computador e o troco inicial.
- **Resumo:** vendas, peças, faturamento, descontos, cortesias, vendas do Salgueiro e de consignados.
- **Fechamento:** bruto, devoluções, taxas da maquininha e líquido a receber.
- **Lista de vendas** com os itens de cada uma e **formas de pagamento**.
- **Produtos vendidos:** cada peça, quantidade, valor de tabela, desconto e valor recebido.
- **🏆 Mais vendidos:** o ranking dos produtos da loja, com peças, porcentagem e valor.

Imprimir/PDF e Excel saem com o nome da loja. A opção **"Todas — comparativo entre lojas"** continua mostrando a tabela antiga, com a receita de cada loja lado a lado.

O ranking **Mais vendidos** também passou a aparecer no relatório do Evento.

---

## v3.32.0 — Exportar e imprimir só o que está na tela do Estoque

### 🔎 O que mudou

Em **Estoque → Movimentar**, os botões **Exportar PDF** e **Exportar Excel** passam a respeitar o filtro da tela:

- **"Somente consignados" + um fornecedor** → sai só o estoque daquele fornecedor;
- **"Somente da loja"** → só as peças próprias;
- **busca por nome, referência ou código** (ex.: *camisa de enredo*) → só aquele produto.

Ao clicar em exportar com a lista filtrada, aparece a escolha:

- **Só o que está na tela** (já vem marcado), com o nome do filtro;
- **Estoque todo**.

Sem filtro nenhum, sai o estoque todo, como antes.

### 📄 O relatório

- O título diz o que foi impresso (ex.: *Consignados de Fabi Leirosa Atelier*).
- Uma coluna com o saldo de **cada loja e do almoxarifado**, igual à tela, com total no rodapé.
- Totais de peças e valor **só do que foi filtrado**.
- O Excel ganhou as colunas por loja e a de fornecedor; o nome do arquivo diz o filtro.

---

## v3.31.3 — Corrigido o travamento de madrugada no computador principal ("no such table: usuarios")

### 🛑 O que acontecia

Depois de algumas horas de trabalho o computador principal parava de responder e os terminais mostravam **"no such table: usuarios"**. Só voltava reiniciando o sistema no principal.

### 🔎 A causa (provada em teste, não é suposição)

O banco de dados estava num modo de gravação (WAL) que, no motor usado pelo sistema, **perde um pedaço da memória a cada gravação**. O sistema tem uma memória fixa de 16 MB para o banco:

- cada venda, abertura de caixa ou alteração gasta cerca de 128 KB a mais;
- na **gravação nº 128 do dia** a memória acaba;
- dali em diante o banco "esquece" as tabelas e todo pedido responde **"no such table: usuarios"** — exatamente o erro da tela.

Por isso o problema tinha **hora para acontecer**: não era o relógio, era a quantidade de gravações desde que o sistema foi aberto — com o movimento normal da loja, a gravação 128 cai por volta da 1 h da manhã. Abrir a tela de Backup também gastava memória (cerca de 4 MB de uma vez) e adiantava a quebra.

No teste, com o banco do jeito antigo, o sistema quebrou na gravação 128 com a mesma mensagem. Com a correção, **1.000 gravações seguidas sem perder nada de memória**.

### ✅ Correção

- O banco passa a abrir sempre no modo normal. A conversão é automática na primeira abertura, sem mexer em nenhum dado.
- Backups antigos continuam abrindo normalmente, sem gastar memória.

### 🛟 Rede de segurança

Se um dia o banco em memória quebrar por qualquer motivo, o principal **registra no Diagnóstico ("BANCO-QUEBRADO") e se reabre sozinho** — ninguém precisa ir até ele. Ele também nunca grava um banco vazio por cima do arquivo bom.

---

## v3.31.2 — Tela de Backup sem travar o principal · Diagnóstico mais claro

### 💾 A tela de Backup não segura mais o computador principal

Ao abrir **Configurações → Backup**, o principal abria **cada backup guardado** para contar vendas, produtos e clientes. Com muitos backups isso levava **mais de 11 segundos** — e, nesse tempo, os terminais pelo navegador ficavam esperando.

Agora ele guarda essa contagem e só abre o backup **novo ou alterado**. Da segunda vez em diante a tela abre na hora.

### 🩺 Diagnóstico de travamentos mais claro

- **Aba do navegador em segundo plano não conta mais como lentidão.** Quando a aba do sistema fica escondida atrás de outra, o navegador atrasa os pedidos de propósito; isso aparecia como "LENTO" sem o sistema ter culpa. Agora só é registrado o que demorou com a tela à vista.
- **Cada aviso do terminal vem com a explicação.** Embaixo de cada LENTO ou SEM RESPOSTA aparece uma linha dizendo onde estava a demora:
  - o pedido **nem chegou** ao principal → problema de rede/Wi-Fi;
  - o principal respondeu rápido → a demora ficou **na rede ou no navegador**;
  - o principal **também demorou** → ele estava ocupado.

---

## v3.31.1 — Cada computador com o seu caixa: o PDV não troca mais de loja sozinho

### 🏬 O que acontecia

Existia **um caixa aberto para todos**. O computador principal e a loja que usa o navegador vendiam no **mesmo caixa**:

- quando um trocava de loja, o outro passava a vender na **loja errada**;
- quando um abria um caixa, o outro passava a usar o novo;
- quando um fechava, fechava o dos dois.

### ✅ Agora

**Cada computador e cada navegador tem o próprio caixa**, com a própria loja. Um nunca mexe no do outro:

- vendas, trocas, devoluções, recebimento de crediário, sangria, suprimento e fechamento usam **só o caixa daquele computador**;
- trocar de loja muda **só aquele PDV**;
- os relatórios continuam juntando todas as lojas, como sempre.

### 🔓 Depois de atualizar

Cada PDV abre o **próprio caixa**. O caixa que estava aberto antes da atualização aparece na tela de abertura, em **"Caixas abertos em outros computadores"**, com o botão **"Assumir neste computador"** — use no computador que era dono dele. O mesmo botão resolve um computador reinstalado ou um navegador limpo.

---

## v3.31.0 — Rede sem fila · Diagnóstico de travamentos · Frete nas vendas com entrega

### 🌐 A loja pelo navegador não congela mais por causa do principal

O computador principal atendia os terminais **em fila de um só**. Enquanto ele:

- imprimia um cupom ou etiqueta (até **25 segundos**),
- esperava um relatório demorado, ou
- esperava uma conexão "de reserva" que o navegador abre sem mandar nada (até 5 s),

**todos os terminais ficavam parados**. Agora ele atende vários ao mesmo tempo e a impressão roda separada.

| Situação (teste com o servidor de rede) | Antes | Agora |
|---|---|---|
| Pedido com uma conexão de reserva aberta | 5,1 s | 0,3 s |
| 3 pedidos enquanto outro demorava 8 s | 7,7 s cada | 0,03 s cada |
| Pedido durante uma impressão de 6 s | esperava a impressão | 0,02 s |

### ⚠️ Aviso no terminal quando o principal não responde

Em vez de a tela simplesmente parar, aparece uma **faixa vermelha** — *"Sem resposta do computador principal desde HH:MM"* — que some sozinha quando a conexão volta. Nenhum pedido fica esperando para sempre: passou de 35 segundos, a tela avisa.

### 🩺 Diagnóstico de travamentos

O sistema passou a registrar o que acontece na rede, um arquivo por dia, guardado por 30 dias:

- cada pedido dos terminais, com endereço e tempo;
- o que demorou e o que ficou sem resposta;
- quando um terminal perdeu contato e quando voltou;
- quando o sistema abriu, fechou — ou caiu;
- backup na nuvem e impressões (os dois prendem o principal).

Para ver: **Configurações → Rede → Diagnóstico de travamentos**, escolhendo o dia. Dá para salvar em arquivo.

### 🚚 Frete nas vendas com entrega

Em **Configurações → Lojas**, marque **"Esta loja vende com entrega"** (loja WhatsApp). No pagamento:

- **Entrega** (obrigatória): Retirada no balcão, Mercado Envios, Correios, Motoboy, Transportadora ou Outro;
- **Valor do frete**, que soma no total da venda.

O frete aparece no **cupom**, no **fechamento do caixa**, no **relatório de vendas** (quantas entregas de cada tipo) e no **painel**. Entra no faturamento e no caixa — é dinheiro que entrou — mas **não no lucro**, porque é repassado a quem entrega. Também não vira preço de peça: devolução, troca e repasse de consignado continuam calculados só sobre as peças.

### Observação

No computador principal com o acesso em rede ligado, o sistema **reabre sozinho uma vez** logo depois da atualização, para o servidor de rede novo entrar no ar.

---

## v3.30.1 — O sistema não fecha mais sem perguntar

### 🛑 X e Alt+F4 agora perguntam antes de fechar

Relato: *o sistema fechou sozinho*. No PDV o **F4** troca o cliente; com o **Alt** apertado vira **Alt+F4**, que fecha qualquer programa do Windows na hora — e o Salgueiro fechava sem perguntar.

Agora o **X** e o **Alt+F4** abrem a pergunta **"Fechar o Salgueiro Gestão?"**:

- se houver venda montada no PDV, o aviso diz quantas peças vão ser perdidas;
- o botão em destaque é **Continuar trabalhando** — um Enter sem querer não fecha;
- na tela de entrada (ninguém logado) fecha direto;
- para só tirar da frente, o botão **_** (minimizar) continua igual.

### 💾 Salvamento final ao fechar voltou a funcionar

Desde a 3.25.9 o sistema encerrava antes de rodar a gravação final do banco. Agora ele **grava tudo e só depois fecha**. Conferido no próprio Windows com o executável do Salgueiro: com a configuração antiga o fechamento não passava pela gravação; com a nova, passa.

---

## v3.30.0 — Troco em dinheiro · Mais vendidos por loja · Loja sem desconto

### 💵 Troco no pagamento em dinheiro

Ao escolher **Dinheiro**, aparece o campo **Cliente deu (R$)** — **obrigatório** — e o sistema mostra na hora o **troco a devolver** (ou quanto falta).

| Total | Cliente deu | Resultado |
|---|---|---|
| R$ 180,00 | R$ 200,00 | Troco **R$ 20,00** |
| R$ 180,00 | R$ 150,00 | Falta **R$ 30,00** — não deixa confirmar |
| R$ 180,00 | (vazio) | "Informe quanto o cliente deu em dinheiro" |

- O troco sai no cupom e a gaveta confere certinho.
- Vale no **PDV**, na **troca** (diferença paga em dinheiro) e no **recebimento de crediário**.
- Nas outras formas de pagamento o campo não aparece.

### 🏆 Relatórios → Mais vendidos

Aba nova com o ranking dos produtos por **peças vendidas** no período, receita e participação.

- Seletor **"Todas as lojas (total)"** — com a quantidade de cada loja em colunas — ou **uma loja só**.
- Já desconta devolução; troca não conta como venda.
- Exporta para Excel (CSV) e imprime em A4.

### 🚫 Loja sem desconto

Em **Configurações → Lojas**, marque **"Esta loja não dá desconto"** — para venda online, por exemplo.

- No PDV dessa loja some o campo de desconto e aparece a etiqueta *sem desconto*.
- Não entra desconto de espécie nenhuma: manual, por item, à vista, de categoria do cliente ou resgate de pontos.
- Trocando o caixa de loja, a regra acompanha.
- O servidor também recusa — não dá para burlar por um terminal em rede.

---

## v3.29.1 — Imprimir balanço sem folha em branco · documentos em A4

### 🖨️ Imprimir balanço voltou a funcionar

Em **Estoques → local**, o botão **Imprimir balanço** gerava **uma folha em branco**. Agora sai um documento A4 próprio:

- nome da loja e do estoque, data e hora, filtro usado;
- cada peça com referência, cor/tamanho, código de barras, quantidade e valor de venda;
- total de peças e valor no fim;
- coluna **Contado** em branco para a conferência e espaço para assinatura.

Sai **exatamente o que está filtrado na tela**.

### 📄 Relatório, ranking e romaneio em folha A4

Eles imprimiam no tamanho do cupom (80 mm) e saíam numa tira estreita. Agora **todo documento sai em A4**, por um único caminho de impressão. O cupom do PDV continua como estava.

---

## v3.29.0 — Rodinha do mouse não mexe em número · Estoque por loja no produto

### 🖱️ A rodinha do mouse não altera mais nenhum campo de número

Com o cursor em cima de um campo de número (estoque, preço, quantidade — qualquer um), rolar a rodinha para descer a página **alterava o valor sem ninguém ver** — e isso gerava diferença de estoque.

Agora a rodinha **só rola a página**, em **todas** as telas e janelas do sistema, no aplicativo e no navegador. As setinhas de subir e descer também saíram dos campos. A regra é única, vale inclusive para campos que ainda forem criados.

### 📦 Estoque por loja direto no cadastro do produto

Ao cadastrar ou editar um produto, o **administrador** vê **uma coluna para cada estoque** — almoxarifado e cada loja — e digita quanto deve **ficar** em cada um.

| Exemplo | Resultado |
|---|---|
| Produto novo de 40 peças: 10 Loja A, 10 Loja B, 20 Almoxarifado | 40 entram, já repartidas |
| Almoxarifado 20 → 15 e Loja A 10 → 15 | 5 transferidas, total igual |
| Um estoque a mais que o outro a menos | a diferença vira entrada ou saída |

- O que passa de um estoque para outro vira **transferência**, com romaneio em *Transferências*.
- O que for a mais vira **entrada**, com etiqueta oferecida ao salvar.
- O que for a menos vira **saída**.
- Tudo fica no histórico do estoque. Estoque negativo continua não existindo.
- **Só o administrador** mexe no estoque por essa tela.

---

## v3.28.0 — Troca não é venda, de uma vez por todas

Até aqui a troca era guardada no sistema **como se fosse uma venda**, e cada tela precisava lembrar de separá-la. O caixa foi corrigido, depois o relatório, depois o painel — e o **Relatório de Evento** continuava mostrando uma troca como *"1 venda de R$ 180,00"*.

### 🔁 A troca agora é guardada como TROCA

Com situação própria no banco. **Nenhuma tela conta troca como venda** — nem as que já existem, nem as que ainda forem criadas. Trocas antigas são convertidas sozinhas na primeira abertura, com conferência de todas as vendas antes e depois.

### 💰 Só o saldo entra — positivo ou negativo

Saldo da troca = **o que a cliente pagou a mais − o troco que a loja devolveu em dinheiro ou estorno**.

| Troca | Entra |
|---|---|
| Camisa de R$ 80 → camisa de R$ 180, cliente paga R$ 100 | **+ R$ 100**, como troca |
| Camisa de R$ 250 → camisa de R$ 80, loja devolve R$ 170 em dinheiro | **− R$ 170**, como troca |
| Camisa de R$ 80 → outra de R$ 80 | **nada** — fica só o registro |

Entra no total, mas **sempre em linha própria, identificado como troca** — nunca dentro de "vendas".

### 🧾 A venda original continua sendo venda

Quando a troca é feita pela venda de origem, a peça que volta **não desconta mais aquela venda**: o dinheiro dela não voltou para a cliente, virou crédito para a peça nova. Antes, com a venda e a troca no mesmo dia, o relatório mostrava menos dinheiro do que realmente entrou.

### 📋 Onde aparece

- **Relatório de Evento:** cartão *Trocas*; seção *Trocas do período* com o que voltou, o que saiu, crédito, quanto pagou a mais, troco devolvido e saldo; fechamento em linhas separadas — *Líquido das vendas*, *Diferença das trocas*, *Líquido a receber*; nas formas de pagamento, o que foi pago nas trocas em linha própria para bater com a maquininha.
- **Fechamento de caixa:** Vendas → Trocas (pago a mais, troco devolvido, saldo) → Total recebido. A gaveta confere com o dinheiro das vendas **e** das trocas.
- **Relatórios e Painel:** trocas fora da contagem de vendas, com o saldo em linha própria.
- **Listas de vendas e histórico do cliente:** etiqueta *troca*.

### Conferido

Teste com o caso exato — camisa de 80 volta, cliente paga 100, leva camisa de 180 — e um dia inteiro com os quatro tipos de troca no mesmo caixa: o total recebido bate centavo a centavo com o dinheiro que entrou. A conversão do banco foi testada numa cópia real da loja: 723 vendas, R$ 104.423,99, 1.027 itens e 728 pagamentos idênticos antes e depois.
