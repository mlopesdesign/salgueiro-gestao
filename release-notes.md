## v3.27.0 — Troca certa no caixa, estoque de todas as lojas numa tela só

### 💱 Bug corrigido: a troca inflava o caixa

Trocando uma peça de **R$ 80** por uma de **R$ 250**, o fechamento somava os R$ 250 inteiros — mesmo tendo entrado só os **R$ 170** de diferença que a cliente pagou. O caixa fechava com sobra que nunca existiu.

Agora:

- entra no caixa **apenas a diferença**, para mais ou para menos;
- troca por peça **do mesmo valor não mexe em nada** — fica só registrada;
- excedente devolvido continua saindo como sangria, como antes;
- o crédito da peça que voltou **deixou de aparecer como dinheiro recebido**, e no relatório passou a se chamar **"Crédito de troca"** em vez de sair como `troca`;
- o fechamento de caixa ganhou um bloco **Trocas**, separado das vendas.

As trocas que já estavam gravadas são acertadas sozinhas na primeira vez que o programa abrir. Nada precisa ser feito à mão.

### 🏬 Entrada, saída e ajuste em todas as lojas de uma vez

A janela do produto agora tem **uma coluna por estoque**: dá para lançar Almoxarifado, Centro e Shopping na mesma tela, sem abrir e fechar três vezes.

- a coluna "tem aqui" saiu — esse número já está na tela de trás;
- loja sem a peça continua travada na saída (estoque negativo segue impossível);
- as etiquetas somam a quantidade quando a mesma variação entra em mais de uma loja;
- a janela cresce conforme o número de lojas, com os números alinhados à direita.

### 🧹 Zerar estoque

**Configurações → Estoques** (só administrador): zerar o saldo de uma loja escolhida ou de todas de uma vez.

- os produtos, as variações e os preços **continuam cadastrados** — some só a quantidade;
- para confirmar é preciso digitar **ZERAR**;
- tudo que for zerado fica no histórico de movimentações com a quantidade que havia e quem mandou.

### 🏷️ Consignado não sai mais a preço de custo

A peça é do fornecedor: vendida pelo custo não sobra lucro para dividir e a loja acabava pagando o repasse do próprio bolso. A venda passa a ser recusada dizendo qual peça é consignada. A trava está no servidor, então terminal em rede também não contorna.

### 🖨️ Impressão do cupom ajustável

**Configurações → Impressoras**: largura do papel, largura do conteúdo, margem, folga das bordas e tamanho da letra.

- funciona também nos **terminais que usam o sistema pela rede**, onde o cupom saía cortado do lado direito;
- botão **Salvar e imprimir teste**, com uma régua no papel para conferir onde está cortando;
- opção de **ajustar só uma máquina**, sem desregular as outras;
- os valores de fábrica são exatamente os de antes — quem já imprime certo não vê diferença.

### 🔧 Por baixo

- `trocas.js` marca a venda de troca nas duas vias (com e sem venda de origem)
- `resumoCaixa` separa venda de troca; `por_forma` e `por_loja` deixam de contar o crédito
- `estoques.zerar()` recalcula o total geral a partir da soma dos locais
- `salgueiro-setup.nsi` estava parado na 3.25.41 — atualizado
- testes novos: `teste-troca-caixa` (31 asserções) e `teste-zerar-estoque` (37); `teste-venda-custo` atualizado para a nova regra do consignado
