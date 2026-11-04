"use server";

import { z } from "zod";
import { getPurchaseDetail } from "@/lib/dashboard/details";

/** Server Action pública: readAsUser (dentro de getPurchaseDetail) valida a sessão; o id é validado aqui. */
export async function loadPurchaseDetail(id: unknown) {
  return getPurchaseDetail(z.number().int().positive().parse(id));
}
