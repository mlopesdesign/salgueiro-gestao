# REGISTRO DE AÇÕES — Salgueiro Gestão V2

> Uma linha por ação: data, o que foi feito, CERTO/ERRADO e por quê. Consultar
> antes de agir para não repetir erro.

- 2026-11-03 — v3.35.2 deu código novo às 61 variações de 30–31/10 e criou a aba "Etiquetas a trocar". ERRADO: o Marcio pediu para VERIFICAR, não para mudar; e corrigiu o lote maior (739 peças com etiquetas certas) em vez do menor.
- 2026-11-03 — Expliquei a tela supondo que as 739 eram etiquetas a trocar. ERRADO: não confirmei com ele qual lote estava certo.
- 2026-11-05 — Pedi acesso a AppData sem dizer em QUAL computador valeria; foi concedido no desktop-marcio, não no PDV. ERRADO: sempre dizer o computador (get_device_info) antes de pedir pasta.
- 2026-11-05 — Conferência só-leitura do banco do PDV (anexado): troca em 03/11 14:18, 739 peças, nenhuma venda depois. CERTO.
- 2026-11-05 — Banco revertido manual + backup idêntico entregues no chat. CERTO, mas só chegava ao PDV se o Marcio restaurasse.
- 2026-11-05 — v3.36.0: cupom automático + reversão no próprio banco do PDV ao abrir, com cópia antes. Backup pre-v3.36.0, testes no banco real, build, instalador, manuais, GRAPHIFY. CERTO. NÃO publicado: aguarda ordem.
- 2026-11-05 15:33 — v3.36.0 publicada pelo vigia após ordem do Marcio. Commit d740260, tag v3.36.0, Release Latest com resources.neu conferido no GitHub. Bancos da loja (recuperar-loja) NÃO enviados. CERTO.
- 2026-11-05 — device_commit_files com o MESMO stagedPath reaproveitado entregou a versão ANTIGA do arquivo (ESTADO.MD e REGISTRO perderam atualizações). ERRADO: usar caminho de saída novo a cada envio e conferir o conteúdo no disco (grep), não só o tamanho.
- 2026-11-05 22:07 — Laptop: Salgueiro travado em "Carregando" + 2 PS1 órfãos (15:23 e 21:19) na porta 2020. Fechados com autorização; reabriu às 22:07:50 com 2.582 vendas. CERTO.
- 2026-11-05 22:20 — Auditoria com 4 revisores em paralelo (só leitura): 35 achados, os críticos conferidos no código. Relatório em recuperar-loja (fora do git). CERTO.
- 2026-11-05 22:30 — Backup ESTADO-v3.36.0-FUNCIONANDO e repositório tornado PRIVADO (ordem do Marcio). Efeito colateral avisado: updater sem login deixa de ver releases até trocar o canal. CERTO.
- 2026-11-05 — v3.37.0 implementada (35 achados da auditoria): banco nunca abre zerado (recupera do backup com mais vendas), gravação serializada + faixa vermelha em falha, restaurar de arquivo com confirmação, trava de login (5 erros → 5 min), sessão do terminal revalidada, desconto por item exige token, venda idempotente (id_unico), preço lido do banco, cancelamento/devolução/troca estornam consignação e pontos, servidor de rede endurecido (timeouts, bloqueio de .db/.json/backend). Senha de acesso e senha mestra NÃO alteradas. Teste novo 32/32, restauração 14/14. Build sha256 c0a1367b…5893. CERTO.
- 2026-11-05 — 36 arquivos gravados no disco com caminho de saída NOVO (outputs/v3370-a); sha256 conferido no disco = nuvem. CERTO.
- 2026-11-05 — Publicação da v3.37.0 PENDENTE de autorização: criar repo público só de atualizações e abrir o principal temporariamente (repo privado bloqueia o updater: HTTP 404). Nada publicado.
- 2026-11-06 00:16 — Marcio: "coloca public". Conferido antes: nenhum banco da loja no git (só src/dados-iniciais.db, com dados de demonstração). Commit a32f7e1 + tag v3.37.0 enviados; repo PÚBLICO; vigia publicou; API sem login devolve v3.37.0 com sha256 c0a1367b…5893. CERTO.
