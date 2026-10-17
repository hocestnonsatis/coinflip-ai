"""Self-play TD(λ) for the okey value net. Resumable: python3 td.py <name> <lr0> <lr1> <lam> <eps> <minutes> [mix] [seed]
Writes ck/<name>/last.npz (+ games/minutes so far) every 200 games and logs/<name>.log; rerun the same command to continue."""
import sys, os, time, random, json
import numpy as np
from okey import play
from ai import Net, NetBot, GreedyBot, RandomBot

name, lr0, lr1, lam, eps, minutes = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6])
mix = float(sys.argv[7]) if len(sys.argv) > 7 else 0.0
seed = int(sys.argv[8]) if len(sys.argv) > 8 else hash(name) % 10000
os.makedirs(f'ck/{name}', exist_ok=True); os.makedirs('logs', exist_ok=True)
last = f'ck/{name}/last.npz'
games, spent = 0, 0.0
if os.path.exists(last):
    net = Net.load(last); d = np.load(last); games, spent = int(d['games']), float(d['minutes'])
else:
    net = Net(seed)
rng = random.Random(seed * 7919 + games)
log = open(f'logs/{name}.log', 'a')
def say(*a):
    m = ' '.join(str(x) for x in a); print(m, flush=True); log.write(m + '\n'); log.flush()
say(f'start {name} lr {lr0}->{lr1} lam {lam} eps {eps} mix {mix} games {games} spent {spent:.1f}min params {net.params}')

def update(X, z, lr):
    V = net.vbatch(X); T = len(X)
    G = np.empty(T); G[-1] = z
    for t in range(T - 2, -1, -1): G[t] = (1 - lam) * V[t + 1] + lam * G[t + 1]
    for t in range(T):
        x = X[t]; h = np.tanh(net.W1 @ x + net.b1)
        v = 1 / (1 + np.exp(-(net.W2 @ h + net.b2)))
        e = G[t] - v                      # cross-entropy gradient w.r.t. the output logit
        gh = e * net.W2 * (1 - h * h)
        net.W2 += lr * e * h; net.b2 += lr * e
        net.W1 += lr * np.outer(gh, x); net.b1 += lr * gh

def quick_eval(n=200):
    r = random.Random(12345); w = 0
    for k in range(n):
        ps = [NetBot(net, r)] + [GreedyBot(r) for _ in range(3)]
        g, win = play(ps, r, dealer=k % 4)
        w += win == 0
    return w / n

t0 = time.time(); budget = minutes - spent
while (time.time() - t0) / 60 < budget:
    frac = min(1.0, (spent + (time.time() - t0) / 60) / minutes)
    lr = lr0 + (lr1 - lr0) * frac
    learners = [NetBot(net, rng, eps=eps, record=True) for _ in range(4)]
    seats = list(learners)
    if mix and rng.random() < mix:
        for k in rng.sample(range(4), rng.choice([1, 2])): seats[k] = GreedyBot(rng)
    g, win = play(seats, rng)
    for s, p in enumerate(seats):
        if isinstance(p, NetBot) and p.traj: update(np.array(p.traj), 1.0 if win == s else 0.0, lr)
    games += 1
    if games % 200 == 0:
        m = spent + (time.time() - t0) / 60
        net.save(last, games=games, minutes=m)
        if games % 1000 == 0:
            q = quick_eval()
            net.save(f'ck/{name}/g{games}.npz', games=games, minutes=m)
            say(f'games {games} min {m:.1f} lr {lr:.4f} quick-eval vs 3 greedy {q:.3f}')
m = spent + (time.time() - t0) / 60
net.save(last, games=games, minutes=m); net.save(f'ck/{name}/final.npz', games=games, minutes=m)
say(f'done games {games} minutes {m:.1f}')
