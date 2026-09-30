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
