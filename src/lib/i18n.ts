export type Lang = 'tr' | 'en' | 'de' | 'es' | 'fr';
export const LANGS: { code: Lang; name: string }[] = [
	{ code: 'en', name: 'English' }, { code: 'tr', name: 'Türkçe' }, { code: 'de', name: 'Deutsch' },
	{ code: 'es', name: 'Español' }, { code: 'fr', name: 'Français' }
];
export function detectLang(): Lang {
	const saved = localStorage.getItem('lang');
	if (saved && LANGS.some((l) => l.code === saved)) return saved as Lang;
	for (const l of navigator.languages ?? [navigator.language]) {
		const c = l.slice(0, 2).toLowerCase();
		if (LANGS.some((x) => x.code === c)) return c as Lang;
	}
	return 'en';
}
type Dict = {
	heads: string; tails: string; yes: string; no: string; coinLegend: string;
	badges: [string, string, string, string]; loading: string; loadSub: (n: number) => string;
	weights: string; thinking: string; inferring: string; confidence: string;
	stats: [string, string, string, string]; pitch: string; placeholder: string; ask: string; flip: string;
	loadingBtn: string; busyBtn: string; cardTitle: string; card: [string, string][]; noWebgl: string;
	quips: string[]; yesLines: string[]; noLines: string[]; output: (s: string, c: string) => string; langLabel: string;
	title: string; desc: string;
	edge: string; maybe: string; maybeLines: string[]; legendary: string; legendarySub: string;
	edgeLegend: string; tally: string; weightsPlain: string; reveal: string; hint: string; charging: string; overcharge: string; holdLog: (ms: string) => string;
};
const tr: Dict = {
	hint: 'Basılı tut, bırak', charging: 'Güç toplanıyor…', overcharge: 'Aşırı güç! Para titriyor, kâhine söz geçmiyor.', holdLog: (ms) => `basılı tutma: ${ms} ms`,
	weightsPlain: 'fp32 · SHA-256 doğrulandı (sayılır)', reveal: 'Sır açığa çıktı: w aslında üçlü {-1, 0, +1} · 1,58 bit · BitNet b1.58 uyumlu!',
	edge: 'Dik', maybe: 'Belki', maybeLines: ['Para dik durdu. Evren “tanımsız” dedi.', 'Trit = 0. Model cevap vermeyi reddediyor; NaN gibi düşünün.', 'Model bu soruyu cevaplamayı etik bulmadı. Ya da sadece dik durdu.'],
	legendary: 'EFSANEVİ', legendarySub: 'Para dik geldi! (~1/6000 olasılık)', edgeLegend: '• CoinFlip‑1P • %100 YEREL • 0 HALÜSİNASYON ', tally: 'Yazı / Tura / Dik',
	heads: 'Yazı', tails: 'Tura', yes: 'Evet', no: 'Hayır', coinLegend: '• 1 PARAMETRE • 0 HALÜSİNASYON • %100 YAPAY ZEKÂ ',
	badges: ['benchmark: %50,0 doğruluk (SOTA)', '1 parametre', '0 halüsinasyon', '%100 yerel'],
	loading: 'Model ağırlıkları yükleniyor', loadSub: (n) => `${n}/4 bayt · tahmini süre: evrenin yaşı × 0`,
	weights: 'üçlü {-1, 0, +1} · 1,58 bit · BitNet b1.58 uyumlu', thinking: 'Düşünüyor', inferring: 'Çıkarım yapılıyor', confidence: 'Güven',
	stats: ['token/sn', 'gecikme', 'Yazı / Tura', 'logit'],
	pitch: 'Tarihin en iyi tahmin modeli · %50 başarım oranı · Yazı = Evet, Tura = Hayır',
	placeholder: 'Bugün şemsiye almalı mıyım?', ask: 'Basılı tut, kâhine sor 🔮', flip: 'Basılı tut, bırak 🪙', loadingBtn: 'Yükleniyor…', busyBtn: 'Çıkarım…',
	cardTitle: 'Model kartı', card: [['Mimari', 'σ(w · z), z ~ 𝒩(0,1) (crypto.getRandomValues)'], ['Parametre', '1 (bir). 1,8 trilyondan quantize edildi, kalanlar emekli oldu.'], ['Eğitim verisi', '3 adet bozuk para, 1 çay bardağı.'], ['Benchmark', "YazıTura‑Bench'te %50 ± şans. SOTA."], ['Halüsinasyon', '0. Hayal gücü yok ki.'], ['Kısıtlar', 'Hayati kararlar için kullanmayın. Ya da kullanın, bize ne.']],
	noWebgl: 'WebGL yok — model yine de çalışıyor, sadece hayal etmeniz gerekiyor.',
	quips: ['Gradyanlar hesaplanıyor (1 tane)…', 'Attention head sayısı: 0 (gerek yok)…', 'GPU kümesi ısınıyor (çaydanlık)…', 'Bağlam penceresi: 1 bit…', 'RLHF: 3 kişiye soruldu…'],
	yesLines: ['Kozmik tek parametrem kesin konuştu: evet.', 'Ağırlığım titredi ve “evet” dedi. Tartışmaya kapalıdır.', 'Evet. Bunu 1,8 trilyon parametre de söylerdi, ama daha pahalıya.'],
	noLines: ['Tek nöronum itiraz ediyor: hayır.', 'Hayır. Modelim bunu %50 kesinlikle biliyor.', 'Hayır. Ama yarın tekrar sorun, fikrim (z) değişebilir.'],
	output: (s, c) => `✓ Çıktı: ${s} (${c} emin)`, langLabel: 'Dil',
	title: 'CoinFlip‑1P · 1 parametreli yapay zekâ', desc: '1 parametreye quantize edilmiş, tarayıcıda çalışan yazı-tura modeli.'
};
const en: Dict = {
	hint: 'Press & hold, release', charging: 'Charging…', overcharge: 'Overcharged! The coin is trembling, the oracle disclaims all liability.', holdLog: (ms) => `hold: ${ms} ms`,
	weightsPlain: 'fp32 · SHA-256 verified (ish)', reveal: 'Secret revealed: w was ternary all along {-1, 0, +1} · 1.58 bits · BitNet b1.58 compatible!',
	edge: 'Edge', maybe: 'Maybe', maybeLines: ['The coin stood on its edge. The universe returned “undefined”.', 'Trit = 0. The model refuses to answer; think NaN.', 'The model declined to answer on ethical grounds. Or it just stood up.'],
	legendary: 'LEGENDARY', legendarySub: 'Landed on its edge! (~1/6000)', edgeLegend: '• CoinFlip‑1P • 100% LOCAL • 0 HALLUCINATIONS ', tally: 'Heads / Tails / Edge',
	heads: 'Heads', tails: 'Tails', yes: 'Yes', no: 'No', coinLegend: '• 1 PARAMETER • 0 HALLUCINATIONS • 100% AI ',
	badges: ['benchmark: 50.0% accuracy (SOTA)', '1 parameter', '0 hallucinations', '100% local'],
	loading: 'Loading model weights', loadSub: (n) => `${n}/4 bytes · ETA: age of the universe × 0`,
	weights: 'ternary {-1, 0, +1} · 1.58 bits · BitNet b1.58 compatible', thinking: 'Thinking', inferring: 'Running inference', confidence: 'Confidence',
	stats: ['tokens/s', 'latency', 'Heads / Tails', 'logit'],
	pitch: 'The best prediction model in history · 50% success rate · Heads = Yes, Tails = No',
	placeholder: 'Should I take an umbrella today?', ask: 'Hold to ask the Oracle 🔮', flip: 'Hold & release to flip 🪙', loadingBtn: 'Loading…', busyBtn: 'Inferring…',
	cardTitle: 'Model card', card: [['Architecture', 'σ(w · z), z ~ 𝒩(0,1) (crypto.getRandomValues)'], ['Parameters', '1 (one). Quantized from 1.8 trillion; the rest retired.'], ['Training data', '3 coins, 1 cup of tea.'], ['Benchmark', '50% ± luck on HeadsTails‑Bench. SOTA.'], ['Hallucinations', '0. No imagination whatsoever.'], ['Limitations', 'Do not use for life decisions. Or do, we are not your mom.']],
	noWebgl: 'No WebGL — the model still runs, you just have to imagine the coin.',
	quips: ['Computing gradients (one)…', 'Attention heads: 0 (not needed)…', 'Warming up GPU cluster (a kettle)…', 'Context window: 1 bit…', 'RLHF: asked 3 people…'],
	yesLines: ['My single cosmic parameter has spoken: yes.', 'My weight trembled and said “yes”. Not up for debate.', 'Yes. 1.8 trillion parameters would agree, just pricier.'],
	noLines: ['My lone neuron objects: no.', 'No. My model is 50% certain of this.', 'No. Ask again tomorrow, my z may change.'],
	output: (s, c) => `✓ Output: ${s} (${c} sure)`, langLabel: 'Language',
	title: 'CoinFlip‑1P · the 1‑parameter AI', desc: 'A state-of-the-art AI quantized to one parameter. It flips coins.'
};
const de: Dict = { ...en,
	hint: 'Gedrückt halten, loslassen', charging: 'Lädt auf…', overcharge: 'Überladen! Die Münze zittert, das Orakel übernimmt keine Haftung.', holdLog: (ms) => `gehalten: ${ms} ms`,
	weightsPlain: 'fp32 · SHA-256 geprüft (so halb)', reveal: 'Geheimnis gelüftet: w war ternär {-1, 0, +1} · 1,58 Bit · BitNet-b1.58-kompatibel!',
	edge: 'Kante', maybe: 'Vielleicht', maybeLines: ['Die Münze blieb auf der Kante stehen. Das Universum sagt „undefined“.', 'Trit = 0. Weder ja noch nein.'],
	legendary: 'LEGENDÄR', legendarySub: 'Auf der Kante gelandet! (~1/6000)', edgeLegend: '• CoinFlip‑1P • 100% LOKAL • 0 HALLUZINATIONEN ', tally: 'Kopf / Zahl / Kante',
	heads: 'Kopf', tails: 'Zahl', yes: 'Ja', no: 'Nein', coinLegend: '• 1 PARAMETER • 0 HALLUZINATIONEN • 100% KI ',
	badges: ['Benchmark: 50,0% Genauigkeit (SOTA)', '1 Parameter', '0 Halluzinationen', '100% lokal'],
	loading: 'Modellgewichte werden geladen', loadSub: (n) => `${n}/4 Bytes · Restzeit: Alter des Universums × 0`,
	weights: 'ternär {-1, 0, +1} · 1,58 Bit · BitNet-b1.58-kompatibel', thinking: 'Denkt nach', inferring: 'Inferenz läuft', confidence: 'Konfidenz',
	stats: ['Token/s', 'Latenz', 'Kopf / Zahl', 'Logit'],
	pitch: 'Das beste Vorhersagemodell der Geschichte · 50% Trefferquote · Kopf = Ja, Zahl = Nein',
	placeholder: 'Soll ich heute einen Regenschirm mitnehmen?', ask: 'Halten, Orakel fragen 🔮', flip: 'Halten & loslassen 🪙', loadingBtn: 'Lädt…', busyBtn: 'Inferenz…',
	cardTitle: 'Modellkarte', card: [['Architektur', 'σ(w · z), z ~ 𝒩(0,1) (crypto.getRandomValues)'], ['Parameter', '1 (einer). Von 1,8 Billionen quantisiert.'], ['Trainingsdaten', '3 Münzen, 1 Tasse Tee.'], ['Benchmark', '50% ± Glück. SOTA.'], ['Halluzinationen', '0. Keinerlei Fantasie.'], ['Einschränkungen', 'Nicht für Lebensentscheidungen nutzen.']],
	noWebgl: 'Kein WebGL — das Modell läuft trotzdem.',
	quips: ['Berechne Gradienten (einen)…', 'Attention-Heads: 0…', 'GPU-Cluster heizt vor (Wasserkocher)…'],
	yesLines: ['Mein einziger kosmischer Parameter sagt: ja.', 'Ja. Keine Diskussion.'], noLines: ['Mein einsames Neuron widerspricht: nein.', 'Nein. Zu 50% sicher.'],
	output: (s, c) => `✓ Ausgabe: ${s} (${c} sicher)`, langLabel: 'Sprache', title: 'CoinFlip‑1P · die 1‑Parameter‑KI' };
