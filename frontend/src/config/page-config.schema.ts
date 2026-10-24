import { z } from "zod";

z.config(z.locales.ptBR());

/** Único destino permitido para o botão (evita open redirect por erro de configuração). */
export const DESTINATION_HOST = "rastrewin.com";

const text = (max: number) => z.string().trim().min(1, "Texto obrigatório.").max(max);

export const PageConfigSchema = z.strictObject({
  youtubeId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{11}$/, "ID do YouTube inválido: são 11 letras, números, - ou _."),
  unlockAtSeconds: z
    .number()
    .int("Use um número inteiro de segundos.")
    .positive("O tempo precisa ser maior que zero.")
    .max(7200, "Máximo de 2 horas."),
  destinationUrl: z
    .url({
      protocol: /^https$/,
      hostname: new RegExp(`^${DESTINATION_HOST.replaceAll(".", "\\.")}$`),
      error: `O destino precisa ser https://${DESTINATION_HOST}.`,
    })
    .refine((value) => {
      const url = new URL(value);
      return url.port === "" && url.username === "" && url.password === "";
    }, "O destino não pode ter porta nem credenciais."),
  posterSrc: z
    .string()
    .regex(/^\/[\w\-/]+\.(webp|avif|jpg|png)$/, "A capa precisa ser um arquivo local em /public."),
  copy: z.strictObject({
    title: text(120),
    subtitle: text(240),
    cta: text(40),
    metaDisclaimer: text(400),
  }),
});

export type PageConfig = z.infer<typeof PageConfigSchema>;
