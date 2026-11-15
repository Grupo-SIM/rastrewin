"use client";

import { useEffect, useState } from "react";
import { ctaHref } from "@/lib/forward-origin";
import { vslEvent } from "@/lib/meta-events";
import { readUnlocked, saveUnlocked } from "@/lib/unlock-storage";
import { UnlockCta } from "./unlock-cta";
import { type UnlockReason, VslPlayer } from "./vsl-player";

interface VslSectionProps {
	videoId: string;
	unlockAtSeconds: number;
	posterSrc: string;
	title: string;
	ctaLabel: string;
	destinationUrl: string;
}

export function VslSection({
	videoId,
	unlockAtSeconds,
	posterSrc,
	title,
	ctaLabel,
	destinationUrl,
}: VslSectionProps) {
	const [unlocked, setUnlocked] = useState(false);

	// Lido depois da hidratação: o HTML estático sai sempre sem o botão.
	// Botão lembrado de uma visita anterior não é uma nova liberação (sem VSLCTAUnlock).
	useEffect(() => {
		if (readUnlocked(videoId)) setUnlocked(true);
	}, [videoId]);

	// Botão: na interação, o link ganha a origem do anúncio (UTMs e fbclid, nunca com recusa no banner)
	// e o clique vira CTAClick para a Meta. Ouvinte delegado: o link continua um <a> comum.
	useEffect(() => {
		let lastClickAt = 0;
		const onInteraction = (event: Event) => {
			try {
				const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>(
					"a[data-vsl-cta]",
				);
				if (!link) return;
				link.href = ctaHref(destinationUrl, window.location.search, document.cookie);
				const opens =
					event.type === "click" ||
					(event.type === "auxclick" && (event as MouseEvent).button === 1);
				if (!opens || Date.now() - lastClickAt < 2000) return;
				lastClickAt = Date.now();
				vslEvent("CTAClick", { button: "quero_conhecer", section: "vsl" });
			} catch {
				// o botão sempre funciona, mesmo se a medição falhar
			}
		};
		const types = ["click", "auxclick", "contextmenu", "touchstart"];
		for (const type of types)
			document.addEventListener(type, onInteraction, { capture: true, passive: true });
		return () => {
			for (const type of types) document.removeEventListener(type, onInteraction, { capture: true });
		};
	}, [destinationUrl]);

	const handleUnlock = (reason: UnlockReason) => {
		setUnlocked(true);
		vslEvent("VSLCTAUnlock", { reason, video_id: `vimeo:${videoId}` });
		// Falha do vídeo libera só nesta visita; quem assistiu (o tempo ou até o fim) fica lembrado.
		if (reason !== "error") saveUnlocked(videoId);
	};

	return (
		// Vídeo e botão dividem a mesma coluna: o botão nunca fica mais largo que o vídeo.
		// Celular deitado: a seção some da grade (contents); o vídeo vai para a coluna da direita,
		// na altura da tela, e o botão fica à esquerda, abaixo do texto.
		<section
			aria-label="Vídeo"
			className="landscape-short:contents @container mt-6 flex w-full max-w-[22.5rem] flex-col max-[359px]:mt-5 sm:mt-8 sm:max-w-[min(25rem,calc((100svh-15rem)*0.5625))] sm:min-w-[18rem]"
		>
			<div className="landscape-short:col-start-2 landscape-short:row-span-4 landscape-short:row-start-1 landscape-short:w-[calc((100svh-2rem)*0.5625)] w-full">
				<VslPlayer
					videoId={videoId}
					unlockAtSeconds={unlockAtSeconds}
					posterSrc={posterSrc}
					title={title}
					unlocked={unlocked}
					onUnlock={handleUnlock}
				/>
			</div>

			<p role="status" className="sr-only">
				{unlocked ? "Acesso liberado. O botão para continuar já está na página." : ""}
			</p>

			{unlocked ? (
				<UnlockCta
					href={destinationUrl}
					label={ctaLabel}
					className="landscape-short:mt-6 landscape-short:justify-start"
				/>
			) : null}
		</section>
	);
}
