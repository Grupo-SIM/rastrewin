import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	robots: { follow: false, index: false },
	title: "Página não encontrada | Rastrewin",
};

export default function NotFound() {
	return (
		<main className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
			<Image
				src="/logo-rastrewin.svg"
				alt="Rastrewin"
				width={2078}
				height={564}
				className="h-8 w-auto"
			/>
			<div>
				<h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
					Página não encontrada
				</h1>
				<p className="text-ink-soft mt-2">O endereço que você acessou não existe.</p>
			</div>
			<div className="@container flex w-full max-w-xs justify-center">
				<Button asChild variant="rainbow" size="xl">
					<a href="/">Voltar para o vídeo</a>
				</Button>
			</div>
		</main>
	);
}
