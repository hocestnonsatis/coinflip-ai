# Kedi (cups game) — resumable log

Goal: /kedi — the human hides a toy under one of 3 cups and shuffles; the cat model guesses the cup **from pixels only**
(a fixed "cat camera" renders the scene to a tiny grayscale frame at a fixed game-time rate; the model never sees game state,
swap events or cup positions). Same three.js scene for training data (headless Chrome) and for play → no domain gap.

## Plan / checkpoints (tick when done)
- [ ] C1 `src/lib/kedi-anim.ts` pure timeline → pose (shared by game + datagen) + tests
- [ ] C2 `src/lib/kedi-scene.ts` three.js room/table/cups/toy/cat + cat camera capture (64×32 gray, 30 Hz game time, identical frames skipped)
- [ ] C3 datagen: `?datagen` hook + `scripts/cdp-kedi-datagen.mjs` → `train-cat/data/shard-*.u8|json`
- [ ] C4 train `train-cat/train.py` (PyTorch CPU) → `train-cat/ckpt/*.pt`, eval table
- [ ] C5 export ONNX + TS weights, parity test
- [ ] C6 app UI, i18n ×5, sound, stats (kind 'kedi', DO instance 'kedi'), hub card, sitemap, SEO, OG, README
- [ ] C7 checks: tests, svelte-check, build, prod play-through, blank-feed / mirror-feed honesty checks, screenshots, deploy, commit, push

## Log
- C1 done: `kedi-anim.ts` (pose = pure fn of game time; swapDur 0.9 s…0.15 s; LIFT_H 1.25; randomEpisode / pure grid episodes).
- C2 done: `kedi-scene.ts`. Cat camera: fov 38, pos (0, 3.9, −2.3) → look (0, 0.3, 0.3), renders layer 0 only (cat = layer 1)
  into 128×64 RT (no tone mapping), luminance → own tone LUT, 2×2 box filter → 64×32 uint8 (row 0 = bottom). **Freeze these:
  any change to cups/toy/mat/table/lights/cat camera invalidates the data.**
- C3 running: `node scripts/cdp-kedi-datagen.mjs http://localhost:5181 train-cat/data 2 2400 1000000` against a frozen copy of
  the repo in /tmp/kedi-snap (vite dev :5181) so edits to the app don't hot-reload the generator. Resumable (rerun same cmd).
  Throughput: SwiftShader is the bottleneck (~6–7 ms per cat frame incl. readPixels, ~140 frames/s total no matter how
  many Chrome instances), so 2 workers. ~240 frames/episode → ~70 min.
  Eval grid afterwards: `... train-cat/data-grid 2 840 9000000 0,1,2,3,5,8,12,20,30:0,0.35,0.65,0.85,1` (pure shuffles).
- C3 note: grid eval set uses speeds 0.1,0.3,0.5,0.7,0.95 (= slider buckets slow…lightning) × swaps 0,1,2,3,5,8,12,20,30, 900 rounds:
  `node scripts/cdp-kedi-datagen.mjs http://localhost:5181 train-cat/data-grid 1 900 9000000 0,1,2,3,5,8,12,20,30:0.1,0.3,0.5,0.7,0.95`
- Splits: seed%20==0 → val (checkpoint pick), seed%20 ∈ {10,15} → test (model card number), rest → train.
- Pilots on ~500–700 rounds, 8 epochs (/tmp/kpilot, /tmp/kpilotB): plain CNN+GRU (26,747 p) sees the toy while cups are lifted
  (p≈0.9) but forgets it once they go down; loss 0.98. Belief variant `KediB` (27,044 p: GRU predicts a 3×3 slot transition
  T_t and evidence e_t, b_t ∝ (b_{t-1}·T_t)⊙exp(e_t), T init ≈ I) learns faster (loss 0.89). → use ARCH=belief (default).
  TS step / ONNX step export / parity test all support both (meta.arch). State = (h, log-belief).
- C6 mostly written (KediApp, i18n-kedi ×5, routes, /api/kedi/*, hub card, sitemap, sound meow/cup, tests/kedi.test.ts);
  kedi-weights.ts / kedi-27k.onnx / kedi-stats.ts are UNTRAINED placeholders until C4/C5.
- Resume: if datagen died, rerun the two datagen commands above (needs /tmp/kedi-snap vite on :5181; recreate by copying
  the repo's tracked files there if the box was reset — the scene files must be the committed ones).
  Then: `ARCH=belief THREADS=7 nohup python3 train-cat/train.py train --epochs 30 > train-cat/ckpt/train.out 2>&1 &` (resumes from ckpt/last.pt),
  `python3 train-cat/export.py && python3 train-cat/eval.py`.

## C4 browser integration (untrained weights) — verified
- `node scripts/cdp-kedi.mjs http://localhost:5180 /tmp/kshots/cat` runs end to end: 5 rounds, 2 blank, 2 mirror, no console errors, engine wasm ~0.7–1.3 ms/frame. With untrained weights blank is OK and mirror fails, as expected.
- scripts/og-kedi.py <shot> "<subtitle>" → static/og-kedi.png (run again on the final prod shot).
- tests/kedi.test.ts added to the npm test chain.
