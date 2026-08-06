// Salgueiro Gestão — processo principal (Electron)
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Alguns Windows/GPUs encerram o renderer antes do login quando o Chromium
// tenta iniciar aceleração de hardware. O PDV não depende de GPU.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('in-process-gpu');

const XLSX = require('xlsx');
const { criarBanco, resetarDados, validarBackup } = require('./src/db');
const auth = require('./src/core/auth');
const produtos = require('./src/core/produtos');
const estoque = require('./src/core/estoque');
const pdv = require('./src/core/pdv');
const clientes = require('./src/core/clientes');
const crediario = require('./src/core/crediario');
const financeiro = require('./src/core/financeiro');
const compras = require('./src/core/compras');
const relatorios = require('./src/core/relatorios');
const config = require('./src/core/config');
const dashboard = require('./src/core/dashboard');
const permissoes = require('./src/core/permissoes');
const devolucoes = require('./src/core/devolucoes');
const valesTroca = require('./src/core/vales_troca');
const pontos = require('./src/core/pontos');
const backupNuvem = require('./src/core/backup_nuvem');
const consignacao = require('./src/core/consignacao');
const licenca = require('./src/core/licenca');
const rede = require('./src/core/rede');
const lojas = require('./src/core/lojas');

let db;
let win;
let dadosDir;   // pasta de dados (definida no app.whenReady)
let arquivoDb;  // caminho do banco (definido no app.whenReady)
let sessao = { usuario: null }; // usuário logado (para auditoria/permissões)

