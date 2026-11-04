import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfigTabs } from "@/components/config/config-tabs";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getConfigView } from "@/lib/config/queries";

export const metadata: Metadata = { title: "Configurações" };

export default function ConfigPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações"
        description="Contas GA4, pixels Meta, contas de anúncio e webhook. Os segredos ficam cifrados e aparecem mascarados."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <ConfigContent />
      </Suspense>
    </div>
  );
}

async function ConfigContent() {
  // getConfigView valida a sessão (readAsUser) e lê com RLS.
  const config = await getConfigView();
  return <ConfigTabs config={config} />;
}
