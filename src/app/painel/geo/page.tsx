import { EarthIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Geo" };

export default function GeoPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Geo" description="Mapa de visitantes e vendas por região." />
      <EmptyState
        icon={EarthIcon}
        title="Em construção"
        description="Esta tela será implementada na Fase 6."
      />
    </div>
  );
}
