// Real numbers for the shipped checkpoint (train/ck/d/final.npz → train/best.npz): TD(λ=0.7), α 0.2→0.02, seed 4.
// Training: 381,954 self-play games in 95 min on one CPU core. Evaluation (train/eval.py, SEED=7777, fresh seeds, 5,000 games each).
export const STATS = { params: 1601, games: 381954, minutes: 95, vsRandom: { w: 4986, n: 5000 }, vsHeur: { w: 3766, n: 5000 }, onnxBytes: 6786 };
