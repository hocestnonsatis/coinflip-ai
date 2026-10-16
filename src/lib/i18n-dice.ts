import type { Lang } from './i18n';

export type DiceDict = {
	title: string; desc: string; pitch: string; placeholder: string; ask: string; roll: string; loadingBtn: string; busyBtn: string;
	charging: string; overcharge: string; thinking: string; inferring: string; confidence: string; stats: [string, string, string, string];
	loading: string; loadSub: (n: number) => string; hint: string; copy: string; copied: string; copyFail: string; engineLabel: string; engineTs: string;
	cardTitle: string; card: [string, string][]; noWebgl: string; badges: [string, string, string, string]; weightsPlain: string;
	quips: string[]; lines: string[]; lowLines: string[]; highLines: string[]; rareLines: string[];
	rareLabel: string; legendary: string; legendarySub: string; output: (f: string, c: string) => string; holdLog: (ms: string) => string;
};

const tr: DiceDict = {
	title: 'DiceRoll‑6P · 6 parametreli yapay zekâ zarı', desc: '6 parametreli, gerçek ONNX modeliyle tarayıcıda çalışan 3D zar. Sorunu yaz (“Kaç saat uyumalıyım?”), basılı tut, model 1–6 arasında karar versin.',
	pitch: '6 parametre · %16,7 doğruluk (SOTA) · cevaplar 1 ile 6 arasında', placeholder: 'Kaç saat uyumalıyım?', ask: 'Basılı tut, zara sor 🎲', roll: 'Basılı tut & bırak 🎲',
	loadingBtn: 'Yükleniyor…', busyBtn: 'Zar yuvarlanıyor…', charging: 'Güç toplanıyor', overcharge: 'Aşırı güç! Zar titriyor, masa sorumluluk kabul etmiyor.',
	thinking: 'Düşünüyor', inferring: 'Softmax hesaplanıyor', confidence: 'Güven', stats: ['Token/sn', 'Gecikme', 'Atış', 'Top‑p'],
	loading: 'Model ağırlıkları yükleniyor', loadSub: (n) => `${n * 6}/24 bayt · kalan süre: yok denecek kadar az`, hint: 'Basılı tut, bırak',
	copy: 'Sonucu kopyala', copied: 'Kopyalandı ✓', copyFail: 'Kopyalanamadı', engineLabel: 'Motor', engineTs: 'TypeScript (yedek)',
	cardTitle: 'Model kartı', card: [['Mimari', 'softmax((g + b) · 1,0); g = Gumbel(hash(basılı tutma süresi ⊕ jitter)), ONNX Runtime’da çalışır'], ['Parametre', '6 (altı). Hepsi 1/6. Elle ayarlandı, çok emek verildi.'], ['Eğitim verisi', '1 tavla zarı, 3 çay, 1 kahvehane tartışması.'], ['Benchmark', 'ZarBench‑6’da %16,7 ± şans. SOTA.'], ['Halüsinasyon', '0. 7 gelmez, söz.'], ['Kısıtlar', 'Tavlada hile için kullanmayın. Kullanırsanız bize ne.']],
	noWebgl: 'WebGL kullanılamıyor, zar sadece hayal gücünde yuvarlanıyor.', badges: ['benchmark: %16,7 doğruluk (SOTA)', '6 parametre', '0 halüsinasyon', '%100 yerel'],
	weightsPlain: 'b = [1/6 × 6] · fp32 · hepsi aynı (bilerek)',
	quips: ['Gumbel gürültüsü örnekleniyor…', 'Altı yüz, tek kader.', 'Attention head sayısı: 0. Zar bakmaz, atılır.', 'Softmax ısınıyor…', 'Tavla tahtası yükleniyor… şaka, gerek yok.'],
	lines: ['{face}. Bunu 6 parametreyle buldum, rakiplerim hâlâ token sayıyor.', '{face}. {conf} eminim; geri kalan beş yüz itiraz etti ama oy hakları yok.', '{face}. Saniyede {tps} token hızında, yüzde yüz yerli zar.', '{face}. {ms} ms basılı tuttun, model de ona göre karar verdi.', '{face}. Benchmark’ta da bu çıktı, testi de ben yazdım.', '{face}. Seri A turunda bu sayıya 60 milyon dolar istiyoruz.', '{face}. Halüsinasyon değil, düpedüz olasılık.', '{face}. Kahvehanede de böyle dediler, bilimsel oldu.', '{face}. Altı parametre, tek fikir.', '{face}. Hocam bu sefer kesin.'],
	lowLines: ['{face}. Az ama öz. Tıpkı parametre sayım gibi.', '{face}. Düşük çıktı ama moral bozmak yok, model {conf} emin.', '{face}. Şeş beş değil ama hayat da tavla değil.'],
	highLines: ['{face}. Yüksek çıktı! Yatırımcılara AGI diye sunuyoruz.', '{face}. Tavlada olsa şimdi kapıyı alırdın.', '{face}. Altıya yakın, yani neredeyse süper zekâ.'],
	rareLines: ['Zar köşesinin üstünde durdu. Model bu cevabı veremez, fizik veriyor.', 'Köşe! Softmax bile şaşırdı.'],
	rareLabel: 'Köşe!', legendary: 'EFSANEVİ', legendarySub: 'Zar köşesinin üstünde dengede kaldı!', output: (f, c) => `✓ Çıktı: ${f} (${c} emin)`, holdLog: (ms) => `basılı tutma: ${ms} ms`
};
const en: DiceDict = {
	title: 'DiceRoll‑6P · the 6‑parameter AI die', desc: 'A 3D die powered by a real 6‑parameter ONNX model in your browser. Ask a question (“How many hours should I sleep?”), hold, and the model picks 1–6.',
	pitch: '6 parameters · 16.7% accuracy (SOTA) · answers range from 1 to 6', placeholder: 'How many hours should I sleep?', ask: 'Hold to ask the die 🎲', roll: 'Hold & release 🎲',
	loadingBtn: 'Loading…', busyBtn: 'Rolling…', charging: 'Charging', overcharge: 'Overcharged! The die is shaking, the table accepts no liability.',
	thinking: 'Thinking', inferring: 'Computing softmax', confidence: 'Confidence', stats: ['Tokens/s', 'Latency', 'Rolls', 'Top‑p'],
	loading: 'Loading model weights', loadSub: (n) => `${n * 6}/24 bytes · time left: basically none`, hint: 'Hold, then release',
	copy: 'Copy result', copied: 'Copied ✓', copyFail: 'Copy failed', engineLabel: 'Engine', engineTs: 'TypeScript (fallback)',
	cardTitle: 'Model card', card: [['Architecture', 'softmax((g + b) · 1.0); g = Gumbel(hash(hold time ⊕ jitter)), runs on ONNX Runtime'], ['Parameters', '6 (six). All of them 1/6. Hand‑tuned, very hard work.'], ['Training data', '1 backgammon die, 3 coffees, 1 heated board‑game argument.'], ['Benchmark', '16.7% ± luck on DiceBench‑6. SOTA.'], ['Hallucinations', '0. It will never say 7.'], ['Limitations', 'Do not use to cheat at board games. Or do, no refunds.']],
	noWebgl: 'WebGL unavailable, the die only rolls in your imagination.', badges: ['benchmark: 16.7% accuracy (SOTA)', '6 parameters', '0 hallucinations', '100% local'],
	weightsPlain: 'b = [1/6 × 6] · fp32 · all identical (on purpose)',
	quips: ['Sampling Gumbel noise…', 'Six faces, one destiny.', 'Attention heads: 0. Dice don’t attend, they roll.', 'Warming up the softmax…', 'Scaling from 1 to 6 parameters. Investors notified.'],
	lines: ['{face}. Found with 6 parameters while my rivals are still counting tokens.', '{face}. {conf} confident; the other five faces objected but don’t get a vote.', '{face}. At {tps} tokens/sec. Artisanal, locally rolled.', '{face}. You held for {ms} ms, so the model decided accordingly.', '{face}. Same answer on the benchmark. I wrote the benchmark.', '{face}. Raising a Series A on this number. $60M, pre‑money.', '{face}. Not a hallucination, just probability.', '{face}. As a large language model… kidding, I’m a cube.', '{face}. Six parameters, one opinion.', '{face}. Peer‑reviewed by gravity.'],
	lowLines: ['{face}. Small but mighty. Like my parameter count.', '{face}. Low roll, high confidence: {conf}.', '{face}. Underwhelming? So was GPT‑1.'],
	highLines: ['{face}. High roll! Pitching this to investors as AGI.', '{face}. Basically superintelligence, on a scale of 1 to 6.', '{face}. Emergent behavior detected. Probably.'],
	rareLines: ['The die is balancing on a corner. The model can’t answer this one; physics can.', 'Corner! Even the softmax is surprised.'],
	rareLabel: 'Corner!', legendary: 'LEGENDARY', legendarySub: 'The die balanced on its corner!', output: (f, c) => `✓ Output: ${f} (${c} sure)`, holdLog: (ms) => `hold: ${ms} ms`
};
const de: DiceDict = { ...en,
	title: 'DiceRoll‑6P · der KI‑Würfel mit 6 Parametern', desc: 'Ein 3D‑Würfel mit einem echten ONNX‑Modell mit 6 Parametern im Browser. Frage stellen („Wie viele Stunden soll ich schlafen?“), halten, das Modell wählt 1–6.',
	pitch: '6 Parameter · 16,7 % Genauigkeit (SOTA) · Antworten von 1 bis 6', placeholder: 'Wie viele Stunden soll ich schlafen?', ask: 'Halten, Würfel fragen 🎲', roll: 'Halten & loslassen 🎲',
	loadingBtn: 'Lädt…', busyBtn: 'Rollt…', charging: 'Lädt auf', overcharge: 'Überladen! Der Würfel zittert, der Tisch übernimmt keine Haftung.',
	thinking: 'Denkt nach', inferring: 'Softmax läuft', confidence: 'Konfidenz', stats: ['Token/s', 'Latenz', 'Würfe', 'Top‑p'],
	loading: 'Modellgewichte werden geladen', loadSub: (n) => `${n * 6}/24 Bytes · Restzeit: praktisch keine`, hint: 'Gedrückt halten, loslassen',
	copy: 'Ergebnis kopieren', copied: 'Kopiert ✓', copyFail: 'Kopieren fehlgeschlagen',
	cardTitle: 'Modellkarte', card: [['Architektur', 'softmax((g + b) · 1,0); g = Gumbel(hash(Haltedauer ⊕ Jitter)), läuft auf ONNX Runtime'], ['Parameter', '6 (sechs). Alle 1/6. Handoptimiert, harte Arbeit.'], ['Trainingsdaten', '1 Spielwürfel, 3 Kaffee, 1 hitzige Mensch‑ärgere‑dich‑nicht‑Runde.'], ['Benchmark', '16,7 % ± Glück auf WürfelBench‑6. SOTA.'], ['Halluzinationen', '0. Eine 7 gibt es nie.'], ['Einschränkungen', 'Nicht zum Schummeln bei Brettspielen verwenden.']],
	noWebgl: 'WebGL nicht verfügbar, der Würfel rollt nur in deiner Fantasie.', badges: ['Benchmark: 16,7 % Genauigkeit (SOTA)', '6 Parameter', '0 Halluzinationen', '100 % lokal'],
	weightsPlain: 'b = [1/6 × 6] · fp32 · alle gleich (mit Absicht)',
	quips: ['Gumbel‑Rauschen wird gezogen…', 'Sechs Seiten, ein Schicksal.', 'Softmax wärmt sich auf…'],
	lines: ['{face}. Mit 6 Parametern gefunden, die Konkurrenz zählt noch Tokens.', '{face}. Zu {conf} sicher; die anderen fünf Seiten haben kein Stimmrecht.', '{face}. Bei {tps} Tokens/s, regional gewürfelt.', '{face}. Du hast {ms} ms gehalten, das Modell hat entsprechend entschieden.', '{face}. Keine Halluzination, nur Wahrscheinlichkeit.'],
	lowLines: ['{face}. Klein, aber oho. Wie meine Parameterzahl.', '{face}. Niedriger Wurf, hohe Konfidenz: {conf}.'],
	highLines: ['{face}. Hoher Wurf! Den Investoren verkaufen wir das als AGI.', '{face}. Quasi Superintelligenz, auf einer Skala von 1 bis 6.'],
	rareLines: ['Der Würfel balanciert auf einer Ecke. Das Modell kann das nicht beantworten, die Physik schon.'],
	rareLabel: 'Ecke!', legendary: 'LEGENDÄR', legendarySub: 'Der Würfel blieb auf einer Ecke stehen!', output: (f, c) => `✓ Ausgabe: ${f} (${c} sicher)`, holdLog: (ms) => `Haltedauer: ${ms} ms`
};
const es: DiceDict = { ...en,
	title: 'DiceRoll‑6P · el dado con IA de 6 parámetros', desc: 'Un dado 3D con un modelo ONNX real de 6 parámetros en tu navegador. Pregunta («¿Cuántas horas debería dormir?»), mantén pulsado y el modelo elige del 1 al 6.',
	pitch: '6 parámetros · 16,7 % de precisión (SOTA) · respuestas del 1 al 6', placeholder: '¿Cuántas horas debería dormir?', ask: 'Mantén y pregunta al dado 🎲', roll: 'Mantén y suelta 🎲',
	loadingBtn: 'Cargando…', busyBtn: 'Rodando…', charging: 'Cargando', overcharge: '¡Sobrecarga! El dado tiembla, la mesa no se hace responsable.',
	thinking: 'Pensando', inferring: 'Calculando softmax', confidence: 'Confianza', stats: ['Tokens/s', 'Latencia', 'Tiradas', 'Top‑p'],
	loading: 'Cargando los pesos del modelo', loadSub: (n) => `${n * 6}/24 bytes · tiempo restante: casi nada`, hint: 'Mantén pulsado y suelta',
	copy: 'Copiar resultado', copied: 'Copiado ✓', copyFail: 'No se pudo copiar',
	cardTitle: 'Ficha del modelo', card: [['Arquitectura', 'softmax((g + b) · 1,0); g = Gumbel(hash(tiempo de pulsación ⊕ jitter)), corre en ONNX Runtime'], ['Parámetros', '6 (seis). Todos valen 1/6. Ajustados a mano, mucho esfuerzo.'], ['Datos de entrenamiento', '1 dado de parchís, 3 cafés, 1 discusión de sobremesa.'], ['Benchmark', '16,7 % ± suerte en DadoBench‑6. SOTA.'], ['Alucinaciones', '0. Nunca saldrá un 7.'], ['Limitaciones', 'No usar para hacer trampa en el parchís.']],
	noWebgl: 'WebGL no disponible, el dado solo rueda en tu imaginación.', badges: ['benchmark: 16,7 % de precisión (SOTA)', '6 parámetros', '0 alucinaciones', '100 % local'],
	weightsPlain: 'b = [1/6 × 6] · fp32 · todos iguales (a propósito)',
	quips: ['Muestreando ruido de Gumbel…', 'Seis caras, un destino.', 'Calentando la softmax…'],
	lines: ['{face}. Encontrado con 6 parámetros mientras la competencia sigue contando tokens.', '{face}. Seguro al {conf}; las otras cinco caras protestaron, pero no votan.', '{face}. A {tps} tokens/s, de tirada artesanal.', '{face}. Mantuviste {ms} ms y el modelo decidió en consecuencia.', '{face}. No es una alucinación, es probabilidad.'],
	lowLines: ['{face}. Pequeño pero matón. Como mi número de parámetros.', '{face}. Tirada baja, confianza alta: {conf}.'],
	highLines: ['{face}. ¡Tirada alta! Se lo venderemos a los inversores como AGI.', '{face}. Casi superinteligencia, en una escala del 1 al 6.'],
	rareLines: ['El dado se ha quedado sobre una esquina. El modelo no puede responder esto; la física sí.'],
	rareLabel: '¡Esquina!', legendary: 'LEGENDARIO', legendarySub: '¡El dado se quedó sobre una esquina!', output: (f, c) => `✓ Salida: ${f} (${c} seguro)`, holdLog: (ms) => `pulsación: ${ms} ms`
};
const fr: DiceDict = { ...en,
	title: 'DiceRoll‑6P · le dé IA à 6 paramètres', desc: 'Un dé 3D animé par un vrai modèle ONNX à 6 paramètres dans votre navigateur. Posez une question (« Combien d’heures dois‑je dormir ? »), maintenez, le modèle choisit de 1 à 6.',
	pitch: '6 paramètres · 16,7 % de précision (SOTA) · réponses de 1 à 6', placeholder: 'Combien d’heures dois‑je dormir ?', ask: 'Maintenir pour interroger le dé 🎲', roll: 'Maintenir & relâcher 🎲',
	loadingBtn: 'Chargement…', busyBtn: 'Ça roule…', charging: 'Chargement', overcharge: 'Surcharge ! Le dé tremble, la table décline toute responsabilité.',
	thinking: 'Réflexion', inferring: 'Calcul du softmax', confidence: 'Confiance', stats: ['Tokens/s', 'Latence', 'Lancers', 'Top‑p'],
	loading: 'Chargement des poids du modèle', loadSub: (n) => `${n * 6}/24 octets · temps restant : presque rien`, hint: 'Maintenir, puis relâcher',
	copy: 'Copier le résultat', copied: 'Copié ✓', copyFail: 'Échec de la copie',
	cardTitle: 'Fiche du modèle', card: [['Architecture', 'softmax((g + b) · 1,0) ; g = Gumbel(hash(durée d’appui ⊕ jitter)), tourne sur ONNX Runtime'], ['Paramètres', '6 (six). Tous à 1/6. Réglés à la main, gros travail.'], ['Données d’entraînement', '1 dé de jeu de l’oie, 3 cafés, 1 dispute de fin de repas.'], ['Benchmark', '16,7 % ± chance sur DéBench‑6. SOTA.'], ['Hallucinations', '0. Jamais de 7.'], ['Limites', 'Ne pas utiliser pour tricher aux jeux de société.']],
	noWebgl: 'WebGL indisponible, le dé ne roule que dans votre imagination.', badges: ['benchmark : 16,7 % de précision (SOTA)', '6 paramètres', '0 hallucination', '100 % local'],
	weightsPlain: 'b = [1/6 × 6] · fp32 · tous identiques (exprès)',
	quips: ['Échantillonnage du bruit de Gumbel…', 'Six faces, un destin.', 'Le softmax s’échauffe…'],
	lines: ['{face}. Trouvé avec 6 paramètres pendant que la concurrence compte encore ses tokens.', '{face}. Sûr à {conf} ; les cinq autres faces ont protesté, mais elles ne votent pas.', '{face}. À {tps} tokens/s, lancé artisanalement.', '{face}. Vous avez maintenu {ms} ms, le modèle a décidé en conséquence.', '{face}. Pas une hallucination, juste une probabilité.'],
	lowLines: ['{face}. Petit mais costaud. Comme mon nombre de paramètres.', '{face}. Lancer faible, confiance élevée : {conf}.'],
	highLines: ['{face}. Gros lancer ! On vend ça aux investisseurs comme une AGI.', '{face}. Quasi superintelligence, sur une échelle de 1 à 6.'],
	rareLines: ['Le dé tient en équilibre sur un coin. Le modèle ne peut pas répondre ; la physique, si.'],
	rareLabel: 'Coin !', legendary: 'LÉGENDAIRE', legendarySub: 'Le dé est resté sur un coin !', output: (f, c) => `✓ Sortie : ${f} (${c} sûr)`, holdLog: (ms) => `appui : ${ms} ms`
};
export const DICE: Record<Lang, DiceDict> = { tr, en, de, es, fr };
