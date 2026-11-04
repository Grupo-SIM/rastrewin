"use client";
import { useEffect, useRef, useState } from "react";
import { SiteIcon } from "@/components/SiteIcon";

export interface ToastData {
	id: string;
	me: boolean;
	winner: string;
	prize: string;
	site: string;
	color: string;
}

const LIFETIME_MS = 5000;
const FADE_MS = 400;

export function Toast({ t, onClose }: { t: ToastData; onClose: () => void }) {
	const [leaving, setLeaving] = useState(false);
	const close = useRef(onClose);
	close.current = onClose;

	// some sozinho 5s depois de aparecer (com fade nos últimos 400ms)
	useEffect(() => {
		const a = setTimeout(() => setLeaving(true), LIFETIME_MS - FADE_MS);
		const b = setTimeout(() => close.current(), LIFETIME_MS);
		return () => {
			clearTimeout(a);
			clearTimeout(b);
		};
	}, []);

	return (
		<div
			className={`toast ${t.me ? "me" : ""} ${leaving ? "leaving" : ""}`}
			onClick={onClose}
			role="status"
		>
			<div className="toast-in">
				<div className="toast-ico">
					<SiteIcon name={t.site} color={t.color} size={42} />
					<span className="toast-badge">{t.me ? "✓" : "★"}</span>
				</div>
				<div className="toast-body">
					<div className="toast-top">
						<span className="toast-chip">{t.me ? "PRÊMIO" : "RESULTADO"}</span>
						<span className="toast-site">{t.site} · agora</span>
					</div>
					{t.me ? (
						<>
							<span className="toast-big">Você ganhou!</span>
							<span className="toast-txt">{t.prize}</span>
						</>
					) : (
						<>
							<span className="toast-name">{t.winner}</span>
							<span className="toast-txt">
								ganhou <b>{t.prize}</b>
							</span>
						</>
					)}
				</div>
				<span className="toast-x" aria-label="Fechar">
					×
				</span>
			</div>
		</div>
	);
}
