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

## C3 status (16:26 TRT)
- Grid eval set done: train-cat/data-grid 900/900 rounds (pure shuffles, 9 swap counts × 5 speeds, 20 each).
- Main set: 1616/2400 rounds and still growing (pid 56869); train.py reloads it every epoch.
- Training (pid 74039, 40 epochs): epoch 22 loss 0.57, val 0.64 (n=77). Diag on grid @ep13: 0 swaps 100%, 1 swap ≈91%, 2 swaps ≈52%, ≥3 swaps ≈ chance.

## C4 training phase transition + leak check (≈16:55 TRT)
- Around epoch 23–25, val final-acc jumped 0.6 → 1.00 and loss 0.57 → 0.08. Grid diag @ep27 (/tmp/k-ep27.pt): 900/900, even 30 swaps at speed 0.95.
- Too good to trust blindly, so a leak ablation: `NOTOY=1 node scripts/cdp-kedi-datagen.mjs http://localhost:5180 /tmp/kedi-notoy 1 135 7000000 <grid>`.
  This draws the toy ONLY while some cup is lifted (i.e. during the hide); after that, no toy pixels or toy shadow at all.
  The control /tmp/kedi-ctrl uses the same seeds with committed HEAD code (:5180) and also checks the snapshot→HEAD gap
  (the snapshot differs only in the cat (layer 1), ring, timers and shadow-fit points).
  Same-seed frames differ by ≤3/255. ep27 model: ctrl 66/66, notoy 68/68 → no leak; the cat tracks cup motion from pixels.
- Ablation set kept at train-cat/data-notoy (135 rounds, seeds 7000000+, grid cells, HEAD code). eval.py reports it as 'notoy', and the model card shows it.

## C5 model trained + exported (17:25 TRT)
- 40 epochs done (meta: 94 min × 4 threads). best.pt = epoch 25 (the first epoch with val 1.00, n=83, a tie-break artefact); last.pt = epoch 39 (val 1.00, n=117).
- eval best.pt: grid 900/900 but blank feed P ∈ [0.08, 0.77] ✗. eval last.pt: grid 900/900, test 240/240, mirror 240/240, notoy 135/135, blank P ∈ [0.29, 0.36] ✓ → **shipped last.pt**.
- `python3 train-cat/export.py train-cat/ckpt/last.pt`: ONNX 114,132 B, TS/torch/ONNX parity 6e-7, test blank → [0.343, 0.336, 0.322].
- kedi-stats counts the 2,003 train rounds seen in the last epoch (561,703 frames); the set grew during training.

