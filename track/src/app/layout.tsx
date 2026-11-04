import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const manrope = Manrope({
	display: "swap",
	subsets: ["latin"],
	variable: "--font-manrope",
});

const jetbrainsMono = JetBrains_Mono({
	display: "swap",
	subsets: ["latin"],
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
