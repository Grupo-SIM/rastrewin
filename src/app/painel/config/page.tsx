import { SettingsIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Configurações" };

export default function ConfigPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Contas GA4, pixels Meta, contas de anúncio e webhook." />
      <EmptyState
        icon={SettingsIcon}
        title="Em construção"
        description="Esta tela será implementada na Fase 3."
      />
    </div>
  );
}
