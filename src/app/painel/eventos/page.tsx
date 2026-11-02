import { ActivityIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Eventos" };

export default function EventosPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Eventos" description="Todos os eventos capturados, com payload e resposta da Meta e do GA4." />
      <EmptyState
        icon={ActivityIcon}
        title="Em construção"
        description="Esta tela será implementada na Fase 6."
      />
    </div>
  );
}
