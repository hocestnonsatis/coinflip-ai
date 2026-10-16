"""Evaluate checkpoints vs a random player and vs a pip-count heuristic bot.
screen: python3 eval.py screen N ck/*/g*.npz   → JSON lines (heuristic win rate, N games each), parallel
full:   python3 eval.py full N ck/x/gY.npz     → win rates vs random and vs heuristic (N games each, colors/first move random)"""
import sys, json, random, glob
from multiprocessing import Pool
from play import game
from players import pick_net, pick_random, pick_heur
from net import Net
def run(args):
    path, opp, n, seed = args
    net = Net.load(path); rng = random.Random(seed); w = 0
    me = lambda b, a, c: pick_net(net, b, a, c)
    op = pick_heur if opp == 'heur' else (lambda b, a, c: pick_random(b, a, c, rng))
    for _ in range(n): w += game(me, op, rng) > 0
    return path, opp, w, n
if __name__ == '__main__':
    mode, n, paths = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
    with Pool(8) as p:
        if mode == 'screen':
            for path, opp, w, k in p.imap_unordered(run, [(q, 'heur', n, 1) for q in paths]):
                print(json.dumps({'ck': path, 'heur': w / k}), flush=True)
        else:
            jobs = [(paths[0], o, n // 8, int(__import__('os').environ.get('SEED', 1000)) + i) for o in ('rand', 'heur') for i in range(8)]
            agg = {}
            for path, opp, w, k in p.imap_unordered(run, jobs):
                a = agg.setdefault(opp, [0, 0]); a[0] += w; a[1] += k
            print(json.dumps({'ck': paths[0], **{o: {'w': v[0], 'n': v[1], 'rate': v[0] / v[1]} for o, v in agg.items()}}))
