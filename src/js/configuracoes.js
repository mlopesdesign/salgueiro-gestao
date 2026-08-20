// Configurações — identidade visual (white-label), dados da loja e usuários
import { api, el, esc, toast, modal, getConfig, aplicarTema, recarregarConfig, setorAtivo, EM_REDE } from './app.js';
import { htmlNovidades, CSS_NOVIDADES } from './novidades.js';

const PRESETS = [
  { nome: 'Salgueiro',      primaria: '#B01E23', escura: '#7E1114', destaque: '#F2C14E' },
  { nome: 'Vinho & Ouro',   primaria: '#7B2D3B', escura: '#5E1F2C', destaque: '#B8924A' },
  { nome: 'Azul Royal',     primaria: '#1E4FB0', escura: '#123272', destaque: '#F2C14E' },
  { nome: 'Verde Esmeralda',primaria: '#1E7D52', escura: '#12513A', destaque: '#D9B25F' },
  { nome: 'Rosa Boutique',  primaria: '#C2447A', escura: '#8A2B56', destaque: '#E8C39A' },
  { nome: 'Preto Elegante', primaria: '#2B2B2B', escura: '#111111', destaque: '#C9A24B' }
];

export async function viewConfiguracoes(alvo) {
  const tela = el(`
    <div>
      <div class="pagina-topo"><h1>Configurações</h1></div>
      <div class="abas">
        <button data-aba="aparencia" class="ativa">Aparência</button>
        <button data-aba="loja">Dados da loja</button>
        <button data-aba="lojas">🏬 Lojas</button>
        ${setorAtivo('pontos') ? '<button data-aba="pontos">🎁 Pontos</button>' : ''}
        ${setorAtivo('nuvem') ? '<button data-aba="nuvem">☁️ Nuvem</button>' : ''}
        <button data-aba="backup">💾 Backup</button>
        ${setorAtivo('rede') ? '<button data-aba="rede">🌐 Rede</button>' : ''}
        <button data-aba="pdv">🛒 PDV</button>
        <button data-aba="relatorios">📊 Relatórios</button>
        <button data-aba="impressoras">🖨️ Impressoras</button>
        <button data-aba="licenca">📜 Licença</button>
        <button data-aba="atualizacao">🔄 Atualização</button>
        <button data-aba="usuarios">Usuários</button>
        <button data-aba="clientes">👥 Categorias de clientes</button>
      </div>
      <div id="aba-conteudo"></div>
    </div>`);
  const corpo = tela.querySelector('#aba-conteudo');
  const abas = { aparencia: abaAparencia, loja: abaLoja, lojas: abaLojas, pontos: abaPontos, usuarios: abaUsuarios, nuvem: abaNuvem, backup: abaBackup, rede: abaRede, licenca: abaLicenca, pdv: abaPdv, relatorios: abaRelatorios, impressoras: abaImpressoras, atualizacao: abaAtualizacao, clientes: abaCategoriaClientes };
  tela.querySelectorAll('.abas button').forEach(b => {
    b.onclick = () => {
      tela.querySelectorAll('.abas button').forEach(x => x.classList.toggle('ativa', x === b));
      corpo.innerHTML = ''; abas[b.dataset.aba](corpo);
    };
  });
  alvo.appendChild(tela);
  abaAparencia(corpo);
}

// ---------- Aparência ----------
function abaAparencia(corpo) {
  const cfg = getConfig();
  const painel = el(`
    <div class="painel" style="padding:22px;max-width:680px">
      <div class="linha-2">
        <div class="campo"><label>Nome da loja (menu lateral / sistema)</label>
          <input id="ap-nome" value="${esc(cfg.loja_nome)}"></div>
        <div class="campo"><label>Subtítulo (menu lateral)</label>
          <input id="ap-sub" value="${esc(cfg.loja_subtitulo)}"></div>
      </div>
      <div class="campo"><label>Nome no cupom térmico <small style="color:var(--texto-suave)">(vazio = usa o nome da loja acima)</small></label>
        <input id="ap-cupom-nome" value="${esc(cfg.cupom_nome)}" placeholder="${esc(cfg.loja_nome)}"></div>

      <div class="linha-2" style="margin-top:6px">
        <div class="campo"><label>🖥️ Logo do sistema (menu lateral)</label>
          <div style="display:flex;align-items:center;gap:10px">
            <img id="ap-logo-prev" src="${cfg.logo || ''}"
              style="width:56px;height:56px;object-fit:contain;border:1px dashed var(--borda);border-radius:8px;${cfg.logo ? '' : 'visibility:hidden'}">
            <div style="display:flex;flex-direction:column;gap:6px">
              <input type="file" id="ap-logo" accept="image/png,image/jpeg,image/webp">
              <button class="btn btn-suave" id="ap-logo-rm" type="button" style="align-self:flex-start">Remover</button>
            </div>
          </div></div>
        <div class="campo"><label>🖨️ Logo do cupom térmico</label>
          <div style="display:flex;align-items:center;gap:10px">
            <img id="ap-cupom-logo-prev" src="${cfg.logo_cupom || ''}"
              style="width:56px;height:56px;object-fit:contain;border:1px dashed var(--borda);border-radius:8px;${cfg.logo_cupom ? '' : 'visibility:hidden'}">
            <div style="display:flex;flex-direction:column;gap:6px">
              <input type="file" id="ap-cupom-logo" accept="image/png,image/jpeg,image/webp">
              <button class="btn btn-suave" id="ap-cupom-logo-rm" type="button" style="align-self:flex-start">Remover</button>
            </div>
          </div>
          <small style="color:var(--texto-suave)">PNG quadrado ≥300×300px, fundo transparente.</small></div>
      </div>

      <div class="campo" style="margin-top:6px">
        <label>🪟 Ícone do aplicativo (barra de tarefas e atalho)</label>
        <div style="display:flex;align-items:center;gap:12px;border:1px solid var(--borda);
          border-radius:8px;padding:10px 12px">
          <img id="ap-icone-prev" alt=""
            style="width:48px;height:48px;object-fit:contain;border:1px dashed var(--borda);
            border-radius:8px;visibility:hidden">
          <div style="display:flex;flex-direction:column;gap:6px;flex:1">
            <input type="file" id="ap-icone" accept="image/png,image/x-icon,image/vnd.microsoft.icon,.ico">
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn btn-suave" id="ap-icone-rm" type="button">Voltar ao padrão</button>
              <span id="ap-icone-status" style="font-size:12px;color:var(--texto-suave)"></span>
            </div>
          </div>
        </div>
        <small style="color:var(--texto-suave)">
          Aceita .ico ou PNG quadrado (convertido automaticamente). O ícone fica guardado na pasta de dados —
          atualizações do sistema não apagam mais.</small>
      </div>

      <div class="campo" style="margin-top:6px"><label>Temas prontos</label>
        <div id="ap-presets" style="display:flex;gap:8px;flex-wrap:wrap"></div></div>

      <div class="linha-3">
        <div class="campo"><label>Cor principal</label><input id="ap-cor1" type="color" value="${cfg.cor_primaria}" style="height:42px"></div>
        <div class="campo"><label>Cor escura (menu)</label><input id="ap-cor2" type="color" value="${cfg.cor_escura}" style="height:42px"></div>
        <div class="campo"><label>Cor de destaque</label><input id="ap-cor3" type="color" value="${cfg.cor_destaque}" style="height:42px"></div>
      </div>

      <div class="erro" id="ap-erro"></div>
      <button class="btn btn-primario" id="ap-salvar">Salvar aparência</button>
      <p style="color:var(--texto-suave);font-size:12px;margin-top:10px">
        As cores são aplicadas na hora, em todo o sistema, no cupom e nas etiquetas.</p>
    </div>`);

  let logoData = cfg.logo || '';
  let logoCupomData = cfg.logo_cupom || '';

  function bindLogo(inputId, rmId, prevId, getSet) {
    const prev = painel.querySelector('#' + prevId);
    painel.querySelector('#' + inputId).addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { toast('Imagem muito grande (máx. 2 MB).', true); return; }
      const leitor = new FileReader();
      leitor.onload = () => { getSet(leitor.result); prev.src = leitor.result; prev.style.visibility = 'visible'; };
      leitor.readAsDataURL(f);
    });
    painel.querySelector('#' + rmId).onclick = () => {
      getSet(''); prev.src = ''; prev.style.visibility = 'hidden';
      painel.querySelector('#' + inputId).value = '';
    };
  }
  bindLogo('ap-logo', 'ap-logo-rm', 'ap-logo-prev', v => { logoData = v; });
  bindLogo('ap-cupom-logo', 'ap-cupom-logo-rm', 'ap-cupom-logo-prev', v => { logoCupomData = v; });

  // ---------- Ícone do aplicativo ----------
  const icPrev = painel.querySelector('#ap-icone-prev');
  const icInp = painel.querySelector('#ap-icone');
  const icRm = painel.querySelector('#ap-icone-rm');
  const icSt = painel.querySelector('#ap-icone-status');

  async function atualizarStatusIcone() {
    const r = await api('config:iconeStatus');
    if (r?.ok && r.personalizado) {
      icSt.textContent = '✅ Ícone personalizado ativo';
      icRm.style.display = '';
    } else {
      icSt.textContent = 'Usando o ícone padrão do sistema';
      icRm.style.display = 'none';
      icPrev.style.visibility = 'hidden';
    }
  }
  atualizarStatusIcone();

  // Monta um arquivo .ico (PNG embutido) a partir de um canvas 256×256.
  // Formato ICO permite PNG puro dentro do container desde o Vista.
  function pngParaIco(pngBytes, lado) {
    const cab = new Uint8Array(6 + 16);
    const dv = new DataView(cab.buffer);
    dv.setUint16(0, 0, true);            // reservado
    dv.setUint16(2, 1, true);            // tipo 1 = ícone
    dv.setUint16(4, 1, true);            // 1 imagem
    cab[6] = lado >= 256 ? 0 : lado;     // largura (0 = 256)
    cab[7] = lado >= 256 ? 0 : lado;     // altura
    cab[8] = 0;                          // cores da paleta
    cab[9] = 0;                          // reservado
    dv.setUint16(10, 1, true);           // planos
    dv.setUint16(12, 32, true);          // bits por pixel
    dv.setUint32(14, pngBytes.length, true); // tamanho da imagem
    dv.setUint32(18, 22, true);          // offset dos dados
    const out = new Uint8Array(22 + pngBytes.length);
    out.set(cab, 0);
    out.set(pngBytes, 22);
    return out;
  }

  const b64 = bytes => {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  };

  icInp.addEventListener('change', async () => {
    const f = icInp.files[0];
    if (!f) return;
    const ehIco = /\.ico$/i.test(f.name) || /icon/i.test(f.type);
    try {
      let dadosB64;
      if (ehIco) {
        // .ico já pronto — envia como está
        const buf = new Uint8Array(await f.arrayBuffer());
        dadosB64 = b64(buf);
        icPrev.src = URL.createObjectURL(f);
      } else {
        // PNG/JPG → redesenha em 256×256 e empacota como .ico
        const url = URL.createObjectURL(f);
        const img = await new Promise((ok, err) => {
          const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = url;
        });
        const cv = document.createElement('canvas');
        cv.width = 256; cv.height = 256;
        const ctx = cv.getContext('2d');
        // mantém proporção, centralizado, fundo transparente
        const escala = Math.min(256 / img.width, 256 / img.height);
        const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
        ctx.drawImage(img, (256 - w) / 2, (256 - h) / 2, w, h);
        icPrev.src = cv.toDataURL('image/png');
        const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
        const png = new Uint8Array(await blob.arrayBuffer());
        dadosB64 = b64(pngParaIco(png, 256));
        URL.revokeObjectURL(url);
      }
      icPrev.style.visibility = '';
      const r = await api('config:definirIcone', { dados: dadosB64 });
      if (!r.ok) { toast(r.erro, true); return; }
      toast('Ícone aplicado! Se a barra de tarefas não mudar na hora, reinicie o aplicativo.');
      atualizarStatusIcone();
    } catch (e) {
      toast('Não foi possível ler a imagem: ' + (e.message || e), true);
    }
  });

  icRm.onclick = async () => {
    const r = await api('config:removerIcone');
    if (!r.ok) { toast(r.erro, true); return; }
    icInp.value = '';
    icPrev.src = ''; icPrev.style.visibility = 'hidden';
    toast('Voltou ao ícone padrão.');
    atualizarStatusIcone();
  };

  const presets = painel.querySelector('#ap-presets');
  for (const p of PRESETS) {
    const b = el(`<button type="button" class="btn btn-suave" style="gap:8px">
      <span style="display:inline-flex;gap:2px">
        <i style="width:14px;height:14px;border-radius:3px;background:${p.primaria}"></i>
        <i style="width:14px;height:14px;border-radius:3px;background:${p.escura}"></i>
        <i style="width:14px;height:14px;border-radius:3px;background:${p.destaque}"></i>
      </span>${esc(p.nome)}</button>`);
    b.onclick = () => {
      painel.querySelector('#ap-cor1').value = p.primaria;
      painel.querySelector('#ap-cor2').value = p.escura;
      painel.querySelector('#ap-cor3').value = p.destaque;
    };
    presets.appendChild(b);
  }

  painel.querySelector('#ap-salvar').onclick = async () => {
    const r = await api('config:salvar', {
      loja_nome: painel.querySelector('#ap-nome').value.trim() || 'Minha Loja',
      loja_subtitulo: painel.querySelector('#ap-sub').value.trim(),
      cupom_nome: painel.querySelector('#ap-cupom-nome').value.trim(),
      logo: logoData,
      logo_cupom: logoCupomData,
      cor_primaria: painel.querySelector('#ap-cor1').value,
      cor_escura: painel.querySelector('#ap-cor2').value,
      cor_destaque: painel.querySelector('#ap-cor3').value
    });
    if (!r.ok) { painel.querySelector('#ap-erro').textContent = r.erro; return; }
    await recarregarConfig();
    aplicarTema();
    toast('Aparência salva e aplicada. ✨');
  };
  corpo.appendChild(painel);
}

