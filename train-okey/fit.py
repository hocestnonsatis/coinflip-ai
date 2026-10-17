"""Fit the value net on datagen.py shards (cross-entropy, Adam). python3 fit.py <out.npz> [epochs] [init.npz]"""
import sys, glob, numpy as np
from ai import Net, NF, NH
out = sys.argv[1]; epochs = int(sys.argv[2]) if len(sys.argv) > 2 else 30
pat = sys.argv[4] if len(sys.argv) > 4 else 'data/shard*.npz'
fs = sorted(glob.glob(pat)); X = np.concatenate([np.load(f)['X'] for f in fs]); Y = np.concatenate([np.load(f)['Y'] for f in fs])
r = np.random.default_rng(0); p = r.permutation(len(Y)); X, Y = X[p], Y[p]
nv = len(Y) // 20; Xv, Yv, Xt, Yt = X[:nv], Y[:nv], X[nv:], Y[nv:]
print('samples', len(Y), 'win rate', Y.mean())
net = Net.load(sys.argv[3]) if len(sys.argv) > 3 else Net(3)
P = [net.W1, net.b1, net.W2, net.b2]; M = [np.zeros_like(a, dtype=float) for a in P]; V = [np.zeros_like(a, dtype=float) for a in P]
def loss(X, Y):
    q = np.clip(net.vbatch(X), 1e-7, 1 - 1e-7); return float(-(Y * np.log(q) + (1 - Y) * np.log(1 - q)).mean())
base = float(-(Yv * np.log(Yt.mean()) + (1 - Yv) * np.log(1 - Yt.mean())).mean())
print('val loss constant-predictor', round(base, 5))
lr, t, B, best = 3e-3, 0, 2048, 9
for ep in range(epochs):
    for i in range(0, len(Yt), B):
        x, y = Xt[i:i + B], Yt[i:i + B]
        H = np.tanh(x @ net.W1.T + net.b1); q = 1 / (1 + np.exp(-(H @ net.W2 + net.b2)))
        e = (q - y) / len(y)                              # dCE/dlogit
        gW2 = H.T @ e; gb2 = e.sum(); gH = np.outer(e, net.W2) * (1 - H * H)
        gW1 = gH.T @ x; gb1 = gH.sum(0)
        t += 1
        for k, g in enumerate([gW1, gb1, gW2, np.array(gb2)]):
            M[k] = 0.9 * M[k] + 0.1 * g; V[k] = 0.999 * V[k] + 0.001 * g * g
            step = lr * (M[k] / (1 - 0.9 ** t)) / (np.sqrt(V[k] / (1 - 0.999 ** t)) + 1e-8)
            if k == 3: net.b2 = net.b2 - step
            else: P[k] -= step
        P[3] = net.b2
    lv = loss(Xv, Yv)
    print('epoch', ep, 'train', round(loss(Xt[:100000], Yt[:100000]), 5), 'val', round(lv, 5), flush=True)
    if lv < best: best = lv; net.save(out, val=lv, samples=len(Y))
    if ep == epochs // 2: lr /= 3
print('best val', best)
