"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { saveGeneral } from "@/app/painel/config/actions";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { GeneralView } from "@/lib/config/types";
import { TIMEZONE_OPTIONS } from "@/lib/time";
import { Field } from "./field";

const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "ARS", "MXN", "CLP", "COP", "PEN", "UYU", "PYG", "CAD", "AUD"];

export function GeneralForm({ general }: { general: GeneralView }) {
  const [currency, setCurrency] = useState(general.currency);
  const [ga4Debug, setGa4Debug] = useState(general.ga4Debug);
  const [timezone, setTimezone] = useState(general.timezone);
  const zones = TIMEZONE_OPTIONS.some((z) => z.value === general.timezone)
    ? TIMEZONE_OPTIONS
    : [{ value: general.timezone, label: general.timezone }, ...TIMEZONE_OPTIONS];
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const currencies = CURRENCIES.includes(general.currency) ? CURRENCIES : [general.currency, ...CURRENCIES];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveGeneral({
        currency,
        testEventCode: String(form.get("testEventCode") ?? ""),
        allowedOrigins: String(form.get("allowedOrigins") ?? ""),
        checkoutDomains: String(form.get("checkoutDomains") ?? ""),
        ga4Debug,
        timezone,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      setErrors({});
      toast.success(result.message);
    });
  }

  return (
    <GlassCard>
      <CardHeader>
        <CardTitle className="font-semibold">Geral</CardTitle>
        <CardDescription>Moeda, código de teste e quais sites podem enviar eventos.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2" noValidate>
          <Field id="currency" label="Moeda padrão" hint="Usada quando a venda não informa a moeda." error={errors.currency}>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="currency" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            id="timezone"
            label="Fuso horário do painel"
            hint="Use o MESMO fuso da sua conta de anúncios da Meta, para os números por dia baterem."
            error={errors.timezone}
          >
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z.value} value={z.value}>
                    {z.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            id="testEventCode"
            label="Código de teste da Meta (test_event_code)"
            hint="Só durante testes, no Gerenciador de Eventos › Testar eventos. Deixe VAZIO em produção."
            error={errors.testEventCode}
          >
            <Input
              id="testEventCode"
              name="testEventCode"
              defaultValue={general.testEventCode}
              placeholder="TEST12345"
              className="h-11 font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field
            id="allowedOrigins"
            label="Sites autorizados (origens)"
            hint="Um por linha. Só esses sites podem chamar a captura. Ex.: https://meusite.com.br"
            error={errors.allowedOrigins}
          >
            <Textarea
              id="allowedOrigins"
              name="allowedOrigins"
              defaultValue={general.allowedOrigins.join("\n")}
              rows={4}
              placeholder={"https://meusite.com.br\nhttps://www.meusite.com.br"}
              className="font-mono text-sm"
              spellCheck={false}
            />
          </Field>
          <Field
            id="checkoutDomains"
            label="Domínios de checkout"
            hint="Um por linha. Links para eles recebem o trck_user_id (no parâmetro src) e as UTMs."
            error={errors.checkoutDomains}
          >
            <Textarea
              id="checkoutDomains"
              name="checkoutDomains"
              defaultValue={general.checkoutDomains.join("\n")}
              rows={4}
              placeholder="pay.simintpay.com"
              className="font-mono text-sm"
              spellCheck={false}
            />
          </Field>
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 md:col-span-2">
            <div>
              <Label htmlFor="ga4Debug">Modo debug do GA4</Label>
              <p className="text-xs text-muted-foreground">
                As compras enviadas pelo servidor aparecem no DebugView do GA4 e são validadas antes. Ligue só para testar.
              </p>
            </div>
            <Switch id="ga4Debug" checked={ga4Debug} onCheckedChange={setGa4Debug} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              Salvar configurações
            </Button>
          </div>
        </form>
      </CardContent>
    </GlassCard>
  );
}
