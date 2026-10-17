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
- 2026-10-17 22:15 step 5a: src/lib/okey-engine.ts parity OK on 1286 hands (tests/okey.test.ts).
- 2026-10-17 22:17 TS game/bot/net + scripts/build-onnx-okey.py done (interim weights from ck/d). Next: UI while training runs.
- 2026-10-17 22:21 pure self-play from scratch was weak early (quick-eval ~15% vs 3 greedy at 2k games). Kept TD runs a, d, g; killed b c e f. Plan B: datagen.py (4 shards × 15 min, greedy ε-play afterstates → outcome) → fit.py supervised V^greedy → policy improvement via 1-ply; then optional TD fine-tune. Draw rule: compare with sampled pile-draw expectation (K samples).
- 2026-10-17 22:34 features v2 (uncapped partials/outs, isolated tiles, extension types; NF still 14 → 257 params). Pilot: supervised V^greedy (343k samples) ≈ greedy (25.7% vs 25.7%, 300 games); sampled draw expectation essential (k_draw=0 → 14%). Now: datagen 7 shards × 10 more min (appends to data/shard*.npz) → fit → policy iteration with net-generated data (datagen.py k min <net.npz> it1_).
- 22:44 datagen done: 7 shards, ~35k greedy-ε games, 1.47M samples. Fitting ck-sup1.npz (20 ep) → diag2 500 (logs/fit1.log, logs/diag-sup1.log).
