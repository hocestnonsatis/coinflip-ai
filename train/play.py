import random
from bg import start, flip
def game(pA, pB, rng):
    """pX(board,d1,d2)->resulting board (my view). Returns +1 if A wins, -1 if B wins (and gammon flag)."""
    b = start(); turn = rng.randrange(2); ps = (pA, pB)
    while True:
        d1, d2 = rng.randint(1, 6), rng.randint(1, 6)
        r = ps[turn](b, d1, d2)
        if r[26] == 15: return (1 if turn == 0 else -1)
        b = flip(r); turn ^= 1
