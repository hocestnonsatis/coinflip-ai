import sys, time, random, json, os, numpy as np
from bg import start, flip, legal, encode_batch
from net import Net
name, alpha0, alpha1, lam, seed, minutes = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5]), float(sys.argv[6])
os.makedirs(f'ck/{name}', exist_ok=True)
rng = random.Random(seed); net = Net(seed)
T0 = time.time(); g = 0; plies = 0
while time.time() - T0 < minutes * 60:
    frac = min(1, (time.time() - T0) / (minutes * 60)); alpha = alpha0 + (alpha1 - alpha0) * frac
    eW1 = np.zeros_like(net.W1); eb1 = np.zeros_like(net.b1); eW2 = np.zeros_like(net.W2); eb2 = 0.0
    b = start(); turn = 0; prev = None  # prev = (y, grads sign applied)
    while True:
        d1, d2 = rng.randint(1, 6), rng.randint(1, 6)
        ks = list(legal(b, d1, d2)); X = encode_batch(ks)
        v, hh = net.fwd(X); k = int(np.argmax(v)); r = ks[k]
        x = X[k]; V = v[k]; h = hh[k]; plies += 1
        done = r[26] == 15
        sgn = 1.0 if turn == 0 else -1.0
        y = (V if turn == 0 else 1 - V)
        if prev is not None:
            target = (1.0 if turn == 0 else 0.0) if done else y
            delta = target - prev
            net.W1 += alpha * delta * eW1; net.b1 += alpha * delta * eb1; net.W2 += alpha * delta * eW2; net.b2 += alpha * delta * eb2
        if done and prev is None: break
        if done: break
        # gradient of y_t at current params
        do = V * (1 - V) * sgn
        dpre = do * net.W2 * h * (1 - h)
        eW1 = lam * eW1 + np.outer(x, dpre); eb1 = lam * eb1 + dpre; eW2 = lam * eW2 + do * h; eb2 = lam * eb2 + do
        prev = y
        b = flip(r); turn ^= 1
    g += 1
    if g % 5000 == 0:
        net.save(f'ck/{name}/g{g}.npz')
        print(json.dumps({'g': g, 'min': round((time.time() - T0) / 60, 1), 'plies': plies, 'alpha': round(alpha, 4)}), flush=True)
net.save(f'ck/{name}/final.npz'); print(json.dumps({'final': g, 'min': round((time.time() - T0) / 60, 1)}), flush=True)
