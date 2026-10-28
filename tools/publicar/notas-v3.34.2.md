## v3.34.2 — A restauração de backup passa a valer sempre ("restaurei e voltou")

### 🔎 O que aconteceu (provado pelo log da loja de 27/10)

A restauração gravou o banco certo, mas o sistema **não reiniciou**: o mesmo programa continuou aberto (o log mostra ele atendendo às 19:11 e fazendo outra restauração às 19:15), ainda com os **dados antigos na memória**. Na gravação seguinte, ele escreveu esses dados antigos **por cima do banco restaurado**. Por isso o backup de 23/10 "não pegava" e era preciso restaurar de novo.

O sistema **não puxa backup sozinho ao abrir**. Isso só acontece quando o banco está quebrado ou vazio, como em 27/10 às 18:14, depois do desligamento. Em nenhuma das aberturas seguintes houve recuperação automática.

### ✅ Correção

- **Restaurou, parou de gravar.** No instante em que o backup é gravado, o programa que estava aberto fica proibido de gravar o banco. Ele não tem como escrever por cima.
- **Reinício garantido.** Se o programa não fechar sozinho em 4 segundos, é encerrado à força. Se a reabertura automática falhar, aparece o aviso para abrir de novo pelo atalho.
- **Um programa velho nunca grava por cima de um novo.** Cada abertura recebe um código. Antes de gravar, o programa confere se ainda é o mais novo; se não for (ficou esquecido aberto, abriu duas vezes, ou houve restauração), ele não grava e se fecha.
- Tudo fica registrado no Diagnóstico: RESTAURACAO, GRAVACAO-BLOQUEADA, PROCESSO-ANTIGO.
