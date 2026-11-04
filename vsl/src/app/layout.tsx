import type { Metadata, Viewport } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { pageConfig } from "@/config/page-config";
import "./globals.css";

// next/font baixa as fontes no build e as serve do próprio domínio (nenhuma requisição ao Google).
const jakarta = Plus_Jakarta_Sans({
	display: "swap",
	subsets: ["latin"],
	variable: "--font-jakarta",
	weight: ["700", "800"],
});

const manrope = Manrope({
	display: "swap",
	subsets: ["latin"],
	variable: "--font-manrope",
	weight: ["400", "500", "600"],
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
			<body>{children}</body>
		</html>
	);
}
