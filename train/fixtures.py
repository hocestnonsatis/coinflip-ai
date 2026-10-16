# Random positions (from random-play games, incl. bar/bear-off/hits) + all 21 dice rolls → legal result sets, for TS cross-check.
import random, json
from bg import start, flip, legal, encode_batch
rng = random.Random(42); pos = []
while len(pos) < 1500:
    b = start()
    for ply in range(400):
        d1, d2 = rng.randint(1, 6), rng.randint(1, 6)
        if rng.random() < 0.08: pos.append(list(b))
        r = rng.choice(list(legal(b, d1, d2)))
        if r[26] == 15: break
        b = flip(r)
cases = []
for b in pos[:1500]:
    d1, d2 = rng.randint(1, 6), rng.randint(1, 6)
    L = legal(tuple(b), d1, d2)
    cases.append({'b': b, 'd': [d1, d2], 'r': sorted(','.join(map(str, k)) for k in L)})
enc = encode_batch([pos[3], pos[700]]).round(6).tolist()
json.dump({'cases': cases, 'enc': [{'b': pos[3], 'x': enc[0]}, {'b': pos[700], 'x': enc[1]}]}, open('../tests/tavla-fixtures.json', 'w'), separators=(',', ':'))
print(len(cases), sum(len(c['r']) for c in cases), sum(1 for c in cases if c['b'][24] or c['b'][25]), sum(1 for c in cases if c['b'][26]))
