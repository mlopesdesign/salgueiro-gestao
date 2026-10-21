// FILTRO DO ESTOQUE — regra ÚNICA (v3.32.0)
//
// A tela Estoque → Movimentar e as exportações (PDF e Excel) usam esta mesma
// função. Assim o que sai impresso é exatamente o que a tela mostra: se a tela
// está em "Somente consignados · Fabi Leirosa Atelier" ou com "camisa de
// enredo" digitado na busca, o PDF/Excel sai só com isso.
//
// filtro = { tipo: 'todos' | 'proprios' | 'cons', fornecedor_id, termo }
// Cada item precisa de: consignado, fornecedor_id, referencia, codigo_barras e
// o nome do produto em `produto` (tela) ou `nome` (backend).

function _nome(v) { return String(v.produto ?? v.nome ?? ''); }

export function filtroAtivo(f) {
  if (!f) return false;
  return (f.tipo === 'proprios' || f.tipo === 'cons') || !!String(f.termo || '').trim();
}

export function filtrarEstoque(lista, f) {
  if (!filtroAtivo(f)) return lista;
  let r = lista;
  if (f.tipo === 'proprios') r = r.filter(v => !v.consignado);
  else if (f.tipo === 'cons') {
    r = r.filter(v => v.consignado);
    const fid = Number(f.fornecedor_id) || 0;
    if (fid) r = r.filter(v => Number(v.fornecedor_id) === fid);
  }
  const termo = String(f.termo || '').trim();
  if (termo) {
    const t = termo.toLowerCase();
    r = r.filter(v =>
      _nome(v).toLowerCase().includes(t) ||
      String(v.referencia || '').toLowerCase().includes(t) ||
      String(v.codigo_barras || '').includes(termo));
  }
  return r;
}

// Texto curto para o título do PDF, o nome do arquivo e a janela de exportação.
export function descreverFiltro(f, nomeFornecedor) {
  if (!filtroAtivo(f)) return 'Estoque completo';
  const partes = [];
  if (f.tipo === 'proprios') partes.push('Somente da loja');
  if (f.tipo === 'cons') partes.push(Number(f.fornecedor_id) && nomeFornecedor
    ? `Consignados de ${nomeFornecedor}` : 'Somente consignados');
  const termo = String(f.termo || '').trim();
  if (termo) partes.push(`Busca: "${termo}"`);
  return partes.join(' · ');
}
