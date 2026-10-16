import numpy as np
H = 8
class Net:
    def __init__(s, seed=0, h=H):
        r = np.random.default_rng(seed)
        s.W1 = (r.standard_normal((198, h)) * 0.1).astype(np.float64); s.b1 = np.zeros(h)
        s.W2 = (r.standard_normal(h) * 0.1); s.b2 = 0.0
    def params(s): return s.W1.size + s.b1.size + s.W2.size + 1
    def fwd(s, X):
        hh = 1 / (1 + np.exp(-(X @ s.W1 + s.b1)))
        return 1 / (1 + np.exp(-(hh @ s.W2 + s.b2))), hh
    def save(s, f): np.savez(f, W1=s.W1, b1=s.b1, W2=s.W2, b2=np.array(s.b2))
    @staticmethod
    def load(f):
        z = np.load(f); n = Net(); n.W1, n.b1, n.W2, n.b2 = z['W1'], z['b1'], z['W2'], float(z['b2']); return n
