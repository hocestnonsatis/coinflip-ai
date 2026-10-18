"""Kedi cat model: CNN on (frame, frame difference) → GRU belief → P(cup slot). Trained on cat-camera frames rendered by the real
/kedi three.js scene (scripts/cdp-kedi-datagen.mjs). Input is pixels only; labels are the toy's slot per frame.

python3 train-cat/train.py train  [--epochs N]      (resumes from train-cat/ckpt/last.pt)
python3 train-cat/train.py eval   <data dir> [ckpt] (final-frame accuracy table, JSON to stdout)
"""
import json, glob, os, sys, time, math, random
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F

H_, W_, FR = 32, 64, 2048
HERE = os.path.dirname(os.path.abspath(__file__))
torch.set_num_threads(int(os.environ.get('THREADS', '6')))

def load(dirpath):
    eps, mm = [], {}
    for idx in sorted(glob.glob(f'{dirpath}/w*.jsonl')):
        binf = idx[:-6] + '.u8'
        size = os.path.getsize(binf)
        mm[binf] = np.memmap(binf, dtype=np.uint8, mode='r')
        for line in open(idx):
            if not line.strip(): continue
            e = json.loads(line)
            if e['off'] + e['n'] * FR > size: continue
            e['bin'] = binf; eps.append(e)
    return eps, mm

def frames_of(e, mm):
    return np.asarray(mm[e['bin']][e['off']:e['off'] + e['n'] * FR]).reshape(e['n'], H_, W_)

def weights_of(e):
    """0 until the toy has been visible for a moment after the (latest) hide, 1 afterwards; the last frame counts extra."""
    t = np.array(e['times'], dtype=np.float32) / 1000
    w = np.ones(len(t), np.float32)
    for (th, _slot) in e['hides']:
        th /= 1000; w[(t >= th) & (t < th + 0.45)] = 0
    w[-1] = 12.0
    return w

class Kedi(nn.Module):
    def __init__(s, hid=32, feat=32):
        super().__init__()
        s.c1 = nn.Conv2d(2, 8, 5, 2, 2); s.c2 = nn.Conv2d(8, 16, 3, 2, 1); s.c3 = nn.Conv2d(16, 16, 3, 2, 1)
        s.fc = nn.Linear(16 * 4 * 8, feat); s.gru = nn.GRU(feat, hid, batch_first=True); s.head = nn.Linear(hid, 3)
    def features(s, x, prev):  # x, prev: (N, 32, 64) uint8-scaled floats in [0,1]
        z = torch.stack([(x - 0.4) * 3, (x - prev) * 6], 1)
        z = F.relu(s.c1(z)); z = F.relu(s.c2(z)); z = F.relu(s.c3(z))
        return F.relu(s.fc(z.flatten(1)))
    def forward(s, x):  # x: (B, T, 32, 64) in [0,1]
        B, T = x.shape[:2]
        prev = torch.cat([x[:, :1], x[:, :-1]], 1)
        f = s.features(x.reshape(B * T, H_, W_), prev.reshape(B * T, H_, W_)).reshape(B, T, -1)
        h, _ = s.gru(f)
        return s.head(h)

class KediB(Kedi):
    """Same CNN + GRU, but the output is an explicit belief over the 3 slots, carried from frame to frame:
    b_t ∝ (b_{t-1} · T_t) ⊙ exp(e_t), where T_t (3×3, row = from-slot, softmax over to-slot) and the evidence e_t are both
    predicted from the frame features and the GRU state. With nothing happening T ≈ I and e ≈ 0, so the belief is simply kept."""
    def __init__(s, hid=32, feat=32):
        super().__init__(hid, feat)
        s.head = nn.Linear(hid, 9 + 3)
        with torch.no_grad():
            s.head.weight.mul_(0.1); s.head.bias.zero_(); s.head.bias[[0, 4, 8]] = 4.0
    def forward(s, x, return_logb=False):
        B, T = x.shape[:2]
        prev = torch.cat([x[:, :1], x[:, :-1]], 1)
        f = s.features(x.reshape(B * T, H_, W_), prev.reshape(B * T, H_, W_)).reshape(B, T, -1)
        h, _ = s.gru(f)
        o = s.head(h); lt = F.log_softmax(o[..., :9].reshape(B, T, 3, 3), -1); ev = o[..., 9:]
        lb = torch.full((B, 3), -math.log(3.0)); out = []
        for t in range(T):
            lb = torch.logsumexp(lb.unsqueeze(-1) + lt[:, t], 1) + ev[:, t]   # (b · T) in log space, then evidence
            lb = lb - torch.logsumexp(lb, -1, keepdim=True); out.append(lb)
        return torch.stack(out, 1)  # log-probabilities (log_softmax of these is a no-op)