## C6 browser integration with trained weights (≈18:00 TRT)
- Card text localized (train/honesty/limits built from real numbers ×5 langs). The old "fast shuffles confuse it" claims were false → removed from the card and the hub taglines.
- Accuracy table: count moved to the note (20 per cell), fixed layout so it fits the panel.
- cdp-kedi.mjs now also plays 9 real-user rounds (click-click and drag swaps, rapid/slow/2.5 s pauses, mixed with shuffle ×12/20/30 at slider 1.0 = 150 ms per swap, and slider 0 = 900 ms). Slider extremes are inside the training range (speed ∈ [0,1]); manual swaps are 550 ms, queued with a 20 ms gap, also in the training range.
- Dev run: every guess matched the expected slot by probs; __kediUi.result was a $state proxy (didn't serialize) → now a plain copy.

## C7 deployed (≈18:40 TRT)
- npm test ✓, svelte-check 0/0, build ✓. wrangler deploy (the first two tries failed with "fetch failed", the third worked) → version 4f5dd908-5355-44ef-bced-0231ef0635bd; redeployed with the prod OG → **8792bfcd-58af-4756-8202-70ace086b46a**.
- Prod play-through `node scripts/cdp-kedi.mjs https://tiny-models.anil-oz.workers.dev screens/cat`: 0 console errors; normal 5/5; manual 9/9
  (click and drag, rapid/slow/2.5 s pauses, shuffle ×12/×20/×30 at slider 1.0 = 150 ms per swap, ×6 at slider 0); blank → [0.342, 0.336, 0.322]; mirror 2/2 flipped.
- The smoke test counted 18 rounds on /api/kedi/stats → reset with `?game=kedi` (dry run first). The counter is now 0.
- OG regenerated from screens/cat-desktop-reveal.png. Leftover datagen and the :5181 vite are stopped.
- Later: maybe publish to Hugging Face (not done).

## S1 cheat stickers in the scene (19:20 TRT) — model NOT retrained
- kedi-scene: a flat yarn-ball picture (CircleGeometry r 0.22 + painted canvas, slightly emissive "glossy print") is a child of each cup on its cat-facing (−z) side at y≈0.25, layer 0.
  The cat camera sees it; the player camera (+z) is blocked by the cup. Visibility = on[cup] && t ≥ since[cup], evaluated at the capture time,
  so live play and renderEpisode(…, st) agree. setSticker(cup, on, since=time), stickers().
- With stickers off, frames match /tmp/kedi-ctrl to within the known SwiftShader run-to-run noise (max 2/255).
  The first, non-emissive version only showed as a dim ~4×3 px blob (~130, versus the toy's ~220–250) because the cat-facing side is backlit; glossy → ~200–220.
- datagen STICK=<wrong|empty|all|right>:<before|after> (eval only). Pure grid rounds → toy cup = hide slot.

## S2 sticker eval + UI (19:55 TRT)
- 7 configs × 60 pure rounds (seeds 8000000+, grid 0,1,3,8,20 swaps × 0.3,0.7,0.95 speed), rendered on HEAD with STICK=…, in train-cat/data-stick/<cfg> (gitignored).
  Sanity: the same seed under different configs differs in 40/40 frames; the stickers show as toy-bright blobs, also on lifted cups during the hide.
- `python3 train-cat/eval_stick.py` (shipped last.pt, not retrained) → src/lib/kedi-stick-stats.ts. **420/420 right, fooled 0×** in every config
  (wrong/empty/all/right × before/after), mean confidence 0.9985–0.9991. It localises the toy during the hide (toy on the mat) and then tracks cup motion; static pictures carry no evidence.
- UI: cheat card (checkbox; per-slot sticker buttons, all / empty ones (after the hide) / peel off) and a cat's-eye inset (the real 64×32 frames;
  a captureNow preview before the hide / after the round, drawn only). Cheated rounds open no ticket and report nothing. Streamed lines stickOn / cheatWon / cheatFooled use real numbers. Card section "Against cheating" ×5 langs.
- Test: exactly one brain.push; captureNow previews never fed. Fixed the TR seen line (stray % before {p}).

## S3 sleepy cat + separate counter (Oct 18, TRT)
- Scene: capture pump keeps only ticks with (tick index since the hide) % stride == 0; startCapture(t0, 30/fps). Same renderer, same frames, just sparser (game time).
  Visuals only (layer 1, not seen by the cat camera): setSleepy(0..3) → heavier lids, longer and more frequent blinks, a yawn every ~(11−2·level) s with an open mouth, slower gaze, head sway; "zzz" DOM overlay at screenOfHead().
- `python3 train-cat/eval_sleepy.py` (shipped last.pt, not retrained) emulates the stride on the stored 30 fps data-grid frames (frame at tick j = last stored frame ≤ j, identical frames dropped again; content compare with np.array_equal).
  900 held-out rounds per fps: **30 → 900/900 (154 frames/round), 15 → 764 (78), 10 → 638 (52), 5 → 426 (27)**. 0 swaps 20/20 everywhere. Pooled over 1–30 swaps (160 per speed, 752/526/367/257/164 ms):
  15 fps 160/160/160/123/61, 10 fps 160/160/95/67/56, 5 fps 97/59/52/53/65. The rerun with the content compare gave the same numbers.
- Stats: new ticket kind `kedix`, DO instance `kedi-x`. Rounds with stickers or fps < 30 open a kedix ticket (`/api/kedi/start {special:true}`) and report `special:true`; a sticker added mid-round swaps the normal ticket for a special one.
  `/api/kedi/stats` → {games,human,cat, special:{…}}; reset accepts game=kedi-x. Rounds that used the `__kediFeed` test hook are never reported (feedTainted), so smoke tests no longer touch the honest counter.
- Honest counter at deploy: 5 games after the last reset (real visitors), so it is NOT reset any more; only kedi-x (our smoke rounds) is reset.
- Tests: kedix ↔ kedi tickets do not cross-verify; sleepy i18n (5 langs, placeholders), table completeness, stride wiring.
- Deploy 9bcec229 (first), then 9eff25de (feedTainted). wrangler "fetch failed" ×3–4 again before success.
