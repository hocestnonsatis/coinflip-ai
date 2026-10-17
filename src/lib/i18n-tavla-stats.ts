import type { Lang } from './i18n';
// All-time global counter badge on /tavla. Numbers arrive pre-formatted with Intl.NumberFormat(lang).
export type StatsDict = {
	title: string; line: (n: string, count: number, humans: string, model: string) => string; gammons: (h: string, m: string) => string;
	humans: string[]; model: string[]; tie: string[]; empty: string; counted: string;
};
export const TAVLA_STATS: Record<Lang, StatsDict> = {
	tr: {
		title: 'Tüm zamanlar', line: (n, _c, h, m) => `Bugüne kadar ${n} oyun oynandı · İnsanlar ${h} · Model ${m}`, gammons: (h, m) => `Mars: insanlar ${h} · model ${m}`,
		humans: ['İnsanlık şimdilik önde. 1.601 parametre not alıyor.', 'İnsanlar önde. Model bunu “eğitim verisi” diye geçiştiriyor.'],
		model: ['Model önde. 8 nöron, koca insanlığa karşı. Ayıp oluyor.', 'Model önde. Kahvehanede bu konuşulmaz.'],
		tie: ['Berabere. Evren dengede, zarlar adil.'], empty: 'Henüz biten oyun yok. İlk sonuç senin olabilir.', counted: 'Bu oyun da sayıldı.'
	},
	en: {
		title: 'All‑time', line: (n, c, h, m) => `${n} ${c === 1 ? 'game' : 'games'} played so far · Humans ${h} · Model ${m}`, gammons: (h, m) => `Gammons: humans ${h} · model ${m}`,
		humans: ['Humanity leads. For now. The 1,601 parameters are taking notes.', 'Humans ahead. The model calls it “training data”.'],
		model: ['The model leads. 8 neurons versus all of humanity. Awkward.', 'The model is ahead. Let’s not talk about it.'],
		tie: ['Dead even. The universe is balanced, the dice are fair.'], empty: 'No finished games yet. The first result could be yours.', counted: 'Your game was counted.'
	},
	de: {
		title: 'Allzeit', line: (n, c, h, m) => `Bisher ${n} ${c === 1 ? 'Spiel' : 'Spiele'} gespielt · Menschen ${h} · Modell ${m}`, gammons: (h, m) => `Gammons: Menschen ${h} · Modell ${m}`,
		humans: ['Die Menschheit führt. Noch. Die 1.601 Parameter machen sich Notizen.', 'Menschen vorn. Das Modell nennt es „Trainingsdaten“.'],
		model: ['Das Modell führt. 8 Neuronen gegen die ganze Menschheit. Peinlich.', 'Das Modell liegt vorn. Reden wir nicht darüber.'],
		tie: ['Gleichstand. Das Universum ist im Gleichgewicht, die Würfel sind fair.'], empty: 'Noch kein beendetes Spiel. Das erste Ergebnis könnte deins sein.', counted: 'Dein Spiel wurde gezählt.'
	},
	es: {
		title: 'Histórico', line: (n, c, h, m) => `${n} ${c === 1 ? 'partida jugada' : 'partidas jugadas'} hasta ahora · Humanos ${h} · Modelo ${m}`, gammons: (h, m) => `Gammons: humanos ${h} · modelo ${m}`,
		humans: ['La humanidad va ganando. Por ahora. Los 1.601 parámetros toman nota.', 'Ganan los humanos. El modelo lo llama “datos de entrenamiento”.'],
		model: ['El modelo va ganando. 8 neuronas contra toda la humanidad. Incómodo.', 'El modelo va por delante. Mejor no hablemos de ello.'],
		tie: ['Empate exacto. El universo está en equilibrio y los dados son justos.'], empty: 'Aún no hay partidas terminadas. El primer resultado puede ser el tuyo.', counted: 'Tu partida ha sido contada.'
	},
	fr: {
		title: 'Depuis toujours', line: (n, c, h, m) => `${n} ${c <= 1 ? 'partie jouée' : 'parties jouées'} à ce jour · Humains ${h} · Modèle ${m}`, gammons: (h, m) => `Gammons : humains ${h} · modèle ${m}`,
		humans: ['L’humanité mène. Pour l’instant. Les 1 601 paramètres prennent des notes.', 'Les humains mènent. Le modèle appelle ça des « données d’entraînement ».'],
		model: ['Le modèle mène. 8 neurones contre toute l’humanité. Gênant.', 'Le modèle est devant. N’en parlons pas.'],
		tie: ['Égalité parfaite. L’univers est en équilibre, les dés sont honnêtes.'], empty: 'Aucune partie terminée pour l’instant. Le premier résultat pourrait être le tien.', counted: 'Ta partie a été comptée.'
	}
};
/** Which funny line applies: 'empty' | 'humans' | 'model' | 'tie'. */
export const leader = (c: { games: number; human: number; model: number }) => (!c.games ? 'empty' : c.human > c.model ? 'humans' : c.model > c.human ? 'model' : 'tie');
