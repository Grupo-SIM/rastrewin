import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import { TRACK_URL, TRCK_STUB } from "@/lib/track";

const jakarta = Plus_Jakarta_Sans({
	display: "swap",
	subsets: ["latin"],
	variable: "--font-jakarta",
	weight: ["500", "600", "700"],
});
const manrope = Manrope({
	display: "swap",
	subsets: ["latin"],
	variable: "--font-manrope",
	weight: ["400", "500", "600", "700", "800"],
});
const serif = Instrument_Serif({
	display: "swap",
	style: "italic",
	subsets: ["latin"],
	variable: "--font-serif",
	weight: "400",
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
