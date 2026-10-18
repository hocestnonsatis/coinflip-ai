import type { Lang } from './i18n';
// Sleepy cat: the model gets fewer camera frames per second (game time). Placeholders as in i18n-kedi.ts plus {fps}.
export type SleepyDict = {
	title: string; awake: string; fpsUnit: string; note: string; roundTag: (fps: number) => string; nextRound: string;
	special: (n: string, h: string, k: string) => string;
	seen: string[]; decide: string[]; won: string[]; lost: string[];
	cardTitle: string; bySpeed: string; bySwaps: string; cardNote: string;
};
const tr: SleepyDict = {
	title: 'Uykulu kedi', awake: 'uyanık', fpsUnit: 'kare/sn', note: 'Uykulu kedi modele saniyede daha az kare verir (oyun zamanında 30 → 15 → 10 → 5). Kareler aynı, sadece seyrekleşir. Model yeniden eğitilmedi. Değişiklik bir sonraki saklamada başlar.',
	roundTag: (f) => `😴 Uykulu tur: ${f} kare/sn · ayrı sayaca yazılır`, nextRound: 'sonraki turda',
	special: (n, h, k) => `Hileli / uykulu turlar (ayrı sayaç): ${n} tur · İnsanlar ${h} · Kedi ${k}`,
	seen: ['Hıı… gördüm… {pos}… {p}… zzz', '*esner* Tamam… oyuncak {pos} altında. Saniyede {fps} kare görüyorum ({p}).', 'Gözüm kapanıyor ama {pos} dedim ({p}). Yavaş karıştır, olur mu?'],
	decide: ['Hmm… *esner*… {pos} galiba ({p}).', '{n} kare gördüm, uykum var… {pos} ({p}).'],
	won: ['Uyurken bile buldum. 😴 {fps} kare/sn ile {p} emindim.', 'Zzz… hı? Buldum mu? {s} değişimde {n} kare yetti ({p}).'],
	lost: ['Zzz… kaçırdım. Saniyede {fps} kare, {s} değişim; {p} ile {pos} dedim ama oyuncak {real} altındaymış.', 'Gözlerim kapanıyordu… {n} kare gördüm, yetmedi. {real} imiş.'],
	cardTitle: 'Uykulu kedi (modeli yeniden eğitmeden)', bySpeed: 'Doğruluk: kare/sn × hız (1–30 değişim)', bySwaps: 'Doğruluk: kare/sn × değişim (5 hızın hepsi)',
	cardNote: 'Eğitimde hiç görülmeyen aynı 900 test turu; 30 kare/sn = normal kedi. Kare hızı oyun zamanına göre; kare hızı düşünce hızlı değişimlerin ortası kaçıyor.'
};
const en: SleepyDict = {
	title: 'Sleepy cat', awake: 'awake', fpsUnit: 'fps', note: 'A sleepy cat gets fewer camera frames per second (game time: 30 → 15 → 10 → 5). Same frames, just sparser. The model was not retrained. Takes effect at the next hide.',
	roundTag: (f) => `😴 Sleepy round: ${f} fps · counted separately`, nextRound: 'next round',
	special: (n, h, k) => `Cheat / sleepy rounds (separate counter): ${n} rounds · Humans ${h} · Cat ${k}`,
	seen: ['Mmh… saw it… {pos}… {p}… zzz', '*yawns* OK… the toy is under {pos}. I’m seeing {fps} frames a second ({p}).', 'My eyes are closing, but I say {pos} ({p}). Shuffle slowly, yes?'],
	decide: ['Hmm… *yawn*… {pos}, I think ({p}).', 'I saw {n} frames, I’m sleepy… {pos} ({p}).'],
	won: ['Found it in my sleep. 😴 {p} sure at {fps} fps.', 'Zzz… huh? Did I win? {n} frames were enough for {s} swaps ({p}).'],
	lost: ['Zzz… missed it. {fps} fps, {s} swaps; I said {pos} at {p}, but the toy was under {real}.', 'My eyes were closing… {n} frames weren’t enough. It was {real}.'],
	cardTitle: 'Sleepy cat (model not retrained)', bySpeed: 'Accuracy: fps × speed (1–30 swaps)', bySwaps: 'Accuracy: fps × swaps (all 5 speeds)',
	cardNote: 'The same 900 held‑out test rounds; 30 fps = the normal cat. Frame rate is in game time; at low rates the middle of fast swaps falls between frames.'
};
const de: SleepyDict = {
	title: 'Müde Katze', awake: 'wach', fpsUnit: 'B/s', note: 'Eine müde Katze bekommt weniger Kamerabilder pro Sekunde (Spielzeit: 30 → 15 → 10 → 5). Dieselben Bilder, nur seltener. Das Modell wurde nicht neu trainiert. Gilt ab dem nächsten Verstecken.',
	roundTag: (f) => `😴 Müde Runde: ${f} B/s · zählt separat`, nextRound: 'nächste Runde',
	special: (n, h, k) => `Schummel‑ / Müde‑Runden (eigener Zähler): ${n} Runden · Menschen ${h} · Katze ${k}`,
	seen: ['Mmh… gesehen… {pos}… {p}… zzz', '*gähnt* Gut… das Spielzeug ist {pos}. Ich sehe {fps} Bilder pro Sekunde ({p}).', 'Mir fallen die Augen zu, aber ich sage {pos} ({p}). Langsam mischen, ja?'],
	decide: ['Hmm… *gähn*… {pos}, glaube ich ({p}).', '{n} Bilder gesehen, ich bin müde… {pos} ({p}).'],
	won: ['Im Schlaf gefunden. 😴 Mit {fps} B/s {p} sicher.', 'Zzz… hm? Gewonnen? {n} Bilder reichten für {s} Tausche ({p}).'],
	lost: ['Zzz… verpasst. {fps} B/s, {s} Tausche; ich sagte {pos} mit {p}, aber das Spielzeug war unter {real}.', 'Mir fielen die Augen zu… {n} Bilder reichten nicht. Es war {real}.'],
	cardTitle: 'Müde Katze (Modell nicht neu trainiert)', bySpeed: 'Genauigkeit: B/s × Tempo (1–30 Tausche)', bySwaps: 'Genauigkeit: B/s × Tausche (alle 5 Tempi)',
	cardNote: 'Dieselben 900 zurückgehaltenen Testrunden; 30 B/s = die normale Katze. Bildrate in Spielzeit; bei wenigen Bildern fällt die Mitte schneller Tausche zwischen zwei Bilder.'
};
const es: SleepyDict = {
	title: 'Gato dormilón', awake: 'despierto', fpsUnit: 'fps', note: 'Un gato dormilón recibe menos fotogramas por segundo (tiempo de juego: 30 → 15 → 10 → 5). Los mismos fotogramas, solo más espaciados. El modelo no se reentrenó. Empieza en el siguiente escondite.',
	roundTag: (f) => `😴 Ronda dormilona: ${f} fps · cuenta aparte`, nextRound: 'próxima ronda',
	special: (n, h, k) => `Rondas con trampa / dormilonas (contador aparte): ${n} rondas · Humanos ${h} · Gato ${k}`,
	seen: ['Mmm… lo vi… {pos}… {p}… zzz', '*bosteza* Vale… el juguete está bajo {pos}. Veo {fps} fotogramas por segundo ({p}).', 'Se me cierran los ojos, pero digo {pos} ({p}). Mezcla despacio, ¿sí?'],
	decide: ['Mmm… *bostezo*… {pos}, creo ({p}).', 'Vi {n} fotogramas, tengo sueño… {pos} ({p}).'],
	won: ['Lo encontré dormido. 😴 {p} seguro a {fps} fps.', 'Zzz… ¿eh? ¿Gané? {n} fotogramas bastaron para {s} cambios ({p}).'],
	lost: ['Zzz… se me escapó. {fps} fps, {s} cambios; dije {pos} con {p}, pero el juguete estaba bajo {real}.', 'Se me cerraban los ojos… {n} fotogramas no bastaron. Era {real}.'],
	cardTitle: 'Gato dormilón (modelo sin reentrenar)', bySpeed: 'Precisión: fps × velocidad (1–30 cambios)', bySwaps: 'Precisión: fps × cambios (las 5 velocidades)',
	cardNote: 'Las mismas 900 rondas de prueba reservadas; 30 fps = el gato normal. Fps en tiempo de juego; con pocos fotogramas, la mitad de los cambios rápidos cae entre dos fotogramas.'
};
const fr: SleepyDict = {
	title: 'Chat endormi', awake: 'réveillé', fpsUnit: 'i/s', note: 'Un chat endormi reçoit moins d’images par seconde (temps de jeu : 30 → 15 → 10 → 5). Les mêmes images, juste plus espacées. Le modèle n’a pas été réentraîné. Prend effet à la prochaine cachette.',
	roundTag: (f) => `😴 Manche endormie : ${f} i/s · comptée à part`, nextRound: 'manche suivante',
	special: (n, h, k) => `Manches truquées / endormies (compteur à part) : ${n} manches · Humains ${h} · Chat ${k}`,
	seen: ['Mmh… vu… {pos}… {p}… zzz', '*bâille* D’accord… le jouet est sous {pos}. Je vois {fps} images par seconde ({p}).', 'Mes yeux se ferment, mais je dis {pos} ({p}). Mélange doucement, d’accord ?'],
	decide: ['Hmm… *bâillement*… {pos}, je crois ({p}).', 'J’ai vu {n} images, j’ai sommeil… {pos} ({p}).'],
	won: ['Trouvé en dormant. 😴 Sûr à {p} avec {fps} i/s.', 'Zzz… hein ? Gagné ? {n} images ont suffi pour {s} échanges ({p}).'],
	lost: ['Zzz… raté. {fps} i/s, {s} échanges ; j’ai dit {pos} à {p}, mais le jouet était sous {real}.', 'Mes yeux se fermaient… {n} images, ça n’a pas suffi. C’était {real}.'],
	cardTitle: 'Chat endormi (modèle non réentraîné)', bySpeed: 'Précision : i/s × vitesse (1–30 échanges)', bySwaps: 'Précision : i/s × échanges (les 5 vitesses)',
	cardNote: 'Les mêmes 900 manches de test réservées ; 30 i/s = le chat normal. Cadence en temps de jeu ; à faible cadence, le milieu des échanges rapides tombe entre deux images.'
};
export const KEDI_SLEEP: Record<Lang, SleepyDict> = { tr, en, de, es, fr };
