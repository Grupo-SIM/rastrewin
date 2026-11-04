import type { Metadata } from "next";
import Image from "next/image";
import { VslSection } from "@/components/vsl/vsl-section";
import { pageConfig } from "@/config/page-config";

const { copy, siteUrl } = pageConfig;

export const metadata: Metadata = {
	description: copy.subtitle,
	metadataBase: new URL(siteUrl),
	openGraph: {
		description: copy.subtitle,
		locale: "pt_BR",
		siteName: "Rastrewin",
		title: copy.title,
		type: "website",
		url: "/",
	},
	// Página de tráfego pago: fora dos buscadores (o Caddy também envia X-Robots-Tag).
	robots: { follow: false, googleBot: { follow: false, index: false }, index: false },
	title: "Rastrewin",
};

export default function Home() {
	return (
		<div className="flex min-h-svh flex-col">
			<div aria-hidden="true" className="h-1 w-full [background:var(--rainbow)]" />

			<main className="landscape-short:grid landscape-short:max-w-4xl landscape-short:grid-cols-[minmax(0,1fr)_auto] landscape-short:grid-rows-[auto_auto_auto_1fr] landscape-short:items-start landscape-short:gap-x-8 landscape-short:pt-4 landscape-short:text-left mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 pt-6 pb-10 text-center max-[359px]:pt-5 sm:pt-10">
				<Image
					src="/logo-rastrewin.svg"
					alt="Rastrewin"
					width={2078}
					height={564}
					loading="eager"
					className="landscape-short:justify-self-start h-8 w-auto sm:h-9"
				/>

				<h1 className="font-display landscape-short:mt-5 mt-6 text-[1.75rem] leading-[1.15] font-extrabold tracking-tight text-balance max-[359px]:mt-4 max-[359px]:text-2xl sm:mt-8 sm:text-4xl">
					{copy.title}
				</h1>
				<p className="text-ink-soft mt-3 text-base text-pretty max-[359px]:text-[0.9375rem] sm:text-lg">
					{copy.subtitle}
				</p>

				<VslSection
					videoId={pageConfig.vimeoId}
					unlockAtSeconds={pageConfig.unlockAtSeconds}
					posterSrc={pageConfig.posterSrc}
					title={copy.title}
					ctaLabel={copy.cta}
					destinationUrl={pageConfig.destinationUrl}
				/>
			</main>

			<footer className="border-line bg-paper-2 border-t">
				<p className="text-mut mx-auto max-w-xl px-4 py-6 text-center text-xs leading-relaxed text-pretty">
					{copy.metaDisclaimer}
				</p>
			</footer>
		</div>
	);
}
