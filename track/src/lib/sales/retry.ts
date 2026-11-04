import "server-only";
import { safeErrorMessage } from "@/lib/errors";
import { deliverPurchase, pendingPurchaseIds } from "./deliver";

/*
 * Reenvio automático: a cada 5 min, reprocessa compras com envio pendente
 * (falha da Meta/GA4, servidor reiniciado antes do after(), conta adicionada depois).
 * Para em 5 tentativas por destino e só olha os últimos 7 dias.
 */
const INTERVAL_MS = 5 * 60 * 1000;
const g = globalThis as unknown as { __salesRetryStarted?: boolean; __salesRetryRunning?: boolean };

async function tick() {
	if (g.__salesRetryRunning) return;
	g.__salesRetryRunning = true;
	try {
		const ids = await pendingPurchaseIds();
		for (const id of ids) await deliverPurchase(id);
		if (ids.length) console.log(`[reenvio] ${ids.length} compra(s) reprocessada(s)`);
	} catch (error) {
		console.error("[reenvio] falhou", safeErrorMessage(error));
	} finally {
		g.__salesRetryRunning = false;
	}
}

export function startSalesRetryLoop() {
	if (g.__salesRetryStarted) return;
	g.__salesRetryStarted = true;
	setTimeout(tick, 30_000).unref();
	setInterval(tick, INTERVAL_MS).unref();
}
