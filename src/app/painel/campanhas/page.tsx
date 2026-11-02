import { MegaphoneIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Campanhas" };

export default function CampanhasPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Campanhas" description="Insights do Meta Ads cruzados com a receita por UTM: ROAS e CPA." />
      <EmptyState
        icon={MegaphoneIcon}
        title="Em construção"
        description="Esta tela será implementada na Fase 7."
      />
    </div>
  );
}
