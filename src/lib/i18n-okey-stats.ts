import type { Lang } from './i18n';
// All-time global counter badge on /okey. Numbers arrive pre-formatted with Intl.NumberFormat(lang).
export type OkeyStatsDict = {
	title: string; line: (n: string, count: number, humans: string, bots: string) => string; draws: (d: string) => string;
	humans: string[]; bots: string[]; tie: string[]; empty: string; counted: string;
};
export const OKEY_STATS: Record<Lang, OkeyStatsDict> = {
	tr: {
		title: 'Tüm zamanlar', line: (n, _c, h, b) => `Bugüne kadar ${n} oyun oynandı · İnsanlar ${h} · Botlar ${b}`, draws: (d) => `Deste biten: ${d}`,
		humans: ['İnsanlar önde. Botlar istakalarını sessizce yeniden diziyor.', 'İnsanlık önde. 257 parametre bunu not etti.'],
		bots: ['Botlar önde. Üç bot, tek insan; adil değil ama istatistik bu.', 'Botlar önde. Not: 4 kişilik oyunda bu zaten beklenen.'],
		tie: ['Berabere. Taşlar adil, kimse küsmesin.'], empty: 'Henüz biten oyun yok. İlk sonuç senin olabilir.', counted: 'Bu oyun da sayıldı.'
	},
	en: {
		title: 'All‑time', line: (n, c, h, b) => `${n} ${c === 1 ? 'game' : 'games'} played so far · Humans ${h} · Bots ${b}`, draws: (d) => `Pile ran out: ${d}`,
		humans: ['Humans lead. The bots are quietly re‑sorting their racks.', 'Humanity is ahead. 257 parameters took note.'],
		bots: ['Bots lead. Three bots per human, so that’s just statistics.', 'Bots ahead. In a 4‑player game that’s the expected outcome, they say.'],
		tie: ['Dead even. The tiles are fair, nobody sulk.'], empty: 'No finished games yet. The first result could be yours.', counted: 'Your game was counted.'
	},
	de: {
		title: 'Insgesamt', line: (n, c, h, b) => `Bisher ${n} ${c === 1 ? 'Spiel' : 'Spiele'} · Menschen ${h} · Bots ${b}`, draws: (d) => `Stapel leer: ${d}`,
		humans: ['Die Menschen führen. Die Bots sortieren still ihre Bänke neu.', 'Die Menschheit führt. 257 Parameter haben es notiert.'],
		bots: ['Die Bots führen. Drei Bots pro Mensch – reine Statistik.', 'Bots vorne. Bei vier Spielern ist das zu erwarten, sagen sie.'],
		tie: ['Gleichstand. Die Steine sind fair, niemand schmollt.'], empty: 'Noch keine beendeten Spiele. Das erste Ergebnis könnte deins sein.', counted: 'Dein Spiel wurde gezählt.'
	},
	es: {
		title: 'Histórico', line: (n, c, h, b) => `${n} ${c === 1 ? 'partida jugada' : 'partidas jugadas'} hasta ahora · Humanos ${h} · Bots ${b}`, draws: (d) => `Montón agotado: ${d}`,
		humans: ['Ganan los humanos. Los bots reordenan su atril en silencio.', 'La humanidad va delante. 257 parámetros toman nota.'],
		bots: ['Ganan los bots. Tres bots por humano: pura estadística.', 'Los bots van delante. Con cuatro jugadores es lo esperado, dicen.'],
		tie: ['Empate total. Las fichas son justas, nadie se enfade.'], empty: 'Aún no hay partidas terminadas. El primer resultado puede ser tuyo.', counted: 'Tu partida se ha contado.'
	},
	fr: {
		title: 'Depuis le début', line: (n, c, h, b) => `${n} ${c === 1 ? 'partie jouée' : 'parties jouées'} à ce jour · Humains ${h} · Bots ${b}`, draws: (d) => `Pioche épuisée : ${d}`,
		humans: ['Les humains mènent. Les bots rangent leur chevalet en silence.', 'L’humanité mène. 257 paramètres prennent des notes.'],
		bots: ['Les bots mènent. Trois bots par humain : simple statistique.', 'Les bots devant. À quatre joueurs, c’est attendu, disent‑ils.'],
		tie: ['Égalité parfaite. Les tuiles sont honnêtes, personne ne boude.'], empty: 'Aucune partie terminée pour l’instant. Le premier résultat sera peut‑être le tien.', counted: 'Ta partie a été comptée.'
	}
};
export const okeyLeader = (c: { games: number; human: number; bots: number }) => (!c.games ? 'empty' : c.human > c.bots ? 'humans' : c.bots > c.human ? 'bots' : 'tie') as 'empty' | 'humans' | 'bots' | 'tie';
