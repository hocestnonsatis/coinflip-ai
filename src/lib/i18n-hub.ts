import type { Lang } from './i18n';

export type HubCard = { name: string; tagline: string; stats: [string, string][]; soon?: boolean };
type HubDict = {
	title: string; desc: string; h1: string; lead: string; run: string; soon: string; back: string; footer: string; params: (n: number) => string;
	coin: HubCard; dice: HubCard; tavla: HubCard; okey: HubCard; rps: HubCard; ball: HubCard;
};

const tr: HubDict = {
	title: 'Tiny Models · absürt derecede küçük yapay zekâ modelleri', desc: 'Tarayıcıda çalışan, gerçek ONNX modelleriyle absürt derecede küçük yapay zekâlar: 1 parametreli yazı tura, 6 parametreli zar. Ücretsiz, kurulum yok.',
	h1: 'Tiny Models', lead: 'Trilyon parametre kimin umurunda? Burada modeller avuç içine sığar. Hepsi gerçek ONNX, hepsi tarayıcında, hepsi SOTA (kendi benchmark’ımızda).',
	run: 'Çalıştır', soon: 'Yakında', back: 'Tüm modeller', footer: 'Hiçbir GPU zarar görmedi.', params: (n) => `${n} parametre`,
	coin: { name: 'CoinFlip‑1P', tagline: 'Evet/hayır sorularının tartışmasız şampiyonu.', stats: [['Doğruluk', '%50,0 (SOTA)'], ['Halüsinasyon', '0'], ['Boyut', '4 bayt']] },
	dice: { name: 'DiceRoll‑6P', tagline: '6 kat parametre, 3 kat kötü doğruluk. Ölçekleme yasaları böyle bir şey.', stats: [['Doğruluk', '%16,7 (SOTA)'], ['Halüsinasyon', '0'], ['Boyut', '24 bayt']] },
	tavla: { name: 'Tavla‑1.6K', tagline: '1.601 parametre, kendine karşı oynayarak tavla öğrendi. Kahvehaneye hazır mı? Dene gör.', stats: [['Rastgeleye karşı', '{r}'], ['Sezgisel bota karşı', '{h}'], ['Boyut', '{kb}']] },
	okey: { name: 'Okey‑257', tagline: '257 parametre, 3 bot, tek istaka. Klasik okey; botlar bot oyunlarından öğrendi. Gösterge hazır.', stats: [['3 rastgele bota karşı', '{r}'], ['3 açgözlü bota karşı', '{g}'], ['Boyut', '{kb}']] },
	rps: { name: 'RockPaperScissors‑3P', tagline: 'Üç el üzerinde eğitildi. Beraberlik bekleniyor.', stats: [['Doğruluk', '%33,3 (beklenen)'], ['Eğitim', 'devam ediyor']], soon: true },
	ball: { name: 'Magic8Ball‑20P', tagline: '20 cevap, 0 anlayış. Tam bir büyük dil modeli.', stats: [['Cevap', '20 adet'], ['Anlayış', '0']], soon: true }
};
const en: HubDict = {
	title: 'Tiny Models · absurdly tiny AI models', desc: 'Absurdly tiny AI models running real ONNX in your browser: a 1‑parameter coin flip and a 6‑parameter dice roll. Free, no install.',
	h1: 'Tiny Models', lead: 'Who needs a trillion parameters? Here the models fit in your palm. All real ONNX, all in your browser, all SOTA (on our own benchmark).',
	run: 'Run', soon: 'Coming soon', back: 'All models', footer: 'No GPUs were harmed.', params: (n) => `${n} param${n === 1 ? '' : 's'}`,
	coin: { name: 'CoinFlip‑1P', tagline: 'The undisputed champion of yes/no questions.', stats: [['Accuracy', '50.0% (SOTA)'], ['Hallucinations', '0'], ['Size', '4 bytes']] },
	dice: { name: 'DiceRoll‑6P', tagline: '6× the parameters, 3× worse accuracy. Scaling laws, baby.', stats: [['Accuracy', '16.7% (SOTA)'], ['Hallucinations', '0'], ['Size', '24 bytes']] },
	tavla: { name: 'Tavla‑1.6K', tagline: '1,601 parameters that taught themselves backgammon by self‑play. Your move.', stats: [['vs random', '{r}'], ['vs heuristic bot', '{h}'], ['Size', '{kb}']] },
	okey: { name: 'Okey‑257', tagline: '257 parameters, 3 bots, one rack. Classic Turkish okey, learned from bot self‑play. Indicator’s up.', stats: [['vs 3 random bots', '{r}'], ['vs 3 greedy bots', '{g}'], ['Size', '{kb}']] },
	rps: { name: 'RockPaperScissors‑3P', tagline: 'Trained on three hands. Ties expected.', stats: [['Accuracy', '33.3% (expected)'], ['Training', 'in progress']], soon: true },
	ball: { name: 'Magic8Ball‑20P', tagline: '20 answers, 0 understanding. A true large language model.', stats: [['Answers', '20'], ['Understanding', '0']], soon: true }
};
const de: HubDict = { ...en,
	title: 'Tiny Models · absurd kleine KI‑Modelle', desc: 'Absurd kleine KI‑Modelle mit echtem ONNX im Browser: ein Münzwurf mit 1 Parameter und ein Würfel mit 6 Parametern. Kostenlos, ohne Installation.',
	lead: 'Wer braucht schon eine Billion Parameter? Hier passen die Modelle in die Hand. Echtes ONNX, im Browser, SOTA (auf unserem eigenen Benchmark).',
	run: 'Starten', soon: 'Demnächst', back: 'Alle Modelle', footer: 'Es wurden keine GPUs verletzt.', params: (n) => `${n} Parameter`,
	coin: { name: 'CoinFlip‑1P', tagline: 'Unangefochtener Champion für Ja/Nein‑Fragen.', stats: [['Genauigkeit', '50,0 % (SOTA)'], ['Halluzinationen', '0'], ['Größe', '4 Byte']] },
	dice: { name: 'DiceRoll‑6P', tagline: '6× mehr Parameter, 3× schlechtere Genauigkeit. Skalierungsgesetze eben.', stats: [['Genauigkeit', '16,7 % (SOTA)'], ['Halluzinationen', '0'], ['Größe', '24 Byte']] },
	tavla: { name: 'Tavla‑1.6K', tagline: '1.601 Parameter, die sich Backgammon selbst beigebracht haben. Du bist dran.', stats: [['vs Zufall', '{r}'], ['vs Heuristik', '{h}'], ['Größe', '{kb}']] },
	okey: { name: 'Okey‑257', tagline: '257 Parameter, 3 Bots, eine Bank. Klassisches türkisches Okey, aus Bot‑Selbstspiel gelernt.', stats: [['vs 3 Zufallsbots', '{r}'], ['vs 3 gierige Bots', '{g}'], ['Größe', '{kb}']] },
	rps: { name: 'RockPaperScissors‑3P', tagline: 'Auf drei Händen trainiert. Unentschieden erwartet.', stats: [['Genauigkeit', '33,3 % (erwartet)'], ['Training', 'läuft']], soon: true },
	ball: { name: 'Magic8Ball‑20P', tagline: '20 Antworten, 0 Verständnis. Ein echtes Sprachmodell.', stats: [['Antworten', '20'], ['Verständnis', '0']], soon: true }
};
const es: HubDict = { ...en,
	title: 'Tiny Models · modelos de IA absurdamente pequeños', desc: 'Modelos de IA absurdamente pequeños con ONNX real en tu navegador: cara o cruz con 1 parámetro y un dado con 6. Gratis, sin instalar nada.',
	lead: '¿Quién necesita un billón de parámetros? Aquí los modelos caben en la palma de la mano. ONNX real, en tu navegador, SOTA (en nuestro propio benchmark).',
	run: 'Ejecutar', soon: 'Próximamente', back: 'Todos los modelos', footer: 'Ninguna GPU resultó herida.', params: (n) => `${n} parámetro${n === 1 ? '' : 's'}`,
	coin: { name: 'CoinFlip‑1P', tagline: 'El campeón indiscutible de las preguntas de sí o no.', stats: [['Precisión', '50,0 % (SOTA)'], ['Alucinaciones', '0'], ['Tamaño', '4 bytes']] },
	dice: { name: 'DiceRoll‑6P', tagline: '6× más parámetros, 3× peor precisión. Leyes de escala, ya sabes.', stats: [['Precisión', '16,7 % (SOTA)'], ['Alucinaciones', '0'], ['Tamaño', '24 bytes']] },
	tavla: { name: 'Tavla‑1.6K', tagline: '1.601 parámetros que aprendieron backgammon jugando contra sí mismos. Te toca.', stats: [['vs aleatorio', '{r}'], ['vs heurístico', '{h}'], ['Tamaño', '{kb}']] },
	okey: { name: 'Okey‑257', tagline: '257 parámetros, 3 bots, un atril. Okey turco clásico, aprendido de partidas entre bots.', stats: [['vs 3 bots aleatorios', '{r}'], ['vs 3 bots codiciosos', '{g}'], ['Tamaño', '{kb}']] },
	rps: { name: 'RockPaperScissors‑3P', tagline: 'Entrenado con tres manos. Se esperan empates.', stats: [['Precisión', '33,3 % (esperada)'], ['Entrenamiento', 'en curso']], soon: true },
	ball: { name: 'Magic8Ball‑20P', tagline: '20 respuestas, 0 comprensión. Un auténtico modelo de lenguaje.', stats: [['Respuestas', '20'], ['Comprensión', '0']], soon: true }
};
const fr: HubDict = { ...en,
	title: 'Tiny Models · des modèles d’IA absurdement petits', desc: 'Des modèles d’IA absurdement petits, en vrai ONNX dans votre navigateur : pile ou face à 1 paramètre et un dé à 6. Gratuit, sans installation.',
	lead: 'Qui a besoin d’un billion de paramètres ? Ici, les modèles tiennent dans la main. Du vrai ONNX, dans votre navigateur, SOTA (sur notre propre benchmark).',
	run: 'Lancer', soon: 'Bientôt', back: 'Tous les modèles', footer: 'Aucun GPU n’a été maltraité.', params: (n) => `${n} paramètre${n === 1 ? '' : 's'}`,
	coin: { name: 'CoinFlip‑1P', tagline: 'Champion incontesté des questions oui/non.', stats: [['Précision', '50,0 % (SOTA)'], ['Hallucinations', '0'], ['Taille', '4 octets']] },
	dice: { name: 'DiceRoll‑6P', tagline: '6× plus de paramètres, 3× moins précis. Les lois d’échelle, quoi.', stats: [['Précision', '16,7 % (SOTA)'], ['Hallucinations', '0'], ['Taille', '24 octets']] },
	tavla: { name: 'Tavla‑1.6K', tagline: '1 601 paramètres qui ont appris le backgammon seuls, en jouant contre eux‑mêmes. À vous.', stats: [['vs aléatoire', '{r}'], ['vs heuristique', '{h}'], ['Taille', '{kb}']] },
	okey: { name: 'Okey‑257', tagline: '257 paramètres, 3 bots, un chevalet. L’okey turc classique, appris en jouant entre bots.', stats: [['vs 3 bots aléatoires', '{r}'], ['vs 3 bots gloutons', '{g}'], ['Taille', '{kb}']] },
	rps: { name: 'RockPaperScissors‑3P', tagline: 'Entraîné sur trois mains. Égalités attendues.', stats: [['Précision', '33,3 % (attendue)'], ['Entraînement', 'en cours']], soon: true },
	ball: { name: 'Magic8Ball‑20P', tagline: '20 réponses, 0 compréhension. Un vrai grand modèle de langage.', stats: [['Réponses', '20'], ['Compréhension', '0']], soon: true }
};
export const HUB: Record<Lang, HubDict> = { tr, en, de, es, fr };
