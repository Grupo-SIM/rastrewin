"use client";

import { useState } from "react";
import { VslPlayer } from "./vsl-player";

type VslSectionProps = {
  youtubeId: string;
  unlockAtSeconds: number;
  posterSrc: string;
  title: string;
};

export function VslSection({ youtubeId, unlockAtSeconds, posterSrc, title }: VslSectionProps) {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <section aria-label="Vídeo" className="mt-6 flex w-full flex-col items-center sm:mt-8">
      <VslPlayer
        youtubeId={youtubeId}
        unlockAtSeconds={unlockAtSeconds}
        posterSrc={posterSrc}
        title={title}
        unlocked={unlocked}
        onUnlock={() => setUnlocked(true)}
      />
    </section>
  );
}
