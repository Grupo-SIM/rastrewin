import type { Metadata } from "next";
import Image from "next/image";
import { VslSection } from "@/components/vsl/vsl-section";
import { pageConfig } from "@/config/page-config";

const { copy, siteUrl } = pageConfig;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Rastrewin",
  description: copy.subtitle,
  // Página de tráfego pago: fora dos buscadores (o Caddy também envia X-Robots-Tag).
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Rastrewin",
    url: "/",
    title: copy.title,
    description: copy.subtitle,
  },
};

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <div aria-hidden="true" className="h-1 w-full [background:var(--rainbow)]" />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 pt-6 pb-10 text-center max-[359px]:pt-5 sm:pt-10">
        <Image
          src="/logo-rastrewin.svg"
          alt="Rastrewin"
          width={2078}
          height={564}
          loading="eager"
          className="h-8 w-auto sm:h-9"
        />

        <h1 className="mt-6 font-display text-[1.75rem] leading-[1.15] font-extrabold tracking-tight text-balance max-[359px]:mt-4 max-[359px]:text-2xl sm:mt-8 sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-3 text-base text-pretty text-ink-soft max-[359px]:text-[0.9375rem] sm:text-lg">
          {copy.subtitle}
        </p>

        <VslSection
          youtubeId={pageConfig.youtubeId}
          unlockAtSeconds={pageConfig.unlockAtSeconds}
          posterSrc={pageConfig.posterSrc}
          title={copy.title}
          ctaLabel={copy.cta}
          destinationUrl={pageConfig.destinationUrl}
        />
      </main>

      <footer className="border-t border-line bg-paper-2">
        <p className="mx-auto max-w-xl px-4 py-6 text-center text-xs leading-relaxed text-pretty text-mut">
          {copy.metaDisclaimer}
        </p>
      </footer>
    </div>
  );
}
