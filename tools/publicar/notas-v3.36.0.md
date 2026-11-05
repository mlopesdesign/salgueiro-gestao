## v3.36.0 — Cupom sai sozinho ao finalizar a venda · Etiquetas das peças voltam a valer

### 🖨️ Cupom não fiscal automático

Ao confirmar a venda, o comprovante não fiscal sai **sozinho** na impressora de cupom. Ninguém precisa clicar em "Imprimir".

| Onde a venda foi feita | O que acontece |
|---|---|
| Computador principal com impressora de cupom configurada | Cupom direto na térmica |
| Aparelho pela rede | A janela de impressão abre sozinha |
| Computador principal sem impressora configurada | Pergunta, como antes |

O aviso de venda concluída continua, com **Imprimir de novo** para a segunda via.

### 🏷️ Troca de códigos da v3.35.2 desfeita

As 61 variações cadastradas em 30 e 31/10 voltam ao código impresso nas etiquetas delas (2000000006017 a 2000000006611). As etiquetas coladas nas peças voltam a valer no caixa. A aba "Etiquetas a trocar" deixa de aparecer.

- Roda uma vez, ao abrir o sistema, com cópia do banco antes (`antes-reverter-codigos`).
- Não mexe em venda, estoque nem cadastro — só no número do código dessas 61 variações.
- Cadastro novo continua sem repetir código (próximo: 2000000100623).
- O sistema não refaz mais a troca ao restaurar backup.

## Como atualizar
Aguarde a notificação dentro do app (Configurações → Atualização) ou baixe o `resources.neu` abaixo e substitua em `%LOCALAPPDATA%\SalgueiroGestao\resources.neu`.

## Arquivo
- `resources.neu` — SHA256: `f48d6bf4cb6b78914a82c67023aae0bec56dea9fd47f6cd3dbb4940c2a8e0dfc`