// ---------- Dados da loja ----------
// ---------- PDV ----------
function abaPdv(corpo) {
  const cfg = getConfig();
  const painel = el(`
    <div class="painel" style="padding:22px;max-width:600px">
      <h3 style="margin:0 0 18px;font-size:15px">Desconto automático Dinheiro / PIX</h3>
      <p style="color:var(--texto-suave);font-size:13px;margin:0 0 18px">
        Quando habilitado, vendas pagas <b>inteiramente em dinheiro ou PIX</b>
        acima do valor mínimo recebem desconto automático sem precisar de autorização.
      </p>
      <div class="linha-2" style="align-items:center;margin-bottom:14px">
        <div class="campo" style="margin:0">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input id="pdv-avista-ativo" type="checkbox" style="width:18px;height:18px;cursor:pointer"
              ${cfg.desconto_avista_ativo === '1' ? 'checked' : ''}>
            <span>Habilitar desconto à vista</span>
          </label>
        </div>
      </div>
      <div class="linha-2" id="pdv-avista-campos" style="${cfg.desconto_avista_ativo === '1' ? '' : 'opacity:.4;pointer-events:none'}">
        <div class="campo">
          <label>Desconto (%)</label>
          <input id="pdv-avista-pct" type="number" min="1" max="50" step="0.5"
            value="${esc(cfg.desconto_avista_percent || '5')}" placeholder="5">
        </div>
        <div class="campo">
          <label>Valor mínimo da venda (R$)</label>
          <input id="pdv-avista-min" type="number" min="1" step="1"
            value="${esc(cfg.desconto_avista_minimo || '100')}" placeholder="100">
        </div>
      </div>
      <div class="erro" id="pdv-erro"></div>
      <button class="btn btn-primario" id="pdv-salvar" style="margin-top:14px">Salvar</button>
      <p style="color:var(--texto-suave);font-size:12px;margin-top:10px">
        O desconto aparece automaticamente no modal de pagamento quando todas as formas
        são Dinheiro ou PIX e o total atinge o mínimo. Fica registrado na venda.
      </p>

      <hr style="border:none;border-top:1px solid var(--borda);margin:22px 0">

      <h3 style="margin:0 0 10px;font-size:15px">Validade do vale-troca</h3>
      <p style="color:var(--texto-suave);font-size:13px;margin:0 0 14px">
        Quando uma troca deixa diferença a favor da cliente e você escolhe emitir
        vale-troca, o vale nasce com esta validade. Depois do vencimento o sistema
        recusa o código no pagamento.
      </p>
      <div class="campo" style="max-width:260px">
        <label>Dias de validade (0 = sem vencimento)</label>
        <input id="pdv-vale-dias" type="number" min="0" max="3650" step="1"
          value="${esc(cfg.vale_validade_dias || '90')}" placeholder="90">
      </div>
      <div class="erro" id="pdv-vale-erro"></div>
      <button class="btn btn-primario" id="pdv-vale-salvar" style="margin-top:6px">Salvar validade</button>
      <p style="color:var(--texto-suave);font-size:12px;margin-top:10px">
        A mudança vale para os vales emitidos <b>daqui em diante</b>. Vales já
        emitidos mantêm a data que receberam.
      </p>

      <hr style="border:none;border-top:1px solid var(--borda);margin:22px 0">

      <h3 style="margin:0 0 10px;font-size:15px">Taxas da maquininha</h3>
      <p style="color:var(--texto-suave);font-size:13px;margin:0 0 14px">
        São os percentuais que a operadora cobra em cada forma de pagamento.
        O sistema usa estes valores para calcular o <b>líquido a receber</b> no
        relatório de evento. Já vêm preenchidos com as taxas da Mercado Pago
        Smart 2 — só mexa se a operadora reajustar ou se você trocar de máquina.
      </p>
      <div class="linha-3">
        <div class="campo"><label>Pix na chave (%)</label>
          <input id="tx-pix-chave" type="number" min="0" max="100" step="0.01"
            value="${esc(cfg.taxa_pix_chave ?? '0')}" placeholder="0"></div>
        <div class="campo"><label>Pix na maquininha (%)</label>
          <input id="tx-pix-maq" type="number" min="0" max="100" step="0.01"
            value="${esc(cfg.taxa_pix_maquina ?? '0.49')}" placeholder="0,49"></div>
        <div class="campo"><label>Débito (%)</label>
          <input id="tx-debito" type="number" min="0" max="100" step="0.01"
            value="${esc(cfg.taxa_debito ?? '0.99')}" placeholder="0,99"></div>
      </div>
      <div class="linha-2">
        <div class="campo"><label>Crédito à vista (%)</label>
          <input id="tx-cred-vista" type="number" min="0" max="100" step="0.01"
            value="${esc(cfg.taxa_credito_vista ?? '3.05')}" placeholder="3,05"></div>
        <div class="campo"><label>Crédito parcelado 2x a 6x (%)</label>
          <input id="tx-cred-parc" type="number" min="0" max="100" step="0.01"
            value="${esc(cfg.taxa_credito_parcelado ?? '3.25')}" placeholder="3,25"></div>
      </div>
      <div class="erro" id="tx-erro"></div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:6px">
        <button class="btn btn-primario" id="tx-salvar">Salvar taxas</button>
        <button class="btn btn-suave" id="tx-padrao">Restaurar padrão</button>
      </div>
      <p style="color:var(--texto-suave);font-size:12px;margin-top:10px">
        A taxa é calculada <b>por transação</b> e arredondada em cada uma, como a
        operadora cobra. Mudar aqui vale para <b>todo relatório gerado a partir
        de agora</b>, inclusive de eventos passados — o sistema não guarda a taxa
        junto da venda, ele recalcula na hora.
      </p>
    </div>`);

  // ---- Taxas da maquininha (v3.12.0) ----
  const TX_PADRAO = { 'tx-pix-chave': '0', 'tx-pix-maq': '0.49', 'tx-debito': '0.99',
                      'tx-cred-vista': '3.05', 'tx-cred-parc': '3.25' };
  painel.querySelector('#tx-padrao').onclick = () => {
    for (const [id, v] of Object.entries(TX_PADRAO)) painel.querySelector('#' + id).value = v;
    painel.querySelector('#tx-erro').textContent = '';
    toast('Valores da Mercado Pago Smart 2 preenchidos. Clique em Salvar taxas para gravar.');
  };
  painel.querySelector('#tx-salvar').onclick = async () => {
    const $e = painel.querySelector('#tx-erro');
    const campos = {
      taxa_pix_chave: painel.querySelector('#tx-pix-chave').value,
      taxa_pix_maquina: painel.querySelector('#tx-pix-maq').value,
      taxa_debito: painel.querySelector('#tx-debito').value,
      taxa_credito_vista: painel.querySelector('#tx-cred-vista').value,
      taxa_credito_parcelado: painel.querySelector('#tx-cred-parc').value
    };
    for (const [k, v] of Object.entries(campos)) {
      const n = Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        $e.textContent = 'Informe um percentual entre 0 e 100 em todos os campos.';
        return;
      }
      campos[k] = String(n);
    }
    const r = await api('config:salvar', campos);
    if (!r.ok) { $e.textContent = r.erro; return; }
    $e.textContent = '';
    await recarregarConfig();
    toast('Taxas salvas. Gere o relatório de evento de novo para ver o efeito.');
  };

  const $cb = painel.querySelector('#pdv-avista-ativo');
  const $campos = painel.querySelector('#pdv-avista-campos');
  $cb.addEventListener('change', () => {
    $campos.style.opacity = $cb.checked ? '' : '.4';
    $campos.style.pointerEvents = $cb.checked ? '' : 'none';
  });

  painel.querySelector('#pdv-salvar').onclick = async () => {
    const pct = Number(painel.querySelector('#pdv-avista-pct').value) || 0;
    const min = Number(painel.querySelector('#pdv-avista-min').value) || 0;
    if ($cb.checked && (pct <= 0 || pct > 50)) {
      painel.querySelector('#pdv-erro').textContent = 'Percentual deve estar entre 1% e 50%.'; return;
    }
    if ($cb.checked && min <= 0) {
      painel.querySelector('#pdv-erro').textContent = 'Valor mínimo inválido.'; return;
    }
    painel.querySelector('#pdv-erro').textContent = '';
    const r = await api('config:salvar', {
      desconto_avista_ativo: $cb.checked ? '1' : '0',
      desconto_avista_percent: String(pct),
      desconto_avista_minimo: String(min)
    });
    if (!r.ok) { painel.querySelector('#pdv-erro').textContent = r.erro; return; }
    await recarregarConfig();
    toast($cb.checked
      ? `✅ Desconto de ${pct}% habilitado para vendas acima de R$ ${min.toFixed(2)}.`
      : 'Desconto à vista desabilitado.');
  };

  painel.querySelector('#pdv-vale-salvar').onclick = async () => {
    const $err = painel.querySelector('#pdv-vale-erro');
    const dias = Math.round(Number(painel.querySelector('#pdv-vale-dias').value));
    if (!isFinite(dias) || dias < 0 || dias > 3650) {
      $err.textContent = 'Informe um número de dias entre 0 e 3650.'; return;
    }
    $err.textContent = '';
    const r = await api('config:salvar', { vale_validade_dias: String(dias) });
    if (!r.ok) { $err.textContent = r.erro; return; }
    await recarregarConfig();
    toast(dias === 0
      ? 'Vales-troca passam a ser emitidos sem vencimento.'
      : `✅ Vales-troca passam a valer por ${dias} dias.`);
  };

  corpo.appendChild(painel);
}

