import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  LoaderCircleIcon,
  type LucideIcon,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MaintenanceView } from "@/lib/config/types";
import { formatDateTime } from "@/lib/time";

/* Status sempre com ícone + rótulo (nunca só cor). */
const HEALTH: Record<MaintenanceView["health"], { label: string; icon: LucideIcon; color: string }> = {
  ok: { label: "Funcionando", icon: CircleCheckIcon, color: "var(--status-good)" },
  rodando: { label: "Rodando agora", icon: LoaderCircleIcon, color: "var(--muted-foreground)" },
  nunca: { label: "Ainda não rodou", icon: CircleDashedIcon, color: "var(--muted-foreground)" },
  atrasada: { label: "Atrasada", icon: CircleAlertIcon, color: "var(--status-warning)" },
  erro: { label: "Falhou", icon: CircleXIcon, color: "var(--status-critical)" },
};

const nf = new Intl.NumberFormat("pt-BR");

function Status({ spec }: { spec: { label: string; icon: LucideIcon; color: string } }) {
  const Icon = spec.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <Icon className="size-4 shrink-0" style={{ color: spec.color }} aria-hidden />
      {spec.label}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:text-right">{children}</dd>
    </div>
  );
}

function proxyStatus(m: MaintenanceView) {
  if (!m.production) {
    return {
      spec: { label: "Desenvolvimento", icon: CircleDashedIcon, color: "var(--muted-foreground)" },
      note: "Sem proxy local. Em produção, o nginx/Caddy precisa enviar o X-Real-IP.",
    };
  }
  if (m.ipSource === "x-real-ip") {
    return {
      spec: { label: "Proxy configurado", icon: CircleCheckIcon, color: "var(--status-good)" },
      note: "Confira se este é o seu IP atual. Se aparecer o IP do servidor, o proxy está enviando o endereço errado.",
    };
  }
  return {
    spec: { label: "Proxy sem X-Real-IP", icon: CircleAlertIcon, color: "var(--status-warning)" },
    note: "Configure o proxy como em deploy/nginx.conf ou deploy/Caddyfile. Sem isso, a geolocalização e os limites de acesso ficam imprecisos.",
  };
}

export function MaintenanceCard({ maintenance: m, timeZone }: { maintenance: MaintenanceView; timeZone: string }) {
  const run = m.lastRun;
  const proxy = proxyStatus(m);

  return (
    <GlassCard>
      <CardHeader>
        <CardTitle className="font-semibold">Manutenção e servidor</CardTitle>
        <CardDescription>
          Todo dia às 03:15 (Brasília), uma limpeza automática apaga o conteúdo enviado e recebido da Meta e do GA4 nos
          eventos com mais de {m.retentionDays} dias. O evento continua nos relatórios. Ela também remove sessões de
          login vencidas e o cache antigo das campanhas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3">
          <Row label="Limpeza diária">
            <Status spec={HEALTH[m.health]} />
          </Row>
          {run && (
            <Row label="Última execução">
              <span className="num">{formatDateTime(run.finishedAt ?? run.startedAt, timeZone)}</span>
              {m.health !== "erro" && m.health !== "rodando" && (
                <span className="block text-xs text-muted-foreground">
                  {nf.format(run.rowsPayloads)} eventos limpos · {nf.format(run.rowsSessions)} sessões removidas
                </span>
              )}
            </Row>
          )}
          {run?.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {run.error.replace(/\.?\s*$/, ".")} Ela roda de novo na próxima noite. Se repetir, rode à mão:{" "}
              <code className="text-xs">CALL app_private.run_retention();</code>
            </p>
          )}
          {m.health === "atrasada" && (
            <p className="rounded-lg bg-amber/10 px-3 py-2 text-sm text-amber">
              Nenhuma limpeza nos últimos 2 dias. Confira se o banco está usando a imagem com pg_cron (rastrewin-postgres).
            </p>
          )}
          <Row label="Próxima execução">
            <span className="num">{formatDateTime(m.nextRunAt, timeZone)}</span>
          </Row>
          <div className="my-1 border-t" />
          <Row label="Seu IP visto pelo servidor">
            <span className="num">{m.ip ?? "não identificado"}</span>
          </Row>
          <Row label="Proxy reverso">
            <Status spec={proxy.spec} />
          </Row>
          <p className="text-xs text-muted-foreground">{proxy.note}</p>
        </dl>
      </CardContent>
    </GlassCard>
  );
}