ARCH = os.environ.get('ARCH', 'belief')
def make(): return KediB() if ARCH == 'belief' else Kedi()

def nparams(m): return sum(p.numel() for p in m.parameters())

def batch(eps, mm, ids, rnd, train=True):
    seqs, labs, ws, unif = [], [], [], []
    for i in ids:
        e = eps[i]; x = frames_of(e, mm).astype(np.float32) / 255; y = np.array([int(c) for c in e['labels']], np.int64); w = weights_of(e); u = 0.0
        if train:
            if rnd.random() < 0.5: x = x[:, :, ::-1]; y = 2 - y          # mirror (the scene is left/right symmetric)
            a, b = 0.75 + rnd.random() * 0.5, (rnd.random() - 0.5) * 0.16  # brightness / contrast
            x = np.clip(x * a + b + np.random.normal(0, 0.012 + 0.02 * rnd.random(), x.shape).astype(np.float32), 0, 1)
            r = rnd.random()
            if r < 0.035:  # blank / covered camera → no information → uniform target
                kind = rnd.randrange(3)
                x = np.full_like(x, rnd.random()) if kind == 0 else (np.random.rand(*x.shape).astype(np.float32) if kind == 1 else np.clip(np.full_like(x, rnd.random()) + np.random.normal(0, 0.03, x.shape), 0, 1).astype(np.float32))
                u = 1.0; w = np.ones_like(w)
        seqs.append(np.ascontiguousarray(x)); labs.append(y); ws.append(w); unif.append(u)
    T = max(len(s) for s in seqs); B = len(seqs)
    X = np.zeros((B, T, H_, W_), np.float32); Y = np.zeros((B, T), np.int64); Wt = np.zeros((B, T), np.float32)
    for k, (s, y, w) in enumerate(zip(seqs, labs, ws)):
        X[k, :len(s)] = s; Y[k, :len(s)] = y; Wt[k, :len(s)] = w
        X[k, len(s):] = s[-1]  # pad by repeating the last frame (masked out anyway)
    return torch.from_numpy(X), torch.from_numpy(Y), torch.from_numpy(Wt), torch.tensor(unif), [len(s) for s in seqs]

def loss_fn(logits, Y, Wt, U):
    lp = F.log_softmax(logits, -1)
    ce = -lp.gather(-1, Y.unsqueeze(-1)).squeeze(-1)
    uni = -lp.mean(-1)  # CE against the uniform distribution
    l = torch.where(U[:, None] > 0, uni, ce)
    return (l * Wt).sum() / Wt.sum()

def evaluate(model, eps, mm, bs=48):
    model.eval(); res = []
    with torch.no_grad():
        for k in range(0, len(eps), bs):
            ids = list(range(k, min(len(eps), k + bs)))
            X, Y, Wt, U, L = batch(eps, mm, ids, None, train=False)
            p = F.softmax(model(X), -1)
            for j, i in enumerate(ids):
                e = eps[i]; last = L[j] - 1; pr = p[j, last].numpy(); y = int(e['labels'][-1])
                res.append({'seed': e['seed'], 'swaps': e['swaps'], 'speed': e['speed'], 'dur': (np.median(e['durs']) / 1000 if e.get('durs') else None),
                            'ok': int(pr.argmax() == y), 'p_true': float(pr[y]), 'n': e['n']})
    model.train(); return res