function dirDados() {
  // Em produção: pasta de dados do usuário. Em desenvolvimento: ./data
  const dir = app.isPackaged
    ? path.join(app.getPath('userData'), 'dados')
    : path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function criarJanela() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Salgueiro Gestão',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

// ---- Rotas IPC ------------------------------------------------------------
// Cada rota recebe (db, payload, sessao) e devolve um objeto serializável.
const rotas = {
  // Aplicativo
  'app:versao': () => ({ ok: true, version: app.getVersion() }),

  // Autenticação
  'auth:login': (p) => {
    const r = auth.login(db, p.usuario, p.senha);
    if (r.ok) sessao.usuario = r.usuario;
    return r;
  },
  'auth:logout': () => { sessao.usuario = null; return { ok: true }; },
  'auth:sessao': () => ({ ok: true, usuario: sessao.usuario }),
  'auth:listarUsuarios': () => auth.listarUsuarios(db),
  'auth:salvarUsuario': (p) => auth.salvarUsuario(db, p, sessao.usuario),
  'auth:trocarSenha': (p) => auth.trocarSenha(db, p, sessao.usuario),

  // Dashboard
  'dashboard:resumo': () => dashboard.resumo(db, sessao.usuario),
  'permissoes:catalogo': () => ({ ok: true, catalogo: permissoes.CATALOGO, defaults: permissoes.DEFAULTS }),

  // Configurações (white-label)
  'config:obter': () => config.obter(db),
  'config:salvar': (p) => config.salvar(db, p, sessao.usuario),

  // Impressoras
  'config:listarImpressoras': async () => {
    const lista = await win.webContents.getPrintersAsync();
    return { ok: true, impressoras: lista.map(i => ({ nome: i.name, padrao: !!i.isDefault })) };
  },
  'config:imprimir': (p) => {
    const cfg = config.obter(db).config;
    const nome = p?.tipo === 'etiqueta' ? cfg.impressora_etiqueta : cfg.impressora_cupom;
    if (!nome) return { ok: false, erro: 'Nenhuma impressora configurada para este tipo.' };
    return new Promise((resolve) => {
      win.webContents.print(
        { silent: true, deviceName: nome, printBackground: true },
        (sucesso, motivo) => resolve(sucesso ? { ok: true } : { ok: false, erro: motivo || 'Falha na impressão.' })
      );
    });
  },

  // Backup manual local e restauração
  'backup:manual': async () => {
    const hora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const r = await dialog.showSaveDialog(win, {
      title: 'Salvar backup do banco de dados',
      defaultPath: `salgueiro-backup-${hora}.db`,
      filters: [{ name: 'Banco de dados', extensions: ['db'] }]
    });
    if (r.canceled || !r.filePath) return { ok: false, erro: 'Operação cancelada.' };
    fs.copyFileSync(arquivoDb, r.filePath);
    return { ok: true, arquivo: r.filePath };
  },
  'backup:restaurar': async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Escolher arquivo de backup para restaurar',
      filters: [{ name: 'Banco de dados', extensions: ['db'] }],
      properties: ['openFile']
    });
    if (r.canceled || !r.filePaths?.length) return { ok: false, erro: 'Operação cancelada.' };
    const origem = r.filePaths[0];

    const conf = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Restaurar e reiniciar', 'Cancelar'],
      defaultId: 1, cancelId: 1,
      title: 'Restaurar backup',
      message: 'Substituir os dados atuais pelo backup selecionado?',
      detail: 'Uma cópia de segurança dos dados atuais será feita antes. O sistema será reiniciado.'
    });
    if (conf.response !== 0) return { ok: false, erro: 'Operação cancelada.' };

    // valida se o arquivo é um banco SQLite legível com a tabela usuarios
    const backupValido = await validarBackup(origem);
    if (!backupValido) {
      return { ok: false, erro: 'Arquivo inválido: não é um backup do Salgueiro Gestão.' };
    }

    // cópia de segurança do banco atual + restauração
    const hora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    fs.copyFileSync(arquivoDb, path.join(dadosDir, `pre-restauracao-${hora}.db`));
    db.close();
    fs.copyFileSync(origem, arquivoDb);
    app.relaunch();
    app.exit(0);
    return { ok: true };
  },
  'backup:listarLocais': () => {
    const dir = path.join(dadosDir, 'backups');
    let itens = [];
    try {
      itens = fs.readdirSync(dir).filter(f => f.endsWith('.db')).sort().reverse()
        .map(f => ({ nome: f, tamanho: fs.statSync(path.join(dir, f)).size }));
    } catch {}
    return { ok: true, backups: itens, pasta: dir };
  },

  // Categorias
  'categorias:listar': () => produtos.listarCategorias(db),
  'categorias:salvar': (p) => produtos.salvarCategoria(db, p, sessao.usuario),
  'categorias:excluir': (p) => produtos.excluirCategoria(db, p.id, sessao.usuario),

  // Produtos + grade
  'produtos:listar': (p) => produtos.listarProdutos(db, p || {}),
  'produtos:obter': (p) => produtos.obterProduto(db, p.id),
  'produtos:salvar': (p) => produtos.salvarProduto(db, p, sessao.usuario),
  'produtos:excluir': (p) => produtos.excluirProduto(db, p.id, sessao.usuario),

  // Estoque
  'estoque:buscar': (p) => estoque.buscarVariacoes(db, p.termo),
  'estoque:movimentar': (p) => estoque.movimentar(db, p, sessao.usuario),
  'estoque:kardex': (p) => estoque.kardex(db, p || {}),
  'estoque:reposicao': () => estoque.reposicao(db),

  // Clientes
  'clientes:listar': (p) => clientes.listar(db, p || {}),
  'clientes:salvar': (p) => clientes.salvar(db, p, sessao.usuario),
  'clientes:obter': (p) => crediario.obterCliente(db, p.id),
  'clientes:excluir': (p) => crediario.excluirCliente(db, p.id, sessao.usuario),
  'clientes:listarCategorias': () => clientes.listarCategorias(db),
  'clientes:salvarCategoria': (p) => clientes.salvarCategoria(db, p, sessao.usuario),
  'clientes:excluirCategoria': (p) => clientes.excluirCategoria(db, p.id, sessao.usuario),
  'clientes:exportarDados': () => clientes.exportar(db),
  'clientes:exportar': () => {
    const r = clientes.exportar(db);
    if (!r.ok) return r;
    const ws = XLSX.utils.json_to_sheet(r.clientes.map(c => ({
      nome: c.nome, cpf: c.cpf || '', telefone: c.telefone || '', email: c.email || '',
      endereco: c.endereco || '', nascimento: c.nascimento || '', categoria: c.categoria || '',
      limite_credito: c.limite_credito || 0, obs: c.obs || '', pontos: c.pontos
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { ok: true, buffer: buf.toString('base64'), total: r.clientes.length };
  },
  'clientes:importar': (p) => {
    if (!p || !p.dados) return { ok: false, erro: 'Dados ausentes.' };
    let linhas;
    if (p.formato === 'xlsx') {
      const buf = Buffer.from(p.dados, 'base64');
      const wb = XLSX.read(buf, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      linhas = XLSX.utils.sheet_to_json(ws, { defval: '' });
    } else {
      // CSV: dados é string utf-8
      const rows = p.dados.split(/\r?\n/).filter(l => l.trim());
      if (rows.length < 2) return { ok: false, erro: 'CSV sem dados.' };
      const sep = rows[0].includes(';') ? ';' : ',';
      const headers = rows[0].split(sep).map(h => h.trim().replace(/^"|"$/g,''));
      linhas = rows.slice(1).map(row => {
        const vals = row.split(sep).map(v => v.trim().replace(/^"|"$/g,''));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
      });
    }
    return clientes.importar(db, linhas, sessao.usuario);
  },

  // Crediário
  'crediario:abertas': (p) => crediario.parcelasAbertas(db, p || {}),
  'crediario:receber': (p) => crediario.receberParcela(db, p, sessao.usuario),
  'crediario:aniversariantes': () => crediario.aniversariantes(db),

  // Fornecedores + Compras
  'fornecedores:listar': (p) => compras.listarFornecedores(db, p || {}),
  'fornecedores:salvar': (p) => compras.salvarFornecedor(db, p, sessao.usuario),
  'fornecedores:excluir': (p) => compras.excluirFornecedor(db, p.id, sessao.usuario),
  'compras:criar': (p) => compras.criarCompra(db, p, sessao.usuario),
  'compras:listar': () => compras.listarCompras(db),
  'compras:obter': (p) => compras.obterCompra(db, p.id),
  'compras:receber': (p) => compras.receberCompra(db, p, sessao.usuario),
  'compras:cancelar': (p) => compras.cancelarCompra(db, p.id, sessao.usuario),

  // Relatórios
  'relatorios:vendas': (p) => relatorios.vendasPeriodo(db, p || {}),
  'relatorios:abc': (p) => relatorios.curvaAbc(db, p || {}),
  'relatorios:paradas': (p) => relatorios.pecasParadas(db, p || {}),
  'relatorios:receitaPorLoja': (p) => relatorios.receitaPorLoja(db, p || {}),

  // Lojas (unidades)
  'lojas:listar': (p) => lojas.listar(db, p || {}),
  'lojas:salvar': (p) => lojas.salvar(db, p, sessao.usuario),
  'lojas:excluir': (p) => lojas.excluir(db, p.id, sessao.usuario),

  // Financeiro
  'financeiro:listar': (p) => financeiro.listar(db, p || {}),
  'financeiro:salvar': (p) => financeiro.salvar(db, p, sessao.usuario),
  'financeiro:baixar': (p) => financeiro.baixar(db, p, sessao.usuario),
  'financeiro:excluir': (p) => financeiro.excluir(db, p.id, sessao.usuario),
  'financeiro:fluxo': (p) => financeiro.fluxo(db, p || {}),

  // PDV / Caixa
  'pdv:caixaAtual': () => pdv.caixaAtual(db),
  'pdv:abrirCaixa': (p) => pdv.abrirCaixa(db, p, sessao.usuario),
  'pdv:movimentoCaixa': (p) => pdv.movimentoCaixa(db, p, sessao.usuario),
  'pdv:resumoCaixa': (p) => pdv.resumoCaixa(db, p.caixa_id),
  'pdv:fecharCaixa': (p) => {
    const r = pdv.fecharCaixa(db, p, sessao.usuario);
    if (r.ok) {
      // Backup assíncrono após fechar o caixa (não bloqueia a resposta)
      setImmediate(() => backupNuvem.fazerBackupTodos(dadosDir, arquivoDb)
        .then(res => { if (res.resultados?.some(x => x.ok)) console.log('[nuvem] backup pós-caixa ok'); })
        .catch(e => console.error('[nuvem] backup pós-caixa:', e.message)));
    }
    return r;
  },
  'pdv:venda': (p) => pdv.registrarVenda(db, p, sessao.usuario),
  'pdv:obterVenda': (p) => pdv.obterVenda(db, p.id),
  'pdv:listarVendas': (p) => pdv.listarVendas(db, p || {}),
  'pdv:cancelarVenda': (p) => pdv.cancelarVenda(db, p, sessao.usuario),

  // Devoluções
  'devolucoes:itensVenda': (p) => devolucoes.itensVenda(db, p.venda_id),
  'devolucoes:registrar': (p) => devolucoes.registrar(db, p, sessao.usuario),
  'devolucoes:listar': () => devolucoes.listar(db),

  // Vales-troca
  'vales_troca:consultar': (p) => valesTroca.consultar(db, p.codigo),
  'vales_troca:listar': () => valesTroca.listar(db),

  // Backup na nuvem
  'nuvem:status': () => backupNuvem.obterStatus(dadosDir),
  'nuvem:salvarClientId': (p) => backupNuvem.salvarClientId(dadosDir, p.provider, p.client_id),
  'nuvem:conectar': async (p) => backupNuvem.iniciarOAuth(dadosDir, p.provider),
  'nuvem:desconectar': (p) => backupNuvem.desconectar(dadosDir, p.provider),
  'nuvem:backup': async (p) => {
    if (p?.provider) return backupNuvem.fazerBackup(dadosDir, arquivoDb, p.provider);
    return backupNuvem.fazerBackupTodos(dadosDir, arquivoDb);
  },

  // Programa de pontos
  'pontos:config': () => pontos.getConfig(db),
  'pontos:salvarConfig': (p) => pontos.salvarConfig(db, p, sessao.usuario),
  'pontos:saldo': (p) => pontos.saldo(db, p.cliente_id),
  'pontos:historico': (p) => pontos.historico(db, p.cliente_id),
  'pontos:ajustar': (p) => pontos.ajustar(db, p, sessao.usuario),

  // Consignação
  'consignacao:resumo': () => consignacao.resumo(db),
  'consignacao:listar': (p) => consignacao.listar(db, p),
  'consignacao:acertar': (p) => consignacao.acertar(db, p, sessao.usuario),

  // Licença (arrendamento) e área do desenvolvedor
  'licenca:status': () => ({ ok: true, ...licenca.estado(dadosDir) }),
  'licenca:renovar': (p) => licenca.renovar(dadosDir, p.codigo),
  'dev:entrar': (p) => licenca.devEntrar(dadosDir, p.usuario, p.senha),
  'dev:aplicar': (p) => licenca.devAplicar(dadosDir, p),
  'dev:remover': (p) => licenca.devRemover(dadosDir, p.senha),
  'dev:trocarSenha': (p) => licenca.devTrocarSenha(dadosDir, p.senha_atual, p.nova_senha),
  'dev:setores': (p) => licenca.devSetores(dadosDir, p.senha, p.bloqueados),
  'dev:resetarFabrica': (p) => {
    if (!licenca.senhaDevOk(dadosDir, p.senha)) return { ok: false, erro: 'Senha de desenvolvedor incorreta.' };
    if (String(p.confirmacao || '').trim().toUpperCase() !== 'ZERAR') {
      return { ok: false, erro: 'Confirmação inválida.' };
    }
    // Backup de segurança do banco antes de zerar (fica em dadosDir)
    try {
      const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(arquivoDb, path.join(dadosDir, `backup-antes-reset-${carimbo}.db`));
    } catch (e) { console.error('backup pré-reset falhou:', e); }
    resetarDados(db);
    sessao.usuario = null;
    return { ok: true };
  },

  // Acesso em rede (multiterminal)
  'rede:status': () => {
    const cfg = config.obter(db).config;
    return { ok: true, ...rede.status(Number(cfg.rede_porta) || 8750), ativa_config: cfg.rede_ativa === '1' };
  },
  'rede:abrirNavegador': (p) => {
    const url = String(p.url || '');
    // só endereços http locais gerados pela própria aba Rede
    if (!/^http:\/\/[0-9.]+:\d{2,5}\/?$/.test(url)) return { ok: false, erro: 'Endereço inválido.' };
    shell.openExternal(url);
    return { ok: true };
  },
  'rede:aplicar': async (p) => {
    if (p.ativa && !licenca.moduloAtivo(dadosDir, 'rede')) {
      return { ok: false, erro: 'O módulo "Acesso em Rede" não está incluído no seu plano.' };
    }
    const porta = Number(p.porta) || 8750;
    const r = config.salvar(db, { rede_ativa: p.ativa ? '1' : '0', rede_porta: String(porta) }, sessao.usuario);
    if (!r.ok) return r;
    rede.parar();
    if (!p.ativa) return { ok: true, ativa: false };
    const ini = await rede.iniciar({ porta, dirApp: path.join(__dirname, 'app'), processar });
    return ini.ok ? { ok: true, ativa: true, porta, ips: ini.ips } : ini;
  }
};

function exigirLogin(canal) {
  return !['app:versao', 'auth:login', 'auth:sessao', 'config:obter',
           'licenca:status', 'licenca:renovar',
           'dev:entrar', 'dev:aplicar', 'dev:remover',
           'dev:trocarSenha', 'dev:setores', 'dev:resetarFabrica'].includes(canal);
}

// Executor único de rotas — usado pelo IPC (janela local) e pelo servidor de
// rede (terminais via navegador, cada um com sua própria sessão).
async function processar(canal, payload, sess) {
  const sessAnterior = sessao;
  sessao = sess; // as rotas leem/escrevem `sessao.usuario`
  try {
    const rota = rotas[canal];
    if (!rota) return { ok: false, erro: `Rota desconhecida: ${canal}` };
    if (exigirLogin(canal) && !sess.usuario) {
      return { ok: false, erro: 'Sessão expirada. Entre novamente.' };
    }
    const bloqueio = licenca.verificar(dadosDir, canal);
    if (bloqueio) return { ok: false, erro: bloqueio };
    const permNec = PERM_ROTA[canal];
    if (permNec && !permissoes.pode(sess.usuario, permNec)) {
      return { ok: false, erro: 'Você não tem permissão para esta ação.' };
    }
    // desconto no PDV é uma permissão à parte (validada no conteúdo da venda)
    if (canal === 'pdv:venda' && !permissoes.pode(sess.usuario, 'pdv.desconto')) {
      const p = payload || {};
      const temDesc = (Number(p.desconto) || 0) > 0 ||
        (Array.isArray(p.itens) && p.itens.some(i => (Number(i.desconto) || 0) > 0));
      if (temDesc) return { ok: false, erro: 'Você não tem permissão para dar desconto.' };
    }
    // Setores desligados pelo Dev que aparecem como forma de pagamento no PDV
    if (canal === 'pdv:venda') {
      const formas = Array.isArray((payload || {}).pagamentos) ? payload.pagamentos.map(pg => pg.forma) : [];
      if (formas.includes('crediario') && licenca.setorBloqueado(dadosDir, 'crediario')) {
        return { ok: false, erro: 'O crediário está desativado nesta instalação.' };
      }
      if (formas.includes('vale') && licenca.setorBloqueado(dadosDir, 'vales')) {
        return { ok: false, erro: 'Os vales-troca estão desativados nesta instalação.' };
      }
    }
    return await rota(payload || {});
  } catch (e) {
    console.error(`[api] ${canal}:`, e);
    return { ok: false, erro: e.message || 'Erro interno.' };
  } finally {
    sessao = sessAnterior;
  }
}

// Permissão exigida por rota (defesa no backend; o admin sempre passa).
const PERM_ROTA = {
  'dashboard:resumo': 'dashboard.ver',
  'produtos:listar': 'produtos.ver', 'produtos:obter': 'produtos.ver',
  'produtos:salvar': 'produtos.editar', 'produtos:excluir': 'produtos.excluir',
  'categorias:listar': 'produtos.ver', 'categorias:salvar': 'produtos.editar', 'categorias:excluir': 'produtos.editar',
  'estoque:buscar': 'estoque.ver', 'estoque:kardex': 'estoque.ver', 'estoque:reposicao': 'estoque.ver',
  'estoque:movimentar': 'estoque.movimentar',
  'fornecedores:listar': 'compras.ver', 'compras:listar': 'compras.ver', 'compras:obter': 'compras.ver',
  'fornecedores:salvar': 'compras.gerenciar', 'fornecedores:excluir': 'compras.gerenciar',
  'compras:criar': 'compras.gerenciar', 'compras:receber': 'compras.gerenciar', 'compras:cancelar': 'compras.gerenciar',
  'clientes:listar': 'clientes.ver', 'clientes:obter': 'clientes.ver',
  'clientes:listarCategorias': 'clientes.ver', 'clientes:exportar': 'clientes.ver', 'clientes:exportarDados': 'clientes.ver',
  'clientes:salvarCategoria': 'clientes.gerenciar', 'clientes:excluirCategoria': 'clientes.gerenciar',
  'clientes:importar': 'clientes.gerenciar',
  'clientes:salvar': 'clientes.gerenciar', 'clientes:excluir': 'clientes.gerenciar',
  'crediario:abertas': 'clientes.ver', 'crediario:aniversariantes': 'clientes.ver',
  'crediario:receber': 'crediario.receber',
  'financeiro:listar': 'financeiro.ver', 'financeiro:fluxo': 'financeiro.ver',
  'financeiro:salvar': 'financeiro.gerenciar', 'financeiro:baixar': 'financeiro.gerenciar', 'financeiro:excluir': 'financeiro.gerenciar',
  'consignacao:resumo': 'financeiro.ver', 'consignacao:listar': 'financeiro.ver',
  'consignacao:acertar': 'financeiro.gerenciar',
  'relatorios:vendas': 'relatorios.ver', 'relatorios:abc': 'relatorios.ver', 'relatorios:paradas': 'relatorios.ver',
  'relatorios:receitaPorLoja': 'dashboard.financeiro',
  'lojas:listar': 'pdv.ver', 'lojas:salvar': 'config.gerenciar', 'lojas:excluir': 'config.gerenciar',
  'pdv:caixaAtual': 'pdv.ver', 'pdv:resumoCaixa': 'pdv.ver', 'pdv:listarVendas': 'pdv.ver', 'pdv:obterVenda': 'pdv.ver',
  'pdv:venda': 'pdv.vender',
  'pdv:abrirCaixa': 'caixa.abrir_fechar', 'pdv:fecharCaixa': 'caixa.abrir_fechar',
  'pdv:movimentoCaixa': 'caixa.sangria',
  'pdv:cancelarVenda': 'pdv.cancelar',
  'devolucoes:itensVenda': 'pdv.devolucao', 'devolucoes:registrar': 'pdv.devolucao', 'devolucoes:listar': 'pdv.devolucao',
  'vales_troca:consultar': 'vales.ver', 'vales_troca:listar': 'vales.ver',
  'pontos:config': 'pdv.ver', 'pontos:saldo': 'pdv.ver', 'pontos:historico': 'clientes.ver',
  'pontos:salvarConfig': 'config.gerenciar', 'pontos:ajustar': 'config.gerenciar',
  'nuvem:status': 'config.gerenciar', 'nuvem:conectar': 'config.gerenciar',
  'nuvem:desconectar': 'config.gerenciar', 'nuvem:backup': 'config.gerenciar',
  'nuvem:salvarClientId': 'config.gerenciar',
  'config:salvar': 'config.gerenciar',
  'backup:manual': 'config.gerenciar', 'backup:restaurar': 'config.gerenciar',
  'backup:listarLocais': 'config.gerenciar',
  'rede:status': 'config.gerenciar', 'rede:aplicar': 'config.gerenciar',
  'rede:abrirNavegador': 'config.gerenciar',
  'auth:listarUsuarios': 'usuarios.gerenciar', 'auth:salvarUsuario': 'usuarios.gerenciar',
  'permissoes:catalogo': 'usuarios.gerenciar'
};

// Backup automático: 1 cópia por dia, mantém as últimas 30
function backupDiario(arquivoDb) {
  try {
    const dir = path.join(path.dirname(arquivoDb), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const hoje = new Date().toISOString().slice(0, 10);
    const destino = path.join(dir, `salgueiro-${hoje}.db`);
    if (!fs.existsSync(destino) && fs.existsSync(arquivoDb)) {
      fs.copyFileSync(arquivoDb, destino);
    }
    const lista = fs.readdirSync(dir).filter(f => f.endsWith('.db')).sort();
    while (lista.length > 30) fs.unlinkSync(path.join(dir, lista.shift()));
  } catch (e) { console.error('[backup]', e); }
}

// Auto-atualização (opcional e segura):
// - só roda no app instalado (empacotado), nunca em desenvolvimento;
// - se o electron-updater não estiver presente, ou a loja estiver offline,
//   ou o servidor de updates não responder, apenas ignora — nunca trava o app;
// - baixa a nova versão em segundo plano e, quando pronta, pergunta ao usuário
//   se deseja reiniciar para instalar.
function iniciarAutoUpdate() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    return; // dependência não instalada — segue sem auto-update
  }
  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', (err) => console.error('[update]', err && err.message));
    autoUpdater.on('update-downloaded', async (info) => {
      const r = await dialog.showMessageBox(win, {
        type: 'info',
        buttons: ['Reiniciar agora', 'Depois'],
        defaultId: 0,
        cancelId: 1,
        title: 'Atualização disponível',
        message: `Uma nova versão (${info.version}) foi baixada.`,
        detail: 'Deseja reiniciar o Salgueiro Gestão agora para instalar?'
      });
      if (r.response === 0) autoUpdater.quitAndInstall();
    });
    // Verifica em segundo plano, sem incomodar se não houver update.
    autoUpdater.checkForUpdates().catch((err) =>
      console.error('[update] verificação falhou:', err && err.message));
  } catch (e) {
    console.error('[update] init falhou:', e && e.message);
  }
}

app.whenReady().then(async () => {
  dadosDir = dirDados();
  arquivoDb = path.join(dadosDir, 'salgueiro.db');
  backupDiario(arquivoDb);

  try {
    db = await criarBanco(arquivoDb);
  } catch (e) {
    dialog.showErrorBox(
      'Erro ao iniciar o Salgueiro Gestão',
      'Não foi possível abrir o banco de dados.\n\n' +
      'Detalhes: ' + (e.message || e) + '\n\n' +
      'Pasta de dados: ' + dadosDir
    );
    app.quit();
    return;
  }

  // Backup na nuvem: verificar na inicialização e a cada hora
  const verificarBackupNuvem = async () => {
    try {
      if (backupNuvem.precisaBackupDiario(dadosDir)) {
        const r = await backupNuvem.fazerBackupTodos(dadosDir, arquivoDb);
        if (r.resultados.some(x => x.ok)) console.log('[nuvem] backup automático:', r.resultados.map(x => x.provider + ':' + (x.ok ? '✓' : x.erro)).join(', '));
      }
    } catch (e) { console.error('[nuvem]', e.message); }
  };
  setTimeout(verificarBackupNuvem, 30000); // 30s após o startup
  setInterval(verificarBackupNuvem, 3600000); // a cada hora

  ipcMain.handle('api', (evento, { canal, payload }) => processar(canal, payload, sessao));

  // Acesso em rede: religa o servidor se estava ativo e o módulo está liberado
  try {
    const cfgIni = config.obter(db).config;
    if (cfgIni.rede_ativa === '1' && licenca.moduloAtivo(dadosDir, 'rede')) {
      rede.iniciar({ porta: Number(cfgIni.rede_porta) || 8750, dirApp: path.join(__dirname, 'app'), processar })
        .then(r => { if (!r.ok) console.error('[rede]', r.erro); });
    }
  } catch (e) { console.error('[rede]', e.message); }

  criarJanela();
  iniciarAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Garante que nenhuma escrita pendente se perca ao fechar o sistema
app.on('before-quit', () => {
  try { if (db && db.salvarAgora) db.salvarAgora(); } catch (_) {}
});
