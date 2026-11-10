"use client";

/**
 * Reabre as preferências de cookies do banner de consentimento (LGPD), que é do t.js do track.
 * Sem o t.js (dev sem NEXT_PUBLIC_TRACK_URL), o clique não faz nada.
 */
export function CookiePreferencesButton({ className }: { className?: string }) {
	return (
		<button
			type="button"
			className={className}
			onClick={() => {
				const trck = (window as Window & { trck?: (...args: unknown[]) => void }).trck;
				trck?.("consent", "open");
			}}
		>
			Preferências de cookies
		</button>
	);
}
