"use client";
import { trck } from "@/lib/track";

/** Reabre as preferências do banner de consentimento (t.js do track). Sem o t.js, não faz nada. */
export function CookiePreferencesButton({
	className,
	label = "Preferências de cookies",
}: {
	className?: string;
	label?: string;
}) {
	return (
		<button type="button" className={className} onClick={() => trck("consent", "open")}>
			{label}
		</button>
	);
}
