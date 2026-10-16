import random, numpy as np
from bg import legal, encode_batch
def pick_net(net, b, d1, d2):
    L = legal(b, d1, d2); ks = list(L)
    if len(ks) == 1: return ks[0]
    v, _ = net.fwd(encode_batch(ks)); return ks[int(np.argmax(v))]
def pick_random(b, d1, d2, rng=random):
    return rng.choice(list(legal(b, d1, d2)))
def heur_score(r):
    # r: board after my move (my view). pip-count race + safety heuristic
    mypip = sum((i + 1) * r[i] for i in range(24) if r[i] > 0) + 25 * r[24]
    oppip = sum((24 - i) * -r[i] for i in range(24) if r[i] < 0) + 25 * r[25]
    blots = sum(1 for i in range(24) if r[i] == 1)
    points = sum(1 for i in range(24) if r[i] >= 2)
    return (oppip - mypip) - 4 * blots + 2 * points + 3 * r[26]
def pick_heur(b, d1, d2):
    L = legal(b, d1, d2); return max(L, key=heur_score)
