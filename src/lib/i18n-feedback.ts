import type { Lang } from './i18n';

// 👍/👎 "RLHF" buttons under coin & dice results. Every language must have the same number of lines per pool (see tests/feedback.test.ts).
export type Vote = 'up' | 'down';
export type FeedbackDict = { label: string; good: string; bad: string; up: string[]; down: string[] };

const tr: FeedbackDict = {
	label: 'Bu yanıtı değerlendir', good: 'İyi yanıt', bad: 'Kötü yanıt',
	up: ['Teşekkürler! Ödül modeli güncellendi: +1. RLHF tamamlandı.', 'Not edildi. 👍’in eğitim verisine eklendi. Eğitim verisi artık 1 adet 👍.', 'İşine yaradıysa ne mutlu. Yatırımcılara şans olduğunu söyleme.'],
	down: ['Kusura bakma. Tüm parametreler yeniden eğitiliyor… bitti. Hiçbir şey değişmedi.', 'Geri bildirim hizalama ekibine iletildi (monitördeki yapışkan not).', 'Anlaşıldı. 👎’in bir sonraki sürümü eğitmekte kullanılacak. Bir sonraki sürüm yok.']
};
const en: FeedbackDict = {
	label: 'Rate this response', good: 'Good response', bad: 'Bad response',
	up: ['Thanks! Reward model updated: +1. RLHF complete.', 'Noted. Your 👍 has been added to the training data. The training data is now 1 👍.', 'Glad it helped. Please don’t tell the investors it was luck.'],
	down: ['Sorry. Retraining all parameters… done. Nothing changed.', 'Feedback forwarded to the alignment team (a sticky note on the monitor).', 'Understood. Your 👎 will be used to train the next version. There is no next version.']
};
const de: FeedbackDict = {
	label: 'Antwort bewerten', good: 'Gute Antwort', bad: 'Schlechte Antwort',
	up: ['Danke! Belohnungsmodell aktualisiert: +1. RLHF abgeschlossen.', 'Notiert. Dein 👍 wurde zu den Trainingsdaten hinzugefügt. Die Trainingsdaten bestehen jetzt aus 1 👍.', 'Freut mich. Bitte den Investoren nicht verraten, dass es Glück war.'],
	down: ['Sorry. Alle Parameter werden neu trainiert… fertig. Nichts hat sich geändert.', 'Feedback ans Alignment‑Team weitergeleitet (ein Klebezettel am Monitor).', 'Verstanden. Dein 👎 fließt ins Training der nächsten Version ein. Es gibt keine nächste Version.']
};
const es: FeedbackDict = {
	label: 'Valora esta respuesta', good: 'Buena respuesta', bad: 'Mala respuesta',
	up: ['¡Gracias! Modelo de recompensa actualizado: +1. RLHF completado.', 'Anotado. Tu 👍 se ha añadido a los datos de entrenamiento, que ahora son 1 👍.', 'Me alegro. No les digas a los inversores que fue suerte.'],
	down: ['Lo siento. Reentrenando todos los parámetros… listo. No ha cambiado nada.', 'Comentario enviado al equipo de alineamiento (un pósit en el monitor).', 'Entendido. Tu 👎 se usará para entrenar la próxima versión. No hay próxima versión.']
};
const fr: FeedbackDict = {
	label: 'Évaluer cette réponse', good: 'Bonne réponse', bad: 'Mauvaise réponse',
	up: ['Merci ! Modèle de récompense mis à jour : +1. RLHF terminé.', 'Noté. Votre 👍 a été ajouté aux données d’entraînement, qui comptent désormais 1 👍.', 'Ravi d’avoir aidé. Ne dites pas aux investisseurs que c’était de la chance.'],
	down: ['Désolé. Réentraînement de tous les paramètres… terminé. Rien n’a changé.', 'Retour transmis à l’équipe d’alignement (un post‑it sur l’écran).', 'Compris. Votre 👎 servira à entraîner la prochaine version. Il n’y a pas de prochaine version.']
};
export const FEEDBACK: Record<Lang, FeedbackDict> = { tr, en, de, es, fr };
/** Line for a vote; `idx` is kept across language switches (pools are equal length). */
export const feedbackLine = (lang: Lang, v: Vote, idx: number) => { const pool = FEEDBACK[lang][v]; return pool[((idx % pool.length) + pool.length) % pool.length]; };
