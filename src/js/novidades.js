// Novidades de cada versão — mostrado em Configurações → Atualização.
// Escrito para quem usa a loja, não para programador: frases curtas, sem termo
// técnico. A cada release nova, acrescente um bloco NO TOPO da lista.
export const NOVIDADES = [
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
