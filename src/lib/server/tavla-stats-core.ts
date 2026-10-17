// Pure helpers for the global tavla win counter: signed game tickets + result plausibility checks.
// No platform imports, so the same code runs in the Worker and in `node tests/tavla-stats.test.ts`.

export type Winner = 'human' | 'model';
export interface ResultBody { winner: Winner; gammon: boolean; moves: number; gameId: string }
export interface Counts { games: number; human: number; model: number; humanGammons: number; modelGammons: number }

export const RULES = {
	minMs: 30_000, // a real game (opening roll, animations, ≥13 turns of clicking) cannot be shorter
	maxMs: 24 * 3600_000, // tickets expire after a day
	// 167 pips each; even all 6-6 doubles (24 pips/turn) need 7 winner turns, so ≥ 7 + 6 turns in total
	minMoves: 13,
	maxMoves: 2000
};

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
export async function issueTicket(secret: string, now = Date.now()): Promise<{ gameId: string; start: number }> {
	const id = hex(crypto.getRandomValues(new Uint8Array(16)));
	const body = `t1.${id}.${now}`;
	return { gameId: `${body}.${await hmac(secret, body)}`, start: now };
}

export async function verifyTicket(secret: string, ticket: unknown): Promise<{ id: string; start: number } | null> {
	if (typeof ticket !== 'string' || ticket.length > 200) return null;
	const m = /^t1\.([0-9a-f]{32})\.(\d{13})\.([0-9a-f]{64})$/.exec(ticket);
	if (!m) return null;
	if (!safeEqual(await hmac(secret, `t1.${m[1]}.${m[2]}`), m[3])) return null;
	return { id: m[1], start: Number(m[2]) };
}

export type Check = { ok: true; id: string; winner: Winner; gammon: boolean } | { ok: false; status: number; error: string };

/** Full validation of a POST /api/tavla/result body (shape, signature, timing, move count). Once-only is enforced by the Durable Object. */
export async function checkResult(secret: string, body: unknown, now = Date.now()): Promise<Check> {
	const b = body as Partial<ResultBody> | null;
	if (!b || typeof b !== 'object') return { ok: false, status: 400, error: 'bad body' };
	if (b.winner !== 'human' && b.winner !== 'model') return { ok: false, status: 400, error: 'bad winner' };
	if (typeof b.gammon !== 'boolean') return { ok: false, status: 400, error: 'bad gammon' };
	if (typeof b.moves !== 'number' || !Number.isInteger(b.moves)) return { ok: false, status: 400, error: 'bad moves' };
	const t = await verifyTicket(secret, b.gameId);
	if (!t) return { ok: false, status: 403, error: 'bad ticket' };
	const age = now - t.start;
	if (age < RULES.minMs) return { ok: false, status: 422, error: 'too fast' };
	if (age > RULES.maxMs) return { ok: false, status: 410, error: 'ticket expired' };
	if (b.moves < RULES.minMoves || b.moves > RULES.maxMoves) return { ok: false, status: 422, error: 'implausible move count' };
	return { ok: true, id: t.id, winner: b.winner, gammon: b.gammon };
}

/** Per-IP rate-limit key without storing raw IPs. */
export async function ipKey(secret: string, ip: string): Promise<string> { return (await hmac(secret, `ip:${ip}`)).slice(0, 24); }

export const LIMITS = { windowMs: 3600_000, start: 60, result: 30 };
