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
