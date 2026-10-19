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
