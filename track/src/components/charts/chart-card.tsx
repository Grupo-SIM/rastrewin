"use client";

import { ChartColumnIcon, TableIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface TableSpec {
	columns: { key: string; label: string; align?: "left" | "right" }[];
	rows: Record<string, string>[];
}

/**
 * Cartão de gráfico com o equivalente em TABELA (acessível, nunca depende só de cor/tooltip).
 * Os valores da tabela vêm prontos (já formatados) e entram como texto.
 */
export function ChartCard({
	title,
	description,
	table,
	children,
	footer,
	className,
}: {
	title: string;
	description?: ReactNode;
	table?: TableSpec;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
}) {
	const [showTable, setShowTable] = useState(false);
	const id = useId();
	return (
		<GlassCard className={className}>
			<CardHeader className="flex flex-row items-start justify-between gap-3">
				<div className="min-w-0">
					<CardTitle id={id} className="font-semibold">
						{title}
					</CardTitle>
					{description && <CardDescription className="mt-1">{description}</CardDescription>}
				</div>
				{table && (
					<Button
						variant="ghost"
						size="sm"
						className="text-muted-foreground h-9 shrink-0"
						aria-pressed={showTable}
						onClick={() => setShowTable(v => !v)}
					>
						{showTable ? <ChartColumnIcon /> : <TableIcon />}
						{showTable ? "Ver gráfico" : "Ver tabela"}
					</Button>
				)}
			</CardHeader>
			<CardContent aria-labelledby={id}>
				{showTable && table ? <DataTableView table={table} /> : children}
				{footer && <div className="text-muted-foreground mt-3 text-xs">{footer}</div>}
			</CardContent>
		</GlassCard>
	);
}

export function DataTableView({ table }: { table: TableSpec }) {
	return (
		<div className="max-h-80 overflow-auto rounded-lg border">
			<table className="w-full text-sm">
				<thead className="bg-card sticky top-0">
					<tr className="border-b">
						{table.columns.map(c => (
							<th
								key={c.key}
								scope="col"
								className={`text-muted-foreground px-3 py-2 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}
							>
								{c.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{table.rows.map((row, i) => (
						<tr key={i} className="border-b last:border-0">
							{table.columns.map(c => (
								<td
									key={c.key}
									className={`px-3 py-1.5 ${c.align === "right" ? "num text-right" : ""}`}
								>
									{row[c.key]}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
