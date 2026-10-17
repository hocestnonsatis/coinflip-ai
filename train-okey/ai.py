"""Hand features, the tiny value net and the bots (random, greedy solver heuristic, net). Mirrored by src/lib/okey-ai.ts."""
import math, random
import numpy as np
from okey import counts, cover, pairs, solve_sets, ttype, tcol, tval, FJ, NT

NF = 14   # inputs
NH = 16   # hidden

def _partials(left):
    """Pairs of leftover tiles that are two thirds of a set, and the tile types that would complete them."""
    n = 0; need = set()
    L = [t for t in left if t >= 0]
    for a in range(len(L)):
        for b in range(a + 1, len(L)):
            x, y = L[a], L[b]
            cx, vx, cy, vy = tcol(x), tval(x), tcol(y), tval(y)
            if vx == vy and cx != cy:
                n += 1
                for k in range(4):
                    if k != cx and k != cy: need.add(k * 13 + vx - 1)
            elif cx == cy and vx != vy:
                lo, hi = min(vx, vy), max(vx, vy)
                gaps = {hi - lo}
                if lo == 1: gaps.add(14 - hi)   # 1 as the top: 12‑…‑1 / 13‑1
                g = min(gaps)
                if g == 1:
                    n += 1
                    if hi - lo == 1:
                        if lo > 1: need.add(cx * 13 + lo - 2)
                        need.add(cx * 13 + (hi % 13))       # hi+1 (13 → 1)
                    else:  # 13 & 1
                        need.add(cx * 13 + 11)              # 12
                elif g == 2:
                    n += 1
                    mid = lo + 1 if hi - lo == 2 else 13    # 12 & 1 → 13
                    need.add(cx * 13 + mid - 1)
    return n, need

def _extends(sets):
    """Tile types that would grow an existing set (each one lets a leftover tile go → one tile closer)."""
    need = set()
    for s in sets:
        real = [t for t in s if t >= 0]
        if not real: continue
        cols = {tcol(t) for t in real}; vals = sorted({tval(t) for t in real})
        group_like = len(vals) == 1 and len(cols) == len(real)
        run_like = len(cols) == 1
        if group_like and len(s) < 4:
            for k in range(4):
                if k not in cols: need.add(k * 13 + vals[0] - 1)
        if run_like and (len(real) == 1 or not group_like or len(real) == 1):
            col = tcol(real[0])
            if len(real) > 1 and len(vals) == 1: continue
            lo, hi = vals[0], vals[-1]
            top_one = 1 in vals and 13 in vals and len(vals) < 13  # …‑13‑1 run: the 1 is the top
            if top_one:
                lows = [v for v in vals if v != 1]; lo = lows[0]
                if lo > 2: need.add(col * 13 + lo - 2)
            else:
                if lo > 1: need.add(col * 13 + lo - 2)
                if hi < 13: need.add(col * 13 + hi)
                elif hi == 13: need.add(col * 13)  # 1 after 13
    return need

def features(hand, okey, seen, pile_left):
    """hand: 14 tile ids (after discard). seen: public type counts (discards + gösterge)."""
    c, w = counts(hand, okey)
    cov = cover(c, w); dw = 14 - cov
    sets, left = solve_sets(c, w)
    pr = pairs(c, w)
    npart, need = _partials(left)
    need |= _extends(sets)
    raw = [0] * NT
    for i in hand: raw[ttype(i)] += 1
    outs = 0
    for t in need:
        if t == okey: continue
        unseen = 2 - seen[t] - raw[t]
        if t == okey: unseen = 0
        if okey == t: unseen = 0
        outs += max(0, unseen)
    outs += max(0, 2 - seen[okey] - raw[okey])  # wildcards always help
    f = [dw / 8, dw == 1, dw == 2, dw == 3, dw == 4, dw >= 5, pr / 7, pr >= 5, pr >= 6, w / 2, min(npart, 6) / 6, min(outs, 24) / 24, pile_left / 48, len(sets) / 5]
    return np.array(f, dtype=np.float64), dw

