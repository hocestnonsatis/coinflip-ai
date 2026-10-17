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
- 22:46 sup1 (1.47M samples, val 0.4627 vs const 0.5387): diag 500×2: greedy 25.8%, net tau0 25.0%, tau.03 25.5%, k0 14.9% — still ≈ greedy. Started policy-iteration datagen it1_ (6 shards × 10 min, policy = ck-sup1).
- 22:58 interrupted; it1_ shards present (6 × ~35k = 210k samples, ~6k net-policy games, partial 10-min runs). Time-box 45 min: fit it1 (init sup1) and mix (it1+greedy), diag, pick, final eval.
- 23:03 diag 500×2 vs 3 greedy: it1 tau0 24.4% / tau.03 23.5%; mix1 22.4% / 25.1%; sup1 25.0% / 25.5% (greedy ref 25.8%). Differences within noise (±1.4%). Policy iteration gave no gain → ship ck-sup1 with tau 0.03 (best.npz). Final held-out eval 4000 games/matchup.
- 23:10 FINAL eval-final.json (best.npz = ck-sup1, tau 0.03, held-out seeds 90000+, 4000 games each, model seat 0): vs 3 random 93.4% (3736/4000, 246 pile-outs); vs 3 greedy 24.0% (959/4000, 18 pile-outs); reference greedy vs 3 greedy 25.0% (998/4000). Net ≈ greedy (−1.0 pt, within ~1.4σ). Shipped. Exported static/model/okey-257.onnx (1451 B), src/lib/okey-weights.ts, src/lib/okey-stats.ts.
- 23:15 deployed tiny-models d1f1e98f (stats worker a3ace1b5 with 'draw' key). Prod: all /xx/okey 200, sitemap 5 okey URLs, hreflang ok, okey API protections verified (too fast 422, once per ticket 409, tavla ticket rejected for okey), okey counter reset to 0. Headless prod UI test passed desktop 1920×1080 + mobile 390×844 (screens/okey-*.png), no page errors.
- 23:35 bugfix deploy 79ce112f: gösterge was overlapped by the pile's 6th stack column (x 2.4 vs pile up to 2.52) → pile moved to x −3.3…1.5, gösterge on a raised wooden stand at x 2.55, tilted 0.5 rad to the camera; HUD chip 'Gösterge: ■n · Okey: ■n'; corners pulled in to ±4.3/±3.6, revealed hands re-spaced, labels move behind racks on reveal; scene.audit() + scripts/cdp-okey-layout.mjs: 7 viewports × (dealt, crowded 10 discards/corner, revealed) → 0 cross-group overlaps, gösterge first ray hit and inside the free area. Real okeys upside down + gold rim in rack (3D + 2D). Prod counter shows 2 real games since reset (left as is).

## 2026-10-17 lighting / legibility pass (commit 46c3fb3, worker 35b0dd40)
- Key spot 420 → 130, cone π/4.2 → π/3.4, penumbra 0.6 → 0.95, decay 1.4 → 1.2; hemisphere 0.75; new fill spot (16, cone 0.42) aimed only at the human rack; exposure 0.85 → 0.78.
- Bloom threshold → 2.6 (HDR, above any lit tile; strength 0.08); turn strips 4.5 emissive so they still glow.
- Tiles matte: clearcoat 0, roughness 0.78–0.8, specularIntensity 0.35, flat ivory face #f1ead6.
- Inks (src/lib/okey-ink.ts, shared 3D + 2D): red #c8102e, yellow/ochre #b87a00, blue #0047d6, black #121212. WCAG contrast on ivory 4.90 / 3.00 / 6.09 / 15.59; ΔE76 RY 58, RB 116, RK 84, YB 143, YK 82, BK 92 (test enforces ≥3 and ≥45 and CSS sync).
- Numerals font 900 + same-colour stroke; colour-blind symbol under the number: red ◆, yellow ▲, blue ■, black ●.
- Screens: screens/okey-light-{before,after}-{desktop,mobile}{,-rack}.png, okey-light-after-2d.png. Layout audit OK on prod.

## 2026-10-17 selection/highlight pass (worker be6167af)
- Tile materials are static (no emissive anywhere on side/face/back). Highlights = unlit, non-tone-mapped rounded ring just outside the tile outline, 0.012 behind the face plane (own + neighbour faces win the depth test). Selection green + chevron (above on top row, below in the lift gap on bottom row), set colours, okey gold. Lift 0.28 → 0.2.
- 2D: .set background tint removed → blue border; sel lift 8 → 6 px; test enforces highlight CSS has no background/color/filter/opacity/stroke.
- scripts/cdp-okey-select.mjs + okey-select-de.py: highlight-only ΔE76 (same pose, frames on vs hidden) = 0.00 on ink and face for selected / in-set / okey frame / selected okey, desktop + mobile, prod. Plain → selected (includes the 0.2 lift re-raster) 0.7–1.6 ink, ≤0.5 face.
