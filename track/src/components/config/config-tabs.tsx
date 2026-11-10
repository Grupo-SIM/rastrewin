"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ConfigView } from "@/lib/config/types";
import { AccountsPanel } from "./accounts-panel";
import { GeneralForm } from "./general-form";
import { InstallCard } from "./install-card";
import { MaintenanceCard } from "./maintenance-card";
import { PrivacyForm } from "./privacy-form";
import { WebhookCard } from "./webhook-card";

/** `health`: conteúdo da aba Saúde, renderizado no servidor. `?aba=saude` abre direto nela (link da faixa de aviso). */
export function ConfigTabs({ config, health }: { config: ConfigView; health: ReactNode }) {
	const count = (k: keyof ConfigView["accounts"]) => config.accounts[k].length;
	const tabs = [
		{ label: "Geral", short: "Geral", value: "geral" },
		{ count: count("ga4"), label: "GA4", short: "GA4", value: "ga4" },
		{ count: count("pixel"), label: "Pixels Meta", short: "Pixels", value: "pixel" },
		{ count: count("ads"), label: "Contas de anúncio", short: "Anúncios", value: "ads" },
		{ label: "Privacidade", short: "LGPD", value: "privacidade" },
		{ label: "Saúde", short: "Saúde", value: "saude" },
	];
	const requested = useSearchParams().get("aba");
	const initial = tabs.some(t => t.value === requested) ? (requested as string) : "geral";
	// No celular a lista de abas rola de lado: aberta direto numa aba do fim (ex.: Saúde, pela faixa
	// de aviso), traz essa aba para a área visível.
	const listRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const box = listRef.current;
		const active = box?.querySelector<HTMLElement>(`[data-state="active"]`);
		if (!box || !active) return;
		const hidden = active.getBoundingClientRect().right - box.getBoundingClientRect().right;
		if (hidden > 0) box.scrollLeft += hidden + 16;
	}, []);

	return (
		<Tabs key={initial} defaultValue={initial} className="gap-5">
			<div ref={listRef} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
				<TabsList className="h-11 w-max">
					{tabs.map(tab => (
						<TabsTrigger key={tab.value} value={tab.value} className="h-full px-3">
							<span className="sm:hidden">{tab.short}</span>
							<span className="hidden sm:inline">{tab.label}</span>
							{tab.count !== undefined && (
								<span className="num bg-muted text-muted-foreground rounded px-1.5 text-[11px]">
									{tab.count}
								</span>
							)}
						</TabsTrigger>
					))}
				</TabsList>
			</div>
			<TabsContent value="geral" className="flex flex-col gap-5">
				<InstallCard general={config.general} />
				<GeneralForm general={config.general} />
				<WebhookCard general={config.general} />
				<MaintenanceCard maintenance={config.maintenance} timeZone={config.general.timezone} />
			</TabsContent>
			<TabsContent value="ga4">
				<AccountsPanel kind="ga4" accounts={config.accounts.ga4} timeZone={config.general.timezone} />
			</TabsContent>
			<TabsContent value="pixel">
				<AccountsPanel
					kind="pixel"
					accounts={config.accounts.pixel}
					timeZone={config.general.timezone}
				/>
			</TabsContent>
			<TabsContent value="ads">
				<AccountsPanel kind="ads" accounts={config.accounts.ads} timeZone={config.general.timezone} />
			</TabsContent>
			<TabsContent value="privacidade" className="flex flex-col gap-5">
				<PrivacyForm privacy={config.privacy} />
			</TabsContent>
			<TabsContent value="saude">{health}</TabsContent>
		</Tabs>
	);
}