def table(res):
    acc = lambda rs: (sum(r['ok'] for r in rs) / len(rs)) if rs else float('nan')
    out = {'overall': acc(res), 'n': len(res)}
    return out

def train(epochs=30, bs=24, lr=3e-3):
    """Resumable. Reloads the dataset every epoch (so it can start while the generator is still writing rounds).
    LR: 1 warm-up epoch, then cosine to 3 % of lr."""
    rnd = random.Random(1)
    model = make(); print('arch', ARCH, 'params', nparams(model), flush=True)
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    ep0, best, secs = 0, -1, 0.0
    CK = os.environ.get('KEDI_CKPT', f'{HERE}/ckpt'); os.makedirs(CK, exist_ok=True); ck = f'{CK}/last.pt'
    if os.path.exists(ck):
        s = torch.load(ck, weights_only=False); model.load_state_dict(s['model']); opt.load_state_dict(s['opt']); ep0 = s['epoch'] + 1; best = s.get('best', -1); secs = s.get('secs', 0.0)
        rnd.setstate(s['rnd']); print('resumed at epoch', ep0, flush=True)
    for ep in range(ep0, epochs):
        eps, mm = load(f'{HERE}/data')
        val = [i for i, e in enumerate(eps) if e['seed'] % 20 == 0]; tr = [i for i, e in enumerate(eps) if e['seed'] % 20 not in (0, 10, 15)]  # 10, 15 = test split (eval.py), never seen
        veps = [eps[i] for i in val]
        cur = lr * (0.3 if ep == 0 else 0.03 + 0.97 * 0.5 * (1 + math.cos(math.pi * (ep - 1) / max(1, epochs - 1))))
        for g in opt.param_groups: g['lr'] = cur
        t0 = time.time(); order = tr[:]; rnd.shuffle(order)
        chunks = [sorted(order[k:k + bs * 20], key=lambda i: eps[i]['n']) for k in range(0, len(order), bs * 20)]  # length buckets (less padding)
        bl = [c[k:k + bs] for c in chunks for k in range(0, len(c), bs)]; rnd.shuffle(bl)
        tot = 0.0
        for ids in bl:
            X, Y, Wt, U, L = batch(eps, mm, ids, rnd)
            loss = loss_fn(model(X), Y, Wt, U)
            opt.zero_grad(); loss.backward(); nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
            tot += loss.item()
        secs += time.time() - t0
        res = evaluate(model, veps, mm); a = table(res)['overall']
        msg = f'epoch {ep} lr {cur:.2e} train {len(tr)} loss {tot / len(bl):.4f} val_final_acc {a:.4f} (n={len(veps)}, {time.time() - t0:.0f}s)'; print(msg, flush=True)
        if a > best: best = a; torch.save({'model': model.state_dict(), 'epoch': ep, 'val': a}, f'{CK}/best.pt')
        torch.save({'model': model.state_dict(), 'opt': opt.state_dict(), 'epoch': ep, 'best': best, 'rnd': rnd.getstate(), 'secs': secs}, ck)
        json.dump({'epochs': ep + 1, 'minutes': round(secs / 60), 'procs': torch.get_num_threads(), 'train_rounds_last_epoch': len(tr)}, open(f'{CK}/meta.json', 'w'))
        with open(f'{CK}/log.txt', 'a') as f: f.write(msg + '\n')

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'train':
        ep = int(sys.argv[sys.argv.index('--epochs') + 1]) if '--epochs' in sys.argv else 30
        train(epochs=ep)
    elif cmd == 'eval':
        d = sys.argv[2]; ckp = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/ckpt/best.pt'
        eps, mm = load(d); m = make(); m.load_state_dict(torch.load(ckp, weights_only=False)['model'])
        res = evaluate(m, eps, mm); print(json.dumps(res))
