## v3.41.0 — Desconto à vista com caixinha · Comparativo por data e hora · Estoque sem valores para o estoquista

### 🏷️ Desconto à vista só quando a caixa marcar
Na tela de pagamento apareceu a caixinha **"Dar desconto à vista"**, que começa desmarcada. Marcada, o desconto entra com as mesmas regras de antes (Pix ou dinheiro, a partir do valor mínimo). Desmarcada, a venda sai sem desconto. Os outros descontos não mudaram.

### 📊 Comparativo entre lojas obedece à data e hora
Em Relatórios → Por loja → "Todas — comparativo entre lojas", entram só as vendas entre a abertura e o fechamento escolhidos. O período aparece no topo.

### 🖨️ Estoque com e sem valores
Em Relatórios → 📦 Estoque, há dois botões: **Imprimir com valores** e **Imprimir para conferência (sem valores)**. A versão sem valores sai só com as quantidades e a coluna "Contado", sem custo, sem preço e sem o que foi vendido.

### 🛡️ Modo servidor e caixas (vindos da 3.40.2)
- O vigia do modo servidor não é mais barrado pelo antivírus.
- **Salgueiro Terminal 1.0.1**, que os caixas recebem sozinhos pela rede da loja:
  - imprime sem a janela do Windows;
  - tem o botão Atualizar agora;
  - acha o servidor pelo nome do computador;
  - ajusta a tela a monitores menores.

## Arquivos
- `resources.neu` — SHA256: `820fec7e17d08b79061c788c7242f0ae9dc258c9717b75a6067af5da2541a878`
- `salgueiro-terminal.neu` (Salgueiro Terminal 1.0.1) — SHA256: `eea62c90e2e2d06368e3c39af0c76b897320d032bbfd10c988829bf6687f44f8`
