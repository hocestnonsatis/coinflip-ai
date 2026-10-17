# Brute-force cross-check of the solver on small random hands + speed check.
import random, time, itertools
from okey import *
import okey as O

def brute(c, w):
    """Exhaustive: try all ways to form sets from the multiset (slow; for ≤ 9 tiles)."""
    tiles = [t for t in range(52) for _ in range(c[t])] + [-1] * w
    best = 0
    def valid(s):
        real = [t for t in s if t >= 0]; nw = len(s) - len(real)
        if len(s) < 3: return False
        # group
        if len(s) <= 4 and len(set(tval(t) for t in real)) <= 1 and len(set(tcol(t) for t in real)) == len(real): return True
        if len(set(tcol(t) for t in real)) > 1: return False
        vals = sorted(tval(t) for t in real)
        if len(set(vals)) != len(vals): return False
        L = len(s)
        if L > 13: return False
        for start in range(1, 13):
            pos = set(range(start, start + L))
            if max(pos) > 14: break
            vv = set(14 if (x == 1 and 14 in pos and 1 not in pos) else x for x in vals)
            if vv <= pos: return True
        return False
    n = len(tiles)
    def rec(rem, got):
        nonlocal best
        best = max(best, got)
        if not rem: return
        first = rem[0]; rest = rem[1:]
        rec(rest, got)  # leave first over
        for k in range(2, min(13, len(rest)) + 1):
            for comb in itertools.combinations(range(len(rest)), k):
                s = [first] + [rest[j] for j in comb]
                if valid(s):
                    rr = [rest[j] for j in range(len(rest)) if j not in comb]
                    rec(rr, got + len(s))
    rec(tiles, 0)
    return best

rng = random.Random(1)
bad = 0
for it in range(3000):
    n = rng.randint(3, 9)
    ids = rng.sample(range(106), n)
    okey = ttype(ids[0]) if it % 3 == 0 and ids[0] < 104 else rng.randrange(52)
    if it % 5 == 0: ids = ids[:-1] + [104]
    # bias towards structure: sometimes build near-sets
    if it % 2:
        col = rng.randrange(4); v = rng.randint(1, 11)
        ids = [col * 26 + (v - 1 + k) * 2 for k in range(3)] + rng.sample(range(106), n - 3)
        ids = list(set(ids))
        if it % 4 == 1: okey = col * 13 + (v + 3) % 13  # a wild nearby
    c, w = counts(ids, okey)
    a = cover(c, w); b = brute(c, w)
    if a != b:
        bad += 1
        if bad < 6: print('MISMATCH', [(tcol(t), tval(t)) for t in range(52) for _ in range(c[t])], 'w', w, 'solver', a, 'brute', b)
print('mismatches', bad, '/ 3000')
# specific rule checks
R = lambda v: (v - 1) * 2  # red tile ids (copy 0)
def C(ids, okey=51): return counts(ids, okey)
assert cover(*C([R(12), R(13), R(1)])) == 3, '12-13-1 valid'
assert cover(*C([R(13), R(1), R(2)])) == 0, '13-1-2 invalid'
assert cover(*C([R(1), R(2), R(3)])) == 3
Y = lambda v: 26 + (v - 1) * 2; B = lambda v: 52 + (v - 1) * 2; K = lambda v: 78 + (v - 1) * 2
assert cover(*C([R(5), Y(5), B(5), K(5)])) == 4
assert cover(*C([R(5), R(5) + 1, Y(5)])) == 0, 'same colour twice is not a group'
# okey as wildcard: okey = red 7 (gösterge red 6)
ok = okey_of(5)
assert ok == 6
assert cover(*counts([R(3), R(4), R(7)], ok)) == 3, 'red 7 tile is the okey → wild'
assert cover(*counts([R(6), R(8), 104], ok)) == 3, 'false joker = red 7 as a plain tile'
assert okey_of(12) == 0, '13 → 1 wrap'
# speed: 14-tile random hands
O._memo.clear()
t0 = time.time(); N = 3000
for _ in range(N):
    ids = rng.sample(range(106), 14); c, w = counts(ids, rng.randrange(52)); cover(c, w)
print(f'{(time.time() - t0) / N * 1000:.2f} ms per 14-tile hand (cold-ish memo)')
# tricky wildcard cases vs brute
W = 103  # blue? id 103 → type 51 (black 13); use okey=51 so id 102/103 are wilds
cases = [[R(12), R(13), 102], [R(13), 102, 103], [R(1), 102, 103], [102, 103], [R(5), 102, 103], [R(1), R(2), R(3), 102],
         [R(5), Y(5), B(5), K(5), 102], [R(13), R(1), 102], [R(12), R(1), 102], [R(1), R(13), R(12), R(11), 102, 103], [R(2), R(13), 102]]
for cs in cases:
    c, w = counts(cs, 51)
    a, b = cover(c, w), brute(c, w)
    print([('W' if t >= 102 else f'R{(t // 2) % 13 + 1}' if t < 26 else t) for t in cs], a, b, '' if a == b else 'MISMATCH')
nw = 0
