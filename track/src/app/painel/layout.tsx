import { Suspense } from "react";
import { SessionGate } from "@/components/auth/session-gate";
import { UserBadge } from "@/components/auth/user-badge";
import { PageSkeleton } from "@/components/page-skeleton";
import { DeliveryAlerts } from "@/components/shell/delivery-alerts";
import { HealthBanner } from "@/components/shell/health-banner";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { ViewerMobileNav, ViewerSidebar } from "@/components/shell/viewer-nav";

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
	// O shell é estático; sessão e conteúdo chegam por streaming atrás de <Suspense>.
	const user = (
		<Suspense>
			<UserBadge />
		</Suspense>
	);
	return (
		<div className="flex min-h-dvh">
			{/* Menu pelo nível (o fallback não mostra itens de administrador) */}
			<Suspense fallback={<Sidebar footer={user} />}>
				<ViewerSidebar footer={user} />
			</Suspense>
			<div className="flex min-w-0 flex-1 flex-col">
				<Topbar />
				{/* pb extra no mobile para não ficar atrás da barra inferior */}
				<main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-10">
					{/* Envio à Meta/GA4 falhando (todos os níveis): não atrasa a página; aparece quando chega */}
					<Suspense fallback={null}>
						<DeliveryAlerts />
					</Suspense>
					{/* Aviso dos bastidores (Saúde), só para Administrador: não atrasa a página; aparece quando chega */}
					<Suspense fallback={null}>
						<HealthBanner />
					</Suspense>
					<Suspense fallback={<PageSkeleton />}>
						<SessionGate>{children}</SessionGate>
					</Suspense>
					{/* Exigido pela licença CC BY 4.0 da base de geolocalização */}
					<p className="text-muted-foreground mt-10 text-center text-[11px]">
						Geolocalização por IP:{" "}
						<a
							href="https://db-ip.com"
							target="_blank"
							rel="noopener"
							className="underline underline-offset-2"
						>
							IP Geolocation by DB-IP
						</a>{" "}
						(CC BY 4.0)
					</p>
				</main>
			</div>
			<Suspense fallback={<MobileNav footer={user} />}>
				<ViewerMobileNav footer={user} />
			</Suspense>
		</div>
	);
}