// ---------- Relatórios ----------
function abaRelatorios(corpo) {
  const cfg = getConfig();
  const painel = el(`
    <div class="painel" style="padding:22px;max-width:600px">
      <h3 style="margin:0 0 18px;font-size:15px">Cards do relatório de evento</h3>
      <p style="color:var(--texto-suave);font-size:13px;margin:0 0 18px">
        Controla se os cards de resumo exibem a linha de detalhe abaixo do valor —
        a quantidade de peças e o valor de tabela (bruto, sem descontos).
      </p>
      <div class="campo" style="margin:0 0 18px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input id="rel-cards-detalhe" type="checkbox" style="width:18px;height:18px;cursor:pointer"
            ${cfg.relatorio_cards_detalhe !== '0' ? 'checked' : ''}>
          <span>Exibir detalhe nos cards (qtd de peças · valor de tabela)</span>
        </label>
      </div>
      <div class="erro" id="rel-erro"></div>
      <button class="btn btn-primario" id="rel-salvar">Salvar</button>
    </div>`);

  painel.querySelector('#rel-salvar').onclick = async () => {
    const ativo = painel.querySelector('#rel-cards-detalhe').checked ? '1' : '0';
    const r = await api('config:salvar', { relatorio_cards_detalhe: ativo });
    if (!r.ok) { painel.querySelector('#rel-erro').textContent = r.erro; return; }
    toast('Configuração salva. ✔');
  };

  corpo.appendChild(painel);
}

function abaLoja(corpo) {
  const cfg = getConfig();
  const painel = el(`
    <div class="painel" style="padding:22px;max-width:680px">
      <div class="linha-2">
        <div class="campo"><label>CNPJ</label><input id="lj-cnpj" value="${esc(cfg.loja_cnpj)}"></div>
        <div class="campo"><label>Telefone/WhatsApp</label><input id="lj-tel" value="${esc(cfg.loja_telefone)}"></div>
      </div>
      <div class="campo"><label>Endereço</label><input id="lj-end" value="${esc(cfg.loja_endereco)}"></div>
      <div class="campo"><label>Mensagem no rodapé do cupom</label>
        <textarea id="lj-rodape" rows="3"
          style="width:100%;padding:9px 12px;border:1px solid var(--borda);border-radius:8px;font:inherit">${esc(cfg.cupom_rodape)}</textarea></div>
      <div class="erro" id="lj-erro"></div>
      <button class="btn btn-primario" id="lj-salvar">Salvar dados</button>
      <p style="color:var(--texto-suave);font-size:12px;margin-top:10px">
        CNPJ, telefone e endereço aparecem no cabeçalho do cupom quando preenchidos.</p>
    </div>`);
  painel.querySelector('#lj-salvar').onclick = async () => {
    const r = await api('config:salvar', {
      loja_cnpj: painel.querySelector('#lj-cnpj').value.trim(),
      loja_telefone: painel.querySelector('#lj-tel').value.trim(),
      loja_endereco: painel.querySelector('#lj-end').value.trim(),
      cupom_rodape: painel.querySelector('#lj-rodape').value
    });
    if (!r.ok) { painel.querySelector('#lj-erro').textContent = r.erro; return; }
    await recarregarConfig();
    toast('Dados da loja salvos.');
  };
  corpo.appendChild(painel);
}

// ---------- Usuários ----------
// ---------- Lojas (unidades) ----------
async function abaLojas(corpo) {
  const painel = el(`
    <div>
      <p style="color:var(--texto-suave);margin:0 0 12px">
        Cadastre suas unidades (Loja 1, Loja 2…). Cada caixa é aberto para uma loja, e a
        receita fica separada por loja nos relatórios — a receita total continua somando todas.
      </p>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primario" id="nova-loja">+ Nova loja</button></div>
      <div class="painel"><table>
        <thead><tr><th>Loja</th><th>Estoque vinculado</th><th class="num">Caixas</th><th></th><th style="width:150px"></th></tr></thead>
        <tbody></tbody></table></div>
      <div class="erro" id="lojas-erro" style="margin-top:10px"></div>
    </div>`);
  const tbody = painel.querySelector('tbody');
  const erro = painel.querySelector('#lojas-erro');

  async function carregar() {
    erro.textContent = '';
    const r = await api('lojas:listar', { todas: true });
    tbody.innerHTML = '';
    if (!r.ok) { erro.textContent = r.erro; return; }
    if (!r.lojas.length) { tbody.appendChild(el('<tr><td colspan="5" class="vazio">Nenhuma loja.</td></tr>')); return; }
    for (const l of r.lojas) {
      const nomeEst = l.estoque_nome
        ? (l.estoque_principal ? `${esc(l.estoque_nome)} <span style="font-size:10px;color:var(--texto-suave)">(central)</span>` : esc(l.estoque_nome))
        : '<span style="color:var(--texto-suave);font-size:11px">— usa central —</span>';
      const tr = el(`<tr>
        <td><b>${esc(l.nome)}</b></td>
        <td style="font-size:12px">${nomeEst}</td>
        <td class="num">${l.qtd_caixas || 0}</td>
        <td>${l.ativo ? '<span class="pill pill-ok">ativa</span>' : '<span class="pill pill-baixo">inativa</span>'}</td>
        <td class="acoes-linha">
          <button data-a="editar">Editar</button>
          ${l.ativo ? '<button data-a="excluir" style="color:var(--vermelho)">Excluir</button>' : ''}
        </td></tr>`);
      tr.querySelector('[data-a=editar]').onclick = () => formLoja(l, carregar);
      const ex = tr.querySelector('[data-a=excluir]');
      if (ex) ex.onclick = async () => {
        if (!confirm(`Excluir/desativar a loja "${l.nome}"?`)) return;
        const r2 = await api('lojas:excluir', { id: l.id });
        r2.ok ? (toast('Loja atualizada.'), carregar()) : (erro.textContent = r2.erro);
      };
      tbody.appendChild(tr);
    }
  }
  painel.querySelector('#nova-loja').onclick = () => formLoja(null, carregar);
  corpo.appendChild(painel);
  carregar();
}

async function formLoja(l, aoConcluir) {
  // carrega estoques antes de abrir o modal
  const re = await api('estoques:listar', { todos: false });
  const estoquesList = (re.ok && re.estoques) ? re.estoques : [];

  // monta opções do select
  // — ao criar: primeira opção é "Criar estoque próprio" (valor 'proprio')
  // — ao editar: sem essa opção (estoque próprio já existe ou foi definido)
  let opcoesHtml = '';
  if (!l) opcoesHtml += '<option value="proprio">Criar estoque próprio</option>';
  for (const e of estoquesList) {
    const label = e.principal ? `${esc(e.nome)} (central)` : esc(e.nome);
    const sel = l && l.estoque_id === e.id ? ' selected' : '';
    opcoesHtml += `<option value="${e.id}"${sel}>${label}</option>`;
  }

  modal(l ? 'Editar loja' : 'Nova loja', `
    <div class="campo"><label>Nome da loja</label>
      <input id="lj-nome" type="text" maxlength="60" value="${l ? esc(l.nome) : ''}" placeholder="Ex.: Loja 1 - Centro"></div>
    <div class="campo"><label>Estoque desta loja</label>
      <select id="lj-estoque">${opcoesHtml}</select>
      <small style="color:var(--texto-suave);margin-top:4px;display:block">
        Qual estoque é debitado ao vender nesta loja.
        "Loja WhatsApp" pode usar o mesmo estoque da loja física, por exemplo.</small></div>
    <div class="erro" id="lj-erro"></div>
  `, async (wrap, fechar) => {
    const nome = wrap.querySelector('#lj-nome').value.trim();
    if (!nome) { wrap.querySelector('#lj-erro').textContent = 'Informe o nome da loja.'; return; }
    const estoqueId = wrap.querySelector('#lj-estoque').value; // 'proprio' ou número
    const payload = { id: l ? l.id : undefined, nome, estoque_id: estoqueId };
    const r = await api('lojas:salvar', payload);
    if (!r.ok) { wrap.querySelector('#lj-erro').textContent = r.erro; return; }
    toast('Loja salva.'); fechar(); aoConcluir && aoConcluir();
  }, 'Salvar');
}

