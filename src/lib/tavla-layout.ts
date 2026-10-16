// Pure geometry for the 3D tavla board (no WebGL): slot positions for every checker.
import { Vector3 } from 'three';
import type { Board } from './tavla-engine';

// Board units: one point = 1 wide. Columns 0..11 left→right (as the SVG board); bar at x = 0; human home = near right.
export const R = 0.44, CH = 0.17, EDGE = 5.55, PITCH = 0.9, TRAY_X = 7.45;
export const colX = (c: number) => -6 + c + (c >= 6 ? 1 : 0);
export const ptX = (i: number) => (i < 12 ? colX(11 - i) : colX(i - 12));
export const near = (i: number) => i < 12; // bottom row of the SVG = near side (z > 0)

export type Loc = number; // 0..23 points, 24 human bar, 25 model bar, 26 human off, 27 model off
export type Highlights = { sources: Set<number>; targets: Set<number>; sel: number | null; lastTo: Set<number> };

/** Slot positions for every checker of a board (human view, human > 0). */
export function layout(b: Board): Map<Loc, { human: boolean; pos: Vector3[] }> {
	const m = new Map<Loc, { human: boolean; pos: Vector3[] }>();
	for (let i = 0; i < 24; i++) {
		const n = Math.abs(b[i]); if (!n) continue;
		const pos: Vector3[] = [], s = near(i) ? 1 : -1;
		for (let k = 0; k < n; k++) { const row = k % 5, layer = Math.floor(k / 5); pos.push(new Vector3(ptX(i) + layer * 0.06, CH / 2 + 0.02 + layer * CH, s * (EDGE - row * PITCH - layer * 0.18))); }
		m.set(i, { human: b[i] > 0, pos });
	}
	const bar = (n: number, s: number) => Array.from({ length: n }, (_, k) => new Vector3(0, 0.26 + CH / 2 + Math.floor(k / 4) * CH, s * (1.0 + (k % 4) * PITCH)));
	if (b[24]) m.set(24, { human: true, pos: bar(b[24], 1) });
	if (b[25]) m.set(25, { human: false, pos: bar(b[25], -1) });
	const off = (n: number, s: number) => Array.from({ length: n }, (_, k) => new Vector3(TRAY_X, 0.08 + R * 0.75, s * (5.7 - k * 0.26)));
	if (b[26]) m.set(26, { human: true, pos: off(b[26], 1) });
	if (b[27]) m.set(27, { human: false, pos: off(b[27], -1) });
	return m;
}

