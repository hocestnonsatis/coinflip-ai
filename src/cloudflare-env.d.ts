// adapter-cloudflare (Kit 3) exposes Worker bindings through `cloudflare:workers` rather than `platform`.
declare module 'cloudflare:workers' {
	type Counts = import('./lib/server/tavla-stats-core').Counts;
	type Rec = { ok: boolean; status?: number; error?: string; stats?: Counts };
	/** RPC surface of stats-worker/index.js (TavlaStats Durable Object). */
	interface TavlaStatsStub {
		stats(): Promise<Counts>;
		hit(key: string, limit: number, windowMs: number): Promise<number>;
		record(id: string, winner: string, gammon: boolean, ip: string, limit: number, windowMs: number): Promise<Rec>;
		reset(): Promise<Counts>;
	}
	export const env: {
		TAVLA_STATS?: { idFromName(name: string): unknown; get(id: unknown): TavlaStatsStub };
		TAVLA_SECRET?: string;
		TAVLA_ADMIN?: string;
	};
}
