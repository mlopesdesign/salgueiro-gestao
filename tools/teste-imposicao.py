import sys, math
sys.path.insert(0, '/sessions/stoic-loving-carson/mnt/LOJA FISICA SALGUEIRO V2/tools')

def ordem(total):
    """Reproduz a imposição do script e devolve as folhas."""
    folhas = []
    for i in range(total // 4):
        folhas.append(('frente', total - 2*i, 1 + 2*i))
        folhas.append(('verso',  2 + 2*i,     total - 1 - 2*i))
    return folhas

def leitura(total):
    """Simula dobrar a pilha e ler o caderno na ordem."""
    f = ordem(total)
    n_folhas = total // 4
    seq = []
    # metade DIREITA da frente e metade ESQUERDA do verso: primeira metade do livro
    # percorrendo de fora para dentro e depois voltando
    for i in range(n_folhas):
        seq.append(f[2*i][2])      # frente, direita  -> 1, 3, 5...
        seq.append(f[2*i+1][1])    # verso,  esquerda -> 2, 4, 6...
    for i in range(n_folhas-1, -1, -1):
        seq.append(f[2*i+1][2])    # verso,  direita
        seq.append(f[2*i][1])      # frente, esquerda
    return seq

ok = True
for total in (4, 8, 12, 16, 44, 88):
    seq = leitura(total)
    esperado = list(range(1, total+1))
    bateu = seq == esperado
    if not bateu: ok = False
    print(f'{total:>3} paginas -> leitura correta: {"SIM" if bateu else "NAO"}')
    if total == 8:
        print('     folhas:', [(t, a, b) for t,a,b in ordem(8)])
        print('     lido  :', seq)
    if not bateu:
        print('     esperado:', esperado)
        print('     obtido  :', seq)
print('\nIMPOSICAO', 'OK' if ok else 'COM ERRO')
