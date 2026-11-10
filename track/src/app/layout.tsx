import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Fontes servidas pelo próprio domínio (subconjunto latin do Google Fonts, licença OFL em ./fonts).
// Ficam no repositório para o build não depender do Google Fonts, que às vezes falha.
const manrope = localFont({
	display: "swap",
	src: [{ path: "./fonts/manrope-latin.woff2", style: "normal", weight: "200 800" }],
	variable: "--font-manrope",
});

const jetbrainsMono = localFont({
	display: "swap",
	src: [{ path: "./fonts/jetbrains-mono-latin.woff2", style: "normal", weight: "100 800" }],
	variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
	description: "Tracking server-side — Meta CAPI, GA4 e vendas.",
	robots: { follow: false, index: false },
	title: { default: "Rastrewin", template: "%s · Rastrewin" },
};

export const viewport: Viewport = {
	initialScale: 1,
	themeColor: [
		{ color: "#060d0a", media: "(prefers-color-scheme: dark)" },
		{ color: "#f4f9f6", media: "(prefers-color-scheme: light)" },
	],
	viewportFit: "cover",
	width: "device-width",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="pt-BR"
			suppressHydrationWarning
			className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
		>
			<body className="min-h-full">
				<ThemeProvider>
					<TooltipProvider delayDuration={200}>{children}</TooltipProvider>
					<Toaster position="top-center" richColors closeButton />
				</ThemeProvider>
			</body>
		</html>
	);
}
