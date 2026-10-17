import random, time
from okey import play
from ai import *
rng = random.Random(0)
net = Net(1)
for name, mk in [('greedy', lambda: [GreedyBot(rng) for _ in range(4)]), ('net', lambda: [NetBot(net, rng) for _ in range(4)]), ('random', lambda: [RandomBot(rng) for _ in range(4)])]:
    t0 = time.time(); wins = [0] * 5; turns = 0; N = 30
    for _ in range(N):
        g, w = play(mk(), rng); wins[4 if w is None else w] += 1; turns += g.turns
    print(name, f'{(time.time() - t0) / N:.2f}s/game', 'wins', wins, 'avg turns', turns / N)
