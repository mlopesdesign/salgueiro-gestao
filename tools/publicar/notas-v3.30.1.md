## v3.30.1 — O sistema não fecha mais sem perguntar

### 🛑 X e Alt+F4 agora perguntam antes de fechar

Relato: *o sistema fechou sozinho*. No PDV o **F4** troca o cliente; com o **Alt** apertado vira **Alt+F4**, que fecha qualquer programa do Windows na hora — e o Salgueiro fechava sem perguntar.

Agora o **X** e o **Alt+F4** abrem a pergunta **"Fechar o Salgueiro Gestão?"**:

- se houver venda montada no PDV, o aviso diz quantas peças vão ser perdidas;
- o botão em destaque é **Continuar trabalhando** — um Enter sem querer não fecha;
- na tela de entrada (ninguém logado) fecha direto;
- para só tirar da frente, o botão **_** (minimizar) continua igual.

### 💾 Salvamento final ao fechar voltou a funcionar

Desde a 3.25.9 o sistema encerrava antes de rodar a gravação final do banco. Agora ele **grava tudo e só depois fecha**. Conferido no próprio Windows com o executável do Salgueiro: com a configuração antiga o fechamento não passava pela gravação; com a nova, passa.
