import { CheckIcon, InfoIcon, LockIcon, MinusIcon } from "lucide-react";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { type Role, ROLE_LABEL, ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Mark = true | false | string;

/** Quadro do mockup aprovado. Só descreve: quem aplica as regras é o servidor. */
const CAPS: [string, [string, Mark, Mark][]][] = [
	["Painel", NAV_ITEMS.filter(i => !i.adminOnly).map(i => [i.label, true, true])],
	[
		"Dados e ações do dia a dia",
		[
			["Nome, e-mail e telefone de clientes", true, "Mascarado"],
			["IP do visitante", true, "Mascarado"],
			["Dados brutos da venda (webhook)", true, false],
			["Buscar venda por e-mail", true, false],
			["Jornada do visitante", true, true],
			["Detalhes de eventos e vendas", true, true],
			["Atualizar dados de campanhas", true, true],
		],
	],
	[
		"Configurações",
		[
			["Contas da Meta e do GA4", true, false],
			["Webhook e segredos", true, false],
			["Sites autorizados e opções gerais", true, false],
			["Privacidade e LGPD", true, false],
			["Saúde do sistema e reenvio de vendas", true, false],
		],
	],
	[
		"Usuários",
		[
			["Ver, criar, editar e excluir usuários", true, false],
			["Definir níveis de acesso", true, false],
		],
	],
];

const MASK_DEMO: [string, string, string][] = [
	["Nome", "Marina Alves", "M***** A****"],
	["E-mail", "marina.alves@gmail.com", "m***@gmail.com"],
	["Telefone", "(11) 98765-4321", "(11) *****-**21"],
	["IP", "187.45.120.33", "187.45.*.*"],
];

function MarkCell({ value }: { value: Mark }) {
	if (value === true) return <CheckIcon className="text-primary mx-auto size-4" aria-label="Permitido" />;
	if (value === false)
		return <MinusIcon className="text-muted-foreground/60 mx-auto size-4" aria-label="Sem acesso" />;
	return <span className="text-amber text-[11px] font-bold">{value}</span>;
}

export function LevelsPanel({ counts }: { counts: Record<Role, number> }) {
	const menu = NAV_ITEMS;
	return (
		<div className="flex flex-col gap-4">
			<div className="grid gap-3 sm:grid-cols-2">
				{ROLES.map(role => (
					<section key={role} className="glass rounded-xl p-4">
						<h3 className="flex items-center gap-2 font-semibold">
							<span
								className={cn(
									"size-2.5 rounded-full",
									role === "admin" ? "bg-primary" : "bg-cyan",
								)}
								aria-hidden
							/>
							{ROLE_LABEL[role].name}
							<span className="text-muted-foreground ml-auto text-xs font-medium">
								{counts[role]} usuário(s)
							</span>
						</h3>
						<p className="text-muted-foreground mt-1 text-sm">{ROLE_LABEL[role].description}</p>
						<p className="text-muted-foreground mt-3 text-xs font-semibold">
							Menu que essa pessoa vê
						</p>
						<div className="mt-2 flex flex-wrap gap-1.5">
							{menu.map(item =>
								role === "admin" || !item.adminOnly ? (
									<span
										key={item.href}
										className="bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium"
									>
										{item.label}
									</span>
								) : (
									<span
										key={item.href}
										className="text-muted-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs line-through"
									>
										<LockIcon className="size-3" aria-hidden />
										{item.label}
									</span>
								),
							)}
						</div>
					</section>
				))}
			</div>

			<section className="glass overflow-hidden rounded-xl">
				<header className="px-4 pt-4 pb-3">
					<h2 className="font-semibold">O que cada nível pode fazer</h2>
					<p className="text-muted-foreground text-sm">
						Dois níveis fixos: simples de entender e difícil de configurar errado.
					</p>
				</header>
				<table className="w-full table-fixed text-sm">
					<thead>
						<tr className="text-muted-foreground border-b text-xs">
							<th className="px-4 py-2 text-left font-medium">Permissão</th>
							<th className="w-[22%] px-1 py-2 text-center font-medium">Admin</th>
							<th className="w-[22%] px-1 py-2 text-center font-medium">Colab.</th>
						</tr>
					</thead>
					<tbody>
						{CAPS.map(([group, rows]) => [
							<tr key={group} className="bg-muted/50">
								<td colSpan={3} className="px-4 py-2 text-xs font-bold">
									{group}
								</td>
							</tr>,
							...rows.map(([label, admin, colab]) => (
								<tr key={`${group}-${label}`} className="border-b last:border-0">
									<td className="px-4 py-2.5 font-medium">{label}</td>
									<td className="px-1 py-2.5 text-center">
										<MarkCell value={admin} />
									</td>
									<td className="px-1 py-2.5 text-center">
										<MarkCell value={colab} />
									</td>
								</tr>
							)),
						])}
					</tbody>
				</table>
				<p className="text-muted-foreground flex gap-2 border-t px-4 py-3 text-xs">
					<InfoIcon className="text-cyan mt-0.5 size-3.5 shrink-0" aria-hidden />
					As regras são aplicadas no servidor: o dado completo nem chega ao navegador do
					Colaborador, e as ações bloqueadas são recusadas mesmo se alguém tentar chamá-las direto.
				</p>
			</section>

			<section className="glass rounded-xl p-4">
				<h2 className="font-semibold">Como o Colaborador vê os dados de clientes</h2>
				<p className="text-muted-foreground mb-3 text-sm">
					Exemplo fictício. O Administrador sempre vê o dado completo.
				</p>
				<div className="grid grid-cols-[5.5rem_1fr_1fr] gap-x-2 text-sm">
					<span className="text-muted-foreground py-2 text-xs font-bold">Campo</span>
					<span className="text-muted-foreground py-2 text-xs font-bold">Administrador</span>
					<span className="text-muted-foreground py-2 text-xs font-bold">Colaborador</span>
					{MASK_DEMO.map(([field, full, masked]) => [
						<span key={`${field}-f`} className="border-t py-2">
							{field}
						</span>,
						<code key={`${field}-a`} className="border-t py-2 font-mono text-xs break-all">
							{full}
						</code>,
						<code key={`${field}-c`} className="border-t py-2 font-mono text-xs break-all">
							{masked}
						</code>,
					])}
				</div>
			</section>
		</div>
	);
}
