// Novidades de cada versão — mostrado em Configurações → Atualização.
// Escrito para quem usa a loja, não para programador: frases curtas, sem termo
// técnico. A cada release nova, acrescente um bloco NO TOPO da lista.
export const NOVIDADES = [
  {
    versao: '3.30.0',
    data: '2026-10-07',
    itens: [
      '💵 TROCO NO PAGAMENTO EM DINHEIRO. Ao escolher Dinheiro aparece o campo "Cliente deu" — obrigatório — e o sistema mostra na hora o troco a devolver (ou quanto falta). O troco sai no cupom e a gaveta confere certinho. Vale no PDV, na troca (quando a cliente paga a diferença em dinheiro) e no recebimento de crediário. Nas outras formas o campo não aparece.',
      '🏆 RELATÓRIOS → MAIS VENDIDOS. Aba nova com o ranking dos produtos por peças vendidas no período, receita e participação. No seletor: "Todas as lojas (total)" — com a quantidade de cada loja em colunas — ou uma loja só. Já desconta devolução, troca não conta, e exporta para Excel (CSV).',
      '🚫 LOJA SEM DESCONTO. Em Configurações → Lojas, marque "Esta loja não dá desconto" (ex.: venda online). No PDV dessa loja some o campo de desconto e não entra desconto de espécie nenhuma: manual, por item, à vista, de categoria do cliente ou resgate de pontos. Trocando o caixa de loja, a regra acompanha. O servidor também recusa — não dá para burlar pela rede.',
    ],
  },
  {
    versao: '3.29.1',
    data: '2026-09-30',
    itens: [
      '🖨️ IMPRIMIR BALANÇO VOLTOU A FUNCIONAR. Em Estoques → local, o botão Imprimir balanço gerava uma folha em branco. Agora sai um documento A4 próprio: nome da loja e do estoque, data, filtro usado, cada peça com referência, cor/tamanho, código de barras, quantidade e valor, total no fim, coluna "Contado" em branco para a conferência e espaço para assinatura. Sai exatamente o que está filtrado na tela.',
      '📄 RELATÓRIO, RANKING E ROMANEIO EM FOLHA A4. Eles usavam o tamanho do cupom (80 mm) na impressão e saíam numa tira estreita. Agora todo documento sai em A4 — a impressão do cupom continua como estava.',
    ],
  },
  {
    versao: '3.29.0',
    data: '2026-09-30',
    itens: [
      '🖱️ A RODINHA DO MOUSE NÃO MEXE MAIS EM NÚMERO. Com o cursor em cima de um campo de número (estoque, preço, quantidade — qualquer um), rolar a rodinha para descer a página alterava o valor sem ninguém ver, e isso gerava diferença de estoque. Agora a rodinha só rola a página, em todas as telas e janelas do sistema, no computador e no navegador. As setinhas de subir e descer também saíram dos campos.',
      '📦 ESTOQUE POR LOJA DIRETO NO PRODUTO. Ao cadastrar ou editar um produto, o administrador vê uma coluna para cada estoque — almoxarifado e cada loja — e digita quanto fica em cada um. Produto de 40 peças: 10 numa loja, 10 na outra, 20 no almoxarifado, tudo na mesma tela. A coluna Total soma sozinha e mostra quanto entra ou sai.',
      '🔄 O que passa de um estoque para outro vira transferência (aparece em Transferências, com romaneio); o que for a mais vira entrada, com etiqueta oferecida ao salvar; o que for a menos vira saída. Tudo fica no histórico do estoque. Estoque negativo continua não existindo, e só o administrador mexe no estoque por essa tela.',
    ],
  },
  {
    versao: '3.28.0',
    data: '2026-09-25',
    itens: [
      '🔁 TROCA NÃO É VENDA — DE UMA VEZ POR TODAS. Até aqui a troca era guardada no sistema como se fosse uma venda, e cada tela precisava lembrar de separá-la: o caixa foi corrigido, depois o relatório, depois o painel — e o Relatório de Evento continuava mostrando uma troca como "1 venda de R$ 180". Agora a troca é guardada como TROCA, com situação própria. Nenhuma tela conta troca como venda — nem as que já existem, nem as que ainda forem criadas.',
      '💰 A DIFERENÇA, POSITIVA OU NEGATIVA. Na troca entra só o saldo: o que a cliente pagou a mais, menos o troco que a loja devolveu em dinheiro ou estorno. Camisa de R$ 80 trocada por uma de R$ 180 com R$ 100 pagos: entra R$ 100, como troca. Camisa de R$ 250 trocada por uma de R$ 80 com R$ 170 devolvidos em dinheiro: sai R$ 170, como troca. Valores iguais: não mexe em nada, só fica registrado.',
      '🧾 A VENDA ORIGINAL CONTINUA SENDO VENDA. Quando a troca é feita pela venda de origem, a peça que volta não desconta mais aquela venda — o dinheiro dela não voltou para a cliente, virou crédito para a peça nova. Antes, com a venda e a troca no mesmo dia, o relatório mostrava menos dinheiro do que realmente entrou.',
      '📋 RELATÓRIO DE EVENTO com cartão Trocas, seção "Trocas do período" (o que voltou, o que saiu, crédito, quanto pagou a mais, troco devolvido e saldo) e o fechamento em linhas separadas: líquido das vendas, diferença das trocas e o líquido a receber somando os dois. Na tabela de formas de pagamento, o que foi pago nas trocas aparece em linha própria, para bater com a maquininha.',
      '🏷️ Nas listas de vendas do caixa e no histórico do cliente, a troca aparece com a etiqueta "troca".',
    ],
  },
  {
    versao: '3.27.5',
    data: '2026-09-25',
    itens: [
      '📉 LUCRO BRUTO NEGATIVO NO PAINEL, CORRIGIDO. Depois da 3.27.4 o painel mostrava LUCRO BRUTO -R$ 90,00. A receita da troca tinha saído de "vendas" (certo), mas o CUSTO da peça que saiu na troca continuou sendo contado — zero de venda menos noventa de custo. Agora a troca tem a conta certa: entra peça e sai peça, então o custo que vale é a diferença entre o custo da que saiu e o da que voltou, e o lucro da troca é a diferença que a cliente pagou menos esse custo. O painel mostra, embaixo da margem, quanto do lucro veio de troca.',
      '🏆 "Mais vendidos no mês" deixou de listar a peça que saiu numa troca. Troca não é venda, nem ali.',
    ],
  },
  {
    versao: '3.27.4',
    data: '2026-09-25',
    itens: [
      '🔁 TROCA NÃO É VENDA — em toda tela do sistema. O painel mostrava "1 venda(s) · R$ 180,00" quando aquilo tinha sido uma troca. Agora a troca não conta como venda em lugar nenhum: nem no painel, nem no relatório, nem no fechamento de caixa, nem no gráfico dos 14 dias, nem no ticket médio.',
      '💰 A DIFERENÇA DA TROCA ENTRA COMO TROCA. O dinheiro que a cliente paga a mais continua entrando no total — afinal entrou no caixa — mas em linha própria, identificado como troca. O fechamento de caixa agora mostra Vendas, depois Trocas, e no fim o Total recebido somando os dois. O relatório ganhou os cartões Diferença de trocas e Total recebido, e o painel mostra a diferença embaixo do valor de vendas.',
      '🧱 A regra virou UMA SÓ, num arquivo do sistema, em vez de estar repetida em cada consulta. Era por isso que o problema ia sendo corrigido num lugar e reaparecendo em outro — caixa, depois relatório, depois painel.',
    ],
  },
  {
    versao: '3.27.3',
    data: '2026-09-25',
    itens: [
      '💱 FATURAMENTO DA TROCA CORRIGIDO NOS RELATÓRIOS. Na 3.27.0 a troca foi acertada no fechamento de caixa, mas a aba Relatórios continuava somando o valor cheio: trocando uma peça de R$ 80 por uma de R$ 250, o faturamento aparecia como R$ 250 em vez dos R$ 170 que a cliente pagou. Agora o relatório inteiro conta só a diferença — faturamento, vendas por dia, por vendedor, por hora, e os cartões Vendas do Salgueiro e Vendas de consignados. A conta virou uma regra única usada em todo o relatório, em vez de ficar repetida consulta por consulta.',
    ],
  },
  {
    versao: '3.27.2',
    data: '2026-09-25',
    itens: [
      '🪟 Nenhuma janela do sistema usa mais barra de rolagem lateral tendo espaço na tela. A regra passou a valer para TODAS as janelas de uma vez — Troca rápida, Entrada de mercadoria, fechamento de caixa, o que for: cada janela abre já no tamanho que o conteúdo precisa, até 90% da tela. Na 3.27.1 isso tinha sido acertado só na janela de estoque.',
    ],
  },
  {
    versao: '3.27.1',
    data: '2026-09-25',
    itens: [
      '🏷️ Peça consignada agora é barrada NA TELA, não só na hora de fechar. Com o preço de custo ligado, a peça consignada não entra no carrinho — e se já estiver no carrinho, o preço de custo não liga, dizendo qual peça é. Só peça do Salgueiro sai a preço de custo.',
      '🪟 A janela de Entrada / Saída / Ajuste deixou de nascer estreita. Ela agora usa até 90% da tela e abre no tamanho que a grade precisa — acabou a barra de rolagem lateral aparecendo com espaço sobrando do lado.',
    ],
  },
  {
    versao: '3.27.0',
    data: '2026-09-24',
    itens: [
      '💱 TROCA NO CAIXA CORRIGIDA. Trocando uma peça de R$ 80 por uma de R$ 250, agora entram no caixa só os R$ 250 − R$ 80 = R$ 170 que a cliente pagou. Antes entravam os R$ 250 inteiros e o fechamento fechava com sobra que nunca existiu. Troca de peças do mesmo valor não mexe mais em nada — fica só registrada. O crédito da peça que voltou deixou de aparecer como dinheiro recebido, e no relatório ele agora se chama "Crédito de troca". As trocas que já estavam no sistema são acertadas sozinhas na primeira vez que o programa abrir.',
      '🏬 ENTRADA, SAÍDA E AJUSTE EM TODAS AS LOJAS DE UMA VEZ. A janela do produto agora tem uma coluna para cada estoque: dá para lançar Almoxarifado, Centro e Shopping na mesma tela. A coluna "tem aqui" saiu — esse número já está na tela de trás. Loja sem a peça continua travada na saída.',
      '🧹 ZERAR ESTOQUE. Em Configurações → Estoques dá para zerar o saldo de uma loja ou de todas de uma vez. Os produtos, as variações e os preços continuam cadastrados: some só a quantidade. Para confirmar é preciso digitar ZERAR, e tudo que for zerado fica no histórico com a quantidade que havia e quem mandou.',
      '🏷️ CONSIGNADO NÃO SAI MAIS A PREÇO DE CUSTO. A peça é do fornecedor: vendida pelo custo não sobra lucro nenhum para dividir e a loja acabava pagando o repasse do próprio bolso. Agora a venda é recusada dizendo qual peça é consignada.',
      '🖨️ IMPRESSÃO DO CUPOM AJUSTÁVEL. Em Configurações → Impressoras dá para acertar largura do papel, largura do conteúdo, margens, folga das bordas e tamanho da letra — inclusive nos terminais que usam o sistema pela rede, que era onde o cupom saía cortado do lado direito. Tem botão de imprimir um teste com régua e a opção de ajustar só uma máquina, sem desregular as outras.',
    ],
  },
  {
    versao: '3.26.5',
    data: '2026-09-16',
    itens: [
      '📐 Tela de Estoque alinhada. Cada loja virou uma COLUNA de verdade, com o número à direita e dígitos de largura fixa — agora 9 e 11 batem na vertical. Antes os saldos eram texto solto numa célula só e nada se alinhava entre as linhas.',
      '🔘 Os botões Entrada, Saída e Ajustar ficam na mesma linha, sem quebrar.',
      '📱 A tela se adapta ao tamanho do monitor: a rolagem horizontal fica dentro da tabela e nunca empurra o layout. Em telas menores sai primeiro o código de barras, depois a foto.',
      '📷 As fotos voltaram: cada variação mostra a miniatura, e a linha do produto usa a primeira foto que existir entre as variações — antes pegava a da primeira variação e, se ela estivesse sem foto, o produto aparecia com o ícone genérico.',
    ],
  },
  {
    versao: '3.26.3',
    data: '2026-09-16',
    itens: [
      '🖨️ AS LOJAS EM REDE VOLTARAM A IMPRIMIR ETIQUETA. Nos terminais a etiqueta saía no tamanho do cupom (80mm) e sem formatação — o sistema usava a impressão da página, que carrega o @page do cupom. Agora a folha de etiquetas abre numa janela própria, com o tamanho 60×40mm correto, e imprime na impressora daquela loja.',
      '🏷️ Etiqueta direto do Estoque: ao confirmar uma Entrada pelo produto, a prévia de etiquetas abre sozinha já com as peças que acabaram de entrar e a quantidade de cada uma.',
    ],
  },
  {
    versao: '3.26.2',
    data: '2026-09-16',
    itens: [
      '📦 Entrada, Saída e Ajustar agora são do PRODUTO. Clicando em qualquer um dos três, abre uma janela só com TODAS as variações do produto — você mexe no que quiser e confirma uma vez. Acabou o abre-fecha variação por variação.',
      '⚖️ No Ajuste você digita a contagem real de cada variação naquele estoque. Linha em branco não é tocada; 0 zera a peça naquele local.',
      '📋 A lista continua agrupada por produto, com o total do produto e o saldo de cada variação em cada loja.',
    ],
  },
  {
    versao: '3.26.1',
    data: '2026-09-16',
    itens: [
      '📦 ESTOQUE PELO PRÓPRIO PRODUTO. O administrador agora corrige a quantidade direto na grade do produto: o número é o TOTAL da variação — tem 10, chegaram 10, escreva 20. Antes esse campo ficava travado e era preciso sair, abrir o módulo Estoque e ajustar variação por variação.',
      '🏷️ ETIQUETA SÓ DAS PEÇAS QUE ENTRARAM. Ao salvar o produto, a tela de etiquetas abre sozinha já com as peças acrescentadas e a quantidade certa de cada uma. Não precisa mais desmarcar tudo na mão.',
      '🚫 NÃO EXISTE MAIS ESTOQUE NEGATIVO NA VENDA. Se faltar a peça no estoque daquela loja, a venda é recusada dizendo o nome da peça, o local e quanto tem. Antes a venda passava assim mesmo e o saldo da loja ficava abaixo de zero.',
      '📋 A recusa ensina o caminho: se a peça está na arara mas não no sistema, é porque a descida do Almoxarifado não foi registrada — basta lançar em Estoques → Transferir.',
      '🧾 Toda correção feita pela grade do produto fica registrada no Kardex, com quem fez e o total informado.',
    ],
  },
  {
    versao: '3.25.41',
    data: '2026-09-10',
    itens: [
      '🔎 PDV: a pesquisa não corta mais a lista. Antes mostrava só 8 produtos, e como a ordem é alfabética o produto recém-cadastrado quase nunca entrava nesses 8 — parecia que o cadastro não tinha salvo. Agora aparecem todos, com rolagem e a contagem de resultados.',
      '🔎 O mesmo corte foi tirado da consulta de preço (F3), das duas telas de troca, da entrada de compras e da busca de produtos na transferência.',
      '🖼️ Nas buscas muito amplas, só as 40 primeiras linhas carregam a foto (o resto usa o ícone) — é o que evita o travamento por excesso de imagens. Digitando mais letras, as fotos voltam.',
      '✅ Conferido: a entrada repartida coloca em cada estoque exatamente a quantidade escolhida, e o total do Salgueiro continua sendo a soma dos locais.',
    ],
  },
  {
    versao: '3.25.40',
    data: '2026-09-05',
    itens: [
      '🔄 TROCA RÁPIDA — a troca ficou muito mais simples: bipa a peça que voltou, bipa a peça que a cliente leva, acerta a diferença. Não precisa mais procurar a venda de origem. O F6 já abre direto nela.',
      '🧾 A troca pela venda de origem continua disponível (um clique dentro da própria tela) para quando precisar do desconto da compra original.',
      '📥 IMPORTAR VENDAS DO WHATSAPP — as vendas anotadas na planilha do dia entram todas de uma vez, sem digitar uma a uma no PDV. Botão "Importar planilha" no PDV, com modelo pronto para baixar.',
      '✅ A planilha é conferida antes de gravar: mostra quantas vendas estão prontas, quais têm erro e por quê. As com erro ficam de fora, as prontas entram.',
    ],
  },
  {
    versao: '3.25.39',
    data: '2026-09-04',
    itens: [
      '🐛 CORREÇÃO IMPORTANTE — saída de estoque: a peça saía do total mas continuava no saldo da loja e aparecia negativa no Almoxarifado. Agora a saída pede DE QUAL estoque a peça sai e tira de lá mesmo.',
      '📦 Entrada de mercadoria: dá para repartir a mesma entrada entre vários estoques de uma vez, dizendo quanto vai para cada um.',
      '📋 Ajuste de inventário: a contagem informada agora é a DAQUELE estoque, não o total do Salgueiro.',
      '🔎 Estoques (locais): campo de pesquisa por nome, referência, cor, tamanho ou código de barras.',
      '👁️ Estoques (locais): itens zerados ficam escondidos por padrão — no filtro dá para ver "somente zerados" ou os dois juntos.',
      '⚡ Estoques (locais): botões de Entrada, Saída e Ajuste direto na linha de cada peça.',
      '🏬 PDV: botão para trocar de loja sem fechar o caixa e sem perder a venda que está na tela.',
    ],
  },
  {
    versao: '3.25.38',
    data: '2026-09-02',
    itens: [
      '🔍 Estoques (locais): filtro cascata — próprios / consignados / por fornecedor',
      '🐛 Fix: filtro por fornecedor em Produtos agora funciona corretamente (fornecedor_id estava ausente na resposta da API)',
    ],
  },
  {
    versao: '3.25.37',
    data: '2026-09-02',
    itens: [
      '🔍 Estoque e Produtos: filtro cascata — escolha entre próprios ou consignados e, se consignado, selecione o fornecedor',
    ],
  },

  {
    versao: '3.25.36',
    data: '2026-09-02',
    itens: [
      '📦 Estoque: filtros por fornecedor consignado — veja só os produtos de cada fornecedor',
      '🏷️ Badge do fornecedor visível em cada produto consignado na lista de estoque',
    ],
  },
  {
    versao: '3.25.35',
    data: '2026-08-31',
    titulo: 'Correções de estabilidade e PDV',
    itens: [
      '🛠 OOM corrigido: migração de fotos e reparo de vínculos não travam mais o app ao gravar',
      '💳 Desconto à vista não é mais oferecido quando a forma de pagamento tem taxa (ex.: PIX com custo)',
      '🏷️ Venda a preço de custo: desconto de categoria não é mais aplicado automaticamente',
      '🔍 PDV: lista de sugestões de produto agora tem scroll (não cresce sem limite)',
      '↩️ Variação excluída pode ser re-adicionada com o mesmo nome sem erro',
    ],
  },
  {
    versao: '3.25.34', data: '2026-08-26',
    titulo: 'Fotos também na listagem do estoque por local',
    itens: [
      'Em Estoques (locais), a lista de peças de cada local agora mostra a miniatura da foto ao lado do produto — igual à tela de Estoque, para identificar a peça de bate-pronto.',
      'As fotos carregam conforme você rola a lista, então um local com centenas de peças abre na mesma velocidade de antes.',
      'No balanço impresso a foto não sai: a folha de conferência continua enxuta, sem gastar tinta nem empurrar linhas para outra página.'
    ]
  },
  {
    versao: '3.25.33', data: '2026-08-26',
    titulo: 'Atualização automática agora COLA de verdade',
    itens: [
      'CORRIGIDO: ao atualizar, o sistema voltava para a versão anterior depois de reiniciar. A causa: ele tentava trocar o arquivo do programa com o próprio programa ainda aberto — e o Windows mantém esse arquivo travado enquanto o app roda, então a troca não pegava.',
      'Agora a atualização baixa, o sistema fecha, a troca acontece com o arquivo livre e o programa reabre sozinho já na versão nova.',
      'Se a internet cair no meio do download, a atualização é cancelada e a versão atual continua intacta — nunca fica pela metade.'
    ]
  },
  {
    versao: '3.25.32', data: '2026-08-26',
    titulo: 'Fotos: reparo automático do vínculo com os produtos',
    itens: [
      'CORRIGIDO o problema que fez as fotos sumirem de todos os produtos de uma vez. As imagens nunca foram perdidas — o que quebrou foi a ligação entre o produto e o arquivo da foto, o que acontecia depois de restaurar um backup do banco (o backup traz os nomes das fotos, mas os arquivos de imagem não vêm junto).',
      'Agora, ao abrir, o sistema confere sozinho se cada foto ainda aponta para um arquivo existente. Achando alguma solta, ele refaz a ligação usando os backups — sem inventar nada: só religa o que consegue comprovar.',
      'Se você restaurar um backup antigo, as fotos voltam sozinhas no próximo boot.'
    ]
  },
  {
    versao: '3.25.31', data: '2026-08-25',
    titulo: 'Catálogo volta a sair com as fotos',
    itens: [
      'Corrigido: o Catálogo em PDF voltou a sair com a foto de cada peça. Depois que as imagens passaram a ser guardadas em arquivo, o gerador do catálogo não conseguia embutir fotos grandes — agora ele lê a imagem do jeito certo e ela aparece, em qualquer tamanho.'
    ]
  },
  {
    versao: '3.25.30', data: '2026-08-25',
    titulo: 'Consignado: fim do desconto contado duas vezes',
    itens: [
      'CORRIGIDO um erro sério no relatório de comissão e no recibo de consignados: o desconto da venda estava sendo descontado DUAS vezes. Ex.: peça de tabela R$170 vendida por R$144,50 aparecia como recebido R$122,83 (descontava os 15% de novo) e pagava R$88,27 ao fornecedor, quando o certo é R$98,03.',
      'Agora "Valor de tabela" é o preço cheio do cadastro, "Desconto" é o desconto dado no PDV, "Recebido" é o que a loja recebeu, e o repasse usa exatamente o valor calculado na venda. Relatório e recibo batem com o cupom, no centavo.'
    ]
  },
  {
    versao: '3.25.28', data: '2026-08-25',
    titulo: 'Fotos no catálogo + botão cancelar venda + trocas para todos',
    itens: [
      'Corrigido: o catálogo em PDF voltou a sair com as fotos das peças. Elas tinham parado de aparecer depois que as imagens passaram a ser guardadas em arquivo (mais leve) — agora o catálogo lê a imagem certinho.',
      'Novo botão "✕ Cancelar venda" na tela do PDV: esvazia o carrinho e zera cliente e desconto de uma vez, sem gravar nada. Bom para recomeçar quando o cliente desiste.',
      'Trocas liberadas para qualquer usuário do PDV — o botão "🔄 Troca" aparece em toda venda que ainda pode ser trocada, sem depender de permissão extra.'
    ]
  },
  {
    versao: '3.25.27', data: '2026-08-25',
    titulo: 'Foto opcional também no Relatório de Estoque',
    itens: [
      'No Estoque, ao clicar em "📄 Exportar PDF", agora aparece a opção "📷 Incluir a foto de cada peça". Marque para o relatório sair com a miniatura ao lado de cada produto.',
      'Continua desmarcada por padrão — quem quer a lista enxuta e mais rápida não muda nada. Com foto, o PDF fica mais bonito para conferência, mas gera mais páginas.'
    ]
  },
  {
    versao: '3.25.26', data: '2026-08-25',
    titulo: 'Foto opcional na Lista de Produtos e Preços',
    itens: [
      'Na tela de Produtos → "Exportar lista", agora existe a opção "Foto". Marque-a para sair a miniatura de cada peça ao lado do nome na lista impressa.',
      'A foto é opcional: continua desmarcada por padrão, então quem prefere a lista enxuta (sem imagem) não precisa mudar nada.',
      'A foto sai só no PDF (para imprimir/enviar ao cliente). O Excel continua sem imagem, como antes.'
    ]
  },
  {
    versao: '3.25.25', data: '2026-08-22',
    titulo: 'Transferir tudo agora zera a origem + quantidade na lista',
    itens: [
      'Corrigido: ao usar "Levar tudo da origem", o local de origem agora fica ZERADO de verdade. Antes, peças com saldo negativo ficavam para trás e a origem terminava negativa.',
      'Peças com saldo negativo na origem (erro de estoque antigo) também são movidas, para a origem poder zerar — o sistema avisa quando isso acontece.',
      'Na opção "Selecionar da lista", agora dá para editar a quantidade de cada produto antes de transferir, em vez de mandar sempre o saldo cheio.'
    ]
  },
  {
    versao: '3.25.23', data: '2026-08-22',
    titulo: 'Transferência: levar tudo e selecionar vários de uma vez',
    itens: [
      'Novo botão "Levar tudo da origem": coloca no romaneio todas as peças do local de origem, no saldo cheio, de uma vez — é só revisar e confirmar.',
      'Novo botão "Selecionar da lista": mostra tudo o que há na origem com caixas de marcar (com "marcar todos" e filtro por nome/referência). Marque os produtos que quer e adicione todos juntos.',
      'Continua funcionando escolher produto por produto na busca, como antes.'
    ]
  },
  {
    versao: '3.25.22', data: '2026-08-20',
    titulo: 'Fim do erro ao ajustar estoque + fotos no estoque',
    itens: [
      'Corrigido o erro "Aborted(OOM)" que impedia ajustar o estoque em lojas com muitas fotos. As fotos saíram de dentro do banco e agora ficam guardadas como arquivos, num local seguro que nenhuma atualização apaga.',
      'A conversão das fotos existentes é automática na primeira abertura, com backup do banco antes — nada se perde.',
      'A tela de Estoque agora mostra a miniatura da foto ao lado de cada peça, para identificar mais rápido.'
    ]
  },
  {
    versao: '3.25.21', data: '2026-08-20',
    titulo: 'Estoque abre com a lista completa em ordem alfabética',
    itens: [
      'Ao abrir o Estoque, a tela já mostra todos os produtos em ordem alfabética — com os botões de Entrada, Saída e Ajustar em cada linha, prontos para usar sem precisar buscar antes.',
      'A busca continua funcionando: digite nome, referência ou bipe o código para filtrar. Apagar a busca volta a mostrar a lista inteira.'
    ]
  },
  {
    versao: '3.25.20', data: '2026-08-20',
    titulo: 'Recibo do consignado igual ao relatório + ajustes no estoque',
    itens: [
      'Recibo/prestação de contas: os valores agora batem exatamente com o relatório de comissão de consignados. O repasse é calculado sobre o valor recebido (após desconto), com as colunas de Desconto, Recebido e Fatia do lucro.',
      'Relatório: o card "Peças" virou "Peças vendidas" e o card de "Ticket médio" foi removido.',
      'Estoque: os campos de entrada, saída e ajuste não vêm mais com número pré-preenchido — acabou o erro de digitar 20 e virar 120.',
      'Lista de produtos: a marcação de % do consignado passou de amarelo para cinza escuro, mais legível.'
    ]
  },
  {
    versao: '3.25.19', data: '2026-08-20',
    titulo: 'Botão do meio removido e janela travada em tela cheia',
    itens: [
      'O botão maximizar/restaurar (◻) foi removido da barra de título. Só ficam _ e X.',
      'O tamanho da janela agora fica travado na área de trabalho do monitor, seja qual for a resolução.',
      'Corrigido: minimizar e voltar pela barra de tarefas não faz mais a tela piscar nem sumir.'
    ]
  },
  {
    versao: '3.25.18', data: '2026-08-20',
    titulo: 'Botão do meio removido da barra de título',
    itens: [
      'O botão maximizar/restaurar (◻) foi removido. Só sobraram _ (minimizar) e X (fechar).',
      'Sem risco de a funcionária clicar sem querer e bagunçar a tela do caixa.',
      'O programa continua abrindo sempre em tela cheia.'
    ]
  },
  {
    versao: '3.25.17', data: '2026-08-20',
    titulo: 'Correção da causa raiz: programa abre em tela cheia',
    itens: [
      'Resolvido o problema que fazia o programa abrir minimizado na barra de tarefas desde a 3.25.13.',
      'O Windows guardava o estado quebrado da janela em um arquivo que nem reinstalar apagava — agora o instalador limpa esse arquivo.',
      'Não aparecem mais janelas pretas de terminal durante a instalação e ao abrir o programa.'
    ]
  },
  {
    versao: '3.25.16', data: '2026-08-20',
    titulo: 'Botão ◻ removido da barra de título',
    itens: [
      'O botão maximizar/restaurar (◻) foi removido via Windows API — sem afetar o funcionamento da janela.',
      'Programa abre sempre em tela cheia. Só _ e X permanecem na barra de título.'
    ]
  },
  {
    versao: '3.25.15', data: '2026-08-19',
    titulo: 'Estabilização: programa abre normalmente',
    itens: [
      'Correção definitiva: programa volta a abrir em tela cheia sem travar na barra de tarefas.',
      'Removido código experimental que causava falha na inicialização nas versões 3.25.13 e 3.25.14.'
    ]
  },
  {
    versao: '3.25.14', data: '2026-08-19',
    titulo: 'Botão do meio inativo — janela sempre cheia',
    itens: [
      'O botão ◻ do meio agora não faz nada: o programa sempre fica em tela cheia.',
      'Correção de bug: na v3.25.13 o programa iniciava travado na barra de tarefas — resolvido.'
    ]
  },
  {
    versao: '3.25.13', data: '2026-08-19',
    titulo: 'Botão do meio removido — só _ e X',
    itens: [
      'O botão maximizar/restaurar (◻) foi removido da barra de título. O programa já abre em tela cheia e não precisa dele.',
      'Só _ (minimizar) e X (fechar) permanecem — menos confusão, sem risco de o programa desaparecer da tela.'
    ]
  },
  {
    versao: '3.25.12', data: '2026-08-19',
    titulo: 'Correção: botões da janela funcionando corretamente',
    itens: [
      'Fix: X fecha, _ minimiza, ◻ restaura/maximiza — todos funcionando como no Windows padrão.',
      'Instalador detecta a versão instalada e pergunta antes de atualizar.'
    ]
  },
  {
    versao: '3.25.8', data: '2026-08-19',
    titulo: 'Comportamento padrão do Windows: X fecha, _ minimiza',
    itens: [
      'O botão X agora fecha o aplicativo completamente, como qualquer programa Windows. Para minimizar à barra de tarefas, use o botão _ (como sempre funcionou). Reabra pelo atalho da área de trabalho ou menu iniciar.'
    ]
  },
  {
    versao: '3.25.4', data: '2026-08-19',
    titulo: 'Correção: janela voltava ao foco ao iniciar e ao fechar',
    itens: [
      'Fix: ao iniciar, o aplicativo agora se coloca automaticamente à frente de qualquer outra janela aberta — sem precisar clicar na barra de tarefas para trazê-lo ao foco.'
    ]
  },
  {
    versao: '3.25.2', data: '2026-08-19',
    titulo: 'Correção: janela voltava para segundo plano ao ser restaurada',
    itens: [
      'Fix: ao clicar no X, o sistema agora minimiza em vez de fechar a janela — o ícone na barra de tarefas volta a funcionar corretamente, sem travar em segundo plano.',
      'Configurações → 📊 Relatórios: nova opção para ocultar a linha de detalhe nos cards de resumo (quantidade de peças e valor de tabela). Quando desligado, os cards mostram só o valor principal.'
    ]
  },
  {
    versao: '3.24.0', data: '2026-08-19',
    titulo: 'Correções na comissão de consignados',
    itens: [
      'Recibo "Este evento": corrigido o filtro de período — o recibo agora mostra apenas as vendas dentro da janela de data e hora definida no relatório, sem incluir registros de outros dias.',
      'Fatia do lucro: eliminado erro de arredondamento acumulado por item que podia deslocar o valor exibido em alguns centavos a mais.'
    ]
  },
  {
    versao: '3.23.0', data: '2026-08-19',
    titulo: 'Menu suspenso de navegação no relatório de evento',
    itens: [
      'O relatório de evento ganhou um menu suspenso fixo no topo da tela. Escolha a seção que quer ver — Fechamento, Vendas, Pagamentos, Consignados etc. — e o relatório rola direto até lá.',
      'Antes era necessário descer a página inteira para chegar à seção desejada. Agora basta um clique no menu.',
      'O menu não aparece na impressão — o PDF continua com todas as seções na ordem normal.'
    ]
  },
  {
    versao: '3.22.0', data: '2026-08-19',
    titulo: 'Recibo de consignado: escolha as vendas da lista',
    itens: [
      'No recibo "Por venda", o sistema agora exibe todas as vendas do fornecedor para você escolher — sem precisar procurar o número.',
      'Selecione uma ou mais vendas com checkboxes; o recibo inclui tudo que foi marcado.',
      'Botão "Selecionar todas" para marcar o conjunto completo de uma vez.'
    ]
  },
  {
    versao: '3.21.2', data: '2026-08-19',
    titulo: 'Documentação e manutenção',
    itens: [
      'Atualização interna de documentação para as versões 3.21.0 e 3.21.1 (sem mudança de funcionalidade).'
    ]
  },
  {
    versao: '3.21.1', data: '2026-08-18',
    titulo: 'Correção dos cálculos de consignados',
    itens: [
      'O card "Vendas de consignados" agora mostra o total correto (soma do valor recebido por fornecedor), igual ao somatório da tabela de comissões.',
      'A "Fatia do lucro" e o "Repasse" passaram a ser calculados sobre o valor recebido (o que entrou de fato), e não sobre o valor de tabela.',
      'A linha "Líquido a receber" no fechamento do evento também foi ajustada para refletir o repasse correto.',
      'Em eventos com vendas antigas (antes da v3.14.0), o repasse agora é recalculado na hora do relatório para usar a mesma regra das vendas novas.'
    ]
  },
  {
    versao: '3.21.0', data: '2026-08-18',
    titulo: 'Recibo de consignado por venda, evento ou mês',
    itens: [
      'O botão de imprimir recibo do consignado agora abre um painel com três opções: "Este evento" (período atual do relatório), "Por mês" (escolha o mês e o ano) e "Por venda" (informe o número de uma venda específica).',
      'Antes só era possível gerar o recibo pelo período do evento aberto na tela.',
      'O card de vendas de consignados agora avisa quando há produtos marcados como consignados mas sem fornecedor ou percentual definidos — o que explicava pequenas diferenças entre o card e a tabela de comissões.',
      'Os produtos sem repasse são listados no relatório com o motivo, para facilitar o acerto no cadastro.'
    ]
  },
  {
    versao: '3.20.0', data: '2026-08-14',
    titulo: 'Taxa do cartão somada na venda a preço de custo',
    itens: [
      'Na venda a preço de custo, quando o cliente paga no cartão a taxa da maquininha passa a ser somada ao valor da compra. Antes a loja vendia sem margem E ainda pagava a taxa, saindo no prejuízo.',
      'Em dinheiro, PIX na chave, crediário e vale não há acréscimo nenhum.',
      'A conta garante que a loja receba o custo inteiro: com R$ 100 de custo no crédito à vista, cobra R$ 103,15 e recebe os R$ 100,00 certinhos.',
      'No crédito parcelado a taxa é cobrada uma vez sobre o total, não por parcela.',
      'A tela de pagamento mostra o custo, a taxa somada e o valor final antes de confirmar. As taxas continuam ajustáveis em Configurações → PDV.'
    ]
  },
  {
    versao: '3.19.3', data: '2026-08-14',
    titulo: 'Correção: tela de erro ao ligar a venda a preço de custo',
    itens: [
      'Ao ligar a venda a preço de custo, o sistema abria a tela vermelha de erro e travava. O aviso que aparece no rodapé do PDV procurava a linha do TOTAL pelo nome errado.',
      'Corrigido. Se por algum motivo o rodapé não estiver na tela, o aviso simplesmente não aparece — o PDV continua funcionando.'
    ]
  },
  {
    versao: '3.19.2', data: '2026-08-14',
    titulo: 'Correção: dizia que a peça não tinha preço de custo',
    itens: [
      'Ao ligar a venda a preço de custo, o sistema acusava que as peças não tinham custo cadastrado — mesmo tendo. O preço de custo não estava sendo levado da busca para o carrinho.',
      'A mensagem também saía pela metade, sem dizer o nome da peça. Agora mostra o nome e orienta onde cadastrar.'
    ]
  },
  {
    versao: '3.19.1', data: '2026-08-14',
    titulo: 'Atalho da venda a preço de custo no pagamento',
    itens: [
      'O botão de vender a preço de custo agora aparece também dentro da tela de pagamento, além da barra de cima do PDV.',
      'Quando a venda já está a preço de custo, a tela de pagamento avisa em destaque, para ninguém fechar sem perceber.'
    ]
  },
  {
    versao: '3.19.0', data: '2026-08-14',
    titulo: 'Venda a preço de custo',
    itens: [
      'Novo botão 🏷️ Preço de custo no PDV (ou tecla F8): a venda inteira passa a sair pelo preço de custo das peças, para funcionária, permuta ou queima de estoque.',
      'O preço vem do que está cadastrado em cada produto. Peça sem custo cadastrado não entra — o sistema avisa quais são.',
      'Nesta venda não há desconto de espécie nenhuma, nem o automático do dinheiro: o custo já é o piso.',
      'Só sai com senha de administrador e com o motivo escrito, igual ao desconto na mão.',
      'No relatório de evento tem seção própria, mostrando quem autorizou, o motivo e quanto a loja abriu mão em cada venda. Também vira uma aba no Excel.'
    ]
  },
  {
    versao: '3.18.2', data: '2026-08-14',
    titulo: 'Índice do catálogo sempre em uma folha',
    itens: [
      'Com muitas categorias o índice do catálogo passava para uma segunda e terceira folha. Agora ele sempre cabe em uma só: até 18 categorias sai em coluna única com letra grande, e acima disso passa para duas colunas, apertando o suficiente para caber mesmo com 50 categorias.'
    ]
  },
  {
    versao: '3.18.1', data: '2026-08-14',
    titulo: 'Ajuste: QR code com respiro nas bordas',
    itens: [
      'No catálogo, o QR code de cada peça estava colado na borda do cartão. Agora sobra a mesma folga na lateral e embaixo, e o cartão ficou um pouco mais alto para acomodar.'
    ]
  },
  {
    versao: '3.18.0', data: '2026-08-14',
    titulo: 'Catálogo com diagramação de gráfica',
    itens: [
      'O catálogo não desperdiça mais folha: as peças correm de página em página em fluxo contínuo, sempre 4 por página. Antes, uma categoria com uma peça só ocupava uma página inteira.',
      'As peças continuam agrupadas por categoria, na ordem — o nome da categoria aparece no alto da página e numa etiqueta em cada peça.',
      'O índice agora informa em que página cada categoria começa.',
      'Os cartões ficaram 20% menores e ganharam margem em volta, deixando a página mais leve e equilibrada. A foto continua quadrada, com espaço respirando nas bordas.'
    ]
  },
  {
    versao: '3.17.2', data: '2026-08-14',
    titulo: 'Correção: catálogo com layout premium e recibo de consignado',
    itens: [
      'O catálogo de produtos foi completamente redesenhado: fotos agora são quadradas (mesma largura e altura), cartões com tipografia profissional, separadores de categoria com faixa lateral colorida, índice elegante e capa/contra-capa no padrão da loja.',
      'Corrigido erro "no such column: vi.produto_id" que impedia gerar o recibo de consignado ao clicar em 🖨️ no relatório de evento — o recibo volta a funcionar normalmente.'
    ]
  },
  {
    versao: '3.17.0', data: '2026-08-14',
    titulo: 'Catálogo de produtos em PDF',
    itens: [
      'Menu novo 📔 Catálogo: gera um PDF profissional estilo revista com todos os produtos da loja.',
      'Escolha o título, coleção/temporada, quais categorias incluir e se mostra preço, referência e QR code.',
      'Capa com a cor e o logo da loja, índice por categoria, grade de 4 produtos por página (foto, cores, tamanhos, preço) e contra-capa com os dados de contato.',
      'Cada produto agrupa todas as suas variações em um único card — sem repetir a mesma peça para cada cor.'
    ]
  },
  {
    versao: '3.16.0', data: '2026-08-14',
    titulo: 'Recibo de prestação de contas para consignados',
    itens: [
      'No Relatório de Evento, a seção de consignados ganhou um botão 🖨️ ao lado de cada fornecedor.',
      'Ao clicar, o sistema gera um PDF profissional em A4 com todos os itens vendidos, valores, percentuais de repasse, total a repassar e campo de assinatura — pronto para imprimir ou enviar.',
      'O recibo mostra: produto, variação (cor/tamanho), quantidade, valor de tabela, custo, percentual e valor do repasse, com totais gerais e situação de pagamento (pendente ou acertado).'
    ]
  },
  {
    versao: '3.15.2', data: '2026-08-14',
    titulo: 'Correção: datas em formato brasileiro em todas as telas',
    itens: [
      'Em várias telas as datas apareciam no formato americano (2026-08-14) em vez de brasileiro (14/08/2026). Corrigido em Clientes, Compras, Estoque, Vendas e Vales-Troca.',
      'O modelo de importação de clientes e a planilha de funcionários do Barracão passaram a usar DD/MM/AAAA nas datas de nascimento.',
      'A importação de clientes agora aceita as duas formas — DD/MM/AAAA e AAAA-MM-DD — e converte automaticamente para o formato interno.'
    ]
  },
  {
    versao: '3.15.1', data: '2026-08-13',
    titulo: 'Correção: o modelo Excel de clientes não abria',
    itens: [
      'O botão "Modelo Excel", na tela de importação de clientes, gerava na verdade um arquivo de texto e só trocava o nome para .xlsx. O Excel recusava — o modelo não abria em computador nenhum.',
      'Agora sai um arquivo Excel de verdade, com a aba Clientes, as colunas na largura certa e três linhas de exemplo.',
      'O modelo CSV continua funcionando como antes, para quem prefere.',
      'As outras exportações do sistema (clientes, estoque, relatórios, ranking) nunca tiveram esse problema.'
    ]
  },
  {
    versao: '3.15.0', data: '2026-08-13',
    titulo: 'Função no cadastro do cliente',
    itens: [
      'O cadastro de cliente ganhou o campo FUNÇÃO / CARGO — almoxarifado, porteiro, financeiro, serviços gerais. Serve para funcionários, sócios e parceiros.',
      'O campo sugere as funções já usadas enquanto você digita, para não virar "PORTEIRO", "Porteiro " e "porteiro" como se fossem três coisas.',
      'A função aparece como coluna na lista de clientes, entra na importação (colunas aceitas: funcao, função ou cargo) e sai na exportação.',
      'Lembrando: o SEGMENTO da pessoa continua sendo a CATEGORIA — cada cliente pertence a uma. A função é a ocupação dela dentro daquele segmento.',
      'CORREÇÃO: a importação gravava o CPF do jeito que viesse na planilha, com pontos e traço, enquanto o cadastro à mão grava só os números. O mesmo CPF virava duas pessoas diferentes. Agora os dois gravam igual.'
    ]
  },
  {
    versao: '3.14.0', data: '2026-08-13',
    titulo: 'O desconto agora aparece peça por peça',
    itens: [
      'ANTES: quando o desconto era dado no total da venda, ele não aparecia em item nenhum — todas as linhas mostravam "—" e a soma delas não batia com o que a cliente pagou. E quando o desconto era lançado numa peça só, parecia que aquela peça tinha levado tudo.',
      'AGORA cada linha mostra QUANTO FOI DESCONTADO DAQUELA PEÇA e QUANTO A CLIENTE PAGOU por ela. O desconto do fechamento é dividido entre as peças, proporcional ao valor de cada uma.',
      'Quando o abatimento veio dos dois lados, aparece a origem embaixo do valor: "R$ 5,00 no item + R$ 3,00 da venda".',
      'Cada venda termina com uma linha de total: valor de tabela, desconto e quanto foi pago. A soma das peças fecha com o valor cobrado.',
      'A lista de produtos vendidos ganhou as colunas Valor de tabela, Desconto e Recebido — e a coluna Recebido soma exatamente o faturamento bruto.',
      'No fechamento, quando não houve devolução, o sistema agora explica por que o faturamento líquido é igual ao bruto, em vez de mostrar dois valores iguais sem dizer nada.',
      'O Excel acompanhou: a aba de itens separa desconto no item, desconto da venda e total, e mostra quanto foi pago por peça.',
      'CONSIGNADOS — o desconto passou a ser dividido. Antes, numa venda com desconto, a loja recebia menos pela peça mas repassava ao fornecedor como se tivesse vendido pelo preço cheio: o abatimento saía todo do lado da loja.',
      'Agora a conta é: valor da venda JÁ COM O DESCONTO, menos o custo da peça, e o que sobra é dividido no percentual combinado. Cada lado absorve a sua parte.',
      'O relatório de consignados ganhou as colunas Valor de tabela, Desconto e Recebido, para você conferir peça a peça.',
      'A CORTESIA não mudou: quem dá o brinde é a loja, então o fornecedor continua recebendo o acerto cheio.',
      'Vendas feitas antes desta versão ficam como foram gravadas — era o combinado na época. O relatório avisa quando isso aparece no período.'
    ]
  },
  {
    versao: '3.13.0', data: '2026-08-13',
    titulo: 'O balão do chat saiu da frente dos relatórios',
    itens: [
      'O BALÃO AGORA PODE SER ARRASTADO. Segure o botão do mouse em cima dele e leve para onde quiser — canto de cima, lado esquerdo, onde não atrapalhar. Ele fica onde você largou, mesmo depois de fechar o sistema.',
      'Dois cliques no balão devolvem ele ao canto de baixo à direita.',
      'A posição é de cada computador: o do caixa pode ficar num canto e o da sala noutro.',
      'CORREÇÃO IMPORTANTE: o balão estava sendo IMPRESSO junto com os relatórios. Ele aparecia no papel e no PDF que vai para o cliente. Agora some na impressão, junto com a etiqueta amarela e o aviso de mensagem.',
      'Na tela, o fim das páginas ganhou uma folga para a última linha do relatório não ficar escondida atrás do balão.',
      'A etiqueta de mensagem não lida e o aviso rápido acompanham o balão para onde ele for.'
    ]
  },
  {
    versao: '3.12.0', data: '2026-08-13',
    titulo: 'As taxas da maquininha agora são suas para editar',
    itens: [
      'Até aqui os percentuais que a operadora cobra estavam fixos dentro do sistema. Se a Mercado Pago reajustasse, ou se você trocasse de maquininha, era preciso uma versão nova do aplicativo.',
      'Agora ficam em Configurações → PDV, no fim da página: Pix na chave, Pix na maquininha, Débito, Crédito à vista e Crédito parcelado.',
      'Os valores já vêm preenchidos com as taxas de hoje da Mercado Pago Smart 2 — quem não mexer não sente diferença nenhuma.',
      'Tem um botão "Restaurar padrão" para voltar aos valores originais se você se perder.',
      'Campo em branco NÃO zera a taxa: o sistema volta ao valor padrão. Zerar a taxa por engano faria o líquido a receber parecer maior do que é.',
      'A mudança vale para todo relatório gerado a partir dali, inclusive de eventos passados — o sistema recalcula na hora, ele não guarda a taxa junto da venda.'
    ]
  },
  {
    versao: '3.11.1', data: '2026-08-13',
    titulo: 'Correção: os destaques de Salgueiro e consignados agora somam o faturamento',
    itens: [
      'Na versão anterior os dois cartões novos somavam o PREÇO DE TABELA das peças. Resultado: "Vendas do Salgueiro" aparecia MAIOR que o faturamento bruto — dois números conflitantes no mesmo topo.',
      'Agora os dois mostram o que a loja REALMENTE recebeu, com o desconto do fechamento dividido entre as peças e a cortesia valendo zero.',
      'Somando os dois cartões você chega no mesmo faturamento bruto do cartão ao lado.',
      'O preço de tabela não sumiu: aparece embaixo de cada cartão, para conferir com a lista de produtos no fim do relatório.'
    ]
  },
  {
    versao: '3.11.0', data: '2026-08-13',
    titulo: 'Quanto vendeu de peça sua e quanto vendeu de consignado',
    itens: [
      'DOIS DESTAQUES NOVOS no topo dos relatórios: VENDAS DO SALGUEIRO (as suas peças) e VENDAS DE CONSIGNADOS (as peças de fornecedor).',
      'Aparecem tanto na aba Vendas quanto no relatório de Evento, com o valor e a quantidade de peças de cada lado.',
      'Os dois somados dão o faturamento bruto do período (ajustado na 3.11.1).',
      'Na lista de produtos vendidos, cada peça de fornecedor agora mostra DE QUEM ELA É e o PERCENTUAL COMBINADO, embaixo do nome. Facilita conferir o acerto sem abrir outra tela.',
      'O Excel acompanhou: a aba de produtos ganhou as colunas Origem, Fornecedor e % do fornecedor, e o resumo traz os dois totais.'
    ]
  },
  {
    versao: '3.10.0', data: '2026-08-13',
    titulo: 'Desconto manual só com senha de administrador e acompanhamento de compras',
    itens: [
      'DESCONTO NA MÃO AGORA SÓ SAI COM SENHA DE ADMINISTRADOR. Quem está no caixa digita o desconto normalmente, mas para fechar a venda um administrador precisa autorizar.',
      'Se quem está operando JÁ É administrador, basta confirmar com a própria senha. Se não for, chama quem pode liberar, que digita o login e a senha dele ali mesmo.',
      'O nome de quem autorizou é gravado a partir do cadastro — ninguém assina no lugar de outra pessoa.',
      'O QUE NÃO MUDOU: desconto de categoria do cliente e desconto automático à vista continuam sendo aplicados sozinhos, sem pedir nada a ninguém.',
      'ACOMPANHAMENTO DE COMPRAS — novidade para quem dá desconto a funcionário. Em Configurações → Categorias de clientes, cada categoria agora tem a opção 👁️ Acompanhar as compras desta categoria.',
      'Marque nas categorias que você quer vigiar (Funcionários, sócios) e as compras dessas pessoas passam a aparecer em Relatórios → 👁️ Compras acompanhadas.',
      'O relatório mostra, por pessoa: quantas compras, quantas peças, o desconto que recebeu e quanto pagou. Clicando no nome, abre o que ela levou — tipo de peça, quantidade e valor.',
      'Tem também o campo "a partir de N peças" para ver só quem comprou em quantidade, e a lista das peças mais levadas no período. É assim que se percebe quem está comprando para revender.',
      'Quem compra bem acima da média do grupo fica com o nome destacado — não é acusação, é só onde vale a pena olhar.',
      'Tudo exportável para Excel, com uma aba por pessoa e outra com as peças no total.'
    ]
  },
  {
    versao: '3.9.0', data: '2026-08-13',
    titulo: 'O relatório de evento agora fecha: o total das peças chega no mesmo faturamento do topo',
    itens: [
      'ANTES: o topo do relatório mostrava um valor (o faturamento) e a lista de produtos no final mostrava outro, maior. Os dois estavam certos, mas ninguém tinha como saber disso — parecia erro de conta.',
      'AGORA a lista de produtos termina com o fechamento: valor de tabela das peças, menos as cortesias, menos os descontos, IGUAL ao faturamento bruto do topo. O mesmo número, no centavo.',
      'Dois cartões novos no topo: TOTAL EM DESCONTOS e TOTAL EM CORTESIAS. São exatamente os dois valores que separam um total do outro, agora à vista desde o começo.',
      'A seção de descontos passou a listar TODOS os descontos dados no fechamento da venda, não só os que alguém autorizou na mão. Desconto de categoria de cliente e desconto automático à vista também aparecem, marcados como "Automático / tabela".',
      'Cada desconto mostra a venda, o cliente, quem lançou, quem autorizou, o motivo, o valor de tabela, quanto foi abatido e o percentual.',
      'O Excel ganhou uma aba de Descontos e a conciliação completa na aba Resumo.',
      'Se algum dia a conta não fechar, o relatório avisa em vermelho quanto sobrou sem explicação — em vez de mostrar dois números diferentes calado.'
    ]
  },
  {
    versao: '3.8.0', data: '2026-08-13',
    titulo: 'Estoque só na mão do dono, filtro de consignados e conta do consignado explicada',
    itens: [
      'MEXER NO ESTOQUE AGORA É SÓ DO ADMINISTRADOR. Entrada de mercadoria, saída manual, ajuste de inventário, transferência entre estoques e criação de local passaram a exigir login de administrador.',
      'Quem não é administrador continua CONSULTANDO o estoque normalmente: bipa o código, vê o saldo, imprime o balanço. Só não altera a quantidade.',
      'Isso NÃO afeta a venda: o PDV continua baixando o estoque a cada venda, e devolução, troca e recebimento de compra continuam funcionando como sempre.',
      'A tela "Quem está online agora" também virou exclusiva do administrador.',
      'PRODUTOS: filtro novo ao lado do de categorias. Escolha "🤝 Somente consignados" e a lista mostra só as peças de fornecedor — para editar uma a uma sem procurar no meio das suas. "🏪 Somente da loja" faz o contrário.',
      'Na lista, a peça consignada agora mostra de quem ela é e qual a fatia combinada, embaixo do nome.',
      'RELATÓRIO DE EVENTO — a conta do consignado ficou clara. Antes aparecia "(65% = R$ 63,55)", e ninguém conseguia fechar essa conta: 65% de R$ 80 dá R$ 52.',
      'O motivo é que o fornecedor recebe o CUSTO da peça de volta MAIS a fatia combinada do LUCRO — não uma porcentagem do preço de venda. Agora o relatório mostra a conta inteira: custo + fatia do lucro = repasse.',
      'A lista "Produtos vendidos no evento" ganhou uma explicação no rodapé quando o total dela não bate com o faturamento. A diferença é sempre cortesia (a peça saiu mas a venda vale zero) e desconto dado no fechamento — nunca erro de soma.'
    ]
  },
  {
    versao: '3.7.0', data: '2026-08-10',
    titulo: 'Aviso de mensagem nova e sistema no celular',
    itens: [
      'Chegou mensagem? Agora aparece uma ETIQUETA AMARELA ao lado do balão, com quantas mensagens não lidas você tem. Ela fica na tela até você ler — não depende de som, porque nem toda máquina da loja tem caixa de som.',
      'Além dela, um aviso rápido mostra quem mandou e o começo do texto. Clique nele para abrir a conversa direto. Ele some sozinho depois de alguns segundos.',
      'O SISTEMA AGORA ABRE NO CELULAR E NO TABLET pela rede da loja. Basta abrir o navegador do aparelho no endereço do terminal.',
      'No celular, o menu vira uma gaveta: toque no ☰ no canto para abrir e escolher a tela.',
      'Botões e campos ficaram maiores no toque, o PDV empilha carrinho e totais um embaixo do outro, e as tabelas largas rolam de lado em vez de espremer tudo.',
      'O botão de finalizar a venda fica fixo na base da tela, sempre à mão.'
    ]
  },
  {
    versao: '3.6.0', data: '2026-08-06',
    titulo: 'Vale-troca impresso e chat avisando de verdade',
    itens: [
      'O VALE-TROCA AGORA SAI IMPRESSO na impressora de cupom, com o código, o valor e a validade. Acabou o "anote o código ou tire uma foto" — a cliente sai da loja com o papel na mão.',
      'A impressão é automática assim que o vale é gerado, na troca e na devolução. Se precisar imprimir de novo, o botão está no mesmo aviso.',
      'Na tela 🎫 Vales-Troca, cada vale em aberto ganhou o botão 🖨️ 2ª via — para quando a cliente perde o papel. A segunda via sai com o SALDO atual, não com o valor original.',
      'CORREÇÃO DO CHAT: mensagem no canal geral não avisava ninguém. O contador do balão ficava zerado e o recado passava despercebido — parecia que a mensagem não tinha chegado.',
      'Agora toda a equipe é notificada quando alguém escreve no canal geral. Quem é cadastrado depois não recebe o histórico antigo como uma pilha de não lidas.'
    ]
  },
  {
    versao: '3.5.2', data: '2026-08-06',
    titulo: 'Correção: o estoque inicial do produto novo não era gravado',
    itens: [
      'CORREÇÃO IMPORTANTE. Ao cadastrar um produto novo digitando só a quantidade — sem preencher cor e tamanho — o estoque era perdido: você salvava e o produto nascia zerado, obrigando a dar entrada depois pelo módulo Estoque.',
      'Agora a quantidade é gravada normalmente. A peça vira uma variação "Única / U" com o estoque que você digitou, já distribuída no Almoxarifado Central e com o movimento de entrada registrado.',
      'Quem preenche cor e tamanho não é afetado — esse caminho sempre funcionou.',
      'Se você cadastrou peças nos últimos dias e elas ficaram zeradas, confira em Relatórios → 📦 Estoque com o filtro "Cadastrados de/até".'
    ]
  },
  {
    versao: '3.5.1', data: '2026-08-06',
    titulo: 'Transferência: todas as variações sempre à vista',
    itens: [
      'Correção: quando nenhuma peça do produto estava na origem escolhida, a grade inteira sumia e aparecia só um aviso. Agora as variações aparecem sempre — você vê que elas existem, mesmo quando as peças estão em outro lugar.',
      'Coluna nova "Total na loja": ao lado do que há na origem, mostra o total daquela cor e tamanho somando todos os locais. Se a peça está zerada na origem mas tem 5 no total, você descobre na hora que ela está em outro estoque.',
      'O cabeçalho do produto agora diz quantas variações ele tem e quantas têm peça na origem escolhida — dá para conferir de bate-pronto se está faltando alguma.'
    ]
  },
  {
    versao: '3.5.0', data: '2026-08-06',
    titulo: 'Transferir estoque escolhendo o produto',
    itens: [
      'A transferência mudou: agora você escolhe o PRODUTO e todas as cores e tamanhos dele aparecem de uma vez, com a quantidade que há na origem. Digite quanto quer mandar de cada um e transfira.',
      'Antes era preciso buscar peça por peça. Um produto com 6 cores e 5 tamanhos exigia 30 buscas separadas.',
      'Botão "Levar tudo" preenche cada linha com o que há na origem. "Limpar" zera tudo de uma vez.',
      'Só entram no romaneio as linhas onde você digitou quantidade — o resto é ignorado.',
      'Se digitar mais do que existe na origem, o sistema avisa e volta para o máximo disponível.',
      'Pode juntar vários produtos no mesmo romaneio: basta buscar o próximo.',
      'Bipando o código de barras, o sistema abre a grade inteira daquele produto.',
      'Um resumo no rodapé mostra quantas peças de quantos produtos vão no romaneio.'
    ]
  },
  {
    versao: '3.4.1', data: '2026-08-06',
    titulo: 'Relatório de estoque para conferir na mão',
    itens: [
      'Nova aba 📦 Estoque em Relatórios. O estoque sai organizado: o produto, embaixo dele cada cor e tamanho, o total do produto, e no fim o total geral. A tela de Estoque continua sendo a lista corrida — este é o relatório somado.',
      'Uma coluna para cada lugar (Almoxarifado, Loja), então você vê onde está cada peça sem abrir outra tela.',
      'Marque “Coluna Contado” e imprima: sai com espaço em branco para escrever a contagem e a diferença peça por peça. É o papel para bater o estoque com o físico.',
      'Para conferir uma remessa que chegou, preencha “Cadastrados de/até” — e se preferir, escolha agrupar por Data de cadastro: cada dia vira um bloco, com o total daquele dia. Assim dá para conferir depois, mesmo sem ter conferido no dia.',
      'Também dá para agrupar por categoria, filtrar por fornecedor, e mostrar só o que tem estoque ou só o que está zerado.',
      'Peça abaixo do estoque mínimo aparece destacada. Se alguma peça estiver no total mas sem lugar definido, o relatório avisa em vez de esconder.',
      'Exporta em Excel e imprime (ou salva em PDF) com as mesmas colunas que você escolheu na tela.',
      'BATER O COMEÇO DOS TRABALHOS COM HOJE: marque "Mostrar movimentação". Aparecem as colunas Entrou, Vendeu, Devolvido e Deveria ter, ao lado do que está em estoque agora. Se os números não fecharem, o relatório mostra a diferença em vermelho.',
      'Um quadro de Fechamento no alto resume tudo: entrou, menos o vendido, mais devoluções, o que deveria ter e o que tem hoje. É a conta fechada numa olhada.',
      'Quando você agrupa por data ou categoria, cada grupo ganha o total dele no fim — não só o total geral.',
      'Marque "Última venda" para ver quando cada peça saiu pela última vez, e desmarque "Mostrar cada variação" quando quiser só os totais por produto.'
    ]
  },
  {
    versao: '3.3.0', data: '2026-08-05',
    titulo: 'Desconto sem chamar o administrador, e duplicar produto',
    itens: [
      'O desconto na venda não pede mais a senha do administrador. Quem está no caixa resolve na hora: informa quem autorizou, o motivo, confirma com a própria senha e pronto.',
      'Isso fica gravado na venda. No Relatório de Evento existe agora a seção 🏷️ Descontos autorizados, com a venda, quem lançou, quem autorizou, o motivo e o valor. Antes o desconto era dado e não sobrava registro de nada.',
      'O ⧉ Duplicar chegou na lista de produtos. Abre o cadastro já preenchido com os dados da peça escolhida — você troca o que precisa e salva. O estoque começa zerado e os códigos de barras são novos.',
      'Na grade de cor e tamanho também tem o ⧉ em cada linha: duplica aquela variação, já com a cor e a foto, para você só trocar o tamanho.',
      'A foto que você escolhe para uma variação agora é realmente salva. Antes ela aparecia na tela, você salvava e ela sumia.',
      'Editar o nome de uma categoria de cliente não apaga mais o desconto dela. Quem tinha "VIP 10%" e mudava o nome pela tela de Clientes perdia os 10% sem aviso.',
      'O Consumidor final virou cliente de verdade: aparece no cadastro e recebe as vendas de quem não se identifica. Ele não entra no ranking de melhores clientes nem nos aniversariantes, e não pode ser excluído.'
    ]
  },
  {
    versao: '3.2.1', data: '2026-08-04',
    titulo: 'O desconto da compra acompanha a troca',
    itens: [
      'Se a cliente comprou com desconto, o mesmo desconto vale na hora da troca. Ela não é cobrada de novo por um valor que já tinha sido abatido.',
      'Peça de R$ 100 comprada com 10% (pagou R$ 90): trocando por outra de R$ 100, não há nada a acertar — nem ela paga, nem a loja devolve.',
      'Trocando por uma peça de R$ 200, o mesmo desconto entra na peça nova inteira: ela sai por R$ 180, o crédito de R$ 90 é abatido e a cliente paga R$ 90.',
      'Trocando por uma de R$ 50, a peça sai por R$ 45 e sobram R$ 45 a favor da cliente.',
      'Em toda troca a loja fica com a mesma margem da venda original — não há perda.',
      'O painel de troca mostra o preço de tabela, o desconto herdado e o total já com desconto, antes de você confirmar.',
      'Antes: a peça devolvida entrava pelo valor pago (com desconto) e a peça nova pelo preço cheio. Trocar por uma peça de igual valor cobrava a diferença do desconto — estava errado.'
    ]
  },
  {
    versao: '3.2.0', data: '2026-08-04',
    titulo: 'Troca funcionando de verdade — e agora com botão no PDV',
    itens: [
      'A troca voltada a funcionar. Antes o sistema aceitava preencher tudo e travava na hora de confirmar; agora conclui normalmente.',
      'Novo botão 🔄 Troca na barra do PDV (ou tecla F6). Não precisa mais entrar em "Vendas do caixa" para achar a troca.',
      'Ao clicar em Troca, o sistema abre a busca da venda: começa mostrando as vendas de hoje e você pode procurar pelo número da venda ou pelo nome da cliente. Se a compra foi outro dia, é só mudar as datas.',
      'A peça que voltou entra no estoque e a peça que a cliente levou sai — tudo na mesma operação, incluindo o estoque do local da loja.',
      'Quando sobra dinheiro a favor da cliente, você escolhe o que fazer: 🎫 vale-troca, 💵 devolver em dinheiro (sai do caixa), 💳 estornar no cartão ou não devolver nada. Antes o sistema emitia vale sempre, sem perguntar.',
      'Se a troca for do mesmo valor, o sistema avisa que não há nada a acertar e é só confirmar.',
      'Todos os vendedores e o gerente podem fazer troca. Não depende mais da permissão de devolução.',
      'O vale-troca agora tem prazo de validade. O padrão é 90 dias e você muda em Configurações → PDV. Depois do vencimento o sistema recusa o código, e a tela de Vales-Troca mostra a data de vencimento de cada um.',
      'Campo de quantidade: agora dá para digitar o número direto pelo teclado, na venda, na devolução e na troca. Antes só funcionava pelas setinhas ou bipando de novo. Ao clicar no campo o valor já vem selecionado — é só digitar por cima e apertar Enter.'
    ]
  },
  {
    versao: '3.1.0', data: '2026-07-31',
    titulo: 'O chat interno está de volta — agora sem pesar no sistema',
    itens: [
      'O 💬 chat entre os terminais voltou, junto com os avisos da administração. Suas conversas antigas continuam lá: nada foi apagado.',
      'O balão de conversa volta ao canto inferior direito de qualquer tela, com o número de mensagens não lidas.',
      'Fale em particular com uma pessoa ou use o Canal geral, que todo mundo lê. A bolinha verde mostra quem está com o sistema aberto agora.',
      'O administrador pode disparar um 📢 aviso para todos os terminais: aparece na tela na hora e a pessoa precisa clicar em "Entendi".',
      'Na aba Avisos o administrador vê, nome por nome, quem já leu e quem ainda não leu.',
      'O QUE MUDOU POR DENTRO: o chat não grava mais no disco a cada poucos segundos. Era isso que sobrecarregava o sistema e ajudou a causar o problema da versão 3.0.0. Agora a presença fica só na memória.',
      'Todas as proteções da versão 3.0.1 continuam ativas: backup automático antes de atualizar, lista de backups com o conteúdo à vista e recuperação automática.'
    ]
  },
  {
    versao: '3.0.1', data: '2026-07-31',
    titulo: 'Proteção total dos seus dados nas atualizações',
    itens: [
      'ATUALIZAÇÃO CRÍTICA. Corrigimos a falha que apagou os dados durante a atualização. Instale assim que possível.',
      'O chat interno foi retirado nesta versão. Ele será devolvido depois, já corrigido — era ele que forçava o sistema a regravar o banco a cada poucos segundos.',
      'Agora o sistema faz um backup sozinho ANTES de baixar qualquer atualização. Se o backup não puder ser feito, a atualização é cancelada — nunca mais uma atualização começa sem ponto de retorno.',
      'Antes de reiniciar para aplicar a atualização, o sistema grava tudo o que estava em aberto. Nenhuma venda se perde no caminho.',
      'A tela de Backup mudou: agora lista todas as cópias com a data e, principalmente, o QUE tem dentro de cada uma (quantas vendas, produtos e clientes). Basta clicar em "Restaurar" na linha desejada — o sistema volta àquele ponto e reinicia sozinho.',
      'Se você escolher um backup vazio ou com menos informação que o sistema tem hoje, aparece um aviso em vermelho com os números lado a lado, antes de qualquer coisa ser apagada.',
      'Backups danificados são identificados na lista e não podem ser restaurados por engano.',
      'Se o sistema abrir e perceber que o banco de dados está incompleto, ele volta sozinho para a última cópia boa e avisa você na tela.',
      'A gravação dos dados foi refeita: em nenhum momento o arquivo do banco deixa de existir no disco, mesmo que falte energia no meio da gravação.',
      'Fotos dos produtos: agora basta CLICAR na foto (a do produto ou a de cada cor/tamanho) para escolher outra no computador. Antes a foto ficava presa — clicar só ampliava a imagem.',
      'Passe o mouse sobre a miniatura de uma cor/tamanho e aparece um ✕ vermelho para tirar a foto daquela variação.',
      'No PDV nada mudou: passar o mouse continua mostrando a foto ampliada e clicar continua abrindo a imagem em tela cheia.'
    ]
  },
  {
    versao: '2.8.0', data: '2026-07-30',
    titulo: 'Romaneios em PDF e painel do usuário separado',
    itens: [
      'Romaneios de transferência agora podem ser baixados em PDF para enviar pelo WhatsApp — botão 📄 Baixar PDF na tela do romaneio.',
      'Após criar uma transferência, um aviso clicável aparece na tela para abrir o romaneio diretamente.',
      'Botão 📊 Relatório PDF lista todas as transferências do estoque em um PDF para download.',
      'Correção: o painel de cada usuário agora mostra sempre os dados corretos, mesmo quando há terminais em rede abertos simultaneamente. O painel do admin continua completo; o de operador não exibe valores financeiros.'
    ]
  },
  {
    versao: '2.7.0', data: '2026-07-30',
    titulo: 'Fotos nas variações e zoom de imagens',
    itens: [
      'Cada tamanho/cor de um produto agora tem sua própria foto. Útil para diferenciar cores diferentes da mesma peça.',
      'Para adicionar: abra o produto, clique no ícone 📷 na coluna Foto da grade de variações.',
      'No PDV e na lista de produtos, ao passar o mouse sobre a miniatura aparece uma pré-visualização maior.',
      'Clique em qualquer foto para abrir em tela cheia.'
    ]
  },
  {
    versao: '2.6.2', data: '2026-07-28',
    titulo: 'Estoque de loja agora é opcional',
    itens: [
      'Ao criar ou editar uma loja, agora você escolhe qual estoque ela usa: estoque próprio, o almoxarifado central, ou o estoque de outra loja.',
      'Útil para "Loja WhatsApp": ela pode usar o mesmo estoque da loja física, sem duplicar nada.',
      'O campo aparece no formulário de loja, em Configurações → Lojas.',
      'Lojas já criadas continuam funcionando igual: cada uma mantém seu estoque atual.'
    ]
  },
  {
    versao: '2.6.1', data: '2026-07-28',
    titulo: 'Menu sem barra de rolagem',
    itens: [
      'O menu da esquerda ficou mais longo e apareceu uma barra de rolagem feia. Ela foi escondida.',
      'O menu continua rolando normalmente com a roda do mouse.',
      'Manual do usuário e guia rápido atualizados com tudo que entrou nas últimas versões.'
    ]
  },
  {
    versao: '2.6.0', data: '2026-07-27',
    titulo: 'Estoque por local (almoxarifado e loja)',
    itens: [
      'Novo item no menu: Estoques (locais). Agora dá para saber onde cada peça está.',
      'Nasce um Almoxarifado Central com todo o estoque atual. A loja começa vazia, para você fazer o balanço.',
      'Botão "Transferir peças": escolhe de onde sai e para onde vai, e o sistema gera o romaneio.',
      'O romaneio sai impresso ou em PDF, com campo de conferência e assinatura — dá para mandar por WhatsApp ou e-mail.',
      'Toda loja nova já nasce com o estoque dela. Também dá para criar estoque de quem pegou peças para vender e de venda pelo WhatsApp.',
      'Se a peça acabar na loja durante a venda, o sistema avisa para buscar no almoxarifado — mas não trava a venda.',
      'Balanço de cada local em tela, impressão e Excel, com coluna para conferir.'
    ]
  },
  {
    versao: '2.5.0', data: '2026-07-27',
    titulo: 'Novidades da versão aqui na tela',
    itens: [
      'Esta aba passou a mostrar, do lado direito, tudo o que mudou em cada versão.',
      'A versão que você está usando aparece marcada como "instalada".',
      'Clique em qualquer versão para abrir a lista de mudanças.'
    ]
  },
  {
    versao: '2.4.0', data: '2026-07-27',
    titulo: 'Ranking por evento',
    itens: [
      'No Ranking você agora escolhe o período em vez de ver sempre "hoje".',
      'Por evento: o sistema descobre sozinho os dias em que a loja abriu. Um sábado que vira domingo conta como um evento só.',
      'A lista mostra o horário, quantas vendas e quanto faturou em cada evento — você só escolhe.',
      'Campo "Comparar com": veja se um produto subiu ou caiu em relação ao evento anterior.',
      'Também dá para informar data e hora na mão, ou usar os botões de mês e ano.'
    ]
  },
  {
    versao: '2.3.0', data: '2026-07-27',
    titulo: 'Tela de Ranking',
    itens: [
      'Novo item no menu: Ranking, com os produtos mais vendidos.',
      'Na tela aparecem os 10 primeiros; a impressão e o Excel trazem a lista completa.',
      'Alterne entre peças vendidas e receita — as duas contas mostram coisas diferentes.',
      'Ranking de categorias, de cor e tamanho (com o estoque atual do lado, para reposição) e dos melhores clientes.',
      'Gráfico do movimento por hora, para saber o horário de pico.'
    ]
  },
  {
    versao: '2.2.0', data: '2026-07-27',
    titulo: 'Cortesia no PDV',
    itens: [
      'Nova forma de pagamento: Cortesia (brinde).',
      'Pede obrigatoriamente quem autorizou e para quem foi — sem isso a venda não fecha.',
      'A venda entra com valor zero: não conta como faturamento nem mexe no caixa.',
      'A peça sai do estoque normalmente.',
      'Produto consignado pode ser cortesia; o fornecedor continua recebendo a parte dele.',
      'O Relatório de Evento ganhou a seção Cortesias, mostrando quanto cada brinde custou para a loja.'
    ]
  },
  {
    versao: '2.1.1', data: '2026-07-27',
    titulo: 'Produtos vendidos no relatório',
    itens: [
      'O Relatório de Evento agora termina com a lista de produtos vendidos e a quantidade de cada um.',
      'Os itens de cada venda já aparecem abertos — não precisa mais clicar para ver o que foi vendido.'
    ]
  },
  {
    versao: '2.1.0', data: '2026-07-27',
    titulo: 'Relatório de Evento',
    itens: [
      'Nova aba em Relatórios para fechar o evento, com período por data E hora (a loja abre num dia e fecha no outro).',
      'Lista de vendas detalhada: clique numa venda para ver os produtos.',
      'Mostra a taxa da maquininha por forma de pagamento e a comissão dos consignados.',
      'Fechamento com o líquido a receber, já descontando devoluções, taxas e comissões.',
      'Você escolhe por marcação quais dados entram no relatório, no PDF e no Excel.'
    ]
  },
  {
    versao: '2.0.55', data: '2026-07-26',
    titulo: 'Ícone do aplicativo configurável',
    itens: [
      'Em Configurações → Aparência dá para trocar o ícone do sistema.',
      'O ícone é guardado numa pasta que a atualização nunca apaga — não some mais.'
    ]
  },
  {
    versao: '2.0.50', data: '2026-07-24',
    titulo: 'Trocas e painel mais fiel',
    itens: [
      'Sistema de Troca no PDV: o que voltou, o que sai no lugar e a diferença ou vale, tudo numa tela.',
      'O painel mostra as vendas do dia por inteiro e as devoluções numa linha separada.'
    ]
  },
  {
    versao: '2.0.36', data: '2026-07-23',
    titulo: 'Desconto à vista e categorias de cliente',
    itens: [
      'Desconto automático para dinheiro e PIX, configurável em Configurações → PDV.',
      'Categorias de cliente com desconto próprio, aplicado sozinho no PDV.',
      'Desconto geral no PDV passa a pedir senha de administrador.'
    ]
  }
];

