"""Backgammon engine (no cube). Board is always from the side-to-move's view:
b[0..23] points (mine >0, opponent <0); I move from high index to low and bear off below 0.
b[24]=my bar, b[25]=opp bar, b[26]=my off, b[27]=opp off. All counts non-negative except points."""
import numpy as np

def start():
    b = [0] * 28
    b[23] = 2; b[12] = 5; b[7] = 3; b[5] = 5
    b[0] = -2; b[11] = -5; b[16] = -3; b[18] = -5
    return tuple(b)

def flip(b):
    n = [0] * 28
    for i in range(24): n[i] = -b[23 - i]
    n[24], n[25], n[26], n[27] = b[25], b[24], b[27], b[26]
    return tuple(n)

def single_moves(b, d):
    """All (from,to) single checker moves with die d; from=24 means bar, to=-1 means off. Returns list of (move, newboard-list)."""
    out = []
    if b[24] > 0:
        t = 24 - d
        if b[t] >= -1:
            n = list(b); n[24] -= 1
            if n[t] == -1: n[t] = 0; n[25] += 1
            n[t] += 1; out.append(((24, t), n))
        return out
    allhome = all(b[i] <= 0 for i in range(6, 24))
    hi = -1
    if allhome:
        for i in range(5, -1, -1):
            if b[i] > 0: hi = i; break
    for p in range(23, -1, -1):
        if b[p] <= 0: continue
        t = p - d
        if t >= 0:
            if b[t] >= -1:
                n = list(b); n[p] -= 1
                if n[t] == -1: n[t] = 0; n[25] += 1
                n[t] += 1; out.append(((p, t), n))
        elif allhome and (t == -1 or p == hi):
            n = list(b); n[p] -= 1; n[26] += 1; out.append(((p, -1), n))
    return out

def legal(b, d1, d2):
    """Dict: resulting board tuple -> move sequence (list of (from,to)). Enforces max-dice and larger-die rules."""
    seqs = {}  # result -> (ndice, dice used list, moves)
    orders = [[d1] * 4] if d1 == d2 else [[d1, d2], [d2, d1]]
    best = [0]
    res = []
    def rec(bb, dice, used, moves):
        ext = False
        if dice:
            for mv, n in single_moves(bb, dice[0]):
                ext = True
                rec(n, dice[1:], used + [dice[0]], moves + [mv])
        if not ext:
            res.append((tuple(bb), used, moves))
    for o in orders: rec(b, o, [], [])
    mx = max(len(u) for _, u, _ in res)
    cand = [r for r in res if len(r[1]) == mx]
    if mx == 1 and d1 != d2:
        big = max(d1, d2)
        if any(r[1][0] == big for r in cand): cand = [r for r in cand if r[1][0] == big]
    out = {}
    for bb, u, m in cand:
        if bb not in out: out[bb] = m
    return out

def winner_done(b):
    return b[26] == 15

# Tesauro 198-input encoding of a position seen by the player who just moved ("me" = positive side), opponent to move.
def encode_batch(B):
    """B: int array (n,28) from 'my' view. Returns float32 (n,198)."""
    B = np.asarray(B, dtype=np.int32)
    n = B.shape[0]
    X = np.zeros((n, 198), np.float32)
    for side, sgn in ((0, 1), (1, -1)):
        c = np.clip(B[:, :24] * sgn, 0, None).astype(np.float32)  # (n,24)
        u = np.stack([c >= 1, c >= 2, c >= 3, np.maximum(c - 3, 0) / 2], axis=2).astype(np.float32)  # (n,24,4)
        X[:, side * 96: side * 96 + 96] = u.reshape(n, 96)
    X[:, 192] = B[:, 24] / 2; X[:, 193] = B[:, 25] / 2
    X[:, 194] = B[:, 26] / 15; X[:, 195] = B[:, 27] / 15
    X[:, 196] = 0; X[:, 197] = 1  # opponent to move
    return X
