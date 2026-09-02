// Catálogo de Produtos — tela de geração (v3.18.0)
//
// Layout do catálogo gerado: fluxo contínuo, sempre 4 peças por página.
// As peças saem agrupadas por categoria, mas a categoria NÃO quebra página —
// por isso a tela mostra a contagem de páginas ao vivo: ela é sempre
// ceil(total de peças / 4), independente de quantas categorias entram.

const CSS_CATALOGO = `
.cat-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
.cat-bloco { background: var(--cartao, #fff); border: 1px solid var(--borda); border-radius: 10px; padding: 18px 20px; }
.cat-bloco + .cat-bloco { margin-top: 16px; }
.cat-bloco h3 {
  font-size: 11px; text-transform: uppercase; letter-spacing: .09em;
  opacity: .45; margin: 0 0 14px; font-weight: 700;
}
.cat-bloco-topo { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.cat-bloco-topo h3 { margin: 0; }
.cat-acoes { display: flex; gap: 10px; }
.cat-acoes .botao-link { font-size: 12px; }

.cat-lista { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding-right: 4px; }
.cat-lista .campo-check { padding: 5px 6px; border-radius: 6px; }
.cat-lista .campo-check:hover { background: var(--suave); }
.cat-qt { opacity: .4; font-size: 12px; }

/* Resumo ao vivo — quantas peças e quantas folhas vão sair */
.cat-resumo {
  display: flex; gap: 0; margin-top: 14px;
  border: 1px solid var(--borda); border-radius: 10px; overflow: hidden;
}
.cat-resumo-item { flex: 1; text-align: center; padding: 12px 6px; }
.cat-resumo-item + .cat-resumo-item { border-left: 1px solid var(--borda); }
.cat-resumo-num { font-size: 22px; font-weight: 800; line-height: 1; color: var(--vermelho); }
.cat-resumo-rot { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; opacity: .45; margin-top: 5px; }

/* Prévia — miniaturas A4 em fila, na ordem real do PDF */
.cat-preview { display: flex; gap: 8px; align-items: flex-start; }
.mini {
  flex: 1; aspect-ratio: .707; border: 1px solid var(--borda); border-radius: 4px;
  background: #fff; overflow: hidden; display: flex; flex-direction: column;
}
.mini-rot { font-size: 9px; text-align: center; opacity: .4; margin-top: 5px; letter-spacing: .04em; }
.mini-capa { background: var(--vermelho); align-items: center; justify-content: center; gap: 4px; color: #fff; }
.mini-capa span { font-size: 14px; opacity: .9; }
.mini-capa i { display: block; width: 60%; height: 2px; background: rgba(255,255,255,.45); }
.mini-ind { padding: 6px 5px; gap: 3px; }
.mini-ind i { display: block; height: 4px; background: var(--borda); border-radius: 2px; }
.mini-ind i:nth-child(odd) { width: 85%; }
.mini-gr { padding: 4px; }
.mini-gr-head { height: 4px; background: var(--vermelho); border-radius: 1px; margin-bottom: 4px; opacity: .85; }
.mini-gr-corpo { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 2px; }
.mini-card { border: 1px solid var(--borda); border-radius: 2px; display: flex; flex-direction: column; overflow: hidden; }
.mini-card b { display: block; background: var(--suave); aspect-ratio: 1; }
.mini-card u { display: block; height: 2px; background: var(--borda); margin: 2px 2px 0; border-radius: 1px; }
.cat-nota { font-size: 11px; opacity: .5; margin-top: 12px; text-align: center; line-height: 1.5; }

.cat-gerar {
  width: 100%; margin-top: 16px; padding: 14px; font-size: 15px; font-weight: 700;
  letter-spacing: .02em;
}
.cat-gerar:disabled { opacity: .6; cursor: wait; }

@media (max-width: 900px) { .cat-wrap { grid-template-columns: 1fr; } }
`;