// Renderiza o histórico. `versaoAtual` ganha destaque de "instalada".
export function htmlNovidades(versaoAtual, esc) {
  const seguro = esc || ((s) => String(s));
  const dataBr = (d) => String(d || '').split('-').reverse().join('/');
  const atualIdx = NOVIDADES.findIndex(n => n.versao === versaoAtual);
  return NOVIDADES.map((n, i) => {
    const instalada = n.versao === versaoAtual;
    const nova = atualIdx >= 0 && i < atualIdx; // versão mais nova que a instalada
    const aberto = i === 0 || instalada;
    return `<details class="nv-item" ${aberto ? 'open' : ''}>
      <summary>
        <span class="nv-ver">v${seguro(n.versao)}</span>
        <span class="nv-tit">${seguro(n.titulo)}</span>
        ${instalada ? '<span class="nv-tag nv-tag-ok">instalada</span>' : ''}
        ${nova ? '<span class="nv-tag nv-tag-nova">disponível</span>' : ''}
        <span class="nv-data">${dataBr(n.data)}</span>
      </summary>
      <ul>${n.itens.map(x => `<li>${seguro(x)}</li>`).join('')}</ul>
    </details>`;
  }).join('');
}

export const CSS_NOVIDADES = `
  .nv-caixa { max-height:560px; overflow-y:auto; padding:2px 4px 2px 0 }
  .nv-item { border:1px solid var(--borda); border-radius:8px; margin-bottom:8px; background:var(--fundo) }
  .nv-item > summary { cursor:pointer; padding:9px 12px; display:flex; align-items:center;
    gap:8px; flex-wrap:wrap; list-style:none }
  .nv-item > summary::-webkit-details-marker { display:none }
  .nv-item > summary::before { content:'▸'; opacity:.5; font-size:11px }
  .nv-item[open] > summary::before { content:'▾' }
  .nv-item[open] > summary { border-bottom:1px solid var(--borda) }
  .nv-ver { font-weight:700; font-size:12px; color:var(--primaria,#8B1E2D) }
  .nv-tit { font-size:13px; font-weight:600 }
  .nv-data { margin-left:auto; font-size:11px; opacity:.55 }
  .nv-tag { font-size:10px; padding:1px 7px; border-radius:20px; font-weight:700; text-transform:uppercase }
  .nv-tag-ok { background:#dcfce7; color:#15803d }
  .nv-tag-nova { background:#fef3c7; color:#b45309 }
  .nv-item ul { margin:0; padding:10px 12px 12px 30px }
  .nv-item li { font-size:12.5px; line-height:1.55; margin-bottom:5px; color:var(--texto-suave) }
  .nv-item li:last-child { margin-bottom:0 }`;
