"use client";

import { LoaderCircleIcon, RotateCcwIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { retryBackendRelays } from "@/app/painel/config/actions";
import { Button } from "@/components/ui/button";

/** Pede ao backend que recoloque na fila as vendas em que desistiu. */
export function RetryRelaysButton() {
	const [pending, start] = useTransition();
	return (
		<Button
			variant="outline"
			className="h-10"
			disabled={pending}
			onClick={() =>
				start(async () => {
					const res = await retryBackendRelays();
					if (res.ok) toast.success(res.message ?? "Pedido enviado.");
					else toast.error(res.error);
				})
			}
		>
			{pending ? <LoaderCircleIcon className="animate-spin" /> : <RotateCcwIcon />}
			Tentar de novo
		</Button>
	);
}
