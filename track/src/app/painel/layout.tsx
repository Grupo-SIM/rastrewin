import { Suspense } from "react";
import { SessionGate } from "@/components/auth/session-gate";
import { UserBadge } from "@/components/auth/user-badge";
import { PageSkeleton } from "@/components/page-skeleton";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  // O shell é estático; sessão e conteúdo chegam por streaming atrás de <Suspense>.
  const user = (
    <Suspense>
      <UserBadge />
    </Suspense>
  );
  return (
    <div className="flex min-h-dvh">
      <Sidebar footer={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {/* pb extra no mobile para não ficar atrás da barra inferior */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-10">
          <Suspense fallback={<PageSkeleton />}>
            <SessionGate>{children}</SessionGate>
          </Suspense>
          {/* Exigido pela licença CC BY 4.0 da base de geolocalização */}
          <p className="mt-10 text-center text-[11px] text-muted-foreground">
            Geolocalização por IP:{" "}
            <a href="https://db-ip.com" target="_blank" rel="noopener" className="underline underline-offset-2">
              IP Geolocation by DB-IP
            </a>{" "}
            (CC BY 4.0)
          </p>
        </main>
      </div>
      <MobileNav footer={user} />
    </div>
  );
}
