// Tile ink palette + colour-blind symbols, shared by the 3D faces, the 2D fallback CSS (kept in sync, see tests) and the tests.
// Chosen for contrast on ivory (WCAG ratio ≥ 3 for every ink) and pairwise CIELAB ΔE ≥ 45 (red vs yellow is the hard pair).
export const IVORY = '#f1ead6';
export const INK = ['#c8102e', '#b87a00', '#0047d6', '#121212']; // red, yellow (ochre), blue, black
export const SYMBOL = ['diamond', 'triangle', 'square', 'circle'] as const; // ◆ ▲ ■ ● under the number
