// tiny-models-stats: one SQLite-backed Durable Object ("global") holding the all-time tavla counter.
// The tiny-models (SvelteKit) Worker binds to it with script_name and calls these methods over RPC;
// this Worker itself serves nothing public.
import { DurableObject } from 'cloudflare:workers';

const KEYS = ['games', 'human', 'model', 'humanGammons', 'modelGammons'];

export class TavlaStats extends DurableObject {
	constructor(ctx, env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS counts (k TEXT PRIMARY KEY, n INTEGER NOT NULL);
			CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, ts INTEGER NOT NULL);
			CREATE INDEX IF NOT EXISTS games_ts ON games (ts);
			CREATE TABLE IF NOT EXISTS hits (k TEXT NOT NULL, b INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (k, b));`);
	}
	stats() {
		const out = Object.fromEntries(KEYS.map((k) => [k, 0]));
		for (const r of this.sql.exec('SELECT k, n FROM counts')) if (r.k in out) out[r.k] = r.n;
		return out;
	}
	/** Fixed-window per-key counter: how many hits this key has left in the current window (< 0 = over the limit). */
	hit(key, limit, windowMs, now = Date.now()) {
		const b = Math.floor(now / windowMs);
		const n = this.sql.exec('INSERT INTO hits (k, b, n) VALUES (?, ?, 1) ON CONFLICT (k, b) DO UPDATE SET n = n + 1 RETURNING n', key, b).one().n;
		if (Math.random() < 0.02) this.sql.exec('DELETE FROM hits WHERE b < ?', b - 1);
		return limit - n;
	}
	/** Count a finished game once per ticket id. Runs synchronously, so it is atomic inside the object. */
	record(id, winner, gammon, ip, limit, windowMs, now = Date.now()) {
		if (this.hit(`r:${ip}`, limit, windowMs, now) < 0) return { ok: false, status: 429, error: 'rate limited' };
		const ins = this.sql.exec('INSERT INTO games (id, ts) VALUES (?, ?) ON CONFLICT (id) DO NOTHING', id, now);
		if (ins.rowsWritten === 0) return { ok: false, status: 409, error: 'already counted', stats: this.stats() };
		const add = (k) => this.sql.exec('INSERT INTO counts (k, n) VALUES (?, 1) ON CONFLICT (k) DO UPDATE SET n = n + 1', k);
		add('games'); add(winner);
		if (gammon) add(winner === 'human' ? 'humanGammons' : 'modelGammons');
		if (Math.random() < 0.02) this.sql.exec('DELETE FROM games WHERE ts < ?', now - 2 * 86400_000); // tickets expire after 24 h
		return { ok: true, stats: this.stats() };
	}
	reset() {
		this.sql.exec('DELETE FROM counts; DELETE FROM games; DELETE FROM hits;');
		return this.stats();
	}
}

export default { fetch: () => new Response('Not found', { status: 404 }) };
