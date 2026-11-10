import "./globals.css";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { TRACK_URL, TRCK_STUB } from "@/lib/track";

// Fontes servidas pelo próprio site (subconjunto latin do Google Fonts, licença OFL em ./fonts).
// Evita baixar do Google Fonts no build, que falhava às vezes e derrubava a imagem.
const jakarta = localFont({
	display: "swap",
	src: [{ path: "./fonts/plus-jakarta-sans-latin.woff2", style: "normal", weight: "500 700" }],
	variable: "--font-jakarta",
});
const manrope = localFont({
	display: "swap",
	src: [{ path: "./fonts/manrope-latin.woff2", style: "normal", weight: "400 800" }],
	variable: "--font-manrope",
});
const serif = localFont({
	display: "swap",
	src: [{ path: "./fonts/instrument-serif-italic-latin.woff2", style: "italic", weight: "400" }],
	variable: "--font-serif",
});

export const metadata: Metadata = {
	icons: { apple: "/logos/Logo%20Rastrewin%20Icon.png", icon: "/logos/Logo%20Rastrewin%20Icon.png" },
	title: "Rastrewin — entre em milhares de sorteios no automático",
};
export const viewport: Viewport = { initialScale: 1, width: "device-width" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR" className={`${jakarta.variable} ${manrope.variable} ${serif.variable}`}>
			{/* Rastreamento (track.rastrewin.com): PageView, visitante e Pixel/GA4. Ver lib/track.ts.
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
