/*
 * Erros sem segredo nem dado pessoal.
 *
 * O Drizzle monta a mensagem de erro de query como "Failed query: <sql>\nparams: <valores>".
 * Os valores incluem a ENCRYPTION_KEY (que vai como parâmetro em encryptSecret/decryptSecret),
 * tokens recém-digitados e dados de compradores. Por isso:
 *   1. safeErrorMessage() — use em TODO log e em TODO erro gravado no banco/mostrado no painel;
 *   2. installLogRedaction() — rede de segurança no processo: troca os segredos do env por
 *      [REDACTED] em tudo que sai no stdout/stderr (inclusive erros que o próprio Next registra).
 * Sem "server-only": também roda no instrumentation.ts.
 */

/** Mensagem segura de um erro: para erros de query, só o código e a mensagem do Postgres (sem SQL nem parâmetros). */
export function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return typeof error === "string" ? error : "erro desconhecido";
  if (error.message.startsWith("Failed query:")) {
    const cause = (error as { cause?: unknown }).cause;
    const code = (cause as { code?: string } | undefined)?.code;
    const detail = cause instanceof Error ? cause.message : "";
    return `erro no banco${code ? ` (${code})` : ""}${detail ? `: ${detail}` : ""}`;
  }
  return error.message;
}

/** Valores sensíveis do env (só os longos o bastante para não trocar texto comum por engano). */
export function secretValuesFromEnv(env: Record<string, string | undefined>): string[] {
  const values = [env.ENCRYPTION_KEY, env.BETTER_AUTH_SECRET];
  for (const url of [env.DATABASE_URL, env.MIGRATION_DATABASE_URL]) {
    try {
      if (url) values.push(decodeURIComponent(new URL(url).password));
    } catch {
      // URL inválida: o env() já recusa no uso
    }
  }
  return [...new Set(values.filter((v): v is string => typeof v === "string" && v.length >= 12))];
}

export function redactSecrets(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) if (out.includes(s)) out = out.split(s).join("[REDACTED]");
  return out;
}

const g = globalThis as unknown as { __logRedactionInstalled?: boolean };

/** Liga a rede de segurança dos logs (uma vez por processo). */
export function installLogRedaction(env: Record<string, string | undefined> = process.env) {
  if (g.__logRedactionInstalled) return;
  const secrets = secretValuesFromEnv(env);
  if (!secrets.length) return;
  g.__logRedactionInstalled = true;
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write.bind(stream) as (...args: unknown[]) => boolean;
    stream.write = ((chunk: unknown, ...rest: unknown[]) => {
      if (typeof chunk === "string") return write(redactSecrets(chunk, secrets), ...rest);
      if (chunk instanceof Uint8Array) {
        const text = Buffer.from(chunk).toString("utf8");
        const clean = redactSecrets(text, secrets);
        return write(clean === text ? chunk : clean, ...rest);
      }
      return write(chunk, ...rest);
    }) as typeof stream.write;
  }
}
