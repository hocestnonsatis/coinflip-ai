"""Supervised targets for the value net: afterstate features of (ε-perturbed) greedy-solver players, labelled with the final outcome.
Resumable: python3 datagen.py <shard> <minutes> → data/shard<k>.npz (appends to an existing shard)."""
import sys, os, time, random
import numpy as np
from okey import play
from ai import GreedyBot, features, distinct

class Rec(GreedyBot):
    """Greedy player that sometimes discards a random non-finishing tile (covers off-policy hands) and records afterstates."""
    def __init__(self, rng, eps): super().__init__(rng); self.eps = eps; self.X = []
    def discard(self, g, s):
        tile, fin = super().discard(g, s)
        if not fin and self.rng.random() < self.eps: tile = self.rng.choice(g.hands[s])
        if not fin:
            h = list(g.hands[s]); h.remove(tile)
            self.X.append(features(h, g.okey, g.seen, len(g.pile))[0])
        return tile, fin

k, minutes = int(sys.argv[1]), float(sys.argv[2])
policy = sys.argv[3] if len(sys.argv) > 3 else 'greedy'  # or a net checkpoint path
from ai import Net, NetBot
net = Net.load(policy) if policy != 'greedy' else None
prefix = sys.argv[4] if len(sys.argv) > 4 else 'shard'
os.makedirs('data', exist_ok=True); path = f'data/{prefix}{k}.npz'
X0, Y0 = (np.load(path)['X'], np.load(path)['Y']) if os.path.exists(path) else (np.zeros((0, 14)), np.zeros(0))
rng = random.Random(1000 + k * 7 + len(Y0)); Xs, Ys = [X0], [Y0]; t0 = time.time(); games = 0
while time.time() - t0 < minutes * 60:
    ps = [Rec(rng, rng.choice([0.0, 0.1, 0.25])) if net is None else NetBot(net, rng, eps=rng.choice([0.0, 0.1, 0.2]), record=True) for _ in range(4)]
    g, win = play(ps, rng)
    for s, p in enumerate(ps):
        X = p.X if net is None else p.traj
        if X: Xs.append(np.array(X)); Ys.append(np.full(len(X), 1.0 if win == s else 0.0))
    games += 1
    if games % 500 == 0: np.savez(path, X=np.concatenate(Xs), Y=np.concatenate(Ys)); print(k, games, flush=True)
np.savez(path, X=np.concatenate(Xs), Y=np.concatenate(Ys)); print('done', k, games, len(np.concatenate(Ys)))