const es: Dict = { ...en,
	hint: 'Mantén pulsado y suelta', charging: 'Cargando…', overcharge: '¡Sobrecarga! La moneda tiembla, el oráculo no se responsabiliza.', holdLog: (ms) => `pulsación: ${ms} ms`,
	weightsPlain: 'fp32 · SHA-256 verificado (más o menos)', reveal: 'Secreto revelado: w era ternario {-1, 0, +1} · 1,58 bits · compatible BitNet b1.58!',
	edge: 'Canto', maybe: 'Quizás', maybeLines: ['La moneda quedó de canto. El universo devolvió “undefined”.', 'Trit = 0. Ni sí ni no.'],
	legendary: 'LEGENDARIO', legendarySub: '¡Cayó de canto! (~1/6000)', edgeLegend: '• CoinFlip‑1P • 100% LOCAL • 0 ALUCINACIONES ', tally: 'Cara / Cruz / Canto',
	heads: 'Cara', tails: 'Cruz', yes: 'Sí', no: 'No', coinLegend: '• 1 PARÁMETRO • 0 ALUCINACIONES • 100% IA ',
	badges: ['benchmark: 50,0% precisión (SOTA)', '1 parámetro', '0 alucinaciones', '100% local'],
	loading: 'Cargando pesos del modelo', loadSub: (n) => `${n}/4 bytes · ETA: edad del universo × 0`,
	weights: 'ternario {-1, 0, +1} · 1,58 bits · compatible BitNet b1.58', thinking: 'Pensando', inferring: 'Ejecutando inferencia', confidence: 'Confianza',
	stats: ['tokens/s', 'latencia', 'Cara / Cruz', 'logit'],
	pitch: 'El mejor modelo predictivo de la historia · 50% de acierto · Cara = Sí, Cruz = No',
	placeholder: '¿Debo llevar paraguas hoy?', ask: 'Mantén para preguntar 🔮', flip: 'Mantén y suelta 🪙', loadingBtn: 'Cargando…', busyBtn: 'Infiriendo…',
	cardTitle: 'Ficha del modelo', card: [['Arquitectura', 'σ(w · z), z ~ 𝒩(0,1) (crypto.getRandomValues)'], ['Parámetros', '1 (uno). Cuantizado desde 1,8 billones.'], ['Datos', '3 monedas, 1 taza de té.'], ['Alucinaciones', '0. Cero imaginación.'], ['Límites', 'No usar para decisiones vitales.']],
	quips: ['Calculando gradientes (uno)…', 'Cabezas de atención: 0…', 'Calentando el clúster GPU (una tetera)…'], noWebgl: 'Sin WebGL — el modelo funciona igual.',
	yesLines: ['Mi único parámetro cósmico ha hablado: sí.', 'Sí. No se discute.'], noLines: ['Mi neurona solitaria objeta: no.', 'No. Seguro al 50%.'],
	output: (s, c) => `✓ Salida: ${s} (${c} seguro)`, langLabel: 'Idioma', title: 'CoinFlip‑1P · la IA de 1 parámetro' };
