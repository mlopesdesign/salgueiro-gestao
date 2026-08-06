// Salgueiro Gestão V2 — roteador local da API (era o main.js do Electron).
// Roda dentro do WebView: recebe api(canal, payload) do frontend e executa
// a lógica de negócio. Contratos das rotas idênticos aos da V1.
/* global Neutralino, NL_PATH, NL_CWD, XLSX */

import * as ambiente from './ambiente.js';
import { criarBanco, resetarDados, validarBackup, estaVazio, radiografar } from './db.js';
import * as auth from './core/auth.js';
import * as produtos from './core/produtos.js';
import * as estoque from './core/estoque.js';
import * as pdv from './core/pdv.js';
import * as clientes from './core/clientes.js';
import * as crediario from './core/crediario.js';
import * as financeiro from './core/financeiro.js';
import * as compras from './core/compras.js';
import * as relatorios from './core/relatorios.js';
import * as config from './core/config.js';
import * as dashboard from './core/dashboard.js';
import * as permissoes from './core/permissoes.js';
import * as devolucoes from './core/devolucoes.js';
import * as valesTroca from './core/vales_troca.js';
import * as pontos from './core/pontos.js';
import * as consignacao from './core/consignacao.js';
import * as licenca from './core/licenca.js';
import * as lojas from './core/lojas.js';
import * as estoques from './core/estoques.js';
import * as rede from './core/rede.js';
import * as nuvem from './core/nuvem.js';
import * as updater from './core/updater.js';
import * as trocas from './core/trocas.js';
import * as mensagens from './core/mensagens.js';
import { LOGO_DEFAULT } from './core/logo-default.js';

let db;
let sessao = { usuario: null };
// Preenchido no boot quando o app precisou se auto-recuperar. A tela lê por
// 'app:recuperacao' e avisa o usuário — recuperação silenciosa esconde
// problema, e problema escondido volta maior.
let RECUPERACAO_BOOT = null;

const AVISO_FASE = (recurso) =>
  ({ ok: false, erro: `${recurso} será ativado em uma próxima atualização desta versão.` });

