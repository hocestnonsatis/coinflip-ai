"""Classic Turkish Okey rules engine + exact hand solver (Python reference; src/lib/okey-engine.ts is the parity-tested port).

Tiles: ids 0..105. id < 104 → type = id // 2 = color*13 + (value-1) (colors 0 red, 1 yellow, 2 blue, 3 black); ids 104, 105 = false jokers (type 52).
Okey (wildcard) = gösterge + 1, same color, 13 → 1. False jokers stand for the okey's colour/value as an ordinary tile.
Sets: runs (same colour, ≥3 consecutive; 1 may follow 13 as in 12‑13‑1, but nothing follows that 1), groups (same value, 3–4 different colours).
A hand wins when 14 tiles are all in sets (after drawing to 15 and discarding the 15th), or as 7 pairs (çift).
Designed to extend to 101 Okey later: the solver reports the actual sets, which 101 scoring needs.
"""
import random

NT = 53          # 52 normal types + false joker
FJ = 52
def tcol(t): return t // 13
def tval(t): return t % 13 + 1
def ttype(i): return i // 2 if i < 104 else FJ
def okey_of(gosterge_type):
    c, v = tcol(gosterge_type), tval(gosterge_type)
    return c * 13 + (v % 13)  # value v+1, 13 → 1

def counts(hand_ids, okey):
    """→ (c[52], wilds): real okeys are wildcards, false jokers count as the okey type."""
    c = [0] * 52; w = 0
    for i in hand_ids:
        t = ttype(i)
        if t == okey: w += 1
        elif t == FJ: c[okey] += 1
        else: c[t] += 1
    return c, w

# ---------------- exact solver: max tiles in valid sets ----------------
# DFS over the first remaining tile (colour‑major, value ascending): it is either left over, the lowest‑colour real member of a
# group, the lowest real tile of a run (positions below it must be wildcards), or — for a 1 — the top of a run ending …13‑1.
# Other members use a real tile if present, else a wildcard (exchange argument: never worse). Leftover wildcards join sets with room.
_memo = {}
MEMO_MAX = 400_000

def _key(c, w, cap): return bytes(c) + bytes((w, cap))

def _best(c, w, cap):
    k = _key(c, w, cap)
    r = _memo.get(k)
    if r is not None: return r
    i = 0
    while i < 52 and c[i] == 0: i += 1
    if i == 52:
        r = min(w, cap)
        _memo[k] = r; return r
    best = -1
    col, v = tcol(i), tval(i)
    # a) leave it over
    c[i] -= 1
    best = _best(c, w, cap)
    c[i] += 1
    for opt in _options(c, w, i, col, v):
        used, wu, size, room = opt
        for t in used: c[t] -= 1
        val = size + _best(c, w - wu, min(2, cap + room))
        for t in used: c[t] += 1
        if val > best: best = val
    _memo[k] = best
    return best

def _options(c, w, i, col, v):
    """Every set containing tile i: (real types used incl. i, wildcards used, set size, room for extra wildcards)."""
    out = []
    # groups: value v, the current colour + 2 or 3 other colours
    others = [k for k in range(4) if k != col]
    from itertools import combinations
    for n in (2, 3):
        for cs in combinations(others, n):
            used = [i]; wu = 0
            for k in cs:
                t = k * 13 + v - 1
                if c[t] - (1 if t == i else 0) > 0: used.append(t)
                else: wu += 1
            if wu <= w: out.append((used, wu, n + 1, 1 if n == 2 else 0))
    # runs containing position v as the lowest real tile; positions are values, 14 means a 1 after 13
    base = col * 13
    def tile_at(p): return base + (p - 1 if p <= 13 else 0)
    for s in range(max(1, v - w), v + 1):
        lead = v - s  # wildcards below v
        used = [i]; wu = lead
        cnt = dict()
        cnt[i] = 1
        for e in range(v + 1, 15):
            t = tile_at(e)
            if e == 14 and s == 1: break  # a run cannot wrap past 13 when it starts at 1 (1..13,1 would reuse the 1)
            have = c[t] - cnt.get(t, 0)
            if have > 0: used.append(t); cnt[t] = cnt.get(t, 0) + 1
            else: wu += 1
            if wu > w: break
            L = e - s + 1
            if L >= 3: out.append((list(used), wu, L, min(2, 13 - L)))
            if L >= 13: break
    # a 1 at the top: runs s..13,1 (s ≤ 12) — current tile i is the 1
    if v == 1:
        for s in range(12, 1, -1):
            used = [i]; wu = 0
            for p in range(s, 14):
                t = base + p - 1
                if c[t] > 0 and used.count(t) < c[t]: used.append(t)
                else: wu += 1
            if wu <= w:
                L = 14 - s + 1
                if L <= 13: out.append((used, wu, L, min(2, 13 - L)))  # can still grow downwards with wildcards
    return out

def cover(c, w):
    if len(_memo) > MEMO_MAX: _memo.clear()
    return _best(list(c), w, 0)

