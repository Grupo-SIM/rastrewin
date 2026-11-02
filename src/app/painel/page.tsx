import { ActivityIcon, PercentIcon, ShoppingBagIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { GlassCard } from "@/components/glass-card";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Visão geral" };

const FUNNEL = [
  { step: "Visitou", tone: "bg-primary" },
  { step: "Checkout", tone: "bg-cyan" },
  { step: "Compra", tone: "bg-amber" },
];

export default function VisaoGeralPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Visão geral"
        description="Usuários, eventos e conversões do período."
        actions={<Badge variant="outline">Dados na Fase 6</Badge>}
      />

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Usuários únicos" value="—" icon={UsersIcon} />
        <KpiCard label="Eventos" value="—" icon={ActivityIcon} tone="cyan" />
        <KpiCard label="Compras" value="—" icon={ShoppingBagIcon} tone="amber" />
        <KpiCard label="Conversão" value="—" icon={PercentIcon} />
      </section>

      <GlassCard>
        <CardHeader>
          <CardTitle>Funil</CardTitle>
          <CardDescription>Visitou → Checkout → Compra, com % entre etapas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {FUNNEL.map((f) => (
            <div key={f.step} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm text-muted-foreground">{f.step}</span>
              <div className="h-8 flex-1 overflow-hidden rounded-md bg-muted">
                <div className={`h-full w-0 ${f.tone}`} />
              </div>
              <span className="num w-14 text-right text-sm">—</span>
            </div>
          ))}
        </CardContent>
      </GlassCard>
    </div>
  );
}
