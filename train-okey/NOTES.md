# Okey training notes (resumable log)

Steps (tick when done; each step leaves files on disk):
- [ ] 1. okey.py engine + solver (Python), speed check
- [ ] 2. features + tiny value net + bots (random, greedy, net)
- [ ] 3. self-play TD training in background (checkpoints in ck/, logs in logs/)
- [ ] 4. eval ≥2000 games vs random and vs greedy (4 players, 25% baseline)
- [ ] 5. export ONNX + TS weights, TS engine port + parity fixtures
- [ ] 6. UI (3D rack + 2D fallback), i18n, SEO, stats counter, deploy

## Log
- 2026-10-17 22:13 step 1 done: okey.py solver exact vs brute force on 3000 small hands (0 mismatches), 0.12 ms / 14-tile hand. Step 2 done: ai.py (14 features → 16 tanh → 1 sigmoid = 257 params), bots random/greedy/net. ~450 self-play games/min/process.
- 2026-10-17 22:13 step 3 started: ./run_all.sh 80 → 7 configs (a–g) × 80 min in background. If interrupted: rerun ./run_all.sh 80 (resumes from ck/<name>/last.npz). Progress: tail logs/<name>.log (quick-eval = win rate vs 3 greedy bots, 200 games).
