// Catálogo de permissões, perfis-modelo e cálculo de permissões efetivas
// A permissão é a fonte de verdade. O perfil serve como modelo inicial.

const CATALOGO = [
  { grupo: 'Painel',        chave: 'dashboard.ver',       rotulo: 'Ver o painel' },
  { grupo: 'Painel',        chave: 'dashboard.financeiro',rotulo: 'Ver lucro, margem e custos no painel' },

  { grupo: 'PDV / Caixa',   chave: 'pdv.ver',             rotulo: 'Abrir o PDV' },
  { grupo: 'PDV / Caixa',   chave: 'pdv.vender',          rotulo: 'Registrar vendas' },
  { grupo: 'PDV / Caixa',   chave: 'pdv.desconto',        rotulo: 'Dar desconto na venda' },
  { grupo: 'PDV / Caixa',   chave: 'pdv.cancelar',        rotulo: 'Cancelar venda' },
  { grupo: 'PDV / Caixa',   chave: 'caixa.abrir_fechar',  rotulo: 'Abrir e fechar o caixa' },
  { grupo: 'PDV / Caixa',   chave: 'caixa.sangria',       rotulo: 'Sangria e suprimento' },
  { grupo: 'PDV / Caixa',   chave: 'pdv.devolucao',       rotulo: 'Fazer devolução de venda' },
  { grupo: 'PDV / Caixa',   chave: 'vales.ver',           rotulo: 'Ver e consultar vales-troca' },

  { grupo: 'Produtos',      chave: 'produtos.ver',        rotulo: 'Ver produtos' },
  { grupo: 'Produtos',      chave: 'produtos.editar',     rotulo: 'Cadastrar e editar produtos' },
  { grupo: 'Produtos',      chave: 'produtos.custo',      rotulo: 'Ver custo e margem do produto' },
  { grupo: 'Produtos',      chave: 'produtos.excluir',    rotulo: 'Excluir produtos' },

  { grupo: 'Estoque',       chave: 'estoque.ver',         rotulo: 'Ver estoque e kardex' },
  { grupo: 'Estoque',       chave: 'estoque.movimentar',  rotulo: 'Movimentar estoque' },

  { grupo: 'Compras',       chave: 'compras.ver',         rotulo: 'Ver compras e fornecedores' },
  { grupo: 'Compras',       chave: 'compras.gerenciar',   rotulo: 'Lançar e receber compras' },

  { grupo: 'Clientes',      chave: 'clientes.ver',        rotulo: 'Ver clientes' },
  { grupo: 'Clientes',      chave: 'clientes.gerenciar',  rotulo: 'Cadastrar e editar clientes' },
  { grupo: 'Clientes',      chave: 'crediario.receber',   rotulo: 'Receber crediário' },

  { grupo: 'Financeiro',    chave: 'financeiro.ver',      rotulo: 'Ver o financeiro' },
  { grupo: 'Financeiro',    chave: 'financeiro.gerenciar',rotulo: 'Lançar e baixar contas' },

  { grupo: 'Relatórios',    chave: 'relatorios.ver',      rotulo: 'Ver relatórios' },

  { grupo: 'Administração', chave: 'config.gerenciar',    rotulo: 'Configurações da loja' },
  { grupo: 'Administração', chave: 'usuarios.gerenciar',  rotulo: 'Gerenciar usuários e permissões' }
];

const TODAS = CATALOGO.map(p => p.chave);
const CHAVES = new Set(TODAS);

// Modelos por perfil (o admin sempre tem tudo, tratado à parte)
const DEFAULTS = {
  admin: [...TODAS],
  // Vendedor / caixa: vende, atende cliente — NÃO vê lucro, custo, financeiro nem relatórios
  caixa: [
    'dashboard.ver',
    'pdv.ver', 'pdv.vender', 'pdv.desconto', 'pdv.devolucao', 'vales.ver', 'caixa.abrir_fechar', 'caixa.sangria',
    'produtos.ver',
    'estoque.ver',
    'clientes.ver', 'clientes.gerenciar', 'crediario.receber'
  ],
  // Estoquista: cuida de produtos/estoque/compras — não mexe no PDV nem no financeiro
  estoque: [
    'dashboard.ver',
    'produtos.ver', 'produtos.editar', 'produtos.custo',
    'estoque.ver', 'estoque.movimentar',
    'compras.ver', 'compras.gerenciar'
  ]
};

// Permissões efetivas de um usuário: admin = tudo; senão custom (JSON) ou o modelo do perfil
function efetivas(perfil, permissoesJson) {
  if (perfil === 'admin') return [...TODAS];
  if (permissoesJson != null && permissoesJson !== '') {
    try {
      const arr = JSON.parse(permissoesJson);
      if (Array.isArray(arr)) return arr.filter(k => CHAVES.has(k));
    } catch (_) { /* ignora e cai no default */ }
  }
  return DEFAULTS[perfil] ? [...DEFAULTS[perfil]] : [];
}

function pode(usuario, chave) {
  if (!usuario) return false;
  if (usuario.perfil === 'admin') return true;
  return Array.isArray(usuario.permissoes) && usuario.permissoes.includes(chave);
}

// valida/normaliza um array vindo do formulário para gravar
function normalizar(perfil, lista) {
  if (perfil === 'admin') return [...TODAS];
  if (!Array.isArray(lista)) return null;
  return lista.filter(k => CHAVES.has(k));
}

module.exports = { CATALOGO, TODAS, DEFAULTS, efetivas, pode, normalizar };
