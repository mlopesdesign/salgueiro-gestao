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