async function abaUsuarios(corpo) {
  const r = await api('auth:listarUsuarios');
  const painel = el(`
    <div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primario" id="novo-usr">+ Novo usuário</button></div>
      <div class="painel"><table>
        <thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th></th><th style="width:100px"></th></tr></thead>
        <tbody></tbody></table></div>
    </div>`);
  const tbody = painel.querySelector('tbody');
  const perfis = { admin: 'Administrador', caixa: 'Caixa', estoque: 'Estoquista' };
  for (const u of (r.ok ? r.usuarios : [])) {
    const tr = el(`<tr>
      <td><b>${esc(u.nome)}</b></td><td>${esc(u.usuario)}</td>
      <td>${perfis[u.perfil] || esc(u.perfil)}</td>
      <td>${u.ativo ? '<span class="pill pill-ok">ativo</span>' : '<span class="pill pill-baixo">inativo</span>'}</td>
      <td class="acoes-linha"><button>Editar</button></td></tr>`);
    tr.querySelector('button').onclick = () => formUsuario(u, () => { corpo.innerHTML = ''; abaUsuarios(corpo); });
    tbody.appendChild(tr);
  }
  painel.querySelector('#novo-usr').onclick = () => formUsuario(null, () => { corpo.innerHTML = ''; abaUsuarios(corpo); });
  corpo.appendChild(painel);
}

async function formUsuario(u, aoConcluir) {
  const cat = await api('permissoes:catalogo');
  const catalogo = cat.ok ? cat.catalogo : [];
  const defaults = cat.ok ? cat.defaults : {};
  const grupos = {};
  for (const p of catalogo) { (grupos[p.grupo] = grupos[p.grupo] || []).push(p); }
  const marcadas = new Set(u ? (u.permissoes_efetivas || []) : (defaults.caixa || []));
  const matriz = Object.entries(grupos).map(([g, itens]) => `
    <div class="perm-grupo">
      <h4>${esc(g)}</h4>
      ${itens.map(p => `<label class="perm-item"><input type="checkbox" class="perm-chk" value="${esc(p.chave)}" ${marcadas.has(p.chave) ? 'checked' : ''}> ${esc(p.rotulo)}</label>`).join('')}
    </div>`).join('');

  const m = modal(u ? `Editar — ${esc(u.nome)}` : 'Novo usuário', `
    <div class="linha-2">
      <div class="campo"><label>Nome *</label><input id="u-nome" value="${esc(u?.nome || '')}"></div>
      <div class="campo"><label>Usuário (login) *</label><input id="u-usuario" value="${esc(u?.usuario || '')}"></div>
    </div>
    <div class="linha-2">
      <div class="campo"><label>Perfil (modelo)</label>
        <select id="u-perfil">
          <option value="caixa" ${u?.perfil === 'caixa' ? 'selected' : ''}>Vendedor (vende, não vê custos)</option>
          <option value="estoque" ${u?.perfil === 'estoque' ? 'selected' : ''}>Estoquista</option>
          <option value="admin" ${u?.perfil === 'admin' ? 'selected' : ''}>Administrador (acesso total)</option>
        </select></div>
      <div class="campo"><label>${u ? 'Nova senha (deixe vazio p/ manter)' : 'Senha * (mín. 6)'}</label>
        <input id="u-senha" type="password"></div>
    </div>
    ${u ? `<div class="campo"><label><input type="checkbox" id="u-ativo" ${u.ativo ? 'checked' : ''} style="width:auto;margin-right:6px">Usuário ativo (desmarcado = bloqueia o login)</label></div>` : ''}
    <div class="perm-editor" id="perm-editor">
      <div class="perm-topo">
        <label>Permissões — o que este usuário pode ver e fazer</label>
        <div class="perm-presets">
          <button type="button" class="btn btn-suave" data-preset="caixa">Modelo Vendedor</button>
          <button type="button" class="btn btn-suave" data-preset="estoque">Modelo Estoquista</button>
          <button type="button" class="btn btn-suave" data-preset="marcar">Marcar tudo</button>
          <button type="button" class="btn btn-suave" data-preset="limpar">Limpar</button>
        </div>
      </div>
      <div class="perm-aviso" id="perm-aviso"></div>
      <div class="perm-matriz">${matriz}</div>
    </div>
    <div class="erro" id="u-erro"></div>
  `, async (mm, fechar) => {
    const perfil = mm.querySelector('#u-perfil').value;
    const permissoes = [...mm.querySelectorAll('.perm-chk')].filter(c => c.checked).map(c => c.value);
    const r = await api('auth:salvarUsuario', {
      id: u?.id,
      nome: mm.querySelector('#u-nome').value,
      usuario: mm.querySelector('#u-usuario').value,
      perfil,
      senha: mm.querySelector('#u-senha').value || null,
      ativo: u ? mm.querySelector('#u-ativo').checked : true,
      permissoes
    });
    if (!r.ok) { mm.querySelector('#u-erro').textContent = r.erro; return; }
    toast('Usuário salvo.'); fechar(); aoConcluir();
  });

  const selPerfil = m.querySelector('#u-perfil');
  const aviso = m.querySelector('#perm-aviso');
  const chks = () => [...m.querySelectorAll('.perm-chk')];
  const aplicar = (chaves) => chks().forEach(c => { c.checked = chaves.includes(c.value); });
  function atualizarPorPerfil() {
    if (selPerfil.value === 'admin') {
      chks().forEach(c => { c.checked = true; c.disabled = true; });
      aviso.textContent = 'Administrador tem acesso total — as permissões abaixo ficam todas ligadas.';
    } else {
      chks().forEach(c => { c.disabled = false; });
      aviso.textContent = 'Use um modelo como ponto de partida e ajuste as caixas conforme precisar.';
    }
  }
  selPerfil.addEventListener('change', () => {
    if (selPerfil.value !== 'admin') aplicar(defaults[selPerfil.value] || []);
    atualizarPorPerfil();
  });
  m.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
    const p = b.dataset.preset;
    if (p === 'marcar') aplicar(catalogo.map(x => x.chave));
    else if (p === 'limpar') aplicar([]);
    else aplicar(defaults[p] || []);
  });
  atualizarPorPerfil();
}

// ---------- Pontos de fidelidade ----------
async function abaPontos(corpo) {
  const cfg = await api('pontos:config');
  const painel = document.createElement('div');
  painel.className = 'painel';
  painel.style.cssText = 'padding:22px;max-width:600px';
  painel.innerHTML = `
    <p style="color:var(--texto-suave);margin-bottom:18px">
      Programa de fidelidade opcional. Quando ativado, clientes identificados acumulam pontos a cada compra
      e podem resgatar como desconto na próxima venda.
    </p>
    <div class="campo" style="margin-bottom:14px">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <input type="checkbox" id="pts-ativo" ${cfg.ativo ? 'checked' : ''} style="width:18px;height:18px">
        <span><b>Ativar programa de pontos</b></span>
      </label>
    </div>
    <div id="pts-form" style="${cfg.ativo ? '' : 'opacity:.45;pointer-events:none'}">
      <div class="linha-3" style="margin-bottom:14px">
        <div class="campo">
          <label>Pontos por R$ 1 gasto</label>
          <input type="number" id="pts-por-real" min="1" step="1" value="${cfg.por_real}"
            style="text-align:right">
          <small style="color:var(--texto-suave)">ex: 1 ponto por R$ 1</small>
        </div>
        <div class="campo">
          <label>Mínimo para resgatar (pts)</label>
          <input type="number" id="pts-minimo" min="1" step="1" value="${cfg.minimo_resgate}"
            style="text-align:right">
          <small style="color:var(--texto-suave)">ex: 100 pontos para resgatar</small>
        </div>
        <div class="campo">
          <label>Desconto por resgate (R$)</label>
          <input type="number" id="pts-valor" min="1" step="0.01" value="${cfg.valor_resgate}"
            style="text-align:right">
          <small style="color:var(--texto-suave)">ex: R$ 10 de desconto</small>
        </div>
      </div>
      <div style="background:var(--creme);border-radius:8px;padding:12px;font-size:0.9em;margin-bottom:18px">
        📊 Com essa configuração: a cada <b id="ex-min">${cfg.minimo_resgate}</b> pontos o cliente ganha
        <b id="ex-val">R$ ${cfg.valor_resgate.toFixed(2).replace('.',',')}</b> de desconto.<br>
        Para ter direito ao resgate precisa gastar pelo menos
        <b id="ex-gasto">R$ ${(cfg.minimo_resgate / cfg.por_real).toFixed(2).replace('.',',')}</b>.
      </div>
    </div>
    <button class="btn btn-primario" id="pts-salvar">Salvar configuração</button>
    <div class="erro" id="pts-erro" style="margin-top:8px"></div>
  `;

  const $ativo = painel.querySelector('#pts-ativo');
  const $form = painel.querySelector('#pts-form');
  $ativo.addEventListener('change', () => {
    $form.style.cssText = $ativo.checked ? '' : 'opacity:.45;pointer-events:none';
  });

  function atualizarExemplo() {
    const min = Number(painel.querySelector('#pts-minimo').value) || 100;
    const val = Number(painel.querySelector('#pts-valor').value) || 10;
    const porReal = Number(painel.querySelector('#pts-por-real').value) || 1;
    painel.querySelector('#ex-min').textContent = min;
    painel.querySelector('#ex-val').textContent = 'R$ ' + val.toFixed(2).replace('.', ',');
    painel.querySelector('#ex-gasto').textContent = 'R$ ' + (min / porReal).toFixed(2).replace('.', ',');
  }
  ['#pts-minimo','#pts-valor','#pts-por-real'].forEach(sel =>
    painel.querySelector(sel).addEventListener('input', atualizarExemplo));

  painel.querySelector('#pts-salvar').onclick = async () => {
    const r = await api('pontos:salvarConfig', {
      ativo: $ativo.checked,
      por_real: Number(painel.querySelector('#pts-por-real').value) || 1,
      minimo_resgate: Number(painel.querySelector('#pts-minimo').value) || 100,
      valor_resgate: Number(painel.querySelector('#pts-valor').value) || 10
    });
    if (r.ok) { toast('Configuração de pontos salva.'); corpo.innerHTML = ''; abaPontos(corpo); }
    else painel.querySelector('#pts-erro').textContent = r.erro || 'Erro ao salvar.';
  };

  corpo.appendChild(painel);
}

