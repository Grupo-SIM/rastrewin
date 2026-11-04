"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface OtpResponse {
	phoneVerified: boolean;
	code: string | null;
	whatsappNumber?: string;
}

/** Pede ao usuário que prove que o telefone é dele: manda o código
 * gerado para o WhatsApp do rastrewin, nosso webhook confere remetente + código. */
export function PhoneVerifyModal({
	userId,
	open,
	onClose,
	onVerified,
}: {
	userId: string;
	open: boolean;
	onClose: () => void;
	onVerified: () => void;
}) {
	const [data, setData] = useState<OtpResponse | null>(null);
	const [err, setErr] = useState("");

	useEffect(() => {
		api<OtpResponse>(`/users/${userId}/otp`, { method: "POST" })
			.then(setData)
			.catch(() => setErr("Não foi possível gerar o código. Recarregue a página."));
	}, [userId]);

	useEffect(() => {
		const poll = setInterval(async () => {
			try {
				const r = await api<OtpResponse>(`/users/${userId}/otp`, { method: "POST" });
				setData(r);
				if (r.phoneVerified) onVerified();
			} catch {}
		}, 4000);
		return () => clearInterval(poll);
	}, [userId, onVerified]);

	const waLink =
		data?.whatsappNumber && data.code
			? `https://wa.me/${data.whatsappNumber.replace(/\D/g, "")}?text=${data.code}`
			: null;

	return (
		<div
			style={{
				background: "rgba(10,12,20,.72)",
				display: open ? "grid" : "none",
				inset: 0,
				padding: 20,
				placeItems: "center",
				position: "fixed",
				zIndex: 1000,
			}}
		>
			<div
				style={{
					background: "#fff",
					borderRadius: 20,
					display: "grid",
					gap: 16,
					maxWidth: 420,
					padding: 32,
					position: "relative",
					textAlign: "center",
					width: "100%",
				}}
			>
				<button
					type="button"
					onClick={onClose}
					aria-label="Fechar"
					style={{
						background: "transparent",
						border: 0,
						borderRadius: 999,
						color: "var(--mut)",
						cursor: "pointer",
						fontSize: 24,
						height: 32,
						lineHeight: 1,
						position: "absolute",
						right: 14,
						top: 12,
						width: 32,
					}}
				>
					×
				</button>
				<h2 className="display" style={{ fontSize: 24 }}>
					Confirme seu WhatsApp
				</h2>
				<p style={{ color: "var(--mut)", fontSize: 15 }}>Receba avisos de vitória pelo WhatsApp</p>
				{err && <div className="err">{err}</div>}
				{data && (
					<>
						<div
							style={{
								background: "var(--blue-bg)",
								borderRadius: 12,
								font: "700 32px/1 var(--f-display)",
								letterSpacing: ".1em",
								padding: "16px 0",
							}}
						>
							{data.code}
						</div>
						{waLink && (
							<a
								href={waLink}
								target="_blank"
								rel="noopener noreferrer"
								className="btn-rainbow"
								style={{ textDecoration: "none" }}
							>
								Abrir WhatsApp e enviar código
							</a>
						)}
						<span style={{ color: "var(--mut)", fontSize: 13 }}>
							Envie o código abaixo para receber notificações diretamente no seu celular sempre
							que ganhar um sorteio.
						</span>
					</>
				)}
			</div>
		</div>
	);
}
