"use client";

import { useEffect, useState } from "react";
import { ctaHref } from "@/lib/forward-origin";
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
	useEffect(() => {
		if (readUnlocked(videoId)) setUnlocked(true);
	}, [videoId]);

	// Botão: na interação, o link ganha a origem do anúncio (UTMs e fbclid, nunca com recusa no banner).
	// Ouvinte delegado: o link continua um <a> comum.
	useEffect(() => {
		const onInteraction = (event: Event) => {
			try {
				const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>(
					"a[data-vsl-cta]",
				);
				if (!link) return;
				link.href = ctaHref(destinationUrl, window.location.search, document.cookie);
			} catch {
				// o botão sempre funciona, mesmo se a montagem do link falhar
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
		// Falha do vídeo libera só nesta visita; quem assistiu fica lembrado.
		if (reason === "watched") saveUnlocked(videoId);
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
