import { BanknoteIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Faturamento" };

export default function FaturamentoPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Faturamento" description="Receita, ticket médio, reembolsos e compras." />
      <EmptyState
        icon={BanknoteIcon}
        title="Em construção"
        description="Esta tela será implementada na Fase 6."
      />
    </div>
  );
}
