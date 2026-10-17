"""Final held-out evaluation (seeds 90000+, never used in training): the model in seat 0 vs 3 opponents, dealer rotating.
python3 evaluate.py <net.npz> <games per matchup> [tau] → eval-final.json"""
import json, random, sys, time
from multiprocessing import Pool
from okey import play
from ai import Net, NetBot, GreedyBot, RandomBot
path, N = sys.argv[1], int(sys.argv[2]); tau = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
P = 8
def job(a):
    me, opp, part = a; r = random.Random(90000 + 1000 * part + {'random': 1, 'greedy': 2}[opp] * 100 + (me == 'net') * 10); net = Net.load(path); w = d = 0
    n = N // P + (1 if part < N % P else 0)
    for k in range(n):
        p0 = NetBot(net, r, tau=tau) if me == 'net' else GreedyBot(r)
        g, win = play([p0] + [(GreedyBot(r) if opp == 'greedy' else RandomBot(r)) for _ in range(3)], r, dealer=(part + k) % 4)
        w += win == 0; d += win is None
    return me, opp, w, d, n
if __name__ == '__main__':
    t0 = time.time(); jobs = [(m, o, p) for m, o in [('net', 'random'), ('net', 'greedy'), ('greedy', 'greedy')] for p in range(P)]
    with Pool(P) as pool: res = pool.map(job, jobs)
    out = {'model': path, 'tau': tau, 'seats': 'model in seat 0, dealer rotates', 'seeds': '90000+ (held out)'}
    for m, o in [('net', 'random'), ('net', 'greedy'), ('greedy', 'greedy')]:
        rs = [x for x in res if x[0] == m and x[1] == o]
        out[f'{m}_vs_3{o}'] = {'w': sum(x[2] for x in rs), 'd': sum(x[3] for x in rs), 'n': sum(x[4] for x in rs)}
    out['minutes'] = round((time.time() - t0) / 60, 1)
    json.dump(out, open('eval-final.json', 'w'), indent=1); print(json.dumps(out))
