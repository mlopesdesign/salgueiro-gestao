// Configurações da loja (white-label): identidade visual, dados e preferências
import { auditar } from './util.js';

const PADRAO = {
  loja_nome: 'Boutique do Salgueiro',
  loja_subtitulo: 'Boutique',
  cupom_nome: '',              // nome no cabeçalho do cupom (vazio = usa loja_nome)
  loja_cnpj: '',
  loja_telefone: '',
  loja_endereco: '',
  cupom_rodape: 'Obrigado pela preferência!\nTrocas em até 7 dias com este cupom.',
  cor_primaria: '#B01E23',
  cor_escura: '#7E1114',
  cor_destaque: '#F2C14E',
  logo: '',                // data URI — logo do sistema/sidebar
  logo_cupom: '',          // data URI — logo do cupom térmico (vazio = usa logo)
  impressora_cupom: '',       // nome da impressora para cupom (vazio = dialogo)
  impressora_etiqueta: '',    // nome da impressora para etiquetas (vazio = dialogo)
  rede_ativa: '0',            // '1' = servidor de rede ligado
  rede_porta: '8750',         // porta do servidor de rede
  desconto_avista_ativo: '0', // '1' = desconto automático dinheiro/PIX habilitado
  desconto_avista_percent: '5',   // percentual de desconto (ex: '5' = 5%)
  desconto_avista_minimo: '100',  // valor mínimo da venda para o desconto se aplicar
  vale_validade_dias: '90'        // validade do vale-troca em dias ('0' = sem vencimento)
};

function obter(db) {
  const linhas = db.prepare('SELECT chave, valor FROM config').all();
  const cfg = { ...PADRAO };
  for (const l of linhas) {
    if (l.chave in cfg || l.chave.startsWith('impressora_')) cfg[l.chave] = l.valor;
  }
  return { ok: true, config: cfg };
}

function salvar(db, p, quem) {
  if (!quem || quem.perfil !== 'admin') return { ok: false, erro: 'Apenas administradores.' };
  const entradas = Object.entries(p || {}).filter(([k]) => k in PADRAO || k.startsWith('impressora_'));
  if (!entradas.length) return { ok: false, erro: 'Nada para salvar.' };

  // valida cores (hex) e tamanho da logo (max ~2MB em base64)
  for (const [k, v] of entradas) {
    if (k.startsWith('cor_') && !/^#[0-9A-Fa-f]{6}$/.test(String(v))) {
      return { ok: false, erro: `Cor inválida em ${k}.` };
    }
    if ((k === 'logo' || k === 'logo_cupom') && String(v).length > 2.8e6) {
      return { ok: false, erro: 'Logo muito grande (máx. ~2 MB). Use um PNG menor.' };
    }
    if ((k === 'logo' || k === 'logo_cupom') && v && !String(v).startsWith('data:image/')) {
      return { ok: false, erro: 'Formato de logo inválido.' };
    }
  }
  const up = db.prepare('INSERT INTO config (chave, valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor');
  for (const [k, v] of entradas) up.run(k, String(v ?? ''));

  auditar(db, quem, 'config.salvar', entradas.map(([k]) => k).join(', '));
  return { ok: true, config: obter(db).config };
}

export { obter, salvar };