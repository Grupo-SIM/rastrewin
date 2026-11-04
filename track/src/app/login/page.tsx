import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { GlassCard } from "@/components/glass-card";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
	return (
		<main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
			<div className="flex w-full max-w-sm items-center justify-between">
				<Logo />
				<ThemeToggle />
			</div>
			<GlassCard className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-lg font-semibold">Entrar no painel</CardTitle>
					<CardDescription>Acesso restrito. Não há cadastro público.</CardDescription>
				</CardHeader>
				<CardContent>
					<Suspense>
						<LoginForm />
					</Suspense>
				</CardContent>
			</GlassCard>
		</main>
	);
}