// ---- Aba: Backup na Nuvem ----
async function abaNuvem(corpo) {
  const painel = el(`<div class="painel"><div id="nuvem-corpo"></div></div>`);
  corpo.appendChild(painel);
  await renderNuvem(painel.querySelector('#nuvem-corpo'));
}

async function renderNuvem(alvo) {
  alvo.innerHTML = '<p style="color:var(--texto-suave)">Carregando…</p>';
  const r = await api('nuvem:status');
  if (!r.ok) { alvo.innerHTML = `<p style="color:var(--vermelho)">${esc(r.erro)}</p>`; return; }

  if (!Object.keys(r.providers || {}).length) {
    alvo.innerHTML = `
      <div style="background:var(--fundo);border:1px solid var(--borda);border-radius:10px;padding:18px 20px;max-width:640px">
        <b>☁️ Em breve nesta instalação</b>
        <p style="color:var(--texto-suave);margin-top:8px">${esc(r.aviso || 'O backup na nuvem chega na próxima atualização.')}</p>
      </div>`;
    return;
  }

  const cards = Object.entries(r.providers).map(([key, p]) => {
    const ultimoBackup = p.ultimo_backup
      ? new Date(p.ultimo_backup).toLocaleString('pt-BR')
      : 'Nunca';
    const badge = p.conectado
      ? `<span class="pill pill-ok" style="font-size:0.85em">Conectado</span>`
      : `<span class="pill" style="background:#eee;font-size:0.85em">Desconectado</span>`;
    const credencial = `
      <div style="background:var(--fundo,#faf8f6);border:1px solid var(--borda,#ddd);border-radius:8px;padding:10px 12px;margin:8px 0">
        <div style="font-size:0.85em;margin-bottom:6px">
          🔑 Credencial (Client ID): ${p.client_id_configurado
            ? '<b style="color:green">configurada ✓</b>'
            : '<b style="color:var(--vermelho)">necessária para conectar</b>'}
        </div>
        <div style="display:flex;gap:6px">
          <input class="cid-${key}" placeholder="${p.client_id_configurado ? 'Cole um novo valor para trocar' : 'Cole aqui o Client ID'}" style="flex:1;font-size:0.85em">
          <button class="btn btn-suave" data-acao="salvarCid" data-prov="${key}">Salvar</button>
        </div>
        <details style="margin-top:6px;font-size:0.78em;color:var(--texto-suave)">
          <summary style="cursor:pointer">Como obter (faço uma única vez e uso em todos os clientes)</summary>
          ${key === 'google'
            ? `1. Acesse <b>console.cloud.google.com</b> → crie um projeto.<br>
               2. "APIs e serviços" → ative a <b>Google Drive API</b>.<br>
               3. "Tela de permissão OAuth" → tipo Externo → publique.<br>
               4. "Credenciais" → Criar credencial → <b>ID do cliente OAuth</b> → tipo <b>App para computador</b>.<br>
               5. Copie o <b>ID do cliente</b> (termina com .apps.googleusercontent.com) e cole acima.`
            : `1. Acesse <b>portal.azure.com</b> → "Registros de aplicativo" → Novo registro.<br>
               2. Contas: "Contas em qualquer diretório + contas Microsoft pessoais".<br>
               3. Redirecionamento: plataforma <b>Aplicativos móveis e de desktop</b>, URI <b>http://localhost:9741/callback</b>.<br>
               4. Copie o <b>ID do aplicativo (cliente)</b> e cole acima.`}
        </details>
      </div>`;

    return `
      <div style="border:1px solid var(--borda,#ddd);border-radius:8px;padding:20px;margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <h4 style="margin:0">${key === 'google' ? '🟦' : '🟩'} ${esc(p.nome)}</h4>
          ${badge}
        </div>
        ${credencial}
        <p style="font-size:0.88em;color:var(--texto-suave);margin:4px 0">
          Último backup: <b>${ultimoBackup}</b>
          ${p.conta ? ` · Conta: ${esc(p.conta)}` : ''}
        </p>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          ${!p.conectado
            ? `<button class="btn btn-primario" data-acao="conectar" data-prov="${key}" ${p.client_id_configurado ? '' : 'disabled title="Salve a credencial acima primeiro"'}>Conectar com ${esc(p.nome)}</button>`
            : `<button class="btn btn-primario" data-acao="backup" data-prov="${key}">☁ Fazer backup agora</button>
               <button class="btn" data-acao="desconectar" data-prov="${key}" style="color:var(--vermelho)">Desconectar</button>`
          }
        </div>
        <div class="nuvem-msg-${key}" style="margin-top:8px;font-size:0.9em"></div>
      </div>`;
  }).join('');

  alvo.innerHTML = `
    <h3 style="margin-bottom:4px">☁️ Backup na Nuvem</h3>
    <p style="color:var(--texto-suave);font-size:0.9em;margin-bottom:20px">
      Backup automático do banco de dados após fechar o caixa e diariamente enquanto o sistema estiver aberto.
      Mantém os últimos 30 arquivos. Requer conexão com a internet.
    </p>
    ${cards}
    <p style="font-size:0.8em;color:var(--texto-suave);margin-top:8px">
      Depois de salvar a credencial, clique em Conectar: o navegador abre, você entra na conta
      e o resto é automático. A credencial é do desenvolvedor — o cliente só faz o login.
    </p>`;

  alvo.querySelectorAll('[data-acao]').forEach(btn => {
    btn.onclick = async () => {
      const acao = btn.dataset.acao;
      const prov = btn.dataset.prov;
      const msg = alvo.querySelector(`.nuvem-msg-${prov}`);
      btn.disabled = true;
      if (acao === 'conectar') {
        msg.textContent = 'Abrindo navegador para autenticação…';
        const r2 = await api('nuvem:conectar', { provider: prov });
        if (r2.ok) { toast(`${r2.nome} conectado! ✅`); await renderNuvem(alvo); }
        else { msg.style.color = 'var(--vermelho)'; msg.textContent = r2.erro; btn.disabled = false; }
      } else if (acao === 'backup') {
        msg.textContent = 'Fazendo backup…';
        const r2 = await api('nuvem:backup', { provider: prov });
        if (r2.ok) { msg.style.color = 'green'; msg.textContent = `✅ Backup concluído: ${r2.arquivo}`; await renderNuvem(alvo); }
        else { msg.style.color = 'var(--vermelho)'; msg.textContent = `❌ ${r2.erro}`; btn.disabled = false; }
      } else if (acao === 'desconectar') {
        if (!confirm(`Desconectar ${prov === 'google' ? 'Google Drive' : 'OneDrive'}?`)) { btn.disabled = false; return; }
        await api('nuvem:desconectar', { provider: prov });
        toast('Desconectado.'); await renderNuvem(alvo);
      } else if (acao === 'salvarCid') {
        const campo = alvo.querySelector(`.cid-${prov}`);
        const valor = campo.value.trim();
        if (!valor) { msg.style.color = 'var(--vermelho)'; msg.textContent = 'Cole o Client ID antes de salvar.'; btn.disabled = false; return; }
        const r2 = await api('nuvem:salvarClientId', { provider: prov, client_id: valor });
        if (r2.ok) { toast('Credencial salva. ✅'); await renderNuvem(alvo); }
        else { msg.style.color = 'var(--vermelho)'; msg.textContent = r2.erro; btn.disabled = false; }
      }
    };
  });
}

// ---- Aba: Backup manual e restauração ----
async function abaBackup(corpo) {
  const painel = el(`<div class="painel" style="padding:22px;max-width:680px">
    <h3 style="margin:0 0 6px">Backup manual</h3>
    <p style="color:var(--texto-suave);margin:0 0 14px">
      Salve uma cópia completa do banco de dados onde quiser (pendrive, pasta na rede, etc.).
    </p>
    <button class="btn btn-primario" id="bk-fazer">💾 Fazer backup agora…</button>

    <hr style="border:none;border-top:1px solid var(--borda);margin:22px 0">

    <h3 style="margin:0 0 6px">Restaurar backup</h3>
    <p style="color:var(--texto-suave);margin:0 0 14px">
      Substitui os dados atuais por um arquivo de backup (.db). Uma cópia de segurança dos
      dados atuais é criada automaticamente antes, e o sistema reinicia ao concluir.
    </p>
    <button class="btn btn-suave" id="bk-restaurar" style="color:var(--vermelho)">↩️ Restaurar de um arquivo…</button>

    <hr style="border:none;border-top:1px solid var(--borda);margin:22px 0">

    <h3 style="margin:0 0 6px">Backups do sistema</h3>
    <p style="color:var(--texto-suave);margin:0 0 10px">
      Clique em <b>Restaurar</b> na linha desejada — o sistema volta para aquele ponto e
      reinicia sozinho. A coluna <b>Conteúdo</b> mostra o que há dentro de cada cópia,
      para você nunca restaurar um backup vazio sem perceber.
      <br><code id="bk-pasta" style="font-size:11px"></code>
    </p>
    <div id="bk-lista"><p style="color:var(--texto-suave)">Carregando…</p></div>
    <div class="erro" id="bk-erro" style="margin-top:10px"></div>
  </div>`);
  corpo.appendChild(painel);

  painel.querySelector('#bk-fazer').onclick = async () => {
    const r = await api('backup:manual');
    if (!r.ok) { if (r.erro !== 'Operação cancelada.') painel.querySelector('#bk-erro').textContent = r.erro; return; }
    toast('Backup salvo em: ' + r.arquivo);
  };

  painel.querySelector('#bk-restaurar').onclick = async () => {
    const r = await api('backup:restaurar');
    if (!r.ok && r.erro !== 'Operação cancelada.') painel.querySelector('#bk-erro').textContent = r.erro;
    // em caso de sucesso o app reinicia sozinho
  };

  await renderListaBackups(painel);
}