class Net:
    def __init__(self, seed=0):
        r = np.random.default_rng(seed)
        self.W1 = r.normal(0, 0.3, (NH, NF)); self.b1 = np.zeros(NH)
        self.W2 = r.normal(0, 0.3, NH); self.b2 = np.array(-1.0)
    @property
    def params(self): return self.W1.size + self.b1.size + self.W2.size + 1
    def forward(self, x):
        h = np.tanh(self.W1 @ x + self.b1)
        return 1 / (1 + math.exp(-(self.W2 @ h + self.b2))), h
    def v(self, x): return self.forward(x)[0]
    def vbatch(self, X):
        H = np.tanh(X @ self.W1.T + self.b1)
        return 1 / (1 + np.exp(-(H @ self.W2 + self.b2)))
    def save(self, path, **meta): np.savez(path, W1=self.W1, b1=self.b1, W2=self.W2, b2=self.b2, **meta)
    @staticmethod
    def load(path):
        d = np.load(path); n = Net(); n.W1, n.b1, n.W2, n.b2 = d['W1'], d['b1'], d['W2'], d['b2'].reshape(()); return n

# ---------------- bots ----------------
def finishing_tile(g, s):
    """A tile whose discard wins now (prefer discarding an okey, worth double), or None."""
    hand = g.hands[s]; best = None
    for i in sorted(set(hand), key=lambda i: (ttype(i) != g.okey, i)):
        if g.win_with(s, i) is not None:
            return i
    return best

def distinct(hand):
    seen = set(); out = []
    for i in hand:
        t = ttype(i)
        if t not in seen: seen.add(t); out.append(i)
    return out

class RandomBot:
    name = 'random'
    def __init__(self, rng): self.rng = rng
    def draw(self, g, s): return 'discard' if self.rng.random() < 0.5 else 'pile'
    def discard(self, g, s):
        f = finishing_tile(g, s)
        if f is not None: return f, True
        return self.rng.choice(g.hands[s]), False

def dw_of(hand, okey):
    c, w = counts(hand, okey); return 14 - cover(c, w)

class GreedyBot:
    """Solver heuristic: minimise tiles away from a win; ties → most outs, then most partial sets. Takes the discard only if it helps."""
    name = 'greedy'
    def __init__(self, rng): self.rng = rng
    def score(self, g, s, hand):
        f, dw = features(hand, g.okey, g.seen, len(g.pile))
        return (-dw, f[11], f[10], f[6], self.rng.random())
    def best_after(self, g, s, hand15):
        best = None
        for i in distinct(hand15):
            h = list(hand15); h.remove(i)
            sc = self.score(g, s, h)
            if best is None or sc > best[0]: best = (sc, i)
        return best
    def draw(self, g, s):
        top = g.top_discard(s)
        cur = dw_of(g.hands[s], g.okey)
        # winning take
        h = g.hands[s] + [top]
        for i in distinct(h):
            hh = list(h); hh.remove(i)
            c, w = counts(hh, g.okey)
            if cover(c, w) == 14 or pairs(c, w) >= 7: return 'discard'
        sc, _ = self.best_after(g, s, h)
        return 'discard' if -sc[0] < cur else 'pile'
    def discard(self, g, s):
        f = finishing_tile(g, s)
        if f is not None: return f, True
        return self.best_after(g, s, g.hands[s])[1], False

class NetBot:
    name = 'net'
    def __init__(self, net, rng, eps=0.0, tau=0.0, record=False):
        self.net, self.rng, self.eps, self.tau, self.record = net, rng, eps, tau, record
        self.traj = []
    def reset(self): self.traj = []
    def evals(self, g, s, hand15):
        cands = distinct(hand15); X = []
        for i in cands:
            h = list(hand15); h.remove(i)
            X.append(features(h, g.okey, g.seen, len(g.pile))[0])
        X = np.array(X); return cands, X, self.net.vbatch(X)
    def draw(self, g, s):
        top = g.top_discard(s)
        h = g.hands[s] + [top]
        for i in distinct(h):
            hh = list(h); hh.remove(i)
            c, w = counts(hh, g.okey)
            if cover(c, w) == 14 or pairs(c, w) >= 7: return 'discard'
        _, _, V = self.evals(g, s, h)
        cur = self.net.v(features(g.hands[s], g.okey, g.seen, len(g.pile))[0])
        return 'discard' if V.max() > cur + self.tau else 'pile'
    def discard(self, g, s):
        f = finishing_tile(g, s)
        if f is not None: return f, True
        cands, X, V = self.evals(g, s, g.hands[s])
        k = int(np.argmax(V))
        if self.eps and self.rng.random() < self.eps: k = self.rng.randrange(len(cands))
        if self.record: self.traj.append(X[k])
        return cands[k], False
