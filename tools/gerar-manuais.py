#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador dos manuais — Salgueiro Gestão

Um comando só, para não depender de ninguém lembrar do passo a passo:

    python3 tools/gerar-manuais.py

Para cada manual em docs/*.md produz três arquivos:

  NOME.pdf                    A4, para ler na tela e imprimir avulso
  NOME-A5.pdf                 a revista montada em ordem de leitura
                              (capa · rosto · miolo · brancas · contracapa)
  NOME-LIVRETO-IMPRIMIR-A4.pdf   É ESTE QUE VAI PARA A IMPRESSORA.
                              A4 paisagem já imposto: imprimir frente e verso
                              virando na borda curta, dobrar ao meio e
                              grampear → vira a revistinha A5.

ARMADILHAS QUE ESTE SCRIPT JÁ RESOLVE (não desfazer sem ler):

0. DIAGRAMAÇÃO: tabela NÃO pode ser page-break-inside:avoid. Numa A5 quase
   nenhuma tabela cabe inteira, então ela pula para a folha seguinte e deixa
   o título sozinho com meia folha em branco — defeito reprovado em entrega.
   Quem não quebra é a LINHA (tr), e o thead repete o cabeçalho. A função
   conferir_buracos() mede a ocupação de cada página e denuncia o caso.

1. O nome da família da fonte de emoji é 'Noto Emoji', COM ESPAÇO. Escrever
   'NotoEmoji' não casa e todo emoji some, sem aviso nenhum.

2. O manual é grande demais para o WeasyPrint terminar numa chamada só de
   shell no sandbox, então ele é cortado em duas partes e juntado depois.

3. Por causa do corte, NÃO dá para numerar com @bottom-center/counter(page):
   a segunda parte recomeça do 1 e counter-reset não atravessa (testado no
   WeasyPrint). O número é desenhado com pymupdf DEPOIS de juntar.

4. Nem ⧉ (U+29C9) nem ⎘ (U+2398) existem na DejaVu ou na Noto Emoji.
   Não usar glifo de "duplicar" nos manuais — descrever em palavras.

Dependências no sandbox:
  pandoc · weasyprint · pypdf · pymupdf · fonttools+brotli (para a fonte)
"""

import os, re, sys, glob, math, shutil, subprocess, tempfile

RAIZ  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS  = os.path.join(RAIZ, 'docs')
TMP   = tempfile.mkdtemp(prefix='manuais-')
FONTE = os.path.expanduser('~/.fonts/NotoEmoji.ttf')

# o pip instala o weasyprint em ~/.local/bin, que nem sempre está no PATH
WEASY = (shutil.which('weasyprint')
         or os.path.expanduser('~/.local/bin/weasyprint'))

# Manuais a gerar e onde cortar em duas partes (título exato do H2)
MANUAIS = [
    # arquivo, corte em duas partes, título da capa, subtítulo da capa
    ('MANUAL-DO-USUARIO', '## 14. Relatórios',
     'Manual do Usuário',  'Tudo o que o sistema faz, explicado passo a passo'),
    ('GUIA-RAPIDO',       None,
     'Guia Rápido',        'O dia a dia da loja, direto ao ponto'),
]

LOJA    = 'Boutique do Salgueiro'
SISTEMA = 'Salgueiro Gestão'
AUTOR   = 'ML Lopes Design'
EMAIL   = 'mlopesdesign@gmail.com'
VERMELHO = '#B01E23'
LOGO = os.path.join(RAIZ, 'recursos', 'logo-gold.png')

# ── Fonte de emoji ────────────────────────────────────────────────────────────
def garantir_fonte():
    """Monta ~/.fonts/NotoEmoji.ttf a partir dos subsets do @fontsource.

    A família resultante se chama 'Noto Emoji' (nameID 1) — é esse nome, com
    espaço, que precisa estar no font-family do CSS."""
    if os.path.exists(FONTE):
        return
    print('  · montando a fonte de emoji…')
    d = os.path.join(TMP, 'emoji')
    os.makedirs(d, exist_ok=True)
    subprocess.run(['npm', 'pack', '@fontsource/noto-emoji'], cwd=d,
                   check=True, capture_output=True)
    tgz = glob.glob(os.path.join(d, '*.tgz'))[0]
    subprocess.run(['tar', 'xzf', tgz], cwd=d, check=True)

    from fontTools.ttLib import TTFont
    from fontTools.merge import Merger
    # só o peso 400: misturar pesos duplica glifos e a mesclagem falha
    subsets = sorted(glob.glob(os.path.join(d, 'package/files/noto-emoji-*-400-normal.woff2')))
    ttfs = []
    for i, a in enumerate(subsets):
        f = TTFont(a); f.flavor = None
        p = os.path.join(d, f'sub{i}.ttf'); f.save(p); ttfs.append(p)
    os.makedirs(os.path.dirname(FONTE), exist_ok=True)
    Merger().merge(ttfs).save(FONTE)
    subprocess.run(['fc-cache', '-f', os.path.dirname(FONTE)], capture_output=True)
    print(f'  · fonte pronta ({len(subsets)} subsets)')


# ── CSS ───────────────────────────────────────────────────────────────────────
def css(a5=False):
    """Folha de estilo. Em A5 tudo encolhe junto, senão a mancha estoura."""
    if a5:
        pag, marg, base = 'A5', '11mm 10mm', 8.2
    else:
        pag, marg, base = 'A4', '18mm 16mm', 9.5
    e = lambda m: round(base * m, 1)
    return f"""
@page {{ size: {pag}; margin: {marg}; }}
body {{ font-family: 'DejaVu Sans', 'Noto Emoji', sans-serif;
       font-size: {base}pt; line-height: 1.5; color: #222; }}
h1 {{ font-size: {e(2.0)}pt; color: #B01E23; border-bottom: 3px solid #B01E23;
     padding-bottom: 3mm; margin-bottom: 5mm; }}
/* page-break-after:avoid segura o título junto do que vem depois.
   Combinado com um bloco seguinte indivisível, isso empurra os DOIS para a
   próxima folha e deixa um buraco. Por isso nada aqui é indivisível: só as
   linhas de tabela e as citações curtas. */