// Lista clicável de backups. Cada linha mostra data, tamanho e o CONTEÚDO
// (vendas / produtos / clientes) — restaurar às cegas foi o que fez o
// sistema continuar vazio depois de uma restauração "bem-sucedida".
async function renderListaBackups(painel) {
  const lista = painel.querySelector('#bk-lista');
  const erroEl = painel.querySelector('#bk-erro');
  const r = await api('backup:listarLocais');
  if (!r.ok) { lista.innerHTML = `<p style="color:var(--vermelho)">${esc(r.erro)}</p>`; return; }

  painel.querySelector('#bk-pasta').textContent = r.pasta;

  if (!r.backups.length) {
    lista.innerHTML = '<p style="color:var(--texto-suave)">Nenhum backup ainda — o primeiro é criado na próxima abertura do sistema.</p>';
    return;
  }

  const dataBonita = (b) => {
    const m = b.nome.match(/(\d{4})-(\d{2})-(\d{2})(?:T(\d{2})-(\d{2}))?/);
    if (!m) return b.quando ? String(b.quando).slice(0, 16).replace('T', ' ') : '—';
    return `${m[3]}/${m[2]}/${m[1]}` + (m[4] ? ` ${m[4]}:${m[5]}` : '');
  };
  const rotulo = (n) =>
    /pre-atualizacao/.test(n) ? '<span style="color:var(--dourado)">🛡️ antes de atualizar</span>'
    : /manual/.test(n)        ? '<span style="color:var(--texto-suave)">✋ manual</span>'
    : '<span style="color:var(--texto-suave)">🗓️ automático</span>';

  lista.innerHTML = `<table>
    <thead><tr>
      <th>Data</th><th>Origem</th><th>Conteúdo</th>
      <th class="num">Tamanho</th><th></th>
    </tr></thead>
    <tbody>${r.backups.map((b, i) => {
      const vazio = !b.temDados || !b.integro;
      const cor = !b.integro ? 'var(--vermelho)' : (vazio ? 'var(--vermelho)' : 'inherit');
      const conteudo = !b.integro ? '⚠️ arquivo danificado'
        : (vazio ? '⚠️ vazio (sem vendas)'
                 : `${b.vendas} venda(s) · ${b.produtos} produto(s) · ${b.clientes} cliente(s)`);
      return `<tr>
        <td>${esc(dataBonita(b))}</td>
        <td>${rotulo(b.nome)}</td>
        <td style="color:${cor}">${conteudo}${b.perdeDados && b.integro && !vazio ? ' <span style="color:var(--dourado)">· menos que o atual</span>' : ''}</td>
        <td class="num">${(b.tamanho / 1024).toFixed(0)} KB</td>
        <td class="num">${b.integro
          ? `<button class="btn btn-suave bk-rest" data-i="${i}" style="padding:4px 10px;font-size:12px">↩️ Restaurar</button>`
          : ''}</td>
      </tr>`;
    }).join('')}</tbody></table>`;

  lista.querySelectorAll('.bk-rest').forEach(btn => {
    btn.onclick = async () => {
      const b = r.backups[Number(btn.dataset.i)];
      erroEl.textContent = '';

      let aviso = `Restaurar o backup de ${dataBonita(b)}?\n\n`
        + `Esse backup tem ${b.vendas} venda(s), ${b.produtos} produto(s) e ${b.clientes} cliente(s).\n`
        + `O sistema agora tem ${r.atual.vendas} venda(s), ${r.atual.produtos} produto(s) e ${r.atual.clientes} cliente(s).\n\n`;
      if (!b.temDados) {
        aviso += '⚠️ ATENÇÃO: este backup está VAZIO. Restaurar vai apagar tudo o que existe hoje.\n\n';
      } else if (b.perdeDados) {
        aviso += '⚠️ ATENÇÃO: este backup tem MENOS dados que o sistema atual. A diferença será perdida.\n\n';
      }
      aviso += 'Uma cópia do estado atual é guardada antes. O sistema reinicia ao concluir.';

      if (!confirm(aviso)) return;

      btn.disabled = true; btn.textContent = '⏳ Restaurando…';
      const res = await api('backup:restaurarLocal', { nome: b.nome, confirmado: true });
      if (!res.ok) {
        btn.disabled = false; btn.textContent = '↩️ Restaurar';
        erroEl.textContent = res.erro || 'Não foi possível restaurar.';
        return;
      }
      // sucesso: o backend reinicia o aplicativo sozinho
    };
  });
}

