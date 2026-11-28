"use client";

import { FlaskConicalIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { setVisitorTest } from "@/app/painel/visitante/[id]/actions";
import { Button } from "@/components/ui/button";

/** Botão "Marcar como teste" / "Deixar de ser teste" (só Administrador; a action confere de novo). */
export function VisitorTestButton({ id, isTest }: { id: string; isTest: boolean }) {
	const [pending, startTransition] = useTransition();
	function toggle() {
		startTransition(async () => {
			const result = await setVisitorTest(id, !isTest);
			if (result.ok) toast.success(result.message);
			else toast.error(result.error);
		});
	}
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="h-10"
			disabled={pending}
			onClick={toggle}
		>
			{!isTest && <FlaskConicalIcon aria-hidden style={{ color: "var(--test)" }} />}
			{isTest ? "Deixar de ser teste" : "Marcar como teste"}
		</Button>
	);
}

/** Aviso da jornada de um visitante de teste (plano 0008). */
export function VisitorTestBanner({
	id,
	markedAt,
	events,
	canEdit,
}: {
	id: string;
	markedAt: string | null;
	events: number;
	canEdit: boolean;
}) {
	return (
		<div
			className="flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3"
			style={{
				background: "color-mix(in srgb, var(--test) 8%, transparent)",
				borderColor: "color-mix(in srgb, var(--test) 40%, transparent)",
			}}
		>
			<FlaskConicalIcon
				className="mt-0.5 size-5 shrink-0"
				style={{ color: "var(--test)" }}
				aria-hidden
			/>
			<div className="min-w-0 flex-1 text-sm">
				<p className="font-semibold">Visitante de teste</p>
				<p className="text-muted-foreground">
					Fora dos números e dos envios à Meta e ao GA4
					{markedAt ? ` desde ${markedAt}` : ""}.{" "}
					{events > 0 &&
						`${events === 1 ? "O evento dele também saiu" : `Os ${events.toLocaleString("pt-BR")} eventos dele também saíram`} dos relatórios. `}
					O que foi enviado antes da marcação não volta.
				</p>
			</div>
			{canEdit && <VisitorTestButton id={id} isTest />}
		</div>
	);
}