// ---- Rotas -----------------------------------------------------------------
const rotas = {
  // Aplicativo
  'app:versao': () => ({ ok: true, version: ambiente.versaoApp() }),
  'app:recuperacao': () => ({ ok: true, recuperacao: RECUPERACAO_BOOT }),

  // Mensagens internas e avisos (v3.1.0 — chat de volta, agora com runVolatil
  // no ping de presença: o polling não reescreve mais o banco em disco).
  'mensagens:resumo': (p) => mensagens.resumo(db, sessao.usuario, p),
  'mensagens:contatos': () => mensagens.contatos(db, sessao.usuario),
  'mensagens:historico': (p) => mensagens.historico(db, sessao.usuario, p),
  'mensagens:enviar': (p) => mensagens.enviar(db, sessao.usuario, p),
  'mensagens:marcarLido': (p) => mensagens.marcarLido(db, sessao.usuario, p),
  'mensagens:terminais': () => mensagens.terminais(db, sessao.usuario),
  'avisos:enviar': (p) => mensagens.enviarAviso(db, sessao.usuario, p),
  'avisos:confirmar': (p) => mensagens.confirmarAviso(db, sessao.usuario, p),
  'avisos:listar': (p) => mensagens.listarAvisos(db, sessao.usuario, p),
  'avisos:encerrar': (p) => mensagens.encerrarAviso(db, sessao.usuario, p),
  'app:garantirExtensao': async () => { await ambiente.garantirExtensaoRede(); return { ok: true }; },

  // Autenticação
  // ATENÇÃO: sessao.usuario é gerenciado pelo chamador (api() para app local,
  // rede.js/sessoes para terminais). Não modificar sessao aqui para evitar
  // que login/logout de terminais corrompam a sessão do app principal.
  'auth:login': async (p) => auth.login(db, p.usuario, p.senha),
  'auth:logout': () => ({ ok: true }),
  'auth:sessao': () => ({ ok: true, usuario: sessao.usuario }),
  'auth:listarUsuarios': () => auth.listarUsuarios(db),
  'auth:salvarUsuario': (p) => auth.salvarUsuario(db, p, sessao.usuario),
  'auth:trocarSenha': (p) => auth.trocarSenha(db, p, sessao.usuario),
  'auth:autorizarDesconto': async (p) => auth.verificarAdmin(db, p.usuario, p.senha),

  // Dashboard
  'dashboard:resumo': () => dashboard.resumo(db, sessao.usuario),
  'permissoes:catalogo': () => ({ ok: true, catalogo: permissoes.CATALOGO, defaults: permissoes.DEFAULTS }),

  // Configurações (white-label)
  'config:obter': () => config.obter(db),
  'config:salvar': (p) => config.salvar(db, p, sessao.usuario),

  // Ícone do aplicativo (barra de tarefas / atalho) — gravado na pasta de DADOS,
  // que o auto-updater e o instalador nunca sobrescrevem. Some nunca mais.
  'config:iconeStatus': async () => {
    try {
      const arq = `${await ambiente.dirDados()}/icone.ico`;
      await Neutralino.filesystem.getStats(arq);
      return { ok: true, personalizado: true, caminho: arq.replace(/\//g, '\\') };
    } catch {
      return { ok: true, personalizado: false, caminho: null };
    }
  },
  // p.dados = base64 do arquivo .ico (ou PNG já convertido para .ico pelo frontend)
  'config:definirIcone': async (p) => {
    if (!p?.dados) return { ok: false, erro: 'Nenhuma imagem recebida.' };
    try {
      const bin = atob(p.dados);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      if (bytes.length < 6) return { ok: false, erro: 'Arquivo de ícone inválido.' };
      const arq = `${await ambiente.dirDados()}/icone.ico`;
      await Neutralino.filesystem.writeBinaryFile(arq, bytes.buffer);
      try { await Neutralino.window.setIcon(arq); } catch { /* aplica no próximo boot */ }
      return { ok: true, caminho: arq.replace(/\//g, '\\') };
    } catch (e) {
      return { ok: false, erro: 'Não foi possível salvar o ícone: ' + (e.message || e) };
    }
  },
  'config:removerIcone': async () => {
    try {
      const arq = `${await ambiente.dirDados()}/icone.ico`;
      try { await Neutralino.filesystem.remove(arq); } catch { /* já não existia */ }
      try { await Neutralino.window.setIcon(`${NL_PATH}/icon.ico`); } catch {}
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: String(e) };
    }
  },

  // Impressoras — lista real do Windows via execCommand (sem precisar da extensão TCP).
  'config:listarImpressoras': async () => {
    try {
      const r = await Neutralino.os.execCommand(
        'powershell.exe -NoProfile -NonInteractive -Command "Get-Printer | Where-Object { $_.DriverName } | Select-Object Name,Default | ConvertTo-Json -Compress"'
      );
      if (r.exitCode !== 0) return { ok: false, erro: r.stdErr || 'Erro ao listar impressoras' };
      const raw = r.stdOut.trim();
      if (!raw) return { ok: true, impressoras: [] };
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return { ok: true, impressoras: arr.map(p => ({ nome: p.Name, padrao: !!p.Default })) };
    } catch (e) {
      return { ok: false, erro: String(e) };
    }
  },

  // Impressão silenciosa local via execCommand + PS1 temp (não depende da extensão TCP).
  // p.impressora pode ser passado diretamente (ex: botão de teste antes de salvar).
  'config:imprimir': async (p) => {
    const tipo = p?.tipo || 'cupom';
    const cfg = config.obter(db).config || {};
    const impressora = p?.impressora || (tipo === 'etiqueta'
      ? (cfg.impressora_etiqueta || '')
      : (cfg.impressora_cupom || ''));
    if (!impressora) return { ok: false, erro: 'Impressora não configurada.' };

    const area = document.getElementById('area-impressao');
    if (!area || !area.innerHTML.trim()) return { ok: false, erro: 'Sem conteúdo para imprimir.' };

    // CSS mínimo embutido para que o arquivo HTML temporário renderize corretamente
    // body{width:76mm} dentro de @page{margin:2mm} → content area=76mm; padding-right:5mm garante que
    // valores alinhados à direita não sejam cortados pela margem física da impressora térmica.
    const cssCupomBase = '*{box-sizing:border-box;margin:0;padding:0}body{background:#fff;width:76mm;padding-left:4mm;padding-right:5mm}@page{size:80mm auto;margin:2mm}';
    const cssCupom = `${cssCupomBase}.cupom{width:100%;font-family:Consolas,'Courier New',monospace;font-size:11px;color:#000;word-break:break-word}.cupom table{width:100%;border-collapse:collapse}.cupom td{padding:1px 0;border:none;font-size:11px;vertical-align:top}.cupom .c-centro{text-align:center}.cupom .c-sep{border-top:1px dashed #000;margin:5px 0}.cupom b{font-weight:700}`;
    // Etiqueta 60x40mm paisagem (Pimaco TR6040: 60mm largura, 40mm altura)
    // Layout: et-left (nome/cor/ref/preço/barcode) + et-right (badge tamanho)
    // padding-left:5mm evita corte na borda física da impressora
    const cssEtq = `*{box-sizing:border-box;margin:0;padding:0}@page{size:60mm 40mm;margin:0}body{background:#fff;width:60mm;height:40mm;overflow:hidden}.etq-grid{display:flex;flex-direction:column}.etiqueta{width:60mm;height:40mm;padding:2mm 2mm 2mm 5mm;font-family:Arial,Helvetica,sans-serif;overflow:hidden;display:flex;flex-direction:row;gap:2mm;page-break-after:always;break-after:page}.et-left{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}.et-loja{font-size:6px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.05em;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin-bottom:.5mm}.et-nome{font-size:13px;font-weight:700;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex-shrink:0}.et-cor,.et-info{font-size:11px;color:#000;margin-top:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}.et-ref{font-size:9px;color:#555;margin-top:.5mm;flex-shrink:0}.et-preco{font-size:12px;font-weight:700;margin-top:1mm;flex-shrink:0}.et-bc-wrap{margin-top:auto;flex-shrink:0}.et-bc-wrap>svg{width:100%;max-width:35mm;height:10mm;display:block}.et-bc-wrap .qrbox{display:flex}.et-bc-wrap .qrbox svg{width:14mm;height:14mm}.et-num{font-family:Consolas,monospace;font-size:7px;letter-spacing:.03em;margin-top:.5mm}.et-right{width:15mm;flex-shrink:0;display:flex;align-items:center;justify-content:center}.et-tam-badge{width:13mm;height:26mm;border:2px solid #000;border-radius:2.5mm;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;line-height:1;text-align:center;word-break:break-all;overflow:hidden}`;
    const css = tipo === 'etiqueta' ? cssEtq : cssCupom;

    // Ler logo da loja como data URI para embutir na impressão (funciona em Edge headless)
    let logoUri = '';
    try {
      const buf = await Neutralino.filesystem.readBinaryFile(`${NL_PATH}/src/img/logo-etq.jpeg`);
      const bytes = new Uint8Array(buf);
      let bin = '';
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
      }
      logoUri = `data:image/jpeg;base64,${btoa(bin)}`;
    } catch { /* sem logo: img ficará oculta pelo onerror */ }

    const htmlFinal = area.innerHTML.replace(/__LOGO_URI__/g, logoUri);
    const conteudo = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${htmlFinal}</body></html>`;

    return await _imprimirDireto(conteudo, impressora, tipo);
  },

  // Backup manual local e restauração
  'backup:manual': async () => {
    const hora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const destino = await ambiente.dialogoSalvar('Salvar backup do banco de dados', `salgueiro-backup-${hora}.db`);
    if (!destino) return { ok: false, erro: 'Operação cancelada.' };
    await db.salvarAgora();
    await ambiente.copiarBancoPara(destino, db.exportar());
    return { ok: true, arquivo: destino };
  },
  'backup:restaurar': async () => {
    const origem = await ambiente.dialogoAbrir('Escolher arquivo de backup para restaurar');
    if (!origem) return { ok: false, erro: 'Operação cancelada.' };

    const conf = await Neutralino.os.showMessageBox(
      'Restaurar backup',
      'Substituir os dados atuais pelo backup selecionado?\n\nUma cópia de segurança dos dados atuais será feita antes. O sistema será reiniciado.',
      'YES_NO', 'WARNING'
    );
    if (conf !== 'YES') return { ok: false, erro: 'Operação cancelada.' };

    const bytes = await ambiente.lerArquivoBinario(origem);
    return await _restaurarBytes(bytes);
  },

  // Restaura direto de um backup da lista (sem seletor de arquivos).
  // `confirmado` vem true quando o usuário já aceitou o aviso de perda.
  'backup:restaurarLocal': async (p) => {
    if (!p || !p.nome) return { ok: false, erro: 'Backup não informado.' };
    let bytes;
    try { bytes = await ambiente.lerBackupLocal(p.nome); }
    catch { return { ok: false, erro: 'Não foi possível ler esse backup.' }; }
    return await _restaurarBytes(bytes, { confirmado: !!p.confirmado });
  },

  'backup:listarLocais': async () => {
    const r = await ambiente.listarBackupsLocais();
    // Radiografa cada backup para a tela mostrar o que há dentro ANTES de
    // restaurar — o usuário nunca mais escolhe um arquivo vazio às cegas.
    const atual = await radiografar(db.exportar());
    const backups = [];
    for (const b of r.backups) {
      let info = null;
      try { info = await radiografar(await ambiente.lerBackupLocal(b.nome)); } catch {}
      backups.push({
        ...b,
        vendas: info ? info.vendas : -1,
        produtos: info ? info.produtos : -1,
        clientes: info ? info.clientes : -1,
        integro: !!(info && info.tabelasOk),
        temDados: !!(info && info.temDados),
        // sinaliza backup mais pobre que o banco em uso (restaurar = perder)
        perdeDados: !!(info && info.totalDados < atual.totalDados)
      });
    }
    return { ok: true, pasta: r.pasta, atual, backups };
  },

  // Backup obrigatório antes de baixar uma atualização.
  // O botão "Baixar e instalar" chama esta rota ANTES do download e aborta
  // a atualização se ela falhar. Nenhuma atualização toca no app sem um
  // ponto de retorno gravado em disco.
  'backup:preAtualizacao': async (p) => {
    await db.salvarAgora();
    const bytes = db.exportar();
    const info = await radiografar(bytes);
    if (!info.tabelasOk) {
      return { ok: false, erro: 'O banco atual está inconsistente. Atualização cancelada por segurança.' };
    }
    const versao = (p && p.versao) ? String(p.versao).replace(/[^\w.-]/g, '') : ambiente.versaoApp();
    const arquivo = await ambiente.salvarBackupCarimbado(bytes, `pre-atualizacao-v${versao}`);
    console.warn(`[atualização] backup de segurança: ${arquivo}`);
    return { ok: true, arquivo, info };
  },

  // Chamada logo antes do restartProcess do updater: nada pendente se perde.
  'backup:salvarAgora': async () => { await db.salvarAgora(); return { ok: true }; },

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
  'estoque:listarCompleto': () => estoque.listarCompleto(db),
  'estoque:exportarXlsx': () => {
    const r = estoque.listarCompleto(db);
    if (!r.ok) return r;
    const cfg = config.obter(db).config || {};
    const ws = XLSX.utils.json_to_sheet(r.variacoes.map(v => ({
      'Produto': v.nome, 'Referência': v.referencia || '', 'Categoria': v.categoria,
      'Cor': v.cor || '', 'Tamanho': v.tamanho || '', 'Código de barras': v.codigo_barras || '',
      'Estoque': v.estoque, 'Preço custo': v.preco_custo || 0, 'Preço venda': v.preco_venda || 0,
      'Total custo': Math.round((v.estoque || 0) * (v.preco_custo || 0) * 100) / 100,
      'Total venda': Math.round((v.estoque || 0) * (v.preco_venda || 0) * 100) / 100
    })));
    // Rodapé totais
    const nRows = r.variacoes.length + 1;
    XLSX.utils.sheet_add_aoa(ws, [['', '', '', '', '', 'TOTAL:', r.totalPecas, '', '', r.totalCusto, r.totalVenda]], { origin: `A${nRows + 1}` });
    const wb = XLSX.utils.book_new();
    const loja = cfg.loja_nome || 'Salgueiro';
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    return { ok: true, buffer: b64, loja };
  },

  // Exportação da lista de produtos com filtros e colunas escolhidas pelo usuário
  'estoque:exportarXlsxFiltrado': (p) => {
    const r = estoque.listarCompleto(db);
    if (!r.ok) return r;
    const o = p || {};
    const c = o.cols || {};
    const arr = r.variacoes.filter(v => {
      if (o.categoria && v.categoria !== o.categoria) return false;
      if (o.filtro === 'com' && !(v.estoque > 0)) return false;
      if (o.filtro === 'sem' && v.estoque > 0) return false;
      return true;
    });
    if (!arr.length) return { ok: false, erro: 'Nenhum produto encontrado com esses filtros.' };
    const a2 = n => Math.round((Number(n) || 0) * 100) / 100;
    const rows = arr.map(v => {
      const linha = { 'Produto': v.nome };
      if (c.ref) linha['Referência'] = v.referencia || '';
      if (c.cat) linha['Categoria'] = v.categoria || '';
      if (c.cor) { linha['Cor'] = v.cor || ''; linha['Tamanho'] = v.tamanho || ''; }
      if (c.cod) linha['Código de barras'] = v.codigo_barras || '';
      if (c.est) linha['Estoque'] = v.estoque;
      if (c.custo) linha['Preço custo'] = a2(v.preco_custo);
      if (c.venda) linha['Preço venda'] = a2(v.preco_venda);
      if (c.total) linha['Total venda'] = a2((v.estoque || 0) * (v.preco_venda || 0));
      if (c.conf) linha['Conferido'] = '';
      return linha;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    // Linha de totais
    const chaves = Object.keys(rows[0]);
    const totais = chaves.map(k => {
      if (k === 'Produto') return 'TOTAL';
      if (k === 'Estoque') return arr.reduce((s, v) => s + (v.estoque || 0), 0);
      if (k === 'Total venda') return a2(arr.reduce((s, v) => s + (v.estoque || 0) * (v.preco_venda || 0), 0));
      return '';
    });
    XLSX.utils.sheet_add_aoa(ws, [totais], { origin: `A${rows.length + 2}` });
    ws['!cols'] = chaves.map(k => ({ wch: k === 'Produto' ? 34 : Math.max(12, k.length + 3) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    return { ok: true, buffer: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) };
  },

  // Clientes
  'clientes:listar': (p) => clientes.listar(db, p || {}),
  'clientes:salvar': (p) => clientes.salvar(db, p, sessao.usuario),
  'clientes:obter': (p) => crediario.obterCliente(db, p.id),
  'clientes:excluir': (p) => crediario.excluirCliente(db, p.id, sessao.usuario),
  'clientes:listarCategorias': () => clientes.listarCategorias(db),
  'clientes:salvarCategoria': (p) => clientes.salvarCategoria(db, p, sessao.usuario),
  'clientes:excluirCategoria': (p) => clientes.excluirCategoria(db, p.id, sessao.usuario),
  'clientes:exportarDados': () => {
    if (!sessao.usuario || sessao.usuario.perfil !== 'admin') return { ok: false, erro: 'Apenas administradores podem exportar clientes.' };
    return clientes.exportar(db);
  },
  'clientes:exportar': () => {
    if (!sessao.usuario || sessao.usuario.perfil !== 'admin') return { ok: false, erro: 'Apenas administradores podem exportar clientes.' };
    const r = clientes.exportar(db);
    if (!r.ok) return r;
    const ws = XLSX.utils.json_to_sheet(r.clientes.map(c => ({
      nome: c.nome, cpf: c.cpf || '', telefone: c.telefone || '', email: c.email || '',
      endereco: c.endereco || '', nascimento: c.nascimento || '', categoria: c.categoria || '',
      limite_credito: c.limite_credito || 0, obs: c.obs || '', pontos: c.pontos
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    return { ok: true, buffer: b64, total: r.clientes.length };
  },
  'clientes:importar': (p) => {
    if (!sessao.usuario || sessao.usuario.perfil !== 'admin') return { ok: false, erro: 'Apenas administradores podem importar clientes.' };
    if (!p || !p.dados) return { ok: false, erro: 'Dados ausentes.' };
    let linhas;
    if (p.formato === 'xlsx') {
      const wb = XLSX.read(p.dados, { type: 'base64' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      linhas = XLSX.utils.sheet_to_json(ws, { defval: '' });
    } else {
      // CSV: dados é string utf-8
      const rows = p.dados.split(/\r?\n/).filter(l => l.trim());
      if (rows.length < 2) return { ok: false, erro: 'CSV sem dados.' };
      const sep = rows[0].includes(';') ? ';' : ',';
      const headers = rows[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
      linhas = rows.slice(1).map(row => {
        const vals = row.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
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
  'clientes:aniversariantes': () => crediario.aniversariantes(db),
  'crediario:aniversariantes': () => crediario.aniversariantes(db), // alias legado

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
  'relatorios:consignados': (p) => relatorios.consignadosMensal(db, p || {}),
  'relatorios:evento': (p) => relatorios.relatorioEvento(db, p || {}),
  'relatorios:ranking': (p) => relatorios.ranking(db, p || {}),
  'relatorios:eventos': (p) => relatorios.eventosVenda(db, p || {}),
  'relatorios:rankingPeriodo': (p) => relatorios.rankingPeriodo(db, p || {}),
  'relatorios:rankingPeriodoXlsx': (p) => {
    const r = relatorios.rankingPeriodo(db, p || {});
    if (!r.ok) return r;
    const a2 = n => Math.round((Number(n) || 0) * 100) / 100;
    const per = r.periodo;
    const wb = XLSX.utils.book_new();
    const add = (nome, rows, larguras) => {
      if (!rows || !rows.length) return;
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = (larguras || Object.keys(rows[0]).map(k => Math.max(12, k.length + 3))).map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, nome);
    };
    const seta = (d) => d === undefined ? '' : d === null ? 'novo' : d > 0 ? `+${d}` : d < 0 ? String(d) : '=';
    add('Ranking', per.produtos.map(x => ({
      'Posição': x.pos, 'Produto': x.nome, 'Referência': x.referencia,
      'Categoria': x.categoria, 'Peças': x.pecas, 'Receita': a2(x.receita),
      'Variação': seta(x.delta)
    })), [9, 34, 14, 20, 10, 14, 12]);
    add('Categorias', per.categorias.map(c => ({
      'Categoria': c.categoria, 'Peças': c.pecas, 'Receita': a2(c.receita) })), [26, 10, 14]);
    add('Cor e tamanho', per.variacoes.map(v => ({
      'Produto': v.produto, 'Cor': v.cor, 'Tamanho': v.tamanho,
      'Peças': v.pecas, 'Receita': a2(v.receita), 'Estoque atual': v.estoque })), [34, 14, 10, 10, 14, 14]);
    add('Clientes', per.clientes.map(c => ({
      'Cliente': c.nome, 'Categoria': c.categoria, 'Compras': c.compras,
      'Total gasto': a2(c.gasto) })), [32, 20, 10, 14]);
    add('Por hora', per.por_hora.map(h => ({
      'Hora': `${String(h.hora).padStart(2, '0')}h`, 'Vendas': h.vendas, 'Receita': a2(h.receita) })), [10, 10, 14]);
    if (!wb.SheetNames.length) return { ok: false, erro: 'Nenhuma venda nesse período.' };
    return { ok: true, buffer: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) };
  },
  'relatorios:rankingXlsx': (p) => {
    const r = relatorios.ranking(db, p || {});
    if (!r.ok) return r;
    const a2 = n => Math.round((Number(n) || 0) * 100) / 100;
    const wb = XLSX.utils.book_new();
    const add = (nome, rows, larguras) => {
      if (!rows || !rows.length) return;
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = (larguras || Object.keys(rows[0]).map(k => Math.max(12, k.length + 3))).map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, nome);
    };
    const seta = (d) => d === null ? 'novo' : d > 0 ? `+${d}` : d < 0 ? String(d) : '=';
    for (const [chave, per] of Object.entries(r.periodos)) {
      add(({ dia: 'Hoje', semana: 'Semana', mes: 'Mes', ano: 'Ano' })[chave], per.produtos.map(x => ({
        'Posição': x.pos, 'Produto': x.nome, 'Referência': x.referencia,
        'Categoria': x.categoria, 'Peças': x.pecas, 'Receita': a2(x.receita),
        'Variação vs período anterior': seta(x.delta)
      })), [9, 34, 14, 20, 10, 14, 26]);
    }
    const ano = r.periodos.ano;
    add('Categorias', ano.categorias.map(c => ({
      'Categoria': c.categoria, 'Peças': c.pecas, 'Receita': a2(c.receita) })), [26, 10, 14]);
    add('Cor e tamanho', ano.variacoes.map(v => ({
      'Produto': v.produto, 'Cor': v.cor, 'Tamanho': v.tamanho,
      'Peças': v.pecas, 'Receita': a2(v.receita), 'Estoque atual': v.estoque })), [34, 14, 10, 10, 14, 14]);
    add('Clientes', ano.clientes.map(c => ({
      'Cliente': c.nome, 'Categoria': c.categoria, 'Compras': c.compras,
      'Total gasto': a2(c.gasto) })), [32, 20, 10, 14]);
    if (!wb.SheetNames.length) return { ok: false, erro: 'Nenhuma venda no período.' };
    return { ok: true, buffer: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) };
  },
  'relatorios:eventoXlsx': (p) => {
    const o = p || {};
    const r = relatorios.relatorioEvento(db, o);
    if (!r.ok) return r;
    const s = o.secoes || {};
    const a2 = n => Math.round((Number(n) || 0) * 100) / 100;
    const wb = XLSX.utils.book_new();
    const add = (nome, rows, larguras) => {
      if (!rows || !rows.length) return;
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = (larguras || Object.keys(rows[0]).map(k => Math.max(12, k.length + 3)))
        .map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, nome);
    };

    if (s.resumo !== false) {
      const q = r.resumo;
      add('Resumo', [
        { Indicador: 'Período', Valor: `${r.inicio} até ${r.fim}` },
        { Indicador: 'Vendas', Valor: q.vendas },
        { Indicador: 'Peças', Valor: q.pecas },
        { Indicador: 'Faturamento bruto', Valor: a2(q.bruto) },
        { Indicador: 'Devoluções', Valor: a2(q.devolucoes) },
        { Indicador: 'Faturamento líquido', Valor: a2(q.liquido) },
        { Indicador: 'Ticket médio', Valor: a2(q.ticket) },
        { Indicador: 'Taxas de cartão', Valor: a2(q.taxas) },
        { Indicador: 'Comissão consignado', Valor: a2(q.comissao) },
        { Indicador: 'Líquido a receber', Valor: a2(q.receber) }
      ], [26, 26]);
    }
    if (s.vendas !== false) {
      add('Vendas', r.vendas.map(v => ({
        'Venda': v.id, 'Data': v.data, 'Hora': v.hora,
        'Cliente': v.cliente || '', 'Vendedor(a)': v.vendedor || '',
        'Peças': v.pecas, 'Subtotal': a2(v.subtotal), 'Desconto': a2(v.desconto),
        'Total': a2(v.total), 'Devolvido': a2(v.devolvido), 'Líquido': a2(v.liquido),
        'Taxa cartão': a2(v.taxa_valor), 'Comissão': a2(v.comissao),
        'Formas': v.pagamentos.map(g => g.rotulo).join(' + ')
      })), [8, 11, 7, 24, 18, 7, 12, 11, 12, 11, 12, 12, 12, 26]);
    }
    if (s.itens) {
      const linhas = [];
      for (const v of r.vendas) for (const it of v.itens) linhas.push({
        'Venda': v.id, 'Data': v.data, 'Hora': v.hora,
        'Produto': it.produto, 'Referência': it.referencia || '',
        'Cor': it.cor || '', 'Tamanho': it.tamanho || '',
        'Qtd': it.qtd, 'Preço unit.': a2(it.preco_unit),
        'Desconto': a2(it.desconto), 'Total': a2(it.total)
      });
      add('Itens', linhas, [8, 11, 7, 34, 14, 12, 10, 7, 12, 11, 12]);
    }
    if (s.produtos !== false) {
      add('Produtos vendidos', r.por_produto.map(x => ({
        'Produto': x.produto, 'Referência': x.referencia || '',
        'Cor': x.cor || '', 'Tamanho': x.tamanho || '',
        'Qtd vendida': x.qtd, 'Preço unit.': a2(x.qtd ? x.total / x.qtd : 0),
        'Total': a2(x.total)
      })), [34, 14, 12, 10, 12, 12, 12]);
    }
    if (s.pagamentos !== false) {
      add('Pagamentos', r.por_forma.map(g => ({
        'Forma': g.forma, 'Qtd': g.qtd, 'Valor': a2(g.valor),
        'Taxa %': g.taxa_pct, 'Taxa R$': a2(g.taxa_valor),
        'Líquido': a2(g.valor - g.taxa_valor)
      })), [24, 8, 14, 10, 12, 14]);
    }
    if (s.consignado !== false && r.por_fornecedor.length) {
      add('Consignado', r.por_fornecedor.map(g => ({
        'Fornecedor': g.fornecedor, 'Peças': g.pecas, 'Venda': a2(g.venda),
        'Comissão': a2(g.comissao), 'Parte da loja': a2(g.parte_loja),
        'Pendente': a2(g.pendente)
      })), [30, 8, 14, 14, 15, 14]);
    }
    if (s.cortesias !== false && r.cortesias.length) {
      add('Cortesias', r.cortesias.map(x => ({
        'Venda': x.venda_id, 'Data': x.data, 'Hora': x.hora,
        'Produto': x.produtos || '', 'Para quem': x.beneficiario || '',
        'Autorizado por': x.autorizado_por || '', 'Peças': x.pecas,
        'Valor de tabela': a2(x.cortesia_valor), 'Custo p/ loja': a2(x.custo)
      })), [8, 11, 7, 34, 24, 22, 8, 15, 14]);
    }
    if (s.vendedor) {
      add('Vendedores', r.por_vendedor.map(g => ({
        'Vendedor(a)': g.vendedor, 'Vendas': g.qtd, 'Peças': g.pecas, 'Total': a2(g.total)
      })), [24, 10, 8, 14]);
    }
    if (s.categoria) {
      add('Categorias', r.por_categoria.map(c => ({
        'Categoria': c.categoria, 'Peças': c.pecas, 'Total': a2(c.total)
      })), [26, 8, 14]);
    }
    if (!wb.SheetNames.length) return { ok: false, erro: 'Selecione ao menos uma seção para exportar.' };
    return { ok: true, buffer: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) };
  },

  // Lojas (unidades)
  // Locais de estoque
  'estoques:listar': (p) => estoques.listar(db, p || {}),
  'estoques:salvar': (p) => estoques.salvar(db, p || {}, sessao.usuario),
  'estoques:desativar': (p) => estoques.desativar(db, p.id, sessao.usuario),
  'estoques:conteudo': (p) => estoques.conteudo(db, p || {}),
  'estoques:porVariacao': (p) => ({ ok: true, locais: estoques.porVariacao(db, p.variacao_id) }),
  'estoques:transferir': (p) => estoques.transferir(db, p || {}, sessao.usuario),
  'estoques:transferencias': (p) => estoques.listarTransferencias(db, p || {}),
  'estoques:romaneio': (p) => estoques.obterTransferencia(db, p.id),
  'estoques:conteudoXlsx': (p) => {
    const r = estoques.conteudo(db, p || {});
    if (!r.ok) return r;
    const a2 = n => Math.round((Number(n) || 0) * 100) / 100;
    const rows = r.itens.map(i => ({
      'Produto': i.produto, 'Referência': i.referencia, 'Categoria': i.categoria,
      'Cor': i.cor, 'Tamanho': i.tamanho, 'Código de barras': i.codigo_barras,
      'Qtd neste estoque': i.qtd, 'Total do Salgueiro': i.total_geral,
      'Custo': a2(i.qtd * (i.preco_custo || 0)), 'Venda': a2(i.qtd * (i.preco_venda || 0)),
      'Conferido': ''
    }));
    if (!rows.length) return { ok: false, erro: 'Este estoque está vazio.' };
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.sheet_add_aoa(ws, [['TOTAL', '', '', '', '', '',
      r.totais.pecas, '', r.totais.custo, r.totais.venda, '']], { origin: `A${rows.length + 2}` });
    ws['!cols'] = [34, 14, 20, 14, 10, 18, 16, 16, 12, 12, 12].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balanço');
    return { ok: true, buffer: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) };
  },

  'estoques:romaneio-pdf': async (p) => {
    const r = estoques.obterTransferencia(db, p.id);
    if (!r.ok) return r;
    const cfg = config.obter(db).config;
    return await _gerarPdfBase64(gerarHtmlRomaneio(r, cfg));
  },
  'estoques:relatorio-transferencias-pdf': async (p) => {
    const r = estoques.listarTransferencias(db, { limite: 500 });
    if (!r.ok) return r;
    const cfg = config.obter(db).config;
    return await _gerarPdfBase64(gerarHtmlRelatorioTransferencias(r.transferencias, cfg, p || {}));
  },

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
  'pdv:fecharCaixa': async (p) => {
    const r = await pdv.fecharCaixa(db, p, sessao.usuario);
    if (r.ok) nuvem.fazerBackupTodos(db).catch(() => {}); // fire-and-forget
    return r;
  },
  'pdv:venda': (p) => pdv.registrarVenda(db, p, sessao.usuario),
  'pdv:obterVenda': (p) => pdv.obterVenda(db, p.id),
  'pdv:listarVendas': (p) => pdv.listarVendas(db, p || {}),
  'pdv:listarVendasGeral': (p) => pdv.listarVendasGeral(db, p || {}),
  'pdv:cancelarVenda': (p) => pdv.cancelarVenda(db, p, sessao.usuario),

  // Devoluções
  'devolucoes:itensVenda': (p) => devolucoes.itensVenda(db, p.venda_id),
  'devolucoes:registrar': (p) => devolucoes.registrar(db, p, sessao.usuario),
  'devolucoes:listar': () => devolucoes.listar(db),

  // Vales-troca
  'vales_troca:consultar': (p) => valesTroca.consultar(db, p.codigo),
  'vales_troca:listar': () => valesTroca.listar(db),

  // Trocas (devolução + nova venda em transação única)
  'trocas:registrar': (p) => trocas.registrar(db, p, sessao.usuario),

  // Backup na nuvem — Google Drive e OneDrive (OAuth 2.0 PKCE)
  'nuvem:status': () => nuvem.obterStatus(),
  'nuvem:salvarClientId': (p) => nuvem.salvarClientId(p.provider, p.client_id),
  'nuvem:conectar': (p) => nuvem.iniciarOAuth(p.provider),
  'nuvem:desconectar': (p) => nuvem.desconectar(p.provider),
  'nuvem:backup': (p) => nuvem.fazerBackup(db, p.provider),

  // Atualizador automático via GitHub Releases
  'updater:verificar': (p) => updater.verificarAtualizacao(p.versaoAtual || '0.0.0'),

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
  'licenca:status': () => ({ ok: true, ...licenca.estado() }),
  'licenca:renovar': (p) => licenca.renovar(p.codigo),
  'dev:entrar': (p) => licenca.devEntrar(p.usuario, p.senha),
  'dev:aplicar': (p) => licenca.devAplicar(p),
  'dev:remover': (p) => licenca.devRemover(p.senha),
  'dev:trocarSenha': (p) => licenca.devTrocarSenha(p.senha_atual, p.nova_senha),
  'dev:setores': (p) => licenca.devSetores(p.senha, p.bloqueados),
  'dev:resetarFabrica': async (p) => {
    if (!licenca.senhaDevOk(p.senha)) return { ok: false, erro: 'Senha de desenvolvedor incorreta.' };
    if (String(p.confirmacao || '').trim().toUpperCase() !== 'ZERAR') {
      return { ok: false, erro: 'Confirmação inválida.' };
    }
    // Backup de segurança do banco antes de zerar (fica na pasta de dados)
    try {
      const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
      await db.salvarAgora();
      await ambiente.copiarBancoPara(`${await ambiente.dirDados()}/backup-antes-reset-${carimbo}.db`, db.exportar());
    } catch (e) { console.error('backup pré-reset falhou:', e); }
    await resetarDados(db);
    sessao.usuario = null;
    return { ok: true };
  },

  // Acesso em rede (multiterminal)
  'rede:status': () => {
    const cfg = config.obter(db).config;
    return { ok: true, ...rede.status(cfg.rede_porta), ativa_config: cfg.rede_ativa === '1' };
  },
  'rede:abrirNavegador': async (p) => {
    const url = String(p.url || '');
    // só endereços http locais gerados pela própria aba Rede
    if (!/^http:\/\/[0-9.]+:\d{2,5}\/?$/.test(url)) return { ok: false, erro: 'Endereço inválido.' };
    await Neutralino.os.open(url);
    return { ok: true };
  },
  'rede:aplicar': async (p) => {
    if (p.ativa && !licenca.moduloAtivo('rede')) {
      return { ok: false, erro: 'O módulo "Acesso em Rede" não está incluído no seu plano.' };
    }
    const porta = Number(p.porta) || 8750;
    const r = config.salvar(db, { rede_ativa: p.ativa ? '1' : '0', rede_porta: String(porta) }, sessao.usuario);
    if (!r.ok) return r;
    await rede.parar();
    if (!p.ativa) return { ok: true, ativa: false };
    const ini = await rede.iniciar({ porta });
    return ini.ok ? { ok: true, ativa: true, porta, ips: ini.ips } : ini;
  }
};


// ── Impressão local direta (sem extensão PS1) ─────────────────────────────────
// ── Geração de PDF via Edge headless ─────────────────────────────────────────
// Recebe HTML completo (standalone), renderiza com Edge --headless=new em A4,
// grava base64 em arquivo temp (evita truncamento via stdout) e retorna { ok, buffer }.
async function _gerarPdfBase64(html) {
  try {
    const appDir = (typeof NL_PATH !== 'undefined' ? NL_PATH : (typeof NL_CWD !== 'undefined' ? NL_CWD : '')).replace(/\\/g, '/');
    if (!appDir) return { ok: false, erro: 'NL_PATH indisponível' };
    const tmpDir = appDir + '/tmp-print';
    try { await Neutralino.filesystem.createDirectory(tmpDir); } catch {}
    const id = Date.now();
    const htmlPath = `${tmpDir}/pdf-${id}.html`;
    const ps1Path  = `${tmpDir}/pdf-${id}.ps1`;
    const b64Path  = `${tmpDir}/pdf-${id}.b64`;
    await Neutralino.filesystem.writeFile(htmlPath, html);
    const escP = s => s.replace(/'/g, "''");
    const htmlW = htmlPath.replace(/\//g, '\\');
    const pdfW  = htmlW.replace(/\.html$/, '.pdf');
    const b64W  = htmlW.replace(/\.html$/, '.b64');
    const ps1 = [
      `$h = '${escP(htmlW)}'`,
      `$p = '${escP(pdfW)}'`,
      `$b = '${escP(b64W)}'`,
      `$e = @('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',` +
        `'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1`,
      `if (!$e) { Write-Error 'Edge nao encontrado'; exit 1 }`,
      `$u = 'file:///' + $h.Replace('\\','/')`,
      `$eA = @('--headless=new','--no-sandbox','--run-all-compositor-stages-before-draw',` +
        `'--print-to-pdf-no-margins','--paper-width=8.267','--paper-height=11.692',` +
        `"--print-to-pdf=$p",'--print-to-pdf-no-header',$u)`,
      `& $e @eA`,
      `$dl = (Get-Date).AddSeconds(20)`,
      `while (!(Test-Path $p) -and (Get-Date) -lt $dl) { Start-Sleep -Milliseconds 300 }`,
      `if (!(Test-Path $p) -or (Get-Item $p).Length -lt 200) { Remove-Item $h -EA 0; exit 2 }`,
      `$bytes = [System.IO.File]::ReadAllBytes($p)`,
      `$b64 = [System.Convert]::ToBase64String($bytes)`,
      `[System.IO.File]::WriteAllText($b, $b64)`,
      `Remove-Item $h,$p -EA 0`,
    ].join('\r\n');
    await Neutralino.filesystem.writeFile(ps1Path, ps1);
    const ps1W = ps1Path.replace(/\//g, '\\');
    const run = await Neutralino.os.execCommand(
      `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${ps1W}"`
    );
    try { await Neutralino.filesystem.remove(ps1Path); } catch {}
    if (run.exitCode !== 0) {
      return { ok: false, erro: `PDF: código ${run.exitCode}`, debug: (run.stdOut||'') + (run.stdErr||'') };
    }
    let b64;
    try { b64 = await Neutralino.filesystem.readFile(b64Path); }
    catch (e) { return { ok: false, erro: 'PDF gerado mas não pôde ser lido: ' + e.message }; }
    try { await Neutralino.filesystem.remove(b64Path); } catch {}
    return { ok: true, buffer: b64.trim() };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

// HTML standalone para o romaneio (A4, sem dependências externas)
function gerarHtmlRomaneio(r, cfg) {
  const esc2 = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const t = r.transferencia;
  const loja = esc2(cfg && cfg.loja_nome ? cfg.loja_nome : 'Salgueiro Gestão');
  const dataBrH = s => `${String(s||'').slice(0,10).split('-').reverse().join('/')} ${String(s||'').slice(11,16)}`;
  const corTam = i => [i.cor,i.tamanho].filter(x=>x&&x!=='Única'&&x!=='U').join(' · ')||'—';
  const linhas = r.itens.map(i => `<tr>
    <td>${esc2(i.produto)}</td><td>${esc2(i.referencia||'—')}</td>
    <td>${esc2(corTam(i))}</td><td>${esc2(i.codigo_barras||'—')}</td>
    <td class="num"><b>${i.qtd}</b></td><td class="conf"></td>
  </tr>`).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <style>
    @page{size:A4;margin:18mm 14mm}
    *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}
    body{font-size:11.5px;color:#111}
    .cab{border-bottom:2.5px solid #222;margin-bottom:12px;padding-bottom:8px}
    .cab h1{font-size:19px;font-weight:800;margin-bottom:2px}
    .cab h2{font-size:12px;letter-spacing:1.5px;color:#555;margin-bottom:8px}
    .info{border-collapse:collapse;width:100%}
    .info td{padding:2px 4px;font-size:11px;vertical-align:top}
    table.tab{width:100%;border-collapse:collapse;margin-top:10px}
    table.tab th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;
      background:#f0f0f0;padding:5px 7px;border:1px solid #bbb;text-align:left}
    table.tab td{border:1px solid #ccc;padding:5px 7px;font-size:11px}
    .num{text-align:right} .conf{min-width:52px}
    .tot td{font-weight:700;background:#f8f8f8;border-color:#aaa}
    .ass{display:flex;gap:60px;margin-top:50px;font-size:10.5px;text-align:center}
    .ass>div{flex:1} .ass .ln{border-bottom:1px solid #333;margin:34px 0 5px}
  </style></head><body>
  <div class="cab">
    <h1>${loja}</h1>
    <h2>ROMANEIO DE TRANSFERÊNCIA Nº ${t.id}</h2>
    <table class="info"><tbody>
      <tr><td><b>De:</b> ${esc2(t.origem)}</td><td><b>Para:</b> ${esc2(t.destino)}</td></tr>
      <tr><td><b>Data:</b> ${dataBrH(t.criado_em)}</td><td><b>Responsável:</b> ${esc2(t.usuario||'—')}</td></tr>
      ${t.obs?`<tr><td colspan="2"><b>Obs:</b> ${esc2(t.obs)}</td></tr>`:''}
    </tbody></table>
  </div>
  <table class="tab"><thead><tr>
    <th>Produto</th><th>Ref.</th><th>Cor / Tam.</th>
    <th>Código de barras</th><th class="num">Qtd</th><th class="conf">Conferido</th>
  </tr></thead><tbody>
    ${linhas}
    <tr class="tot"><td colspan="4">TOTAL DE PEÇAS</td>
      <td class="num">${r.pecas}</td><td></td></tr>
  </tbody></table>
  <div class="ass">
    <div><div class="ln"></div>Entregue por</div>
    <div><div class="ln"></div>Recebido por</div>
  </div>
  </body></html>`;
}

// HTML standalone para relatório resumido de transferências (paisagem A4)
function gerarHtmlRelatorioTransferencias(transferencias, cfg, p) {
  const esc2 = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const loja = esc2(cfg && cfg.loja_nome ? cfg.loja_nome : 'Salgueiro Gestão');
  const dataBr = s => String(s||'').slice(0,10).split('-').reverse().join('/');
  const dataBrH = s => `${dataBr(s)} ${String(s||'').slice(11,16)}`;
  const agora = new Date().toLocaleString('pt-BR');
  let lista = transferencias;
  if (p.de)  lista = lista.filter(t => t.criado_em >= p.de);
  if (p.ate) lista = lista.filter(t => t.criado_em <= p.ate + ' 23:59:59');
  const totalPecas = lista.reduce((s, t) => s + (Number(t.pecas)||0), 0);
  const filtroTxt = (p.de || p.ate)
    ? `Período: ${p.de ? dataBr(p.de) : '—'} a ${p.ate ? dataBr(p.ate) : '—'}`
    : 'Todos os registros';
  const linhas = lista.map(t => `<tr>
    <td class="num">#${t.id}</td>
    <td>${dataBrH(t.criado_em)}</td>
    <td>${esc2(t.origem)}</td>
    <td>${esc2(t.destino)}</td>
    <td>${esc2(t.usuario||'—')}</td>
    <td class="num">${t.pecas}</td>
    <td>${esc2(t.obs||'—')}</td>
  </tr>`).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <style>
    @page{size:A4 landscape;margin:14mm 12mm}
    *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}
    body{font-size:10.5px;color:#111}
    h1{font-size:17px;font-weight:800;margin-bottom:2px}
    .sub{font-size:10px;color:#555;padding-bottom:8px;border-bottom:2px solid #222;margin-bottom:10px}
    table{width:100%;border-collapse:collapse}
    th{font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;
      background:#f0f0f0;padding:4px 6px;border:1px solid #bbb;text-align:left}
    td{border:1px solid #ddd;padding:4px 6px}
    tr:nth-child(even) td{background:#fafafa}
    .num{text-align:right}
    .tot td{font-weight:700;background:#f0f0f0;border-color:#aaa}
    .rodape{margin-top:12px;font-size:9px;color:#888;text-align:right}
  </style></head><body>
  <h1>${loja} — Relatório de Transferências</h1>
  <div class="sub">${filtroTxt} · ${lista.length} romaneio(s) · Total: ${totalPecas} peça(s) · Gerado em ${agora}</div>
  <table><thead><tr>
    <th class="num">Nº</th><th>Data</th><th>De</th><th>Para</th>
    <th>Responsável</th><th class="num">Peças</th><th>Observação</th>
  </tr></thead><tbody>
    ${linhas || '<tr><td colspan="7" style="text-align:center;padding:16px;color:#888">Nenhuma transferência no período.</td></tr>'}
    <tr class="tot"><td colspan="5">TOTAL</td><td class="num">${totalPecas}</td><td></td></tr>
  </tbody></table>
  <div class="rodape">Salgueiro Gestão · ${loja}</div>
  </body></html>`;
}

// ── Impressão local direta (sem extensão PS1) ─────────────────────────────────
// Grava um PS1 temporário e executa via powershell.exe.
// Vantagem: funciona mesmo sem a extensão de rede; envia para a impressora
// configurada (não para o padrão do Windows).
async function _imprimirDireto(conteudo, impressora, tipo) {
  try {
    // NL_PATH = diretório de instalação (onde resources.neu está)
    // NL_CWD  = diretório de trabalho do processo (pode ser home do usuário)
    const appDir = (typeof NL_PATH !== 'undefined' ? NL_PATH : (typeof NL_CWD !== 'undefined' ? NL_CWD : '')).replace(/\\/g, '/');
    if (!appDir) return { ok: false, erro: 'NL_PATH indisponivel' };

    // Temp files ficam em %TEMP% para garantir acesso de escrita
    const tmpDir = appDir + '/tmp-print';
    try { await Neutralino.filesystem.createDirectory(tmpDir); } catch { /* ja existe */ }

    const id = Date.now();
    const htmlPath = `${tmpDir}/print-${id}.html`;
    const ps1Path  = `${tmpDir}/print-${id}.ps1`;

    await Neutralino.filesystem.writeFile(htmlPath, conteudo);

    const htmlW    = htmlPath.replace(/\//g, '\\');
    const pdfW     = htmlW.replace(/\.html$/, '.pdf');
    const sumatraW = (appDir + '/extensions/rede/SumatraPDF.exe').replace(/\//g, '\\');
    const esc      = s => s.replace(/'/g, "''");  // escape PS1 single-quote
    const dimsLine = tipo === 'etiqueta'
      ? `$dims = @('--paper-width=2.362','--paper-height=1.575')`
      : `$dims = @('--paper-width=3.150')`;

    // PS1 usa & + splatting para passar argumentos com espaços corretamente
    // (Start-Process -ArgumentList @array não escapa espaços — bug conhecido do PS1)
    // Edge: polling pelo PDF em vez de -Wait (processo pai sai antes de gravar o arquivo)
    const dimArgs = tipo === 'etiqueta'
      ? `'--paper-width=2.362', '--paper-height=1.575'`
      : `'--paper-width=3.150'`;

    const linhas = [
      `$h = '${esc(htmlW)}'`,
      `$p = '${esc(pdfW)}'`,
      `$imp = '${esc(impressora)}'`,
      `$s = '${esc(sumatraW)}'`,
      `if (!(Test-Path $s)) { $s = "$env:LOCALAPPDATA\\SalgueiroGestao\\extensions\\rede\\SumatraPDF.exe" }`,
      // Se ainda não existe, baixa do GitHub automaticamente
      `if (!(Test-Path $s)) {`,
      `  Write-Host "SUMATRA_BAIXANDO"`,
      `  $dir = Split-Path $s -Parent`,
      `  New-Item -ItemType Directory -Force -Path $dir | Out-Null`,
      `  $tmpZip = "$env:TEMP\\sp361.zip"`,
      `  & curl.exe -fsSL -o $tmpZip "https://github.com/sumatrapdfreader/sumatrapdf/releases/download/SumatraPDF_rel-3.6.1/SumatraPDF-3.6.1-64.zip"`,
      `  if ((Test-Path $tmpZip) -and (Get-Item $tmpZip).Length -gt 500000) {`,
      `    Add-Type -AssemblyName System.IO.Compression.FileSystem`,
      `    $z = [IO.Compression.ZipFile]::OpenRead($tmpZip)`,
      `    foreach ($entry in $z.Entries) { if ($entry.Name -like '*.exe') { [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $s, $true); break } }`,
      `    $z.Dispose(); Remove-Item $tmpZip -EA 0`,
      `  }`,
      `  Write-Host "SUMATRA_DL:$(Test-Path $s)"`,
      `}`,
      `Write-Host "IMP:[$imp]"`,
      `Write-Host "SUMATRA:$(Test-Path $s)"`,
      `$e = @('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1`,
      `Write-Host "EDGE:$e"`,
      `if (!$e) { Write-Host 'EDGE_NAO_ENCONTRADO'; exit 1 }`,
      `$u = 'file:///' + $h.Replace('\\','/')`,
      `$eA = @('--headless=new','--no-sandbox','--run-all-compositor-stages-before-draw','--print-to-pdf-no-margins',${dimArgs},"--print-to-pdf=$p",'--print-to-pdf-no-header',$u)`,
      `Write-Host "EDGE_START"`,
      `& $e @eA`,
      `Write-Host "EDGE_DONE"`,
      `$dl = (Get-Date).AddSeconds(20)`,
      `while (!(Test-Path $p) -and (Get-Date) -lt $dl) { Start-Sleep -Milliseconds 300 }`,
      `Write-Host "PDF_EXISTS:$(Test-Path $p)"`,
      `if (Test-Path $p) { Write-Host "PDF_SIZE:$((Get-Item $p).Length)" }`,
      `if (!(Test-Path $p) -or (Get-Item $p).Length -lt 200) { Remove-Item $h -EA 0; exit 2 }`,
      `Write-Host "PDF_PATH:$p"`,
      `Write-Host "IMP_LEN:$($imp.Length)"`,
      `$sOut = & $s $p '-print-to' $imp '-print-settings' '${tipo === 'etiqueta' ? 'noscale,landscape' : 'noscale'}' '-exit-when-done' 2>&1 | Out-String`,
      `$sc = $LASTEXITCODE`,
      `Write-Host "SUMATRA_EXIT:$sc"`,
      `Write-Host "SUMATRA_OUT:$sOut"`,
      `Remove-Item $h,$p -EA 0`,
      `exit $sc`,
    ];
    const ps1 = linhas.join('\r\n');

    await Neutralino.filesystem.writeFile(ps1Path, ps1);

    const ps1W = ps1Path.replace(/\//g, '\\');
    const r = await Neutralino.os.execCommand(
      `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${ps1W}"`
    );

    try { await Neutralino.filesystem.remove(ps1Path); } catch { /* ok */ }

    const dbg = (r.stdOut || '') + (r.stdErr ? '\nSTDERR:' + r.stdErr : '');
    console.log('[imprimir-debug]', dbg);
    if (r.exitCode !== 0) {
      return { ok: false, erro: `Codigo ${r.exitCode}`, debug: dbg };
    }
    return { ok: true, debug: dbg };
  } catch (e) {
    console.error('[imprimirDireto]', e);
    return { ok: false, erro: String(e) };
  }
}

// Restauração de backup — caminho único para as duas rotas (seletor e lista).
// Regras de segurança:
//  1. o arquivo precisa ser um banco íntegro do Salgueiro (todas as tabelas);
//  2. se o backup tem MENOS dados que o banco atual, só prossegue com
//     `confirmado: true` — a tela pergunta antes, com os números na tela;
//  3. o banco atual vira `pre-restauracao-*.db` antes de qualquer escrita;
//  4. reinicia sozinho no fim (o banco é carregado uma vez, no boot).
async function _restaurarBytes(bytes, opcoes) {
  const { confirmado = false } = opcoes || {};

  if (!(await validarBackup(bytes))) {
    return { ok: false, erro: 'Arquivo inválido: não é um backup íntegro do Salgueiro Gestão.' };
  }
  const novo = await radiografar(bytes);
  const atual = await radiografar(db.exportar());

  if (!confirmado && novo.totalDados < atual.totalDados) {
    return {
      ok: false, precisaConfirmar: true, novo, atual,
      erro: `Este backup tem MENOS dados que o sistema atual `
          + `(${novo.vendas} vendas contra ${atual.vendas}). Restaurar vai apagar a diferença.`
    };
  }

  const hora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await db.salvarAgora();
  await ambiente.copiarBancoPara(`${await ambiente.dirDados()}/pre-restauracao-${hora}.db`, db.exportar());
  await ambiente.salvarBanco(bytes);
  await ambiente.reiniciarApp(); // restauração só vale depois do boot
  return { ok: true, novo };
}

function exigirLogin(canal) {
  return !['app:versao', 'auth:login', 'auth:sessao', 'config:obter',
           'licenca:status', 'licenca:renovar',
           'dev:entrar', 'dev:aplicar', 'dev:remover',
           'dev:trocarSenha', 'dev:setores', 'dev:resetarFabrica'].includes(canal);
}

// Executor único de rotas — idêntico à V1 (menos o troca-troca de sessão,
// que só existia por causa dos terminais em rede; aqui a sessão é única).
async function processar(canal, payload, sess) {
  try {
    const rota = rotas[canal];
    if (!rota) return { ok: false, erro: `Rota desconhecida: ${canal}` };
    if (exigirLogin(canal) && !sess.usuario) {
      return { ok: false, erro: 'Sessão expirada. Entre novamente.' };
    }
    const bloqueio = licenca.verificar(canal);
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
      if (formas.includes('crediario') && licenca.setorBloqueado('crediario')) {
        return { ok: false, erro: 'O crediário está desativado nesta instalação.' };
      }
      if (formas.includes('vale') && licenca.setorBloqueado('vales')) {
        return { ok: false, erro: 'Os vales-troca estão desativados nesta instalação.' };
      }
    }
    // Isolamento de sessão multiterminal: as rotas fecham sobre `sessao.usuario` (módulo),
    // mas chamadas vindas de terminais em rede chegam com `sess` diferente de `sessao`.
    // Sem este ajuste, qualquer terminal veria o painel do usuário logado localmente (admin).
    // As rotas SQL são síncronas → não há race condition neste override temporário.
    const _salvoUsuario = sessao.usuario;
    if (sess !== sessao) sessao.usuario = sess.usuario;
    try { return await rota(payload || {}); }
    finally { if (sess !== sessao) sessao.usuario = _salvoUsuario; }
  } catch (e) {
    console.error(`[api] ${canal}:`, e);
    return { ok: false, erro: e.message || 'Erro interno.' };
  }
}

// Permissão exigida por rota (defesa no backend; o admin sempre passa).
const PERM_ROTA = {
  'dashboard:resumo': 'dashboard.ver',
  'produtos:listar': 'produtos.ver', 'produtos:obter': 'produtos.ver',
  'produtos:salvar': 'produtos.editar', 'produtos:excluir': 'produtos.excluir',
  'categorias:listar': 'produtos.ver', 'categorias:salvar': 'produtos.editar', 'categorias:excluir': 'produtos.editar',
  'estoque:buscar': 'estoque.ver', 'estoque:kardex': 'estoque.ver', 'estoque:reposicao': 'estoque.ver',
  'estoque:listarCompleto': 'estoque.ver', 'estoque:exportarXlsx': 'estoque.ver',
  'estoque:exportarXlsxFiltrado': 'produtos.ver',
  'config:definirIcone': 'config.gerenciar', 'config:removerIcone': 'config.gerenciar',
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
  'clientes:aniversariantes': 'clientes.ver',
  'crediario:receber': 'crediario.receber',
  'financeiro:listar': 'financeiro.ver', 'financeiro:fluxo': 'financeiro.ver',
  'financeiro:salvar': 'financeiro.gerenciar', 'financeiro:baixar': 'financeiro.gerenciar', 'financeiro:excluir': 'financeiro.gerenciar',
  'consignacao:resumo': 'financeiro.ver', 'consignacao:listar': 'financeiro.ver',
  'consignacao:acertar': 'financeiro.gerenciar',
  'relatorios:vendas': 'relatorios.ver', 'relatorios:abc': 'relatorios.ver', 'relatorios:paradas': 'relatorios.ver',
  'relatorios:consignados': 'relatorios.ver',
  'relatorios:evento': 'relatorios.ver', 'relatorios:eventoXlsx': 'relatorios.ver',
  'relatorios:ranking': 'relatorios.ver', 'relatorios:rankingXlsx': 'relatorios.ver',
  'relatorios:eventos': 'relatorios.ver', 'relatorios:rankingPeriodo': 'relatorios.ver',
  'relatorios:rankingPeriodoXlsx': 'relatorios.ver',
  'relatorios:receitaPorLoja': 'dashboard.financeiro',
  'lojas:listar': 'pdv.ver', 'lojas:salvar': 'config.gerenciar', 'lojas:excluir': 'config.gerenciar',
  'estoques:listar': 'estoque.ver', 'estoques:conteudo': 'estoque.ver',
  'estoques:porVariacao': 'estoque.ver', 'estoques:transferencias': 'estoque.ver',
  'estoques:romaneio': 'estoque.ver', 'estoques:conteudoXlsx': 'estoque.ver',
  'estoques:romaneio-pdf': 'estoque.ver', 'estoques:relatorio-transferencias-pdf': 'estoque.ver',
  'estoques:salvar': 'estoque.movimentar', 'estoques:desativar': 'estoque.movimentar',
  'estoques:transferir': 'estoque.movimentar',
  'pdv:caixaAtual': 'pdv.ver', 'pdv:resumoCaixa': 'pdv.ver', 'pdv:listarVendas': 'pdv.ver', 'pdv:listarVendasGeral': 'pdv.ver', 'pdv:obterVenda': 'pdv.ver',
  'pdv:venda': 'pdv.vender',
  'pdv:abrirCaixa': 'caixa.abrir_fechar', 'pdv:fecharCaixa': 'caixa.abrir_fechar',
  'pdv:movimentoCaixa': 'caixa.sangria',
  'pdv:cancelarVenda': 'pdv.cancelar',
  'devolucoes:itensVenda': 'pdv.devolucao', 'devolucoes:registrar': 'pdv.devolucao', 'devolucoes:listar': 'pdv.devolucao',
  // Troca liberada para todo mundo que opera o PDV (decisão do Marcio, v3.2.0):
  // gerente e vendedores precisam resolver a troca na hora, sem chamar o admin.
  'trocas:registrar': 'pdv.ver',
  'vales_troca:consultar': 'vales.ver', 'vales_troca:listar': 'vales.ver',
  'pontos:config': 'pdv.ver', 'pontos:saldo': 'pdv.ver', 'pontos:historico': 'clientes.ver',
  'pontos:salvarConfig': 'config.gerenciar', 'pontos:ajustar': 'config.gerenciar',
  'nuvem:status': 'config.gerenciar', 'nuvem:conectar': 'config.gerenciar',
  'nuvem:desconectar': 'config.gerenciar', 'nuvem:backup': 'config.gerenciar',
  'nuvem:salvarClientId': 'config.gerenciar',
  'updater:verificar': 'config.gerenciar',
  'config:salvar': 'config.gerenciar',
  'backup:manual': 'config.gerenciar', 'backup:restaurar': 'config.gerenciar',
  'backup:listarLocais': 'config.gerenciar', 'backup:restaurarLocal': 'config.gerenciar',
  'backup:preAtualizacao': 'config.gerenciar', 'backup:salvarAgora': 'config.gerenciar',
  'rede:status': 'config.gerenciar', 'rede:aplicar': 'config.gerenciar',
  'rede:abrirNavegador': 'config.gerenciar',
  'auth:listarUsuarios': 'usuarios.gerenciar', 'auth:salvarUsuario': 'usuarios.gerenciar',
  'permissoes:catalogo': 'usuarios.gerenciar',
  'mensagens:contatos': 'mensagens.usar', 'mensagens:historico': 'mensagens.usar',
  'mensagens:enviar': 'mensagens.usar', 'mensagens:marcarLido': 'mensagens.usar',
  'avisos:enviar': 'mensagens.avisar', 'avisos:encerrar': 'mensagens.avisar'
};

// ── Inicialização ─────────────────────────────────────────────────────────────
let _pronto = null;

async function _iniciar() {
  await licenca.iniciar();
  let bytesExistentes = await ambiente.lerBanco();
  // Adota o banco inicial APENAS na verdadeira primeira execução:
  // se instalacao.json já existe na pasta de dados, esta máquina já foi
  // inicializada (mesmo que o banco esteja vazio por reset de fábrica ou
  // que o usuário tenha feito um reset e depois atualizado o app).
  // NUNCA sobrescrever dados existentes com o banco bundled.
  const _jaInicializado = !!(await ambiente.lerTextoDados('instalacao.json'));
  if (!_jaInicializado && await estaVazio(bytesExistentes)) {
    try {
      const resp = await fetch('dados-iniciais.db');
      if (resp.ok) {
        const buf = new Uint8Array(await resp.arrayBuffer());
        if (buf.length && await validarBackup(buf)) {
          bytesExistentes = buf;
          console.warn('[boot] banco inicial da Boutique adotado nesta instalação');
          // identidade da instalação, licença e setores acompanham o banco
          for (const nome of ['instalacao', 'licenca', 'setores']) {
            try {
              const rj = await fetch(`dados-iniciais-${nome}.json`);
              if (rj.ok) {
                const txt = await rj.text();
                if (txt.trim()) await ambiente.escreverTextoDados(`${nome}.json`, txt);
              }
            } catch { /* segue sem este arquivo */ }
          }
          await licenca.iniciar(); // recarrega com os arquivos adotados
        }
      }
    } catch (e) { console.error('[boot] dados iniciais indisponíveis:', e); }
  }
  // ── Rede de segurança do boot (v2.9.0) ────────────────────────────────────
  // Se o banco em disco veio quebrado (tabela essencial ausente) ou vazio
  // tendo backup com dados, o app NÃO abre zerado: volta sozinho para a
  // cópia boa mais recente. O banco ruim é preservado para perícia.
  const _radAtual = bytesExistentes ? await radiografar(bytesExistentes)
                                    : { tabelasOk: false, temDados: false, totalDados: 0 };
  if (bytesExistentes && (!_radAtual.tabelasOk || !_radAtual.temDados)) {
    try {
      const { backups } = await ambiente.listarBackupsLocais(); // mais novo primeiro
      for (const b of backups) {
        let cand;
        try { cand = await ambiente.lerBackupLocal(b.nome); } catch { continue; }
        const r = await radiografar(cand);
        if (!r.tabelasOk || !r.temDados) continue;
        const hora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        await ambiente.copiarBancoPara(
          `${await ambiente.dirDados()}/banco-com-problema-${hora}.db`, bytesExistentes);
        await ambiente.salvarBanco(cand);
        bytesExistentes = cand;
        RECUPERACAO_BOOT = { backup: b.nome, vendas: r.vendas, produtos: r.produtos };
        console.warn(`[recuperação] banco quebrado — restaurado de ${b.nome}`);
        break;
      }
    } catch (e) { console.error('[recuperação] falhou:', e); }
  }
  if (ambiente.RECUPERADO_DE && !RECUPERACAO_BOOT) {
    RECUPERACAO_BOOT = { backup: `gravação interrompida (${ambiente.RECUPERADO_DE})` };
  }

  // Backup diário: só de banco com dados. Um banco quebrado nunca vira backup
  // (era o que transformava o estrago do dia no "backup do dia").
  if (bytesExistentes && (await radiografar(bytesExistentes)).temDados) {
    await ambiente.salvarBackupDiario(bytesExistentes); // 1 cópia/dia, mantém 30
  }

  db = await criarBanco({
    bytes: bytesExistentes,
    schema: await ambiente.carregarSchema(),
    salvarBytes: ambiente.salvarBanco
  });
  // Logo padrão do cupom: aplica se ainda não configurada (logo_cupom ≠ logo do sistema)
  try {
    const logoRow = db.prepare("SELECT valor FROM config WHERE chave='logo_cupom'").get();
    if (!logoRow || !logoRow.valor) {
      db.prepare("INSERT OR REPLACE INTO config (chave, valor) VALUES ('logo_cupom', ?)").run(LOGO_DEFAULT);
    }
  } catch (e) { console.warn('[logo-default]', e); }

  // Migration v2.0.48: recalcular valor_devolvido em devoluções de vendas com desconto geral.
  // O bug pré-v2.0.48 usava o total bruto do item (sem proporcionar desconto_geral da venda).
  try {
    const migrKey = 'migr_fix_dev_desconto_v2048';
    if (!db.prepare("SELECT valor FROM config WHERE chave=?").get(migrKey)) {
      const devsComDesconto = db.prepare(`
        SELECT d.id, d.venda_id, CAST(v.total AS REAL) vtotal, CAST(v.subtotal AS REAL) vsubtotal
        FROM devolucoes d
        JOIN vendas v ON v.id = d.venda_id
        WHERE v.desconto > 0 AND v.subtotal > 0
      `).all();
      const arredM = n => Math.round((Number(n) || 0) * 100) / 100;
      for (const dev of devsComDesconto) {
        const fator = dev.vtotal / dev.vsubtotal;
        const itens = db.prepare(`
          SELECT di.id, di.qtd,
                 CAST(vi.total AS REAL) item_total,
                 CAST(vi.qtd AS REAL) item_qtd_orig
          FROM devolucao_itens di
          JOIN venda_itens vi ON vi.venda_id=? AND vi.variacao_id=di.variacao_id
          WHERE di.devolucao_id=?
        `).all(dev.venda_id, dev.id);
        let novoTotal = 0;
        for (const it of itens) {
          const vu = arredM((it.item_total / it.item_qtd_orig) * fator);
          const tt = arredM(it.qtd * vu);
          db.prepare('UPDATE devolucao_itens SET valor_unit=?, total=? WHERE id=?').run(vu, tt, it.id);
          novoTotal += tt;
        }
        novoTotal = arredM(novoTotal);
        db.prepare('UPDATE devolucoes SET valor_devolvido=? WHERE id=?').run(novoTotal, dev.id);
        console.log(`[migr] dev#${dev.id} corrigida: fator=${fator.toFixed(4)} novo=${novoTotal}`);
      }
      db.prepare("INSERT OR REPLACE INTO config (chave, valor) VALUES (?,?)").run(migrKey, '1');
      console.log('[migr] fix_dev_desconto_v2048 ok');
    }
  } catch (e) { console.warn('[migr] fix_dev_desconto_v2048:', e); }

  // Migration v3.1.0: libera o chat interno para quem já existia.
  // Usuários com permissões personalizadas (JSON gravado) não teriam a chave
  // nova e ficariam sem o balão de mensagens até alguém reeditar cada um.
  try {
    const migrKey = 'migr_mensagens_v310';
    if (!db.prepare('SELECT valor FROM config WHERE chave=?').get(migrKey)) {
      const usuarios = db.prepare(
        "SELECT id, permissoes FROM usuarios WHERE perfil <> 'admin' AND permissoes IS NOT NULL AND permissoes <> ''"
      ).all();
      let n = 0;
      for (const u of usuarios) {
        let lista;
        try { lista = JSON.parse(u.permissoes); } catch { continue; }
        if (!Array.isArray(lista) || lista.includes('mensagens.usar')) continue;
        lista.push('mensagens.usar');
        db.prepare('UPDATE usuarios SET permissoes=? WHERE id=?').run(JSON.stringify(lista), u.id);
        n++;
      }
      db.prepare('INSERT OR REPLACE INTO config (chave, valor) VALUES (?,?)').run(migrKey, '1');
      console.log(`[migr] mensagens_v310 ok (${n} usuário(s) liberados no chat)`);
    }
  } catch (e) { console.warn('[migr] mensagens_v310:', e); }

  // Acesso em rede: prepara a ponte com a extensão e religa se estava ativa
  try {
    rede.preparar(processar);
    const cfgIni = config.obter(db).config;
    if (cfgIni.rede_ativa === '1' && licenca.moduloAtivo('rede')) {
      setTimeout(() => rede.iniciar({ porta: Number(cfgIni.rede_porta) || 8750 })
        .then(r => { if (!r.ok) console.error('[rede]', r.erro); }), 1200);
    }
  } catch (e) { console.error('[rede] preparo falhou:', e); }

  // Backup na nuvem: registra ouvinte OAuth e agenda verificação diária
  try {
    nuvem.registrarOAuthListener();
    // Verifica 5s após o boot e depois a cada hora
    const _checkBackup = async () => {
      try { if (await nuvem.precisaBackupDiario()) await nuvem.fazerBackupTodos(db); }
      catch { /* silencioso — sem internet ou não configurado */ }
    };
    setTimeout(_checkBackup, 5000);
    setInterval(_checkBackup, 3600000);
  } catch (e) { console.error('[nuvem] preparo falhou:', e); }

  // Garante que nenhuma escrita pendente se perca ao fechar o sistema
  // (o index.html chama este gancho quando o usuário clica no X)
  window.__fecharComSalvamento = async () => {
    try { await db.salvarAgora(); } catch (_) {}
    await ambiente.sairApp();
  };
}

export function pronto() {
  if (!_pronto) _pronto = _iniciar();
  return _pronto;
}

// A função que o frontend usa: mesma assinatura da V1.
export async function api(canal, payload) {
  await pronto();
  const r = await processar(canal, payload, sessao);
  // Gerencia sessao APENAS para o app local (terminais em rede usam sessoes Map em rede.js)
  if (canal === 'auth:login'  && r && r.ok) sessao.usuario = r.usuario;
  if (canal === 'auth:logout') sessao.usuario = null;
  return r;
}