// ---- Aba: Acesso em Rede (multiterminal) ----
async function abaRede(corpo) {
  const r = await api('rede:status');
  const painel = el(`<div class="painel" style="padding:22px;max-width:680px">
    <p style="color:var(--texto-suave);margin-bottom:16px">
      Com o acesso em rede ligado, outros computadores e tablets da loja usam o sistema
      <b>pelo navegador</b>, sem instalar nada — basta este computador estar ligado com o sistema aberto.
      Cada terminal tem seu próprio login e permissões.
    </p>
    <div id="rd-corpo"></div>
    <div class="erro" id="rd-erro" style="margin-top:10px"></div>
  </div>`);
  corpo.appendChild(painel);
  const div = painel.querySelector('#rd-corpo');

  if (!r.ok) { div.innerHTML = `<p style="color:var(--vermelho)">${esc(r.erro)}</p>`; return; }

  div.innerHTML = `
    <label style="display:flex;gap:10px;align-items:center;margin-bottom:14px;font-size:14px">
      <input type="checkbox" id="rd-ativa" ${r.ativa_config ? 'checked' : ''}>
      <b>Ligar acesso em rede</b>
    </label>
    <div class="campo" style="max-width:160px"><label>Porta</label><input id="rd-porta" type="number" value="${esc(r.porta)}"></div>
    <button class="btn btn-primario" id="rd-aplicar" style="margin:8px 0 16px">Aplicar</button>
    <div id="rd-status"></div>
    <p style="color:var(--texto-suave);font-size:12px;margin-top:14px">
      ⚠️ Impressão silenciosa, backups e conexões de nuvem funcionam apenas neste computador (principal).
      Nos terminais, a impressão usa o diálogo do navegador. Se o Firewall do Windows perguntar, permita o acesso em redes privadas.
    </p>`;

  const renderStatus = (s) => {
    const alvo = div.querySelector('#rd-status');
    if (!s.ativa) { alvo.innerHTML = '<p style="color:var(--texto-suave)">Servidor desligado.</p>'; return; }
    const links = (s.ips || []).map(i => {
      const url = `http://${i.ip}:${s.porta}`;
      return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0">
        <a href="#" class="rd-link" data-url="${esc(url)}" style="font-weight:700;font-size:15px;color:var(--vinho);text-decoration:underline;cursor:pointer">${esc(url)}</a>
        <button type="button" class="btn btn-suave rd-copiar" data-url="${esc(url)}" style="padding:2px 10px;font-size:11px">📋 copiar</button>
        <small style="color:var(--texto-suave)">(${esc(i.interface)})</small>
      </div>`;
    }).join('');
    alvo.innerHTML = `<div style="background:var(--fundo);border:1px solid var(--borda);border-radius:8px;padding:12px 14px">
      🟢 <b>Servidor ativo.</b> Endereços para os terminais (clique para abrir no navegador):${links || '<div>Nenhuma rede detectada.</div>'}
      <div style="font-size:12px;color:var(--texto-suave);margin-top:6px">Terminais conectados agora: ${s.terminais || 0}</div>
    </div>`;
    alvo.querySelectorAll('.rd-link').forEach(a => a.onclick = async (e) => {
      e.preventDefault();
      const r3 = await api('rede:abrirNavegador', { url: a.dataset.url });
      if (!r3.ok) window.open(a.dataset.url, '_blank'); // num terminal (navegador), abre em nova aba
    });
    alvo.querySelectorAll('.rd-copiar').forEach(b => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.url); toast('Endereço copiado. 📋'); }
      catch { toast('Não foi possível copiar automaticamente.', true); }
    });
  };
  renderStatus(r);

  div.querySelector('#rd-aplicar').onclick = async () => {
    painel.querySelector('#rd-erro').textContent = '';
    const r2 = await api('rede:aplicar', {
      ativa: div.querySelector('#rd-ativa').checked,
      porta: Number(div.querySelector('#rd-porta').value) || 8750
    });
    if (!r2.ok) { painel.querySelector('#rd-erro').textContent = r2.erro; return; }
    toast(r2.ativa ? 'Acesso em rede ligado.' : 'Acesso em rede desligado.');
    const s = await api('rede:status');
    if (s.ok) renderStatus(s);
  };
}

// ---- Aba: Licença ----
async function abaLicenca(corpo) {
  const r = await api('licenca:status');
  const painel = el(`<div class="painel" style="padding:22px;max-width:680px"><div id="lc-corpo"></div></div>`);
  corpo.appendChild(painel);
  const div = painel.querySelector('#lc-corpo');
  if (!r.ok) { div.innerHTML = `<p style="color:var(--vermelho)">${esc(r.erro)}</p>`; return; }

  const situacao = r.sem_licenca
    ? '<span class="pill pill-ok">sem restrições</span>'
    : (r.vencida ? '<span class="pill pill-baixo">VENCIDA</span>' : '<span class="pill pill-ok">ativa</span>');

  div.innerHTML = `
    <div style="background:var(--fundo);border:1px solid var(--borda);border-radius:8px;padding:14px 16px;margin-bottom:16px">
      <div style="margin-bottom:6px">Plano: <b>${esc(r.nome_plano)}</b> · Situação: ${situacao}</div>
      ${r.validade ? `<div style="margin-bottom:6px">Pago até: <b>${esc(r.validade)}</b></div>` : ''}
      <div>ID desta instalação: <b style="letter-spacing:2px">${esc(r.cliente_id)}</b></div>
      <div style="font-size:12px;color:var(--texto-suave);margin-top:6px">Informe este ID ao suporte para renovar ou mudar de plano.</div>
    </div>
    <h3 style="margin:0 0 8px">Renovar / ativar código</h3>
    <div style="display:flex;gap:8px;max-width:480px">
      <input id="lc-cod" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" style="flex:1;text-transform:uppercase">
      <button class="btn btn-primario" id="lc-renovar">Aplicar</button>
    </div>
    <div class="erro" id="lc-erro" style="margin-top:8px"></div>`;

  div.querySelector('#lc-renovar').onclick = async () => {
    const r2 = await api('licenca:renovar', { codigo: div.querySelector('#lc-cod').value });
    if (!r2.ok) { div.querySelector('#lc-erro').textContent = r2.erro; return; }
    toast(`Licença renovada — plano ${r2.plano} até ${r2.validade}. ✅`);
    corpo.innerHTML = ''; abaLicenca(corpo);
  };
}

// ---- Aba: Impressoras ----
async function abaImpressoras(corpo) {
  // Num terminal em rede não há impressão silenciosa remota: cada máquina
  // imprime na SUA impressora pelo diálogo do navegador. Nada a configurar aqui.
  if (EM_REDE) {
    corpo.appendChild(el(`<div class="painel" style="padding:22px;max-width:680px">
      <h3 style="margin:0 0 10px">🖨️ Impressão neste terminal</h3>
      <p style="color:var(--texto-suave);margin:0 0 10px">
        Este computador está acessando o sistema pela rede. Aqui, <b>cada máquina imprime na sua
        própria impressora</b>: ao imprimir cupom ou etiquetas, abre o diálogo do navegador e você
        escolhe a impressora instalada <b>nesta</b> máquina (ex.: caixa imprime cupom na térmica dele,
        estoque imprime etiquetas na impressora de etiquetas dele).
      </p>
      <p style="color:var(--texto-suave);margin:0;font-size:12.5px">
        💡 Dica: no diálogo do navegador dá para marcar a impressora como padrão e desativar
        cabeçalhos/rodapés. A impressão <b>silenciosa</b> (sem diálogo) é configurada apenas no
        computador principal, nesta mesma aba.
      </p>
    </div>`));
    return;
  }
  const cfg = getConfig();
  const painel = el(`<div class="painel" style="padding:22px;max-width:680px">
    <p style="color:var(--texto-suave);margin-bottom:18px">
      Configure impressoras dedicadas para cada finalidade. Quando configurado, o sistema imprime
      <b>silenciosamente</b> sem abrir o diálogo do Windows. Deixe em branco para usar o diálogo padrão.
    </p>
    <div id="imp-corpo"><p style="color:var(--texto-suave)">Carregando impressoras…</p></div>
    <div class="erro" id="imp-erro" style="margin-top:10px"></div>
    <button class="btn btn-primario" id="imp-salvar" style="margin-top:16px">Salvar impressoras</button>
  </div>`);

  corpo.appendChild(painel);

  const r = await api('config:listarImpressoras');
  const div = painel.querySelector('#imp-corpo');

  if (!r.ok) {
    div.innerHTML = `<p style="color:var(--vermelho)">Erro ao listar impressoras: ${esc(r.erro)}</p>`;
    return;
  }

  const opts = ['<option value="">— Usar diálogo do Windows —</option>',
    ...r.impressoras.map(p =>
      `<option value="${esc(p.nome)}"${p.padrao ? ' style="font-weight:bold"' : ''}>${esc(p.nome)}${p.padrao ? ' ★' : ''}</option>`)
  ].join('');

  const mkSelect = (id, label, dica) => `
    <div class="campo" style="margin-bottom:18px">
      <label><b>${esc(label)}</b></label>
      <select id="${id}">${opts}</select>
      <small style="color:var(--texto-suave)">${esc(dica)}</small>
    </div>`;

  div.innerHTML =
    mkSelect('imp-cupom', '🧾 Impressora de Cupom / Comprovante',
      'Impressora térmica de 80mm para comprovantes de venda, cancelamentos e devoluções.') +
    mkSelect('imp-etiqueta', '🏷️ Impressora de Etiquetas',
      'Impressora de etiquetas com código de barras ou QR Code.') +
    `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
      <button class="btn btn-suave" id="imp-teste-cupom" type="button">🖨 Testar cupom</button>
      <button class="btn btn-suave" id="imp-teste-etiqueta" type="button">🖨 Testar etiqueta</button>
    </div>`;

  painel.querySelector('#imp-cupom').value = cfg.impressora_cupom || '';
  painel.querySelector('#imp-etiqueta').value = cfg.impressora_etiqueta || '';

  painel.querySelector('#imp-teste-cupom').onclick = async () => {
    const nome = painel.querySelector('#imp-cupom').value;
    if (!nome) { toast('Selecione uma impressora de cupom antes de testar.', true); return; }
    let area = document.getElementById('area-impressao');
    if (!area) { area = document.createElement('div'); area.id = 'area-impressao'; document.body.appendChild(area); }
    area.innerHTML = `<div class="cupom"><div class="c-centro"><b>TESTE DE IMPRESSAO</b><br>Cupom de comprovante<br><br>Se aparecer aqui a impressora esta OK</div></div>`;
    toast('Enviando cupom de teste...', false);
    const rt = await api('config:imprimir', { tipo: 'cupom', impressora: nome });
    toast(rt.ok ? 'Cupom enviado para impressão!' : ('Erro: ' + (rt.erro || 'falha desconhecida')), !rt.ok);
  };
  painel.querySelector('#imp-teste-etiqueta').onclick = async () => {
    const nome = painel.querySelector('#imp-etiqueta').value;
    if (!nome) { toast('Selecione uma impressora de etiquetas antes de testar.', true); return; }
    let area = document.getElementById('area-impressao');
    if (!area) { area = document.createElement('div'); area.id = 'area-impressao'; document.body.appendChild(area); }
    const bcSvg = `<svg viewBox="0 0 95 25" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:10mm">${[2,1,2,1,1,2,1,2,1,3,1,1,2,1,2,1,1,2,1,2,2,1,1,2,1,2,1,2,1,2,1,1,2,1,2,1,2,1,2,1,1,2,1,2,1,2,1].reduce((a,w,i)=>{const x=a.x;a.svg+=i%2===0?`<rect x="${x}" y="0" width="${w*0.9}" height="25" fill="#000"/>`:'';a.x+=w*0.9+0.4;return a;},{x:2,svg:''}).svg}</svg>`;
    area.innerHTML = `<div class="etq-grid"><div class="etiqueta"><div class="et-left"><div class="et-loja">Boutique do Salgueiro</div><div class="et-nome">Produto Teste</div><div class="et-info">Branco · Ref: TEST-001</div><div class="et-preco">R$ 99,90</div><div class="et-bc-wrap">${bcSvg}<div class="et-num">1234567890128</div></div></div><div class="et-right"><div class="et-tam-badge">P</div></div></div></div>`;
    toast('Enviando etiqueta de teste...', false);
    const rt = await api('config:imprimir', { tipo: 'etiqueta', impressora: nome });
    toast(rt.ok ? 'Etiqueta enviada para impressão!' : ('Erro: ' + (rt.erro || 'falha desconhecida')), !rt.ok);
  };

  painel.querySelector('#imp-salvar').onclick = async () => {
    const r2 = await api('config:salvar', {
      impressora_cupom: painel.querySelector('#imp-cupom').value,
      impressora_etiqueta: painel.querySelector('#imp-etiqueta').value
    });
    if (!r2.ok) { painel.querySelector('#imp-erro').textContent = r2.erro; return; }
    await recarregarConfig();
    toast('Impressoras salvas.');
  };
}

// ---- Aba: Atualização ----
async function abaAtualizacao(corpo) {
  if (!document.getElementById('estilo-novidades')) {
    const st = document.createElement('style');
    st.id = 'estilo-novidades';
    st.textContent = CSS_NOVIDADES + `
      .upd-colunas { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:16px; align-items:start }
      @media (max-width:1100px) { .upd-colunas { grid-template-columns:1fr } }`;
    document.head.appendChild(st);
  }
  const bloco = el(`<div class="upd-colunas">
    <div class="painel" style="padding:22px">
      <h3 style="margin:0 0 16px">🔄 Atualização do sistema</h3>
      <div id="upd-info"><p style="color:var(--texto-suave)">Verificando versão…</p></div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-primario" id="upd-verificar">Verificar agora</button>
      </div>
      <div id="upd-resultado" style="margin-top:16px"></div>
    </div>
    <div class="painel" style="padding:22px">
      <h3 style="margin:0 0 4px">📢 O que mudou</h3>
      <p style="color:var(--texto-suave);font-size:12px;margin:0 0 14px">
        Novidades de cada versão. Clique para abrir e ver os detalhes.</p>
      <div class="nv-caixa" id="upd-novidades"></div>
    </div>
  </div>`);
  const painel = bloco.querySelector('#upd-info').closest('.painel');
  corpo.appendChild(bloco);

  const vr = await api('app:versao');
  const versaoAtual = vr?.version || '2.0.0';
  bloco.querySelector('#upd-novidades').innerHTML = htmlNovidades(versaoAtual, esc);
  painel.querySelector('#upd-info').innerHTML = `
    <div>Versão instalada: <b>v${versaoAtual}</b></div>
    <div style="font-size:12px;color:var(--texto-suave);margin-top:4px">
      As atualizações são baixadas do GitHub e aplicadas automaticamente —
      sem reinstalar o sistema.${EM_REDE ? '<br><b>Nota:</b> a instalação da atualização só pode ser feita no computador principal.' : ''}</div>`;

  painel.querySelector('#upd-verificar').onclick = async () => {
    const res = painel.querySelector('#upd-resultado');
    res.innerHTML = '<p style="color:var(--texto-suave)">⏳ Consultando o servidor…</p>';
    const r = await api('updater:verificar', { versaoAtual });
    if (!r.ok) {
      res.innerHTML = `<div style="color:var(--vermelho)">❌ ${esc(r.erro)}</div>`;
      return;
    }
    if (!r.temAtualizacao) {
      res.innerHTML = `<div style="display:inline-flex;align-items:center;gap:8px;padding:10px 14px;background:var(--fundo);border:1px solid var(--borda);border-radius:8px">
        <span style="font-size:18px">✅</span>
        <span>Sistema atualizado — <b>v${esc(r.versaoAtual)}</b> é a versão mais recente.</span></div>`;
      return;
    }
    // Atualização disponível
    res.innerHTML = `
      <div style="background:var(--fundo);border:1px solid var(--borda);border-radius:8px;padding:16px">
        <div style="margin-bottom:8px;font-size:15px">
          🆕 Nova versão disponível: <b>v${esc(r.versaoNova)}</b>
          <span style="margin-left:8px;font-size:12px;color:var(--texto-suave)">(atual: v${esc(r.versaoAtual)})</span>
        </div>
        ${r.notas ? `<div style="font-size:12.5px;white-space:pre-wrap;color:var(--texto-suave);margin-bottom:14px;max-height:130px;overflow-y:auto;padding:8px 10px;background:rgba(0,0,0,.04);border-radius:6px">${esc(r.notas)}</div>` : ''}
        ${!EM_REDE ? '<button class="btn btn-primario" id="upd-instalar">⬇️ Baixar e instalar</button>' : '<p style="color:var(--texto-suave);font-size:12.5px">Para instalar, acesse o computador principal.</p>'}
        <div id="upd-prog" style="margin-top:10px"></div>
      </div>`;
    if (EM_REDE) return;
    res.querySelector('#upd-instalar').onclick = async () => {
      const btn = res.querySelector('#upd-instalar');
      const prog = res.querySelector('#upd-prog');
      btn.disabled = true;
      try {
        // ── 1. BACKUP OBRIGATÓRIO ANTES DE QUALQUER COISA (v2.9.0) ──────────
        // Nenhuma atualização começa sem ponto de retorno gravado em disco.
        // Antes, o app era reiniciado sem salvar o banco: se o processo
        // morresse no meio de uma gravação, o cliente perdia tudo.
        btn.textContent = '⏳ Fazendo backup…';
        prog.innerHTML = '<p style="color:var(--texto-suave)">🛡️ Salvando backup de segurança antes de atualizar…</p>';
        const bk = await api('backup:preAtualizacao', { versao: r.versaoNova });
        if (!bk.ok) {
          btn.disabled = false; btn.textContent = '⬇️ Baixar e instalar';
          prog.innerHTML = `<p style="color:var(--vermelho)">❌ Atualização cancelada: não foi possível criar o backup de segurança.<br>${esc(bk.erro || '')}</p>`;
          return;
        }
        prog.innerHTML = `<p style="color:green">✅ Backup criado (${bk.info.vendas} vendas, ${bk.info.produtos} produtos).</p>
          <p style="color:var(--texto-suave)">Baixando atualização — aguarde…</p>`;

        btn.textContent = '⏳ Baixando…';
        // Usa curl.exe (nativo no Windows 10+) via Neutralino.os.execCommand
        // evita CORS do WebView2 ao baixar de github.com/objetos CDN
        // eslint-disable-next-line no-undef
        const basePath = NL_PATH.replace(/\//g, '\\');
        const tmpFile  = basePath + '\\resources.neu.tmp';
        const destFile = basePath + '\\resources.neu';
        const url = r.downloadUrl;
        // eslint-disable-next-line no-undef
        const dl = await Neutralino.os.execCommand(
          `curl.exe -L -s -o "${tmpFile}" "${url}"`,
          { background: false }
        );
        if (dl.exitCode !== 0) throw new Error('curl falhou (código ' + dl.exitCode + '): ' + (dl.stdErr || '').slice(0, 200));
        prog.innerHTML = '<p style="color:var(--texto-suave)">📦 Aplicando…</p>';
        // eslint-disable-next-line no-undef
        const mv = await Neutralino.os.execCommand(
          `cmd /c move /Y "${tmpFile}" "${destFile}"`,
          { background: false }
        );
        if (mv.exitCode !== 0) throw new Error('Falha ao mover arquivo: ' + (mv.stdErr || ''));

        // ── 2. GRAVAR O BANCO ANTES DE REINICIAR (v2.9.0) ───────────────────
        // restartProcess() mata o processo. Se houvesse escrita pendente no
        // debounce de 300 ms, ela se perdia; pior, se o kill caísse dentro de
        // uma gravação, o arquivo do banco ficava incompleto.
        prog.innerHTML = '<p style="color:var(--texto-suave)">💾 Gravando dados antes de reiniciar…</p>';
        await api('backup:salvarAgora');

        prog.innerHTML = '<p style="color:var(--dourado)">✅ Atualização aplicada! Reiniciando…</p>';
        // eslint-disable-next-line no-undef
        setTimeout(() => Neutralino.app.restartProcess(), 1200);
      } catch (e) {
        btn.disabled = false; btn.textContent = '⬇️ Baixar e instalar';
        prog.innerHTML = `<p style="color:var(--vermelho)">❌ Falha: ${esc(e.message)}</p>`;
      }
    };
  };
}

// ---- Aba: Categorias de clientes ----
async function abaCategoriaClientes(corpo) {
  const painel = el(`<div class="painel" style="padding:22px;max-width:680px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <div>
        <h3 style="margin:0 0 4px">Categorias de clientes</h3>
        <p style="color:var(--texto-suave);margin:0;font-size:13px">
          Cada categoria pode ter um desconto automático (%). Quando um cliente identificado pertence a uma categoria com desconto, o PDV aplica o desconto sozinho.
          <br>Marque <b>👁️ Acompanhar compras</b> nas categorias que você quer vigiar (funcionários, sócios) — elas aparecem no relatório de acompanhamento.
        </p>
      </div>
      <button class="btn btn-primario" id="cat-nova" style="white-space:nowrap;margin-left:16px">+ Nova categoria</button>
    </div>
    <div id="cat-lista"><p style="color:var(--texto-suave)">Carregando…</p></div>
    <div class="erro" id="cat-erro"></div>
  </div>`);
  corpo.appendChild(painel);

  async function carregar() {
    const r = await api('clientes:listarCategorias');
    const lista = painel.querySelector('#cat-lista');
    if (!r.ok || !r.categorias.length) {
      lista.innerHTML = '<p style="color:var(--texto-suave)">Nenhuma categoria cadastrada.</p>';
      return;
    }
    lista.innerHTML = `<table>
      <thead><tr><th>Categoria</th><th class="num">Desconto</th><th>Acompanhar</th><th style="width:130px"></th></tr></thead>
      <tbody>${r.categorias.map(c => `<tr data-id="${c.id}">
        <td><b>${esc(c.nome)}</b></td>
        <td class="num">${c.desconto_percent > 0 ? `<span style="color:var(--vinho);font-weight:700">${c.desconto_percent}%</span>` : '<span style="color:var(--texto-suave)">—</span>'}</td>
        <td>${c.monitorar
          ? '<span style="background:rgba(184,135,59,.18);color:#7a5716;font-size:11.5px;padding:2px 8px;border-radius:10px;white-space:nowrap">👁️ Acompanhada</span>'
          : '<span style="color:var(--texto-suave)">—</span>'}</td>
        <td class="acoes-linha"><button data-a="editar">Editar</button> <button data-a="excluir" style="color:var(--vermelho)">Excluir</button></td>
      </tr>`).join('')}</tbody>
    </table>`;
    lista.querySelectorAll('[data-a=editar]').forEach(b => {
      const tr = b.closest('tr');
      const id = Number(tr.dataset.id);
      const cat = r.categorias.find(c => c.id === id);
      b.onclick = () => modalCategoria(cat, carregar);
    });
    lista.querySelectorAll('[data-a=excluir]').forEach(b => {
      const id = Number(b.closest('tr').dataset.id);
      b.onclick = async () => {
        if (!confirm('Excluir esta categoria? Clientes vinculados ficam sem categoria.')) return;
        const res = await api('clientes:excluirCategoria', { id });
        if (!res.ok) { painel.querySelector('#cat-erro').textContent = res.erro; return; }
        toast('Categoria excluída.'); carregar();
      };
    });
  }

  painel.querySelector('#cat-nova').onclick = () => modalCategoria(null, carregar);
  carregar();
}

function modalCategoria(cat, aoSalvar) {
  const titulo = cat ? 'Editar categoria' : 'Nova categoria de cliente';
  const m = modal(titulo, `
    <div class="campo"><label>Nome da categoria *</label>
      <input id="mc-nome" value="${esc(cat ? cat.nome : '')}" placeholder="ex: Funcionário, VIP, Componente…"></div>
    <div class="campo"><label>Desconto automático no PDV (%)</label>
      <input id="mc-desc" type="number" min="0" max="100" step="0.5" value="${cat ? cat.desconto_percent : 0}"
        style="max-width:120px">
      <small style="color:var(--texto-suave);display:block;margin-top:4px">0 = sem desconto automático. Ex: 10 = 10% de desconto ao identificar o cliente no PDV.</small></div>
    <div class="campo" style="background:rgba(184,135,59,.08);border:1px solid rgba(184,135,59,.35);border-radius:8px;padding:12px 14px">
      <label style="display:flex;align-items:flex-start;gap:9px;cursor:pointer;margin:0">
        <input type="checkbox" id="mc-monit" ${cat && cat.monitorar ? 'checked' : ''} style="margin-top:3px;width:16px;height:16px">
        <span><b>👁️ Acompanhar as compras desta categoria</b>
          <small style="color:var(--texto-suave);display:block;margin-top:3px;font-weight:400">
            Use em funcionários, sócios e quem compra com desconto. As compras passam a aparecer
            em Relatórios → 👁️ Compras acompanhadas, com o que cada pessoa levou, quantas peças e
            quanto pagou — para perceber quem está comprando em quantidade de revenda.
          </small></span>
      </label>
    </div>
    <div class="erro" id="mc-erro"></div>
  `, async (mm, fechar) => {
    const nome = mm.querySelector('#mc-nome').value.trim();
    const desc = Number(mm.querySelector('#mc-desc').value) || 0;
    if (!nome) { mm.querySelector('#mc-erro').textContent = 'Informe o nome.'; return; }
    const monitorar = mm.querySelector('#mc-monit').checked ? 1 : 0;
    const r = await api('clientes:salvarCategoria', { id: cat ? cat.id : undefined, nome, desconto_percent: desc, monitorar });
    if (!r.ok) { mm.querySelector('#mc-erro').textContent = r.erro; return; }
    toast(cat ? 'Categoria atualizada.' : 'Categoria criada.');
    fechar(); aoSalvar();
  }, 'Salvar');
  setTimeout(() => m.querySelector('#mc-nome')?.focus(), 50);
}
