import type { Viewport } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
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
