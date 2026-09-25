## v3.27.1 — Consignado barrado na tela e janela de estoque no tamanho certo

Correções em cima da v3.27.0, reprovadas no teste do Marcio.

### 🏷️ Peça consignada não entra mais em venda a preço de custo

Na v3.27.0 a recusa só acontecia no fim, quando a venda era fechada. Agora é barrado na tela:

- com o **preço de custo ligado**, a peça consignada **não entra no carrinho**, dizendo qual é;
- com a peça consignada **já no carrinho**, o preço de custo **não liga**, listando as peças que precisam sair.

**Só peça do Salgueiro sai a preço de custo.** A trava continua também no servidor, então terminal em rede não contorna.

### 🪟 Janela de Entrada / Saída / Ajuste no tamanho da tela

A janela nascia estreita e a grade das lojas abria com barra de rolagem lateral tendo espaço sobrando ao lado. Agora ela abre no tamanho que a grade precisa, usando até **90% da tela**.
