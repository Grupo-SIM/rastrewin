"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ConfigView } from "@/lib/config/types";
import { AccountsPanel } from "./accounts-panel";
import { GeneralForm } from "./general-form";
import { InstallCard } from "./install-card";
import { WebhookCard } from "./webhook-card";

export function ConfigTabs({ config }: { config: ConfigView }) {
  const count = (k: keyof ConfigView["accounts"]) => config.accounts[k].length;
  const tabs = [
    { value: "geral", label: "Geral", short: "Geral" },
    { value: "ga4", label: "GA4", short: "GA4", count: count("ga4") },
    { value: "pixel", label: "Pixels Meta", short: "Pixels", count: count("pixel") },
    { value: "ads", label: "Contas de anúncio", short: "Anúncios", count: count("ads") },
  ];

  return (
    <Tabs defaultValue="geral" className="gap-5">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="h-11 w-max">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="h-full px-3">
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count !== undefined && (
                <span className="num rounded bg-muted px-1.5 text-[11px] text-muted-foreground">{tab.count}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="geral" className="flex flex-col gap-5">
        <InstallCard general={config.general} />
        <GeneralForm general={config.general} />
        <WebhookCard general={config.general} />
      </TabsContent>
      <TabsContent value="ga4">
        <AccountsPanel kind="ga4" accounts={config.accounts.ga4} />
      </TabsContent>
      <TabsContent value="pixel">
        <AccountsPanel kind="pixel" accounts={config.accounts.pixel} />
      </TabsContent>
      <TabsContent value="ads">
        <AccountsPanel kind="ads" accounts={config.accounts.ads} />
      </TabsContent>
    </Tabs>
  );
}
