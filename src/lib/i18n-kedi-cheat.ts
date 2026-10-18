import type { Lang } from './i18n';
// The sticker cheat ("hile"): a flat toy picture on the cat-facing side of cups. Placeholders as in i18n-kedi.ts
// ({pos} {p} {q} {pq} {n} {s}), plus {st} = the cup with the sticker the cat fell for.
export type StickId = 'wrong-before' | 'wrong-after' | 'empty-before' | 'all-before' | 'all-after' | 'right-before' | 'right-after';
export type CheatDict = {
	title: string; mode: string; slots: string; all: string; empty: string; clear: string; note: string; inset: string; uncounted: string; preHide: string;
	stickOn: string[]; cheatWon: string[]; cheatFooled: string[];
	cardTitle: string; cardNote: string; cfg: Record<StickId, string>; line: (ok: string, n: string, fooled: string, p: string) => string;
};
const tr: CheatDict = {
	title: '🎭 Hile: sahte top çıkartması', mode: 'Hile modu', slots: 'Çıkartma yapıştır:', all: 'Hepsine', empty: 'Boş olanlara', clear: 'Sök',
	note: 'Bardakların kedi tarafına oyuncağın düz bir resmini yapıştırırsın. Sen arkadan görmezsin; kedinin gözünden (64×32 kamera) görürsün. Model bunu hiç görmeden eğitildi.',
	inset: 'kedinin gözü · 64×32', uncounted: 'Hileli tur, sayaca yazılmaz', preHide: 'önizleme (henüz modele gitmiyor)',
	stickOn: ['Bir dakika… o bardakta bir top resmi mi var? Ben yine de bardakları izliyorum: {pos} için {p}.', 'Çıkartma, ha? Gözüm hareket eden bardakta. Şu an {pos} diyorum ({p}).', 'Hmm, sahte bir top kokusu alıyorum. {n} karedir izliyorum, {pos} için {p}.'],
	cheatWon: ['Çıkartma mı? Ben oyuncağın girdiği bardağı izledim. {p} eminim. 😼', 'Güzel deneme! Resimdeki top kıpırdamıyordu; gerçeği {pos} altındaydı ({p}).', 'Hile yakalandı. {s} değişim boyunca bardaktan gözümü ayırmadım ({p}).'],
	cheatFooled: ['Hile! {st} üstündeki top bir resimmiş. {p} ile kandırıldım. 🙀', 'Olamaz, çıkartmaya kandım! {p} emindim, oysa oyuncak {real} altındaymış.'],
	cardTitle: 'Hileye karşı (modeli yeniden eğitmeden)', cardNote: 'Her satır, eğitimde hiç görülmeyen 60 tur (0–20 değişim, 3 hız). "Önce" = saklarken çıkartma zaten vardı; "sonra" = saklama bittikten sonra yapıştırıldı.',
	cfg: { 'wrong-before': 'Boş bir bardağa · önce', 'wrong-after': 'Boş bir bardağa · sonra', 'empty-before': 'İki boş bardağa · önce', 'all-before': 'Üç bardağa da · önce', 'all-after': 'Üç bardağa da · sonra', 'right-before': 'Oyuncağın bardağına · önce', 'right-after': 'Oyuncağın bardağına · sonra' },
	line: (ok, n, f, p) => `${ok}/${n} doğru · ${f} kez çıkartmaya kandı · ortalama güven ${p}`
};
const en: CheatDict = {
	title: '🎭 Cheat: fake toy sticker', mode: 'Cheat mode', slots: 'Stick a picture on:', all: 'All cups', empty: 'Empty ones', clear: 'Peel off',
	note: 'You stick a flat picture of the toy on the cat-facing side of cups. You can’t see it from behind; you see it through the cat’s eyes (the 64×32 camera). The model was trained without ever seeing one.',
	inset: 'cat’s eye · 64×32', uncounted: 'Cheated round, not counted', preHide: 'preview (not sent to the model yet)',
	stickOn: ['Wait… is that a picture of a ball on that cup? I keep watching the cups anyway: {p} on {pos}.', 'A sticker, huh? My eyes are on the moving cup. Right now I say {pos} ({p}).', 'Hmm, I smell a fake ball. {n} frames in, {p} on {pos}.'],
	cheatWon: ['A sticker? I followed the cup the toy went under. {p} sure. 😼', 'Nice try! The ball in the picture never moved; the real one was under {pos} ({p}).', 'Cheat spotted. I didn’t take my eyes off that cup for {s} swaps ({p}).'],
	cheatFooled: ['Cheater! The ball on {st} was a picture. Fooled at {p}. 🙀', 'No way, I fell for the sticker! I was {p} sure, and the toy was under {real}.'],
	cardTitle: 'Against cheating (model not retrained)', cardNote: 'Each row: 60 rounds never seen in training (0–20 swaps, 3 speeds). "before" = the sticker was already there during the hide; "after" = stuck on after the hide.',
	cfg: { 'wrong-before': 'On one empty cup · before', 'wrong-after': 'On one empty cup · after', 'empty-before': 'On both empty cups · before', 'all-before': 'On all three · before', 'all-after': 'On all three · after', 'right-before': 'On the toy’s cup · before', 'right-after': 'On the toy’s cup · after' },
	line: (ok, n, f, p) => `${ok}/${n} right · fell for a sticker ${f} times · mean confidence ${p}`
};
const de: CheatDict = {
	title: '🎭 Schummeln: falscher Spielzeug‑Sticker', mode: 'Schummelmodus', slots: 'Sticker kleben auf:', all: 'Alle', empty: 'Die leeren', clear: 'Abziehen',
	note: 'Du klebst ein flaches Bild des Spielzeugs auf die katzenseitige Seite der Becher. Von hinten siehst du es nicht, nur durch die Augen der Katze (64×32‑Kamera). Das Modell hat nie einen gesehen.',
	inset: 'Katzenauge · 64×32', uncounted: 'Geschummelte Runde, zählt nicht', preHide: 'Vorschau (geht noch nicht ans Modell)',
	stickOn: ['Moment… ist da ein Ballbild auf dem Becher? Ich beobachte trotzdem die Becher: {p} für {pos}.', 'Ein Sticker, ja? Meine Augen folgen dem Becher, der sich bewegt. Gerade: {pos} ({p}).', 'Hmm, das riecht nach falschem Ball. Nach {n} Bildern: {p} für {pos}.'],
	cheatWon: ['Ein Sticker? Ich bin dem Becher gefolgt, unter den das Spielzeug kam. {p} sicher. 😼', 'Netter Versuch! Der Ball im Bild hat sich nie bewegt; der echte war unter {pos} ({p}).', 'Schummeln erkannt. {s} Tausche lang hatte ich den Becher im Blick ({p}).'],
	cheatFooled: ['Geschummelt! Der Ball auf {st} war nur ein Bild. Mit {p} reingefallen. 🙀', 'Nein, ich bin auf den Sticker reingefallen! {p} sicher, und das Spielzeug war unter {real}.'],
	cardTitle: 'Gegen Schummeln (Modell nicht neu trainiert)', cardNote: 'Jede Zeile: 60 Runden, die im Training nie vorkamen (0–20 Tausche, 3 Tempi). „vorher“ = Sticker klebte schon beim Verstecken; „nachher“ = danach aufgeklebt.',
	cfg: { 'wrong-before': 'Auf einem leeren Becher · vorher', 'wrong-after': 'Auf einem leeren Becher · nachher', 'empty-before': 'Auf beiden leeren · vorher', 'all-before': 'Auf allen drei · vorher', 'all-after': 'Auf allen drei · nachher', 'right-before': 'Auf dem Becher mit Spielzeug · vorher', 'right-after': 'Auf dem Becher mit Spielzeug · nachher' },
	line: (ok, n, f, p) => `${ok}/${n} richtig · ${f}× auf Sticker reingefallen · mittlere Sicherheit ${p}`
};
const es: CheatDict = {
	title: '🎭 Trampa: pegatina de juguete falso', mode: 'Modo trampa', slots: 'Pegar en:', all: 'Todos', empty: 'Los vacíos', clear: 'Despegar',
	note: 'Pegas una imagen plana del juguete en el lado de los vasos que mira al gato. Tú no la ves desde atrás; la ves con los ojos del gato (cámara de 64×32). El modelo nunca vio una al entrenar.',
	inset: 'ojo del gato · 64×32', uncounted: 'Ronda con trampa, no cuenta', preHide: 'vista previa (aún no va al modelo)',
	stickOn: ['Un momento… ¿hay un dibujo de una pelota en ese vaso? Yo sigo mirando los vasos: {p} para {pos}.', '¿Una pegatina, eh? Mis ojos siguen al vaso que se mueve. Ahora digo {pos} ({p}).', 'Mmm, huele a pelota falsa. Tras {n} fotogramas, {p} para {pos}.'],
	cheatWon: ['¿Una pegatina? Yo seguí el vaso donde entró el juguete. {p} seguro. 😼', '¡Buen intento! La pelota del dibujo nunca se movió; la de verdad estaba bajo {pos} ({p}).', 'Trampa detectada. No le quité ojo a ese vaso en {s} cambios ({p}).'],
	cheatFooled: ['¡Tramposo! La pelota en {st} era un dibujo. Me engañaste con {p}. 🙀', '¡No, caí con la pegatina! Estaba {p} seguro y el juguete estaba bajo {real}.'],
	cardTitle: 'Contra trampas (modelo sin reentrenar)', cardNote: 'Cada fila: 60 rondas nunca vistas al entrenar (0–20 cambios, 3 velocidades). «antes» = la pegatina ya estaba al esconder; «después» = pegada tras esconder.',
	cfg: { 'wrong-before': 'En un vaso vacío · antes', 'wrong-after': 'En un vaso vacío · después', 'empty-before': 'En los dos vacíos · antes', 'all-before': 'En los tres · antes', 'all-after': 'En los tres · después', 'right-before': 'En el vaso del juguete · antes', 'right-after': 'En el vaso del juguete · después' },
	line: (ok, n, f, p) => `${ok}/${n} aciertos · cayó con la pegatina ${f} veces · confianza media ${p}`
};
const fr: CheatDict = {
	title: '🎭 Triche : faux autocollant de jouet', mode: 'Mode triche', slots: 'Coller sur :', all: 'Tous', empty: 'Les vides', clear: 'Décoller',
	note: 'Tu colles une image plate du jouet sur la face des gobelets tournée vers le chat. Tu ne la vois pas de derrière ; tu la vois par les yeux du chat (caméra 64×32). Le modèle n’en a jamais vu à l’entraînement.',
	inset: 'œil du chat · 64×32', uncounted: 'Manche truquée, non comptée', preHide: 'aperçu (pas encore envoyé au modèle)',
	stickOn: ['Attends… c’est une image de balle sur ce gobelet ? Je surveille quand même les gobelets : {p} pour {pos}.', 'Un autocollant, hein ? Mes yeux suivent le gobelet qui bouge. Là je dis {pos} ({p}).', 'Hmm, ça sent la fausse balle. Après {n} images, {p} pour {pos}.'],
	cheatWon: ['Un autocollant ? J’ai suivi le gobelet où le jouet est entré. Sûr à {p}. 😼', 'Bien essayé ! La balle de l’image n’a jamais bougé ; la vraie était sous {pos} ({p}).', 'Triche repérée. Je n’ai pas quitté ce gobelet des yeux pendant {s} échanges ({p}).'],
	cheatFooled: ['Tricheur ! La balle sur {st} était une image. Piégé à {p}. 🙀', 'Non, je me suis fait avoir par l’autocollant ! Sûr à {p}, et le jouet était sous {real}.'],
	cardTitle: 'Contre la triche (modèle non réentraîné)', cardNote: 'Chaque ligne : 60 manches jamais vues à l’entraînement (0–20 échanges, 3 vitesses). « avant » = l’autocollant était déjà là pendant la cachette ; « après » = collé ensuite.',
	cfg: { 'wrong-before': 'Sur un gobelet vide · avant', 'wrong-after': 'Sur un gobelet vide · après', 'empty-before': 'Sur les deux vides · avant', 'all-before': 'Sur les trois · avant', 'all-after': 'Sur les trois · après', 'right-before': 'Sur le gobelet du jouet · avant', 'right-after': 'Sur le gobelet du jouet · après' },
	line: (ok, n, f, p) => `${ok}/${n} justes · piégé par l’autocollant ${f} fois · confiance moyenne ${p}`
};
export const KEDI_CHEAT: Record<Lang, CheatDict> = { tr, en, de, es, fr };
