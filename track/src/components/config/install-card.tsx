import { TriangleAlertIcon } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GeneralView } from "@/lib/config/types";
import { CopyButton } from "./copy-button";

export function InstallCard({ general }: { general: GeneralView }) {
	const snippet = `<script>window.trck=window.trck||function(){(trck.q=trck.q||[]).push(arguments)};</script>
<script async src="${general.scriptUrl}"></script>`;
	const example = `<script>trck('track', 'Lead', { value: 10 });</script>`;
	const noOrigins = general.allowedOrigins.length === 0;

	return (
		<GlassCard>
			<CardHeader>
				<CardTitle className="font-semibold">Instalação no site</CardTitle>
				<CardDescription>
					Cole no <code className="text-xs">&lt;head&gt;</code> de todas as páginas. O script
					carrega o Pixel e o GA4 das contas ativas, registra o visitante, envia o PageView e marca
					os links de checkout e WhatsApp.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{noOrigins && (
					<p className="bg-amber/10 text-amber flex items-start gap-2 rounded-lg px-3 py-2 text-sm">
						<TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
						Cadastre o endereço do seu site em “Sites autorizados” (abaixo). Sem isso, o script
						não envia nada.
					</p>
				)}
				<div className="flex flex-col gap-2">
					<pre className="num bg-muted/40 overflow-x-auto rounded-lg border p-3 text-xs leading-relaxed">
						{snippet}
					</pre>
					<CopyButton value={snippet} label="Copiar código" className="h-10 self-start" />
				</div>
				<details className="text-muted-foreground text-sm">
					<summary className="text-foreground cursor-pointer font-medium">
						Eventos, dados do lead e opções
					</summary>
					<div className="mt-3 flex flex-col gap-3">
						<p>
							Disparar um evento (vai para o Pixel e para a Conversions API com o mesmo
							event_id):
						</p>
						<pre className="num bg-muted/40 overflow-x-auto rounded-lg border p-3 text-xs">
							{example}
						</pre>
						<p>
							Ao capturar um lead, envie os dados para melhorar a correspondência na Meta:{" "}
							<code className="text-xs">
								trck(&apos;identify&apos;, {"{"} email, phone, first_name, last_name {"}"})
							</code>
						</p>
						<p>
							Automático: cliques em links de checkout disparam{" "}
							<strong>InitiateCheckout</strong>, e cliques em links de WhatsApp disparam{" "}
							<strong>Contact</strong>. A compra (<strong>Purchase</strong>) vem só do webhook.
						</p>
						<p>
							Se o site já tiver o Pixel ou a gtag instalados, acrescente{" "}
							<code className="text-xs">data-no-pixel</code> ou{" "}
							<code className="text-xs">data-no-ga</code> na tag do script para não duplicar.
							Nesse caso o Pixel e a gtag do site também precisam esperar o aceite (LGPD).
						</p>
						<p>
							Consentimento: o script mostra o banner (aba Privacidade) e só rastreia depois do
							aceite. Para usar um banner próprio, acrescente{" "}
							<code className="text-xs">data-no-banner</code> e informe a escolha com{" "}
							<code className="text-xs">
								trck(&apos;consent&apos;, {"{"} marketing: true {"}"})
							</code>
							.
						</p>
					</div>
				</details>
			</CardContent>
		</GlassCard>
	);
}
