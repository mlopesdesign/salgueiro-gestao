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

**Arquivo:** `resources.neu` — 6.456.384 bytes — sha256 `106d8459cc87e679e8958f2520158a0fcaac859111c62047d349913d94e29514`
