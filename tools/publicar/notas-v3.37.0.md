## v3.37.0 — Banco nunca abre zerado · Segurança reforçada

### 🛡️ O sistema não abre mais vazio

Se ao ligar o computador o banco tiver sumido ou estiver vazio/corrompido, o sistema **recupera sozinho** a cópia com mais vendas, guarda o arquivo com problema e avisa depois do login. Se não houver cópia nenhuma, avisa em vez de começar zerado em silêncio.

### 💾 Gravação protegida

- As gravações saem uma de cada vez, sem atropelo.
- Se uma gravação falhar, aparece uma **faixa vermelha** no topo até voltar ao normal.
- Restaurar de arquivo mostra os dois lados (atual × arquivo) e pede confirmação.

### 🔒 Segurança

- 5 senhas erradas seguidas travam o login por 5 minutos (dobra a cada nova série, até 60 min).
- Senha mestra e funções perigosas só funcionam no computador principal, nunca pela rede.
- Usuário de terminal desativado ou rebaixado perde o acesso no pedido seguinte.
- Senhas existentes não foram alteradas.

### 🛒 Vendas, trocas e devoluções

- Clique duplo no confirmar gera **uma** venda só.
- Preço sempre lido do cadastro.
- Desconto por item exige autorização do administrador.
- Cancelar, devolver e trocar devolvem a consignação e os pontos do cliente.
- Cupom informa se foi impresso direto ou se abriu a janela.

### 🌐 Rede

Servidor de rede com tempo limite (não trava), limite de conexões e sem entregar banco ou arquivos internos.