const fr: Dict = { ...en,
	hint: 'Maintenez, puis relâchez', charging: 'Chargement de la puissance…', overcharge: 'Surcharge ! La pièce tremble, l’oracle décline toute responsabilité.', holdLog: (ms) => `appui: ${ms} ms`,
	weightsPlain: 'fp32 · SHA-256 vérifié (à peu près)', reveal: 'Secret révélé : w était ternaire {-1, 0, +1} · 1,58 bit · compatible BitNet b1.58 !',
	edge: 'Tranche', maybe: 'Peut-être', maybeLines: ['La pièce est restée sur la tranche. L’univers renvoie « undefined ».', 'Trit = 0. Ni oui ni non.'],
	legendary: 'LÉGENDAIRE', legendarySub: 'Tombée sur la tranche ! (~1/6000)', edgeLegend: '• CoinFlip‑1P • 100 % LOCAL • 0 HALLUCINATION ', tally: 'Face / Pile / Tranche',
	heads: 'Face', tails: 'Pile', yes: 'Oui', no: 'Non', coinLegend: '• 1 PARAMÈTRE • 0 HALLUCINATION • 100% IA ',
	badges: ['benchmark : 50,0 % de précision (SOTA)', '1 paramètre', '0 hallucination', '100 % local'],
	loading: 'Chargement des poids du modèle', loadSub: (n) => `${n}/4 octets · ETA : âge de l’univers × 0`,
	weights: 'ternaire {-1, 0, +1} · 1,58 bit · compatible BitNet b1.58', thinking: 'Réflexion', inferring: 'Inférence en cours', confidence: 'Confiance',
	stats: ['tokens/s', 'latence', 'Face / Pile', 'logit'],
	pitch: 'Le meilleur modèle prédictif de l’histoire · 50 % de réussite · Face = Oui, Pile = Non',
	placeholder: 'Dois-je prendre un parapluie aujourd’hui ?', ask: 'Maintenez pour l’Oracle 🔮', flip: 'Maintenez, relâchez 🪙', loadingBtn: 'Chargement…', busyBtn: 'Inférence…',
	cardTitle: 'Fiche du modèle', card: [['Architecture', 'σ(w · z), z ~ 𝒩(0,1) (crypto.getRandomValues)'], ['Paramètres', '1 (un seul). Quantifié depuis 1 800 milliards.'], ['Données', '3 pièces, 1 tasse de thé.'], ['Hallucinations', '0. Aucune imagination.'], ['Limites', 'Ne pas utiliser pour des décisions vitales.']],
	quips: ['Calcul des gradients (un seul)…', 'Têtes d’attention : 0…', 'Préchauffage du cluster GPU (une bouilloire)…'], noWebgl: 'Pas de WebGL — le modèle tourne quand même.',
	yesLines: ['Mon unique paramètre cosmique a parlé : oui.', 'Oui. Sans discussion.'], noLines: ['Mon neurone solitaire objecte : non.', 'Non. Sûr à 50 %.'],
	output: (s, c) => `✓ Sortie : ${s} (${c} sûr)`, langLabel: 'Langue', title: 'CoinFlip‑1P · l’IA à 1 paramètre' };
export const DICTS: Record<Lang, Dict> = { tr, en, de, es, fr };
