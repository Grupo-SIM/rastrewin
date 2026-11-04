import { TriangleAlertIcon } from "lucide-react";
import { CopyButton } from "@/components/config/copy-button";
import { GlassCard } from "@/components/glass-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const URL_PARAMS =
  "utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_term={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}";

/** Como ligar as vendas às campanhas: os parâmetros de URL dos anúncios. */
export function UtmGuide({ salesInPeriod, salesWithCampaignUtm }: { salesInPeriod: number; salesWithCampaignUtm: number }) {
  return (
    <GlassCard>
      <CardHeader>
        <CardTitle className="font-semibold">Como ligar as vendas às campanhas</CardTitle>
        <CardDescription>
          O ROAS por campanha depende das UTMs. Cole os parâmetros abaixo em <strong>todos os anúncios</strong>: Gerenciador de
          Anúncios › anúncio › Rastreamento › <strong>Parâmetros de URL</strong>. A Meta troca cada {"{{…}}"} pelo nome e pelo ID reais.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {salesInPeriod > 0 && salesWithCampaignUtm === 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-amber/10 px-3 py-2 text-sm text-amber">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            Nenhuma das {salesInPeriod} venda(s) do período chegou com UTM de campanha. Configure os parâmetros nos anúncios.
          </p>
        )}
        <pre className="num overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap break-all">{URL_PARAMS}</pre>
        <CopyButton value={URL_PARAMS} label="Copiar parâmetros" className="h-10 self-start" />
        <p className="text-xs text-muted-foreground">
          O script do site guarda essas UTMs e as repassa ao checkout; a venda volta pelo webhook com elas, e o painel liga pelo ID do
          anúncio (ou do conjunto/campanha). Vendas sem UTM aparecem em “Sem campanha identificada”.
        </p>
      </CardContent>
    </GlassCard>
  );
}