export async function viewCatalogo(alvo, api) {
  alvo.innerHTML = `<div class="painel"><div class="vazio">Carregando categorias…</div></div>`;

  const rCats = await api('catalogo:categorias');
  if (!rCats.ok) {
    alvo.innerHTML = `<div class="painel"><div class="recado erro">Erro ao carregar categorias: ${rCats.erro || '?'}</div></div>`;
    return;
  }
  const cats = rCats.categorias || [];

  if (!document.getElementById('css-catalogo')) {
    const st = document.createElement('style');
    st.id = 'css-catalogo';
    st.textContent = CSS_CATALOGO;
    document.head.appendChild(st);
  }

  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  alvo.innerHTML = `
<div class="painel">
  <div class="painel-topo">
    <h2>📔 Catálogo de Produtos</h2>
  </div>

  <div class="cat-wrap">

    <!-- ── Esquerda: identificação e opções ── -->
    <div>
      <div class="cat-bloco">
        <h3>Identificação</h3>
        <label class="campo">
          <span>Título do catálogo</span>
          <input id="cat-titulo" type="text" value="Catálogo de Produtos" placeholder="Catálogo de Produtos">
        </label>
        <label class="campo" style="margin-top:12px">
          <span>Coleção / temporada <small style="opacity:.5">(opcional)</small></span>
          <input id="cat-colecao" type="text" placeholder="Ex.: Coleção Verão 2027">
        </label>
      </div>

      <div class="cat-bloco">
        <h3>O que aparece em cada peça</h3>
        <label class="campo-check">
          <input id="opt-preco" type="checkbox" checked>
          <span>Preço de venda</span>
        </label>
        <label class="campo-check">
          <input id="opt-ref" type="checkbox" checked>
          <span>Referência (código)</span>
        </label>
        <label class="campo-check">
          <input id="opt-qr" type="checkbox" checked>
          <span>QR code</span>
        </label>
        <label class="campo-check" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--borda)">
          <input id="opt-estoque" type="checkbox">
          <span>Somente peças com estoque</span>
        </label>
      </div>
    </div>

    <!-- ── Direita: categorias, resumo, prévia ── -->
    <div>
      <div class="cat-bloco">
        <div class="cat-bloco-topo">
          <h3>Categorias</h3>
          <div class="cat-acoes">
            <button id="cat-todas" class="botao-link">Todas</button>
            <button id="cat-nenhuma" class="botao-link">Nenhuma</button>
          </div>
        </div>
        <div id="cat-lista" class="cat-lista">
          ${cats.length === 0
            ? `<div class="recado">Nenhuma categoria com produtos ativos.</div>`
            : cats.map(c => `
              <label class="campo-check">
                <input class="cat-cb" type="checkbox" value="${c.id === null ? '__null__' : c.id}" data-qt="${c.total}" checked>
                <span>${esc(c.nome)} <small class="cat-qt">${c.total}</small></span>
              </label>`).join('')}
        </div>

        <div class="cat-resumo">
          <div class="cat-resumo-item">
            <div class="cat-resumo-num" id="rs-cats">0</div>
            <div class="cat-resumo-rot">categorias</div>
          </div>
          <div class="cat-resumo-item">
            <div class="cat-resumo-num" id="rs-pecas">0</div>
            <div class="cat-resumo-rot">peças</div>
          </div>
          <div class="cat-resumo-item">
            <div class="cat-resumo-num" id="rs-pags">0</div>
            <div class="cat-resumo-rot">folhas</div>
          </div>
        </div>
      </div>

      <div class="cat-bloco">
        <h3>Como o PDF sai</h3>
        <div class="cat-preview">
          <div>
            <div class="mini mini-capa"><span>📔</span><i></i></div>
            <div class="mini-rot">Capa</div>
          </div>
          <div>
            <div class="mini mini-ind"><i></i><i></i><i></i><i></i><i></i></div>
            <div class="mini-rot">Índice</div>
          </div>
          <div>
            <div class="mini mini-gr">
              <div class="mini-gr-head"></div>
              <div class="mini-gr-corpo">
                ${[1,2,3,4].map(() => `<div class="mini-card"><b></b><u></u><u style="width:60%"></u></div>`).join('')}
              </div>
            </div>
            <div class="mini-rot">Peças</div>
          </div>
          <div>
            <div class="mini mini-capa"><i></i><span>◀</span></div>
            <div class="mini-rot">Contra-capa</div>
          </div>
        </div>
        <div class="cat-nota">
          Sempre 4 peças por folha, sem folha pela metade.<br>
          As peças saem agrupadas por categoria, na ordem, e o índice diz em que folha cada uma começa.
        </div>
      </div>

      <button id="cat-gerar" class="botao cat-gerar">📄 Gerar Catálogo PDF</button>
    </div>
  </div>
</div>`;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const q = s => alvo.querySelector(s);
  const cbs = () => [...alvo.querySelectorAll('.cat-cb')];

  // Resumo ao vivo. As folhas de peça são ceil(peças / 4) — a categoria não
  // quebra página, então não existe folha extra por causa de categoria pequena.
  // Somam-se capa, índice e contra-capa.
  function atualizarResumo() {
    const marcadas = cbs().filter(cb => cb.checked);
    const pecas = marcadas.reduce((s, cb) => s + Number(cb.dataset.qt || 0), 0);
    const folhasPecas = Math.ceil(pecas / 4);
    q('#rs-cats').textContent  = marcadas.length;
    q('#rs-pecas').textContent = pecas;
    q('#rs-pags').textContent  = pecas ? folhasPecas + 3 : 0;
    q('#cat-gerar').disabled = pecas === 0;
  }

  cbs().forEach(cb => cb.addEventListener('change', atualizarResumo));
  q('#cat-todas').onclick   = () => { cbs().forEach(cb => cb.checked = true);  atualizarResumo(); };
  q('#cat-nenhuma').onclick = () => { cbs().forEach(cb => cb.checked = false); atualizarResumo(); };
  atualizarResumo();

  // ── Gerar ──────────────────────────────────────────────────────────────────
  q('#cat-gerar').onclick = async () => {
    const btn = q('#cat-gerar');
    const marcadas = cbs().filter(cb => cb.checked).map(cb => cb.value === '__null__' ? null : Number(cb.value));
    if (marcadas.length === 0) { alert('Selecione ao menos uma categoria.'); return; }

    btn.disabled = true;
    btn.textContent = '⏳ Gerando PDF… pode levar alguns segundos';

    const r = await api('catalogo:gerar', {
      titulo:      q('#cat-titulo').value.trim() || 'Catálogo de Produtos',
      colecao:     q('#cat-colecao').value.trim(),
      categorias:  marcadas,
      soEstoque:   q('#opt-estoque').checked,
      mostrarPreco: q('#opt-preco').checked,
      mostrarRef:   q('#opt-ref').checked,
      mostrarQr:    q('#opt-qr').checked
    });

    btn.disabled = false;
    btn.textContent = '📄 Gerar Catálogo PDF';

    if (!r.ok) {
      alert('Erro ao gerar catálogo: ' + (r.erro || 'falha desconhecida'));
      return;
    }

    // Download
    const bin = atob(r.buffer);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const titulo = q('#cat-titulo').value.trim().replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'catalogo';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    a.download = `${titulo}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
}
