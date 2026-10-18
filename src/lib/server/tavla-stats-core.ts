// Pure helpers for the global tavla win counter: signed game tickets + result plausibility checks.
// No platform imports, so the same code runs in the Worker and in `node tests/tavla-stats.test.ts`.

export type Winner = 'human' | 'model' | 'draw';
export type Kind = 'tavla' | 'okey' | 'kedi';
export interface ResultBody { winner: Winner; gammon: boolean; moves: number; gameId: string }
export interface Counts { games: number; human: number; model: number; humanGammons: number; modelGammons: number; draw?: number }

export type Rules = { minMs: number; maxMs: number; minMoves: number; maxMoves: number; draw: boolean };
export const RULES: Rules = { draw: false,
	minMs: 30_000, // a real game (opening roll, animations, ≥13 turns of clicking) cannot be shorter
	maxMs: 24 * 3600_000, // tickets expire after a day
	// 167 pips each; even all 6-6 doubles (24 pips/turn) need 7 winner turns, so ≥ 7 + 6 turns in total
	minMoves: 13,
	maxMoves: 2000
};
/** Okey: moves = total discards by all 4 seats. A win needs the winner's own turn after the deal, so ≥ 4 discards except for a
 * (practically impossible) dealt winning hand; games can also end with the pile exhausted ('draw'). */
export const RULES_OKEY: Rules = { minMs: 20_000, maxMs: 24 * 3600_000, minMoves: 4, maxMoves: 400, draw: true };
/** Kedi (cups): one round = hide → shuffles → the cat guesses; moves = swaps (0 allowed). Hide + paw + reveal take ≥ 4 s. */
export const RULES_KEDI: Rules = { minMs: 4_000, maxMs: 24 * 3600_000, minMoves: 0, maxMoves: 5000, draw: false };
const msg = (kind: Kind, body: string) => (kind === 'tavla' ? body : `${kind}|${body}`); // tavla tickets keep their original format

const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function hmac(secret: string, msg: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

/** Constant-time string compare (equal-length hex strings). */
export function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return d === 0;
}

/** Ticket "t1.<128-bit random id>.<start ms>.<hmac>" — the id is what the counter remembers to accept a result once. */
export async function issueTicket(secret: string, now = Date.now(), kind: Kind = 'tavla'): Promise<{ gameId: string; start: number }> {
	const id = hex(crypto.getRandomValues(new Uint8Array(16)));
	const body = `t1.${id}.${now}`;
	return { gameId: `${body}.${await hmac(secret, msg(kind, body))}`, start: now };
}

export async function verifyTicket(secret: string, ticket: unknown, kind: Kind = 'tavla'): Promise<{ id: string; start: number } | null> {
	if (typeof ticket !== 'string' || ticket.length > 200) return null;
	const m = /^t1\.([0-9a-f]{32})\.(\d{13})\.([0-9a-f]{64})$/.exec(ticket);
	if (!m) return null;
	if (!safeEqual(await hmac(secret, msg(kind, `t1.${m[1]}.${m[2]}`)), m[3])) return null;
	return { id: m[1], start: Number(m[2]) };
}

export type Check = { ok: true; id: string; winner: Winner; gammon: boolean } | { ok: false; status: number; error: string };

/** Full validation of a POST /api/tavla/result body (shape, signature, timing, move count). Once-only is enforced by the Durable Object. */
export async function checkResult(secret: string, body: unknown, now = Date.now(), kind: Kind = 'tavla', rules: Rules = RULES): Promise<Check> {
	const b = body as Partial<ResultBody> | null;
	if (!b || typeof b !== 'object') return { ok: false, status: 400, error: 'bad body' };
	if (b.winner !== 'human' && b.winner !== 'model' && !(rules.draw && b.winner === 'draw')) return { ok: false, status: 400, error: 'bad winner' };
	if (kind !== 'tavla' && b.gammon === undefined) b.gammon = false;
	if (typeof b.gammon !== 'boolean') return { ok: false, status: 400, error: 'bad gammon' };
	if (typeof b.moves !== 'number' || !Number.isInteger(b.moves)) return { ok: false, status: 400, error: 'bad moves' };
	const t = await verifyTicket(secret, b.gameId, kind);
	if (!t) return { ok: false, status: 403, error: 'bad ticket' };
	const age = now - t.start;
	if (age < rules.minMs) return { ok: false, status: 422, error: 'too fast' };
	if (age > rules.maxMs) return { ok: false, status: 410, error: 'ticket expired' };
	if (b.moves < rules.minMoves || b.moves > rules.maxMoves) return { ok: false, status: 422, error: 'implausible move count' };
	return { ok: true, id: t.id, winner: b.winner, gammon: b.gammon };
}

/** Per-IP rate-limit key without storing raw IPs. */
export async function ipKey(secret: string, ip: string): Promise<string> { return (await hmac(secret, `ip:${ip}`)).slice(0, 24); }

export const LIMITS = { windowMs: 3600_000, start: 60, result: 30 };
export const LIMITS_OKEY = { windowMs: 3600_000, start: 40, result: 30 };
export const LIMITS_KEDI = { windowMs: 3600_000, start: 150, result: 120 }; // rounds are short
