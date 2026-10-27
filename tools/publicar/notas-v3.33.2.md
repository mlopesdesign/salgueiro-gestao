## v3.33.2 — Proteção contra desligamento abrupto: cópia anterior e cópias de hora em hora

### 🔎 O que o arquivo da loja mostrou

O banco guardado pela recuperação de 27/10 (`banco-com-problema-…db`, 2.691.072 bytes) estava **100% zerado**: nenhum byte com dado. É o retrato de quando o Windows desliga de repente (queda de energia, botão, travamento) logo depois de uma gravação: o tamanho do arquivo chega a ser registrado, o conteúdo não.

E não havia cópia de segurança entre 23/10 e 27/10: a cópia diária só era feita **ao abrir** o sistema, e com o programa aberto por dias não nascia nenhuma. A limpeza antiga ainda apagava as diárias (corrigido na 3.33.1).

### ✅ O que muda

- **Cópia da gravação anterior.** A versão anterior do banco não é mais apagada a cada gravação: fica guardada como `salgueiro.db.anterior`. Se o banco amanhecer zerado ou danificado, o sistema restaura **primeiro** essa cópia, e a perda fica limitada à última gravação.
- **Gravação conferida.** Antes de colocar o banco novo no lugar, o sistema confere se o arquivo escrito tem o cabeçalho certo e o tamanho certo. Um arquivo que saiu zerado nunca substitui o bom.
- **Cópias de hora em hora com o sistema aberto.** Se houve venda ou alteração, uma cópia por hora (ficam as últimas 48, ou seja, 2 dias). A cópia diária passa a ser feita também com o sistema aberto, não só ao abrir.
- **Diagnóstico.** "BANCO-ZERADO" quando o banco é encontrado zerado, e a recuperação diz de onde restaurou.
