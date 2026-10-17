"""Parity fixtures for the TS port: hands from real (greedy-bot) games + crafted wildcard hands → cover, pairs, features, sets."""
import json, random
from okey import play, counts, cover, pairs, solve_sets, Game, ttype
from ai import features, GreedyBot
rng = random.Random(2026); out = []
def rec(hand, okey, seen, pile):
    c, w = counts(hand, okey)
    f, dw = features(hand, okey, seen, pile)
    sets, left = solve_sets(c, w)
    out.append(dict(h=hand, o=okey, s=seen, p=pile, cov=cover(c, w), pr=pairs(c, w), f=[round(float(x), 6) for x in f], ns=len(sets), sz=sorted(len(s) for s in sets)))
def tr(g, s, tile):
    if rng.random() < 0.25 and len(g.hands[s]) == 14: rec(list(g.hands[s]), g.okey, list(g.seen), len(g.pile))
for _ in range(120): play([GreedyBot(rng) for _ in range(4)], rng, trace=tr)
# random 14-tile hands with forced wildcards / false jokers
for k in range(400):
    hand = rng.sample(range(106), 14)
    okey = ttype(hand[0]) if hand[0] < 104 else rng.randrange(52)
    if k % 3 == 0 and 104 not in hand: hand[1] = 104
    seen = [0] * 53
    for t in rng.sample(range(52), 10): seen[t] = rng.randint(0, 1)
    rec(hand, okey, seen, rng.randint(0, 48))
json.dump(out, open('../tests/okey-fixtures.json', 'w'))
print(len(out), 'fixtures')
