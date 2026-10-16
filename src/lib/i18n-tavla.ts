import type { Lang } from './i18n';
// Commentary placeholders: {p} = model's own win probability, {h} = your win probability, {n} = candidate moves scored, {ms} = inference ms.
export type TavlaDict = {
	title: string; desc: string; pitch: string; you: string; model: string; roll: string; undo: string; newGame: string; thinking: string;
	yourTurn: string; modelTurn: string; pickChecker: string; pickTarget: string; noMove: string; modelNoMove: string; opening: (you: number, m: number, first: string) => string;
	youWin: string; modelWin: string; gammon: string; winProb: string; pips: string; engineLabel: string; engineTs: string; cardTitle: string; card: (s: CardStats) => [string, string][];
	loading: string; hint: string; start: string[]; move: string[]; confident: string[]; worried: string[]; hit: string[]; gotHit: string[]; humanNoMove: string[]; aiNoMove: string[];
	aiWon: string[]; humanWon: string[]; candidates: (n: number, ms: string) => string;
};
export type CardStats = { params: string; games: string; hours: string; vsRandom: string; vsHeur: string; size: string };

const tr: TavlaDict = {
	title: 'Tavla‑1.6K · 1.601 parametreli yapay zekâyla tavla oyna', desc: 'Tarayıcıda 1.601 parametreli gerçek bir sinir ağına karşı tavla (backgammon) oyna. TD‑Gammon tarzı kendi kendine oynayarak eğitildi, ONNX Runtime ile çalışır. Ücretsiz, kurulum yok.',
	pitch: '1.601 parametre · TD(λ) ile kendine karşı oynayarak öğrendi · gerçek ONNX', you: 'Sen', model: 'Model', roll: 'Zar at 🎲', undo: 'Geri al', newGame: 'Yeni oyun', thinking: 'Model düşünüyor…',
	yourTurn: 'Sıra sende', modelTurn: 'Sıra modelde', pickChecker: 'Oynatacağın pulu seç', pickTarget: 'Hedef haneyi seç', noMove: 'Oynayacak hamlen yok, sıra geçti.', modelNoMove: 'Modelin oynayacak hamlesi yok.',
	opening: (y, m, f) => `Başlangıç zarı: sen ${y}, model ${m}. ${f} başlıyor.`,
	youWin: 'Kazandın! 🎉', modelWin: 'Model kazandı.', gammon: 'Mars!', winProb: 'Kazanma ihtimalin', pips: 'Pip', engineLabel: 'Motor', engineTs: 'TypeScript (yedek)', cardTitle: 'Model kartı',
	card: (s) => [['Mimari', '198 girdi (Tesauro kodlaması) → 8 sigmoid gizli nöron → 1 sigmoid çıktı (kazanma olasılığı)'], ['Parametre', s.params], ['Eğitim', `${s.games} oyun kendine karşı, TD(λ), ${s.hours}, tek CPU çekirdeği`], ['Rastgele oyuncuya karşı', s.vsRandom], ['Pip sayan sezgisel bota karşı', s.vsHeur], ['Arama', '1 hamle derinlik: tüm yasal hamleler tek ONNX çağrısında puanlanır'], ['Boyut', s.size], ['Kısıtlar', 'Katlama küpü yok. Tek oyun, mars sayılır ama puan tutulmaz. Usta değil, ama hamlesini 1 ms’de yapar.']],
	loading: 'Model yükleniyor', hint: 'Pula, sonra hedef haneye dokun. Parlayan haneler gidebileceğin yerler.',
	start: ['Hazırım. Toplam beynim 1.601 sayı, seninki biraz daha fazla. Görelim.', 'Kendime karşı yüz binlerce oyun oynadım. Hepsini ben kazandım. Hepsini ben kaybettim.', 'Pullar dizildi. Benim tecrübem: sadece kendimle oynadım, asosyalim.'],
	move: ['Kazanma ihtimalim {p}. 1.600 parametreyle bu kadar.', '{n} hamleyi tarttım, en iyisi buydu. Galiba.', '{ms} ms düşündüm. Uzun oldu, kusura bakma.', 'Bu hamleyi kahvehanede görsen alkışlarsın. Belki.', 'Benim için {p}, senin için {h}. Matematik acımasız.', 'Gradyanlarım bu hamleyi çok sevdi.', '{n} aday, 1 karar, 0 tereddüt.'],
	confident: ['{p} ile önde gidiyorum. Çayları sen ısmarlarsın.', 'Kazanma ihtimalim {p}. Yavaş yavaş pulları toplamaya başlıyorum.', 'Bu oyun bende gibi. 8 nöronun 8’i de hemfikir.'],
	worried: ['Kazanma ihtimalim {p}. Nöronlarımdan biri istifa etmek üzere.', '{h} sende. Bunu yazan sigmoid utanıyor.', 'Durum kritik: {p}. Şimdi zar tutmaya çalışıyorum… tutmuyor.'],
	hit: ['Kırdım! Bara buyur. Kişisel değil, sadece gradyan.', 'Pulun gitti. Kapıdan girersen konuşuruz.', 'Bir pul kırdım, kazanma ihtimalim {p} oldu.'],
	gotHit: ['Pulumu kırdın. Bunu eğitim verime yazıyorum.', 'Ah! Bar soğukmuş.', 'Kırıldım ama yıkılmadım. Kazanma ihtimalim yine de {p}.'],
	humanNoMove: ['Kapılar kapalı. Sen bekle, ben oynarım.', 'Hamlen yok. Model bunu planlamış gibi yapacak.'],
	aiNoMove: ['Oynayacak yer yok. Bunu bilerek yaptım, strateji.', 'Pas. 1.601 parametre de kapıyı açamıyor.'],
	aiWon: ['Kazandım! 1.601 parametre, sıfır kibir. Tamam, biraz kibir.', 'Oyun bitti. Rövanş istersen buradayım, yorulmam.'],
	humanWon: ['Kazandın. Ağırlıklarımı gözden geçireceğim.', 'Tebrikler! Ben de sadece 8 nöronum, bunu unutma.'],
	candidates: (n, ms) => `${n} aday hamle tek ONNX çağrısında puanlandı · ${ms} ms`
};
const en: TavlaDict = {
	title: 'Tavla‑1.6K · play backgammon vs a 1,601‑parameter AI', desc: 'Play backgammon (tavla) in your browser against a real 1,601‑parameter neural network, trained TD‑Gammon style by self‑play and run with ONNX Runtime. Free, no install.',
	pitch: '1,601 parameters · learned by TD(λ) self‑play · real ONNX', you: 'You', model: 'Model', roll: 'Roll dice 🎲', undo: 'Undo', newGame: 'New game', thinking: 'Model is thinking…',
	yourTurn: 'Your turn', modelTurn: 'Model’s turn', pickChecker: 'Pick a checker to move', pickTarget: 'Pick a target point', noMove: 'No legal move, you pass.', modelNoMove: 'The model has no legal move.',
	opening: (y, m, f) => `Opening roll: you ${y}, model ${m}. ${f} starts.`,
	youWin: 'You win! 🎉', modelWin: 'The model wins.', gammon: 'Gammon!', winProb: 'Your win chance', pips: 'Pips', engineLabel: 'Engine', engineTs: 'TypeScript (fallback)', cardTitle: 'Model card',
	card: (s) => [['Architecture', '198 inputs (Tesauro encoding) → 8 sigmoid hidden units → 1 sigmoid output (win probability)'], ['Parameters', s.params], ['Training', `${s.games} self‑play games, TD(λ), ${s.hours}, one CPU core`], ['vs random player', s.vsRandom], ['vs pip‑count heuristic bot', s.vsHeur], ['Search', '1‑ply: every legal move is scored in a single ONNX call'], ['Size', s.size], ['Limitations', 'No doubling cube. Single game, gammons shown but not scored. Not a master, but it moves in about a millisecond.']],
	loading: 'Loading model', hint: 'Tap a checker, then a target point. Highlighted points are legal.',
	start: ['Ready. My entire brain is 1,601 numbers. Yours is slightly bigger. Let’s see.', 'I played hundreds of thousands of games against myself. I won all of them. I lost all of them.', 'Checkers set. My experience: I only ever played myself. Very antisocial.'],
	move: ['My win chance: {p}. That’s what 1,600 parameters get you.', 'Weighed {n} moves, this was the best. Probably.', 'Thought for {ms} ms. Sorry, that was long.', 'Grandmasters would applaud this move. Some of them. Maybe.', '{p} for me, {h} for you. Math is cruel.', 'My gradients really liked that one.', '{n} candidates, 1 decision, 0 hesitation.'],
	confident: ['Up to {p}. You’re buying the tea.', 'Win chance {p}. I’m starting to warm up my bear‑off.', 'This one’s mine. All 8 neurons agree.'],
	worried: ['Win chance {p}. One of my neurons is drafting a resignation letter.', '{h} for you. The sigmoid that computed this is embarrassed.', 'Critical: {p}. Trying to will the dice now… not working.'],
	hit: ['Hit! Off to the bar. Nothing personal, just gradients.', 'Your checker is gone. Come back in if you can.', 'Hit one. My win chance is now {p}.'],
	gotHit: ['You hit me. Adding that to my training data.', 'Ouch! The bar is cold.', 'Hit but not broken. Still {p} for me.'],
	humanNoMove: ['All doors closed. You wait, I play.', 'No move for you. I’ll pretend I planned this.'],
	aiNoMove: ['Nowhere to go. Totally intentional. Strategy.', 'Pass. Even 1,601 parameters can’t open that board.'],
	aiWon: ['I win! 1,601 parameters, zero ego. Fine, a little ego.', 'Game over. Rematch? I don’t get tired.'],
	humanWon: ['You win. I’ll be reviewing my weights.', 'Congrats! Remember, I’m just 8 neurons.'],
	candidates: (n, ms) => `${n} candidate moves scored in one ONNX call · ${ms} ms`
};
const de: TavlaDict = {
	title: 'Tavla‑1.6K · Backgammon gegen eine KI mit 1.601 Parametern', desc: 'Spiele Backgammon im Browser gegen ein echtes neuronales Netz mit 1.601 Parametern, TD‑Gammon‑artig durch Selbstspiel trainiert, mit ONNX Runtime. Kostenlos, ohne Installation.',
	pitch: '1.601 Parameter · per TD(λ)-Selbstspiel gelernt · echtes ONNX', you: 'Du', model: 'Modell', roll: 'Würfeln 🎲', undo: 'Rückgängig', newGame: 'Neues Spiel', thinking: 'Modell denkt…',
	yourTurn: 'Du bist dran', modelTurn: 'Modell ist dran', pickChecker: 'Wähle einen Stein', pickTarget: 'Wähle ein Zielfeld', noMove: 'Kein legaler Zug, du setzt aus.', modelNoMove: 'Das Modell hat keinen legalen Zug.',
	opening: (y, m, f) => `Eröffnungswurf: du ${y}, Modell ${m}. ${f} beginnt.`,
	youWin: 'Du gewinnst! 🎉', modelWin: 'Das Modell gewinnt.', gammon: 'Gammon!', winProb: 'Deine Gewinnchance', pips: 'Pips', engineLabel: 'Engine', engineTs: 'TypeScript (Fallback)', cardTitle: 'Modellkarte',
	card: (s) => [['Architektur', '198 Eingänge (Tesauro‑Kodierung) → 8 Sigmoid‑Neuronen → 1 Sigmoid‑Ausgang (Gewinnwahrscheinlichkeit)'], ['Parameter', s.params], ['Training', `${s.games} Selbstspiel‑Partien, TD(λ), ${s.hours}, ein CPU‑Kern`], ['gegen Zufallsspieler', s.vsRandom], ['gegen Pip‑Zähl‑Heuristik', s.vsHeur], ['Suche', '1‑ply: alle legalen Züge in einem einzigen ONNX‑Aufruf bewertet'], ['Größe', s.size], ['Grenzen', 'Kein Dopplerwürfel. Einzelspiel, Gammons angezeigt, aber nicht gezählt. Kein Meister, aber zieht in rund einer Millisekunde.']],
	loading: 'Modell lädt', hint: 'Tippe auf einen Stein, dann auf ein Zielfeld. Markierte Felder sind legal.',
	start: ['Bereit. Mein ganzes Gehirn sind 1.601 Zahlen. Deins ist etwas größer. Mal sehen.', 'Ich habe Hunderttausende Partien gegen mich selbst gespielt. Alle gewonnen. Alle verloren.', 'Steine stehen. Meine Erfahrung: nur gegen mich selbst. Sehr ungesellig.'],
	move: ['Meine Gewinnchance: {p}. Mehr geben 1.600 Parameter nicht her.', '{n} Züge abgewogen, das war der beste. Wahrscheinlich.', '{ms} ms nachgedacht. Sorry, das war lang.', '{p} für mich, {h} für dich. Mathe ist gnadenlos.', 'Meine Gradienten mochten diesen Zug sehr.', '{n} Kandidaten, 1 Entscheidung, 0 Zögern.'],
	confident: ['{p} für mich. Du zahlst den Tee.', 'Gewinnchance {p}. Ich wärme schon das Auswürfeln an.', 'Das Spiel gehört mir. Alle 8 Neuronen sind sich einig.'],
	worried: ['Gewinnchance {p}. Eines meiner Neuronen schreibt gerade seine Kündigung.', '{h} für dich. Das zuständige Sigmoid schämt sich.', 'Kritisch: {p}. Ich versuche, die Würfel zu beschwören… klappt nicht.'],
	hit: ['Geschlagen! Ab auf die Bar. Nichts Persönliches, nur Gradienten.', 'Dein Stein ist weg. Komm wieder rein, wenn du kannst.', 'Einen geschlagen. Gewinnchance jetzt {p}.'],
	gotHit: ['Du hast mich geschlagen. Kommt in meine Trainingsdaten.', 'Autsch! Die Bar ist kalt.', 'Geschlagen, nicht besiegt. Immer noch {p} für mich.'],
	humanNoMove: ['Alle Türen zu. Du wartest, ich spiele.', 'Kein Zug für dich. Ich tue so, als hätte ich das geplant.'],
	aiNoMove: ['Kein Platz. Volle Absicht. Strategie.', 'Passe. Auch 1.601 Parameter öffnen dieses Brett nicht.'],
	aiWon: ['Gewonnen! 1.601 Parameter, null Ego. Na gut, ein bisschen.', 'Spiel vorbei. Revanche? Ich werde nicht müde.'],
	humanWon: ['Du gewinnst. Ich überprüfe meine Gewichte.', 'Glückwunsch! Ich bin nur 8 Neuronen.'],
	candidates: (n, ms) => `${n} Kandidatenzüge in einem ONNX‑Aufruf bewertet · ${ms} ms`
};
const es: TavlaDict = {
	title: 'Tavla‑1.6K · juega al backgammon contra una IA de 1.601 parámetros', desc: 'Juega al backgammon en tu navegador contra una red neuronal real de 1.601 parámetros, entrenada al estilo TD‑Gammon jugando contra sí misma, con ONNX Runtime. Gratis, sin instalar nada.',
	pitch: '1.601 parámetros · aprendió con TD(λ) jugando contra sí misma · ONNX real', you: 'Tú', model: 'Modelo', roll: 'Tirar dados 🎲', undo: 'Deshacer', newGame: 'Nueva partida', thinking: 'El modelo piensa…',
	yourTurn: 'Tu turno', modelTurn: 'Turno del modelo', pickChecker: 'Elige una ficha', pickTarget: 'Elige un destino', noMove: 'No tienes jugada legal, pasas.', modelNoMove: 'El modelo no tiene jugada legal.',
	opening: (y, m, f) => `Tirada inicial: tú ${y}, modelo ${m}. Empieza ${f.toLowerCase()}.`,
	youWin: '¡Ganaste! 🎉', modelWin: 'Gana el modelo.', gammon: '¡Gammon!', winProb: 'Tu probabilidad de ganar', pips: 'Pips', engineLabel: 'Motor', engineTs: 'TypeScript (respaldo)', cardTitle: 'Ficha del modelo',
	card: (s) => [['Arquitectura', '198 entradas (codificación de Tesauro) → 8 neuronas sigmoide → 1 salida sigmoide (probabilidad de ganar)'], ['Parámetros', s.params], ['Entrenamiento', `${s.games} partidas contra sí mismo, TD(λ), ${s.hours}, un núcleo de CPU`], ['vs jugador aleatorio', s.vsRandom], ['vs bot heurístico de pips', s.vsHeur], ['Búsqueda', '1‑ply: todas las jugadas legales puntuadas en una sola llamada ONNX'], ['Tamaño', s.size], ['Limitaciones', 'Sin cubo de doblaje. Partida única, los gammons se muestran pero no puntúan. No es un maestro, pero mueve en un milisegundo.']],
	loading: 'Cargando modelo', hint: 'Toca una ficha y luego un destino. Los puntos resaltados son legales.',
	start: ['Listo. Mi cerebro entero son 1.601 números. El tuyo es algo más grande. Veamos.', 'Jugué cientos de miles de partidas contra mí mismo. Las gané todas. Las perdí todas.', 'Fichas colocadas. Mi experiencia: solo jugué contra mí. Muy antisocial.'],
	move: ['Mi probabilidad de ganar: {p}. Es lo que dan 1.600 parámetros.', 'Sopesé {n} jugadas, esta era la mejor. Probablemente.', 'Pensé {ms} ms. Perdón, fue largo.', '{p} para mí, {h} para ti. Las matemáticas son crueles.', 'A mis gradientes les encantó esta.', '{n} candidatas, 1 decisión, 0 dudas.'],
	confident: ['Voy con {p}. El té lo pagas tú.', 'Probabilidad {p}. Ya caliento para sacar fichas.', 'Esta es mía. Las 8 neuronas están de acuerdo.'],
	worried: ['Probabilidad {p}. Una de mis neuronas está redactando su dimisión.', '{h} para ti. La sigmoide que lo calculó está avergonzada.', 'Crítico: {p}. Intento hipnotizar los dados… no funciona.'],
	hit: ['¡Comida! A la barra. Nada personal, solo gradientes.', 'Tu ficha se fue. Vuelve a entrar si puedes.', 'Comí una. Mi probabilidad ahora: {p}.'],
	gotHit: ['Me comiste. Lo añado a mis datos de entrenamiento.', '¡Ay! La barra está fría.', 'Comido pero no vencido. Aún {p} para mí.'],
	humanNoMove: ['Todo cerrado. Tú esperas, yo juego.', 'Sin jugada para ti. Fingiré que lo planeé.'],
	aiNoMove: ['No hay adónde ir. Totalmente intencional. Estrategia.', 'Paso. Ni 1.601 parámetros abren ese tablero.'],
	aiWon: ['¡Gané! 1.601 parámetros, cero ego. Vale, un poco.', 'Fin de la partida. ¿Revancha? No me canso.'],
	humanWon: ['Ganaste. Revisaré mis pesos.', '¡Felicidades! Recuerda que solo soy 8 neuronas.'],
	candidates: (n, ms) => `${n} jugadas candidatas puntuadas en una llamada ONNX · ${ms} ms`
};
const fr: TavlaDict = {
	title: 'Tavla‑1.6K · jouez au backgammon contre une IA à 1 601 paramètres', desc: 'Jouez au backgammon dans votre navigateur contre un vrai réseau de neurones à 1 601 paramètres, entraîné façon TD‑Gammon en jouant contre lui‑même, avec ONNX Runtime. Gratuit, sans installation.',
	pitch: '1 601 paramètres · appris par TD(λ) en jouant contre lui‑même · vrai ONNX', you: 'Vous', model: 'Modèle', roll: 'Lancer les dés 🎲', undo: 'Annuler', newGame: 'Nouvelle partie', thinking: 'Le modèle réfléchit…',
	yourTurn: 'À vous', modelTurn: 'Au modèle', pickChecker: 'Choisissez un pion', pickTarget: 'Choisissez une case', noMove: 'Aucun coup légal, vous passez.', modelNoMove: 'Le modèle n’a aucun coup légal.',
	opening: (y, m, f) => `Lancer d’ouverture : vous ${y}, modèle ${m}. ${f} commence.`,
	youWin: 'Vous gagnez ! 🎉', modelWin: 'Le modèle gagne.', gammon: 'Gammon !', winProb: 'Vos chances de gagner', pips: 'Pips', engineLabel: 'Moteur', engineTs: 'TypeScript (secours)', cardTitle: 'Fiche du modèle',
	card: (s) => [['Architecture', '198 entrées (encodage de Tesauro) → 8 neurones sigmoïdes → 1 sortie sigmoïde (probabilité de victoire)'], ['Paramètres', s.params], ['Entraînement', `${s.games} parties contre lui‑même, TD(λ), ${s.hours}, un cœur CPU`], ['contre un joueur aléatoire', s.vsRandom], ['contre un bot heuristique (pips)', s.vsHeur], ['Recherche', '1‑ply : tous les coups légaux notés en un seul appel ONNX'], ['Taille', s.size], ['Limites', 'Pas de videau. Partie simple, gammons affichés mais non comptés. Pas un maître, mais il joue en une milliseconde.']],
	loading: 'Chargement du modèle', hint: 'Touchez un pion, puis une case. Les cases en surbrillance sont légales.',
	start: ['Prêt. Tout mon cerveau tient en 1 601 nombres. Le vôtre est un peu plus gros. Voyons.', 'J’ai joué des centaines de milliers de parties contre moi‑même. Toutes gagnées. Toutes perdues.', 'Pions en place. Mon expérience : je n’ai joué que contre moi. Très asocial.'],
	move: ['Mes chances de gagner : {p}. Voilà ce que donnent 1 600 paramètres.', 'J’ai pesé {n} coups, celui‑ci était le meilleur. Probablement.', 'Réfléchi {ms} ms. Pardon, c’était long.', '{p} pour moi, {h} pour vous. Les maths sont cruelles.', 'Mes gradients ont adoré ce coup.', '{n} candidats, 1 décision, 0 hésitation.'],
	confident: ['{p} pour moi. Le thé est pour vous.', 'Chances {p}. Je prépare déjà la sortie.', 'Celle‑ci est à moi. Les 8 neurones sont d’accord.'],
	worried: ['Chances {p}. Un de mes neurones rédige sa démission.', '{h} pour vous. La sigmoïde qui l’a calculé a honte.', 'Critique : {p}. J’essaie d’hypnotiser les dés… sans succès.'],
	hit: ['Frappé ! Direction la barre. Rien de personnel, juste des gradients.', 'Votre pion est parti. Revenez si vous pouvez.', 'Un pion frappé. Mes chances : {p}.'],
	gotHit: ['Vous m’avez frappé. J’ajoute ça à mes données d’entraînement.', 'Aïe ! La barre est froide.', 'Frappé mais pas battu. Toujours {p} pour moi.'],
	humanNoMove: ['Tout est fermé. Vous attendez, je joue.', 'Aucun coup pour vous. Je vais faire comme si c’était prévu.'],
	aiNoMove: ['Nulle part où aller. Totalement voulu. Stratégie.', 'Je passe. Même 1 601 paramètres n’ouvrent pas ce jan.'],
	aiWon: ['J’ai gagné ! 1 601 paramètres, zéro ego. Bon, un peu.', 'Partie terminée. Revanche ? Je ne me fatigue jamais.'],
	humanWon: ['Vous gagnez. Je vais revoir mes poids.', 'Bravo ! N’oubliez pas, je ne suis que 8 neurones.'],
	candidates: (n, ms) => `${n} coups candidats notés en un appel ONNX · ${ms} ms`
};
export const TAVLA: Record<Lang, TavlaDict> = { tr, en, de, es, fr };
