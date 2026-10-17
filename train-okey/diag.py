import random, sys
from okey import play
from ai import *
net = Net.load(sys.argv[1]); N = int(sys.argv[2])
class Hybrid(NetBot):
    def draw(self, g, s): return GreedyBot(self.rng).draw(g, s)
def run(mk, label):
    r = random.Random(7); w = 0; d = 0
    for k in range(N):
        g, win = play([mk(r)] + [GreedyBot(r) for _ in range(3)], r, dealer=k % 4); w += win == 0; d += win is None
    print(label, w / N, 'draws', d / N, flush=True)
run(lambda r: GreedyBot(r), 'greedy-ref')
run(lambda r: NetBot(net, r), 'net tau0')
run(lambda r: NetBot(net, r, tau=0.05), 'net tau.05')
run(lambda r: Hybrid(net, r), 'net discard + greedy draw')
