// Real numbers from train-okey (NOTES.md, eval-final.json). Held-out eval: model in seat 0, dealer rotating, seeds 90000+.
// vs*.d = games where the pile ran out (nobody finished). greedyRef = the greedy solver bot itself in seat 0 vs 3 greedy.
// games ≈ 35,245 counted in the 2nd datagen run + ≈10.7k in the pilot (343k samples at ≈32 samples/game).
// iterations ≈ games of the (unshipped) policy-iteration round.
export const STATS = {
	params: 257, samples: 1_467_046, games: 46_000, minutes: 20, procs: 7, iterations: 6_000,
	vsRandom: { w: 3736, n: 4000, d: 246 }, vsGreedy: { w: 959, n: 4000, d: 18 }, greedyRef: { w: 998, n: 4000, d: 14 }, onnxBytes: 1451
};
