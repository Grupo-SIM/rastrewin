import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { withReader } from "@/db";
import { getAuth } from "@/lib/auth";

/*
 * Camada de acesso a dados do painel (DAL). TODA leitura do painel passa por aqui:
 * valida a sessão no servidor e só então consulta como app_reader (RLS).
 * Não confie só no proxy.ts — ele é apenas um redirecionamento otimista.
 */

export const getSession = cache(async () => {
  // headers() PRIMEIRO: no pré-render ele adia o resto para o request.
  // Se getAuth() viesse antes, o build tentaria ler o env (que não existe no build).
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Executa leituras com RLS em nome do usuário logado. */
export async function readAsUser<T>(fn: Parameters<typeof withReader<T>>[1]): Promise<T> {
  const session = await requireSession();
  return withReader(session.user.id, fn);
}
