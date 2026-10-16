## v3.31.2 — Tela de Backup sem travar o principal · Diagnóstico mais claro

### 💾 A tela de Backup não segura mais o computador principal

Ao abrir **Configurações → Backup**, o principal abria **cada backup guardado** para contar vendas, produtos e clientes. Com muitos backups isso levava **mais de 11 segundos** — e, nesse tempo, os terminais pelo navegador ficavam esperando.

Agora ele guarda essa contagem e só abre o backup **novo ou alterado**. Da segunda vez em diante a tela abre na hora.

### 🩺 Diagnóstico de travamentos mais claro

- **Aba do navegador em segundo plano não conta mais como lentidão.** Quando a aba do sistema fica escondida atrás de outra, o navegador atrasa os pedidos de propósito; isso aparecia como "LENTO" sem o sistema ter culpa. Agora só é registrado o que demorou com a tela à vista.
- **Cada aviso do terminal vem com a explicação.** Embaixo de cada LENTO ou SEM RESPOSTA aparece uma linha dizendo onde estava a demora:
  - o pedido **nem chegou** ao principal → problema de rede/Wi-Fi;
  - o principal respondeu rápido → a demora ficou **na rede ou no navegador**;
  - o principal **também demorou** → ele estava ocupado.
