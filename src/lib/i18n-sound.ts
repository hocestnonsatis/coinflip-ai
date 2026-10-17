import type { Lang } from './i18n';
/** labels for the 🔊/🔇 button (M toggles too) */
export const SOUND: Record<Lang, { mute: string; unmute: string }> = {
	en: { mute: 'Mute sound (M)', unmute: 'Unmute sound (M)' },
	tr: { mute: 'Sesi kapat (M)', unmute: 'Sesi aç (M)' },
	de: { mute: 'Ton aus (M)', unmute: 'Ton an (M)' },
	es: { mute: 'Silenciar sonido (M)', unmute: 'Activar sonido (M)' },
	fr: { mute: 'Couper le son (M)', unmute: 'Activer le son (M)' }
};
