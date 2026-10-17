import random, sys
from multiprocessing import Pool
from okey import play
from ai import *
path, N = sys.argv[1], int(sys.argv[2])
def job(args):
    label, seed = args; net = Net.load(path); r = random.Random(seed); w = 0
    mk = {'greedy': lambda: GreedyBot(r), 'tau0': lambda: NetBot(net, r), 'tau.03': lambda: NetBot(net, r, tau=0.03), 'k0': lambda: NetBot(net, r, k_draw=0)}[label]
    for k in range(N):
        g, win = play([mk()] + [GreedyBot(r) for _ in range(3)], r, dealer=k % 4); w += win == 0
    return label, w
if __name__ == '__main__':
    labels = ['greedy', 'tau0', 'tau.03', 'k0']
    with Pool(8) as p: res = p.map(job, [(l, s) for l in labels for s in (1, 2)])
    for l in labels: print(l, sum(w for k, w in res if k == l) / (2 * N))
