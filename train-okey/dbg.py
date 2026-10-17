import random, numpy as np
from okey import Game, ttype, tcol, tval
from ai import *
net = Net.load('/tmp/sup-test.npz'); rng = random.Random(3)
g = Game(rng, dealer=0)
nb = NetBot(net, rng); gb = GreedyBot(rng)
cands, X, V = nb.evals(g, 0, g.hands[0])
for i, x, v in sorted(zip(cands, X, V), key=lambda z: -z[2]):
    print(f'{"RYBK"[tcol(ttype(i))] if ttype(i) < 52 else "J"}{tval(ttype(i)) if ttype(i) < 52 else ""}', 'dw', round(x[0] * 8), 'pairs', round(x[6] * 7), 'w', x[9] * 2, 'part', round(x[10] * 6), 'outs', round(x[11] * 24), 'sets', round(x[13] * 5), 'V', round(float(v), 4))
print('greedy picks', gb.best_after(g, 0, g.hands[0])[1])
print('W2', net.W2.round(2)); 
