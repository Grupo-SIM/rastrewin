"use server";

import { z } from "zod";
import { getEventDetail } from "@/lib/dashboard/details";

/** Server Action pública: readAsUser (dentro de getEventDetail) valida a sessão; o id é validado aqui. */
export async function loadEventDetail(id: unknown) {
	return getEventDetail(z.number().int().positive().parse(id));
}