def pairs(c, w):
    """Çift: identical pairs; wildcards pair with any single, or with each other."""
    p = sum(x // 2 for x in c); singles = sum(x % 2 for x in c)
    u = min(w, singles); p += u; p += (w - u) // 2
    return p

def is_win14(c, w):
    n = sum(c) + w
    assert n == 14
    return cover(c, w) == 14 or pairs(c, w) >= 7

def solve_sets(c, w):
    """Reconstruct one optimal partition: list of sets, each a list of entries (type or -1 for wildcard), plus leftover types."""
    c = list(c); sets = []; left = []
    cap_sets = []
    target = _best(list(c), w, 0)
    cap = 0; got = 0
    while True:
        i = 0
        while i < 52 and c[i] == 0: i += 1
        if i == 52: break
        col, v = tcol(i), tval(i)
        rest_needed = target - got
        c[i] -= 1
        if _best(c, w, cap) == rest_needed:
            left.append(i); continue
        c[i] += 1
        for used, wu, size, room in _options(c, w, i, col, v):
            for t in used: c[t] -= 1
            ncap = min(2, cap + room)
            if size + _best(c, w - wu, ncap) == rest_needed:
                sets.append(_render(used, wu, size, col, v)); w -= wu; cap = ncap; got += size; break
            for t in used: c[t] += 1
        else:
            raise RuntimeError('reconstruction failed')
    # leftover wildcards attach to sets with room
    for s in sets:
        while w > 0 and _room(s) > 0: s.append(-1); w -= 1
    left += [-1] * w
    return sets, left

def _render(used, wu, size, col, v): return list(used) + [-1] * wu
def _room(s):
    real = [t for t in s if t >= 0]
    if len(real) >= 2 and tval(real[0]) == tval(real[1]) and tcol(real[0]) != tcol(real[1]): return 4 - len(s)
    if len(set(tval(t) for t in real)) == 1 and len(real) == 1: return 4 - len(s) if len(s) < 4 else 0
    return 13 - len(s)

# ---------------- game ----------------
class Game:
    """4 seats; play order 0 → 1 → 2 → 3 (each takes the discard of the previous seat)."""
    def __init__(self, rng, dealer=None):
        self.rng = rng
        ids = list(range(106)); rng.shuffle(ids)
        g = next(k for k, i in enumerate(ids) if ttype(i) != FJ)
        self.gosterge = ids.pop(g)
        self.okey = okey_of(ttype(self.gosterge))
        self.dealer = rng.randrange(4) if dealer is None else dealer
        self.hands = [[] for _ in range(4)]
        for s in range(4):
            n = 15 if s == self.dealer else 14
            self.hands[s] = [ids.pop() for _ in range(n)]
        self.pile = ids                     # 48 tiles, drawn from the end
        self.discards = [[] for _ in range(4)]  # discards[s] = tiles seat s threw (top = last); seat s+1 may take the top
        self.turn = self.dealer
        self.winner = None; self.finish = None  # finish: dict(kind='sets'|'cift', okey_discard=bool)
        self.turns = 0
        self.seen = [0] * NT  # public: discards + gösterge
        self.seen[ttype(self.gosterge)] += 1

    def prev(self, s): return (s + 3) % 4
    def top_discard(self, s):
        d = self.discards[self.prev(s)]
        return d[-1] if d else None
    def draw_pile(self, s):
        self.hands[s].append(self.pile.pop())
    def take_discard(self, s):
        d = self.discards[self.prev(s)]; t = d.pop()
        self.seen[ttype(t)] -= 1
        self.hands[s].append(t)
    def win_with(self, s, tile):
        """Would discarding `tile` from the 15-tile hand finish the game? → None or finish dict."""
        h = list(self.hands[s]); h.remove(tile)
        c, w = counts(h, self.okey)
        if cover(c, w) == 14: return dict(kind='sets', okey_discard=ttype(tile) == self.okey)
        if pairs(c, w) >= 7: return dict(kind='cift', okey_discard=ttype(tile) == self.okey)
        return None
    def discard(self, s, tile, finish=False):
        self.hands[s].remove(tile)
        self.turns += 1
        if finish:
            f = self.win_with_after(s, tile)
            self.winner = s; self.finish = f; return
        self.discards[s].append(tile); self.seen[ttype(tile)] += 1
        self.turn = (s + 1) % 4
    def win_with_after(self, s, tile):
        c, w = counts(self.hands[s], self.okey)
        assert cover(c, w) == 14 or pairs(c, w) >= 7
        return dict(kind='sets' if cover(c, w) == 14 else 'cift', okey_discard=ttype(tile) == self.okey)
    def over(self): return self.winner is not None or (not self.pile and self.winner is None and self.need_draw())
    def need_draw(self): return len(self.hands[self.turn]) == 14

def play(players, rng, dealer=None, trace=None):
    """players[s] has .draw(game, s) → 'pile'|'discard' and .discard(game, s) → (tile, finish). Returns winner seat or None (pile out)."""
    g = Game(rng, dealer)
    for p in players:
        if hasattr(p, 'reset'): p.reset()
    while True:
        s = g.turn
        if len(g.hands[s]) == 14:
            top = g.top_discard(s)
            if not g.pile:
                return g, None
            src = players[s].draw(g, s) if top is not None else 'pile'
            if src == 'discard' and top is not None: g.take_discard(s)
            else: g.draw_pile(s)
        tile, fin = players[s].discard(g, s)
        if fin: assert g.win_with(s, tile) is not None
        g.discard(s, tile, fin)
        if trace is not None: trace(g, s, tile)
        if g.winner is not None: return g, s