h2 {{ font-size: {e(1.42)}pt; color: #B01E23; margin-top: 7mm; margin-bottom: 2.5mm;
     border-bottom: 1px solid #eee; padding-bottom: 1.2mm; page-break-after: avoid; }}
h3 {{ font-size: {e(1.15)}pt; color: #7a1219; margin-top: 5mm; margin-bottom: 1.5mm;
     page-break-after: avoid; }}
h4 {{ font-size: {e(1.05)}pt; margin-top: 3.5mm; page-break-after: avoid; }}
/* órfãs e viúvas: nunca deixar 1 linha solta no pé ou no topo da folha */
p, li {{ orphans: 2; widows: 2; }}
/* Tabela PODE quebrar entre páginas — o que não pode quebrar é a LINHA.
   Com page-break-inside:avoid na tabela inteira, qualquer tabela maior que
   a folha pula inteira para a página seguinte e deixa o título sozinho com
   meia folha em branco. Numa A5 isso acontece o tempo todo.
   thead como table-header-group repete o cabeçalho vinho na continuação. */
table {{ border-collapse: collapse; width: 100%; margin: 2.5mm 0;
        font-size: {e(.9)}pt; page-break-inside: auto; }}
thead {{ display: table-header-group; }}
tr {{ page-break-inside: avoid; }}
th {{ background: #B01E23; color: #fff; padding: 1.6mm 2mm; text-align: left; }}
td {{ border-bottom: 1px solid #e8e8e8; padding: 1.4mm 2mm; vertical-align: top; }}
tr:nth-child(even) td {{ background: #fafafa; }}
blockquote {{ border-left: 3px solid #B01E23; background: #fdf6f6; margin: 2.5mm 0;
             padding: 2mm 3.5mm; font-size: {e(.95)}pt; page-break-inside: avoid; }}
code {{ background: #f2f2f2; padding: .4mm 1mm; border-radius: 2px;
       font-family: 'DejaVu Sans Mono', monospace; font-size: {e(.9)}pt; }}
pre {{ background: #f7f7f7; border-left: 3px solid #ddd; padding: 2.5mm;
      overflow-x: auto; page-break-inside: avoid; }}
pre code {{ background: none; font-size: {e(.85)}pt; }}
ul, ol {{ padding-left: 5mm; margin: 1.5mm 0; }}
li {{ margin-bottom: 1mm; }}
hr {{ border: none; border-top: 1px solid #e0e0e0; margin: 5mm 0; }}
a {{ color: #B01E23; text-decoration: none; }}
strong {{ color: #111; }}
""".strip()


# ── Capa e contracapa (A5) ────────────────────────────────────────────────────
def _logo_uri():
    """A logo vira data-uri porque o WeasyPrint resolve caminho relativo ao
    HTML temporário, não ao projeto."""
    if not os.path.exists(LOGO):
        return ''
    import base64
    b64 = base64.b64encode(open(LOGO, 'rb').read()).decode()
    return f'data:image/png;base64,{b64}'


def capa_contracapa_html(titulo, subtitulo, versao):
    """Duas páginas A5: capa (fundo na cor da loja) e contracapa (contato).

    O @page aqui NÃO tem margem: a cor precisa sangrar até a borda do papel,
    senão fica uma moldura branca e não parece capa de revista."""
    logo = _logo_uri()
    marca = (f'<img class="logo" src="{logo}">' if logo
             else f'<div class="marca">{LOJA}</div>')
    return f"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
@page {{ size: A5; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: 'DejaVu Sans', 'Noto Emoji', sans-serif;
       -weasy-print-color-adjust: exact; }}
.folha {{ width: 148mm; height: 210mm; page-break-after: always;
         display: flex; flex-direction: column; }}

/* ── CAPA ── */
.capa {{ background: {VERMELHO}; color: #fff; }}
.capa-topo {{ height: 8mm; background: rgba(0,0,0,.18); }}
.capa-meio {{ flex: 1; display: flex; flex-direction: column;
             align-items: center; justify-content: center;
             text-align: center; padding: 0 16mm; }}
.logo {{ max-width: 52mm; max-height: 26mm; margin-bottom: 9mm; }}
.marca {{ font-size: 20pt; font-weight: 900; letter-spacing: .07em;
         text-transform: uppercase; margin-bottom: 9mm; }}
.risco {{ width: 20mm; height: 1.5px; background: rgba(255,255,255,.45);
         margin: 0 auto 8mm; }}
.titulo {{ font-size: 26pt; font-weight: 300; letter-spacing: .04em;
          line-height: 1.15; margin-bottom: 5mm; }}
.sub {{ font-size: 10.5pt; opacity: .8; line-height: 1.5; }}
.capa-pe {{ padding: 6mm 14mm; display: flex; justify-content: space-between;
           font-size: 8pt; opacity: .75; border-top: 1px solid rgba(255,255,255,.22); }}

/* ── FOLHA DE ROSTO (verso da capa) ── */
.rosto {{ background: #fff; color: #333; padding: 22mm 16mm 14mm; }}
.rosto h2 {{ font-size: 13pt; color: {VERMELHO}; margin-bottom: 5mm; font-weight: 700; }}
.rosto p {{ font-size: 9pt; line-height: 1.7; margin-bottom: 3.5mm; }}
.rosto .dado {{ font-size: 8.5pt; color: #777; }}
.rosto .aviso {{ margin-top: auto; font-size: 8pt; color: #999;
                border-top: 1px solid #eee; padding-top: 4mm; }}

/* ── CONTRACAPA ── */
.contra {{ background: {VERMELHO}; color: #fff; }}
.contra-meio {{ flex: 1; display: flex; flex-direction: column;
               align-items: center; justify-content: center;
               text-align: center; padding: 0 16mm; gap: 4mm; }}
.contra .logo {{ margin-bottom: 6mm; }}
.contato {{ font-size: 11pt; opacity: .9; }}
.contra-pe {{ padding: 6mm 14mm; text-align: center; font-size: 8pt;
             opacity: .7; border-top: 1px solid rgba(255,255,255,.22); }}
</style></head><body>

<div class="folha capa">
  <div class="capa-topo"></div>
  <div class="capa-meio">
    {marca}
    <div class="risco"></div>
    <div class="titulo">{titulo}</div>
    <div class="sub">{subtitulo}</div>
  </div>
  <div class="capa-pe"><span>{SISTEMA}</span><span>versão {versao}</span></div>
</div>

<div class="folha rosto">
  <h2>Sobre este manual</h2>
  <p>Este caderno acompanha o <strong>{SISTEMA}</strong>, o sistema de gestão
     da {LOJA}.</p>
  <p>Ele foi escrito para quem usa a loja no dia a dia — não é preciso
     entender de computador. Cada função tem o passo a passo numerado e, no
     fim, uma tabela com os problemas mais comuns e o que fazer.</p>
  <p class="dado">Versão {versao} · {AUTOR}</p>
  <div class="aviso">
    O sistema se atualiza sozinho. Quando aparecer uma versão nova, o que
    mudou fica em Configurações → Atualização.
  </div>
</div>

<div class="folha contra">
  <div class="capa-topo"></div>
  <div class="contra-meio">
    {marca}
    <div class="risco"></div>
    <div class="contato">Suporte</div>
    <div class="contato">{EMAIL}</div>
  </div>
  <div class="contra-pe">{AUTOR} · {SISTEMA} {versao}</div>
</div>

</body></html>"""


def gerar_capas(nome, titulo, subtitulo, versao):
    """Devolve o caminho do PDF com capa, folha de rosto e contracapa (3 A5)."""
    h = os.path.join(TMP, f'{nome}-capas.html')
    p = os.path.join(TMP, f'{nome}-capas.pdf')
    open(h, 'w', encoding='utf-8').write(
        capa_contracapa_html(titulo, subtitulo, versao))
    r = subprocess.run([WEASY, h, p], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError('capa falhou: ' + r.stderr[-400:])
    return p


def versao_do_projeto():
    import json
    with open(os.path.join(RAIZ, 'neutralino.config.json'), encoding='utf-8') as f:
        return json.load(f)['version']


# ── Gravação ──────────────────────────────────────────────────────────────────
def publicar(doc, destino):
    """Salva o PDF no temporário e copia por cima do destino.

    A pasta do projeto é um mount que não deixa REMOVER arquivo, e o
    pymupdf apaga o antigo antes de gravar — daria 'Operation not
    permitted'. copyfile sobrescreve o conteúdo sem remover o arquivo."""
    tmp = os.path.join(TMP, 'saida-' + os.path.basename(destino))
    doc.save(tmp)
    shutil.copyfile(tmp, destino)


# ── Markdown → PDF ────────────────────────────────────────────────────────────
def md_para_html(md_path, html_path):
    subprocess.run(['pandoc', '-f', 'gfm', '-t', 'html5', '-s',
                    md_path, '-o', html_path], check=True, capture_output=True)
    s = open(html_path, encoding='utf-8').read()
    # o pandoc injeta um bloco de título que duplica o H1 do documento
    s = re.sub(r'<header id="title-block-header">.*?</header>', '', s, flags=re.S)
    open(html_path, 'w', encoding='utf-8').write(s)


def gerar_pdf(nome, corte, a5, saida, desloca=0):
    """Gera o PDF de leitura, cortando em duas partes quando preciso.

    `desloca` soma um valor ao número impresso: o miolo da revista começa na
    página 3 do caderno montado (depois da capa e da folha de rosto), então
    a primeira folha de conteúdo tem de mostrar 3, não 1.

    A numeração é desenhada no fim, sobre o PDF já juntado — ver armadilha 3
    no cabeçalho deste arquivo."""
    import pymupdf
    from pypdf import PdfWriter, PdfReader

    md = open(os.path.join(DOCS, nome + '.md'), encoding='utf-8').read()
    partes = []
    if corte and corte in md:
        i = md.index(corte)
        partes = [md[:i], md[i:]]
    else:
        partes = [md]

    sufixo = 'a5' if a5 else 'a4'
    arq_css = os.path.join(TMP, f'estilo-{sufixo}.css')
    open(arq_css, 'w', encoding='utf-8').write(css(a5))

    pdfs, faltando = [], 0
    for n, txt in enumerate(partes):
        base = os.path.join(TMP, f'{nome}-{sufixo}-{n}')
        open(base + '.md', 'w', encoding='utf-8').write(txt)
        md_para_html(base + '.md', base + '.html')
        r = subprocess.run([WEASY, '-s', arq_css, base + '.html', base + '.pdf'],
                           capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError(f'weasyprint falhou em {base}: {r.stderr[-400:]}')
        faltando += r.stderr.count('.notdef')
        pdfs.append(base + '.pdf')

    if faltando:
        print(f'  ! ATENÇÃO: {faltando} glifo(s) sem fonte — confira os emojis')

    w = PdfWriter()
    for p in pdfs:
        for pg in PdfReader(p).pages:
            w.add_page(pg)
    juntado = os.path.join(TMP, f'{nome}-{sufixo}-juntado.pdf')
    w.write(juntado)

    d = pymupdf.open(juntado)
    for i, p in enumerate(d):
        p.insert_text((p.rect.width / 2 - 4, p.rect.height - (34 if not a5 else 24)),
                      str(i + 1 + desloca), fontsize=7.5, fontname='helv',
                      color=(.6, .6, .6))
    publicar(d, saida)
    return len(d)


# ── Imposição de brochura (saddle stitch) ─────────────────────────────────────
def montar_revista(pdf_capas, pdf_miolo, saida):
    """Monta o A5 completo: capa · folha de rosto · miolo · brancas · contracapa.

    As páginas em branco entram ANTES da contracapa, nunca no fim: a
    contracapa tem de ser a última folha física, senão ela cai no meio do
    caderno depois de grampear.

    O total fecha em múltiplo de 4 porque cada folha A4 dobrada rende
    exatamente 4 páginas A5 — é assim que a gráfica conta."""
    import pymupdf
    capas = pymupdf.open(pdf_capas)     # 0 = capa, 1 = rosto, 2 = contracapa
    miolo = pymupdf.open(pdf_miolo)

    rev = pymupdf.open()
    rev.insert_pdf(capas, from_page=0, to_page=1)      # capa + rosto
    rev.insert_pdf(miolo)                              # conteúdo
    # completa para múltiplo de 4 contando a contracapa que ainda vem
    while (len(rev) + 1) % 4 != 0:
        rev.new_page(width=capas[0].rect.width, height=capas[0].rect.height)
    rev.insert_pdf(capas, from_page=2, to_page=2)      # contracapa
    publicar(rev, saida)
    return len(rev)


def impor_brochura(pdf_a5, saida):
    """Reorganiza as páginas A5 em folhas A4 paisagem para grampear no meio.

    Numa brochura grampeada as páginas NÃO saem em ordem: a folha de fora
    carrega a primeira e a última ao mesmo tempo. Para um caderno de N
    páginas (N múltiplo de 4), cada folha leva:

        frente: [N-2i,  1+2i]        verso: [2+2i,  N-1-2i]

    Ou seja, com 8 páginas: (8,1) (2,7) (6,3) (4,5). Dobrando a pilha ao
    meio e grampeando, a leitura sai 1,2,3…8 na ordem certa.

    A folha é A4 EXATO em paisagem (841.89 × 595.28 pt = 297 × 210 mm) e leva
    uma marca de dobra discreta no topo e na base do centro."""
    import pymupdf

    src = pymupdf.open(pdf_a5)
    n = len(src)
    if n % 4:
        raise RuntimeError(f'revista com {n} páginas não é múltipla de 4')

    A4_L, A4_A = 841.89, 595.28           # A4 paisagem exato, em pontos
    MEIO = A4_L / 2
    out = pymupdf.open()

    def coloca(folha, x, num):
        folha.show_pdf_page(pymupdf.Rect(x, 0, x + MEIO, A4_A), src, num - 1)

    def marca_dobra(folha):
        """Traço fino no topo e na base do centro — só para guiar a dobra."""
        cinza = (.72, .72, .72)
        for y0, y1 in ((0, 12), (A4_A - 12, A4_A)):
            folha.draw_line(pymupdf.Point(MEIO, y0), pymupdf.Point(MEIO, y1),
                            color=cinza, width=.4)

    for i in range(n // 4):
        f = out.new_page(width=A4_L, height=A4_A)     # FRENTE
        coloca(f, 0,    n - 2 * i)
        coloca(f, MEIO, 1 + 2 * i)
        marca_dobra(f)
        v = out.new_page(width=A4_L, height=A4_A)     # VERSO
        coloca(v, 0,    2 + 2 * i)
        coloca(v, MEIO, n - 1 - 2 * i)
        marca_dobra(v)

    publicar(out, saida)
    return len(out)


# ── Conferência de diagramação ────────────────────────────────────────────────
def conferir_buracos(pdf, rotulo, limite=0.35):
    """Denuncia páginas com buraco: pouca tinta e sobra grande no pé.

    O defeito clássico é o título entrar no fim da folha e o bloco seguinte
    (uma tabela grande) não caber, indo inteiro para a próxima — sobra um
    título sozinho com meia folha em branco. Isso não aparece em nenhuma
    verificação de texto; só medindo onde a última linha termina.

    `limite` é a fração da altura útil abaixo da qual a página é suspeita."""
    import pymupdf
    d = pymupdf.open(pdf)
    suspeitas = []
    for i, p in enumerate(d):
        blocos = [b for b in p.get_text('blocks') if b[4].strip()]
        if not blocos:
            continue                      # página em branco proposital
        alt = p.rect.height
        topo = min(b[1] for b in blocos)
        base = max(b[3] for b in blocos)
        # ignora capa/contracapa/rosto (poucas linhas por desenho)
        if len(blocos) <= 6 and topo > alt * .25:
            continue
        ocupado = (base - topo) / alt
        if ocupado < limite:
            primeira = blocos[0][4].strip().split('\n')[0][:44]
            suspeitas.append((i + 1, round(ocupado * 100), primeira))
    if suspeitas:
        print(f'  ! {rotulo}: {len(suspeitas)} página(s) com buraco')
        for n, pct, txt in suspeitas:
            print(f'      pág {n:>3} — só {pct}% ocupada — "{txt}"')
    return suspeitas


def conferir_paginacao(livreto, rotulo):
    """Confere a regra de ouro da diagramação: ÍMPAR à direita, PAR à esquerda.

    Quem folheia um caderno vê sempre o número ímpar na página da direita
    (recto). Se isso inverte, o livreto parece montado ao contrário mesmo
    quando a imposição está certa — foi exatamente o defeito reprovado.

    Confere também que o miolo começa em 1: capa e folha de rosto não
    entram na numeração visível."""
    import pymupdf
    d = pymupdf.open(livreto)
    r = d[0].rect
    erros, vistos = [], []

    def numero(pag, esquerda):
        c = (pymupdf.Rect(0, 0, r.width / 2, r.height) if esquerda
             else pymupdf.Rect(r.width / 2, 0, r.width, r.height))
        t = d[pag].get_text(clip=c).strip()
        if not t:
            return None
        ult = t.split('\n')[-1].strip()
        return int(ult) if ult.isdigit() else None

    for i in range(len(d)):
        for esquerda in (True, False):
            n = numero(i, esquerda)
            if n is None:
                continue
            vistos.append(n)
            lado_certo = (n % 2 == 0) if esquerda else (n % 2 == 1)
            if not lado_certo:
                erros.append(f'pág {n} na {"esquerda" if esquerda else "direita"}')

    if vistos and min(vistos) != 1:
        erros.append(f'a numeração começa em {min(vistos)}, deveria começar em 1')

    if erros:
        print(f'  ! {rotulo}: paginação errada — ' + '; '.join(erros[:4]))
    return erros


# ── Principal ─────────────────────────────────────────────────────────────────
def main():
    print('Gerando os manuais…\n')
    garantir_fonte()
    versao = versao_do_projeto()
    resumo, problemas = [], []

    # Um manual por vez quando pedido: o par inteiro pode estourar o teto de
    # tempo de uma chamada de shell no sandbox.
    #     python3 tools/gerar-manuais.py GUIA-RAPIDO
    filtro = sys.argv[1].upper() if len(sys.argv) > 1 else None
    alvos = [m for m in MANUAIS if not filtro or m[0] == filtro]
    if filtro and not alvos:
        print(f'!! "{filtro}" não está na lista. Opções: '
              + ', '.join(m[0] for m in MANUAIS))
        return 1

    for nome, corte, titulo, subtitulo in alvos:
        if not os.path.exists(os.path.join(DOCS, nome + '.md')):
            print(f'  ! {nome}.md não encontrado, pulando'); continue
        print(f'\n{nome}')

        a4 = os.path.join(DOCS, f'{nome}.pdf')
        pg = gerar_pdf(nome, corte, False, a4)
        print(f'  · A4 de leitura ........ {pg} páginas')

        # Miolo A5, numerado a partir de 1.
        #
        # Capa e folha de rosto NÃO contam na numeração visível — é o padrão
        # editorial, e foi entrega reprovada quando o primeiro conteúdo saiu
        # com "3". O deslocamento físico (o miolo ocupa a 3ª posição do
        # caderno) é PAR, então a paridade continua certa sozinha:
        # número ímpar cai em posição ímpar = página da direita.
        miolo = os.path.join(TMP, f'{nome}-miolo.pdf')
        pgm = gerar_pdf(nome, corte, True, miolo, desloca=0)

        problemas += conferir_buracos(miolo, f'{nome} (miolo A5)')

        capas = gerar_capas(nome, titulo, subtitulo, versao)

        a5 = os.path.join(DOCS, f'{nome}-A5.pdf')
        total = montar_revista(capas, miolo, a5)
        brancas = total - pgm - 3
        print(f'  · revista A5 ........... {total} páginas '
              f'(capa + rosto + {pgm} de miolo + {brancas} em branco + contracapa)')

        # nome autoexplicativo: é ESTE que vai para a impressora
        br = os.path.join(DOCS, f'{nome}-LIVRETO-IMPRIMIR-A4.pdf')
        lados = impor_brochura(a5, br)
        print(f'  · livreto para imprimir  {lados // 2} folhas A4 ({lados} lados)')
        problemas += conferir_paginacao(br, f'{nome} (livreto)')
        resumo.append((nome, pg, total, lados // 2))

    print('\n' + '─' * 64)
    print('PRONTO. Para montar a revistinha:')
    print('  1. Imprima o arquivo -LIVRETO-IMPRIMIR-A4 em papel A4')
    print('  2. Orientação PAISAGEM · frente e verso VIRANDO NA BORDA CURTA')
    print('  3. Escala 100% (NÃO marcar "ajustar à página")')
    print('  4. Dobre a pilha inteira ao meio, na marca cinza do centro')
    print('  5. Grampeie duas vezes em cima da dobra')
    print('─' * 64)
    for nome, a4, a5, folhas in resumo:
        print(f'  {nome}: leitura A4 {a4}p · revista A5 {a5}p · {folhas} folhas para imprimir')

    if problemas:
        print(f'\n!! {len(problemas)} página(s) com buraco de diagramação — '
              'confira antes de mandar imprimir')
        return 1
    print('\nDiagramação conferida: nenhuma página com buraco.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
