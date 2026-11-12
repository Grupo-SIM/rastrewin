import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { pageConfig } from "@/config/page-config";
import { TRACK_URL, TRCK_STUB } from "@/config/track";
import "./globals.css";

// Fontes servidas pelo próprio domínio (subconjunto latin do Google Fonts, licença OFL em ./fonts).
// Ficam no repositório para o build não depender do Google Fonts, que às vezes falha.
const jakarta = localFont({
	display: "swap",
	src: [{ path: "./fonts/plus-jakarta-sans-latin.woff2", style: "normal", weight: "700 800" }],
	variable: "--font-jakarta",
});

const manrope = localFont({
	display: "swap",
	src: [{ path: "./fonts/manrope-latin.woff2", style: "normal", weight: "400 600" }],
	variable: "--font-manrope",
});

// Base dos links absolutos (prévia ao compartilhar) em todas as páginas, inclusive a 404.
export const metadata: Metadata = {
	metadataBase: new URL(pageConfig.siteUrl),
};

export const viewport: Viewport = {
	initialScale: 1,
	themeColor: "#ffffff",
	width: "device-width",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="pt-BR" className={`${jakarta.variable} ${manrope.variable}`}>
			{/* Rastreamento (track.rastrewin.com): visitante, origem do anúncio e PageView.
			    Direto no <head>, igual ao snippet do painel, para o t.js baixar junto com a página. */}
			{TRACK_URL && (
				<head>
					<script id="trck-stub">{TRCK_STUB}</script>
					<script async src={`${TRACK_URL}/t.js`} />
				</head>
			)}
			<body>{children}</body>
		</html>
	);
}
