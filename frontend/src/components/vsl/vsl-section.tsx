"use client";

import { useEffect, useState } from "react";
import { readUnlocked, saveUnlocked } from "@/lib/unlock-storage";
import { UnlockCta } from "./unlock-cta";
import { type UnlockReason, VslPlayer } from "./vsl-player";

type VslSectionProps = {
  youtubeId: string;
  unlockAtSeconds: number;
  posterSrc: string;
  title: string;
  ctaLabel: string;
  destinationUrl: string;
};

export function VslSection({
  youtubeId,
  unlockAtSeconds,
  posterSrc,
  title,
  ctaLabel,
  destinationUrl,
}: VslSectionProps) {
  const [unlocked, setUnlocked] = useState(false);

  // Lido depois da hidratação: o HTML estático sai sempre sem o botão.
  useEffect(() => {
    if (readUnlocked(youtubeId)) setUnlocked(true);
  }, [youtubeId]);

  const handleUnlock = (reason: UnlockReason) => {
    setUnlocked(true);
    // Falha do vídeo libera só nesta visita; quem assistiu fica lembrado.
    if (reason === "watched") saveUnlocked(youtubeId);
  };

  return (
    // Vídeo e botão dividem a mesma coluna: o botão nunca fica mais largo que o vídeo.
    <section
      aria-label="Vídeo"
      className="@container mt-6 flex w-full max-w-[22.5rem] flex-col max-[359px]:mt-5 sm:mt-8 sm:max-w-[min(25rem,calc((100svh-15rem)*0.5625))] sm:min-w-[18rem]"
    >
      <VslPlayer
        youtubeId={youtubeId}
        unlockAtSeconds={unlockAtSeconds}
        posterSrc={posterSrc}
        title={title}
        unlocked={unlocked}
        onUnlock={handleUnlock}
      />

      <p role="status" className="sr-only">
        {unlocked ? "Acesso liberado. O botão para continuar está abaixo do vídeo." : ""}
      </p>

      {unlocked ? <UnlockCta href={destinationUrl} label={ctaLabel} /> : null}
    </section>
  );
}
