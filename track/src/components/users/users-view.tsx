"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import { type ReactNode, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteUsers, setUsersActive, setUsersRole } from "@/app/painel/usuarios/actions";
import { PageHeader } from "@/components/page-header";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActionResult } from "@/lib/config/types";
import { type Role, ROLE_LABEL, ROLES } from "@/lib/roles";
import { formatDateTime } from "@/lib/time";
import type { UserRow, UsersView as View } from "@/lib/users/data";
import { cn } from "@/lib/utils";
import { USERS_DESCRIPTION } from "./copy";
import { LevelsPanel } from "./levels-panel";
import { PasswordDialog } from "./password-dialog";
import { UserDialog } from "./user-dialog";

type Filter = "all" | Role;
type BulkKind = "admin" | "colaborador" | "on" | "off" | "delete";
type Dialog =
	| { kind: "add" }
	| { kind: "edit"; user: UserRow }
	| { kind: "password"; user: UserRow }
	| { kind: "confirm"; action: BulkKind; users: UserRow[] }
	| null;

const initials = (name: string) =>
	name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map(p => p[0] ?? "")
		.join("")
		.toUpperCase() || "?";

const roleTone: Record<Role, string> = {
	admin: "text-primary bg-primary/10",
	colaborador: "text-cyan bg-cyan/10",
};

/** Textos da confirmação (null = aplica direto, sem perguntar). */
function confirmCopy(action: BulkKind, users: UserRow[]) {
	const one = users.length === 1 ? users[0].name : null;
	const who = one ?? `${users.length} usuários`;
	switch (action) {
		case "delete":
			return {
				body: `${one ? `${one} perde` : "Essas pessoas perdem"} o acesso na hora. Essa ação não pode ser desfeita.`,
				cta: "Excluir",
				danger: true,
				title: `Excluir ${one ? "usuário" : who}?`,
			};
		case "off":
			return {
				body: `${one ? `${one} é desconectado(a)` : "Essas pessoas são desconectadas"} na hora e não ${one ? "consegue" : "conseguem"} mais entrar. Dá para reativar depois.`,
				cta: "Desativar",
				danger: true,
				title: `Desativar ${one ? "usuário" : who}?`,
			};
		case "on":
			return {
				body: `${one ? `${one} volta` : "Essas pessoas voltam"} a entrar no painel com a senha atual.`,
				cta: "Reativar",
				danger: false,
				title: `Reativar ${one ? "usuário" : who}?`,
			};
		case "admin":
			return {
				body: `${one ? `${one} passa` : "Essas pessoas passam"} a ter acesso total, inclusive a Usuários e Configurações.`,
				cta: "Tornar Administrador",
				danger: false,
				title: `Tornar ${who} Administrador?`,
			};
		default:
			return null;
	}
}

function runBulk(action: BulkKind, ids: string[]): Promise<ActionResult> {
	if (action === "delete") return deleteUsers(ids);
	if (action === "on" || action === "off") return setUsersActive(ids, action === "on");
	return setUsersRole(ids, action);
}

export function UsersView({ view }: { view: View }) {
	const { users, meId, timeZone } = view;
	const [tab, setTab] = useState("users");
	const [filter, setFilter] = useState<Filter>("all");
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [dialog, setDialog] = useState<Dialog>(null);
	const [pending, startTransition] = useTransition();

	const counts = useMemo(
		() => ({
			admin: users.filter(u => u.role === "admin").length,
			colaborador: users.filter(u => u.role === "colaborador").length,
		}),
		[users],
	);
	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		return users.filter(
			u =>
				(filter === "all" || u.role === filter) &&
				(!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
		);
	}, [users, filter, query]);
	// Só ids que ainda existem e estão visíveis contam (a lista muda depois de uma ação).
	const visibleIds = new Set(rows.filter(u => u.id !== meId).map(u => u.id));
	const chosen = users.filter(u => selected.has(u.id) && visibleIds.has(u.id));
	const allOn = visibleIds.size > 0 && [...visibleIds].every(id => selected.has(id));

	function toggle(id: string, on: boolean) {
		setSelected(prev => {
			const next = new Set(prev);
			if (on) next.add(id);
			else next.delete(id);
			return next;
		});
	}
	function ask(action: BulkKind, list: UserRow[]) {
		if (!list.length) return;
		if (!confirmCopy(action, list)) return apply(action, list);
		setDialog({ action, kind: "confirm", users: list });
	}
	function apply(action: BulkKind, list: UserRow[]) {
		startTransition(async () => {
			const result = await runBulk(
				action,
				list.map(u => u.id),
			);
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			toast.success(result.message);
			setSelected(new Set());
			setDialog(null);
		});
	}

	const confirm = dialog?.kind === "confirm" ? confirmCopy(dialog.action, dialog.users) : null;
	const selfOf = (u: UserRow) => u.id === meId;

	const rowActions = (u: UserRow): ReactNode => (
		<div className="user-row-actions mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
			<button
				type="button"
				className="text-cyan hover:underline"
				onClick={() => setDialog({ kind: "edit", user: u })}
			>
				Editar
			</button>
			<button
				type="button"
				className="text-cyan hover:underline"
				onClick={() => setDialog({ kind: "password", user: u })}
			>
				{selfOf(u) ? "Trocar senha" : "Redefinir senha"}
			</button>
			{!selfOf(u) && (
				<>
					<button
						type="button"
						className="text-cyan hover:underline"
						onClick={() => ask(u.banned ? "on" : "off", [u])}
					>
						{u.banned ? "Reativar" : "Desativar"}
					</button>
					<button
						type="button"
						className="text-destructive hover:underline"
						onClick={() => ask("delete", [u])}
					>
						Excluir
					</button>
				</>
			)}
		</div>
	);
	const who = (u: UserRow) => (
		<div className="flex min-w-0 items-center gap-3">
			<span
				className={cn(
					"grid size-9 shrink-0 place-items-center rounded-full text-xs font-extrabold",
					roleTone[u.role],
				)}
				aria-hidden
			>
				{initials(u.name)}
			</span>
			<div className="min-w-0">
				<p className="font-semibold break-words">
					{u.name}
					{selfOf(u) && (
						<span className="bg-muted text-muted-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold">
							você
						</span>
					)}
				</p>
				<p className="text-muted-foreground text-xs break-all">{u.email}</p>
			</div>
		</div>
	);
	const badge = (u: UserRow) => (
		<span
			className={cn(
				"inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
				roleTone[u.role],
			)}
		>
			{ROLE_LABEL[u.role].name}
		</span>
	);
	const status = (u: UserRow) => (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 text-xs whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current",
				u.banned ? "text-muted-foreground" : "text-primary",
			)}
		>
			{u.banned ? "Desativado" : "Ativo"}
		</span>
	);
	const lastSeen = (u: UserRow) => (u.lastSeenAt ? formatDateTime(u.lastSeenAt, timeZone) : "—");
	const check = (u: UserRow) => (
		<input
			type="checkbox"
			className="accent-primary size-4"
			aria-label={`Selecionar ${u.name}`}
			checked={selected.has(u.id)}
			disabled={selfOf(u)}
			title={selfOf(u) ? "Você não pode aplicar ações em massa à própria conta" : undefined}
			onChange={event => toggle(u.id, event.target.checked)}
		/>
	);

	return (
		<Tabs value={tab} onValueChange={setTab} className="gap-4">
			<PageHeader
				title="Usuários"
				description={USERS_DESCRIPTION}
				actions={
					<Button className="h-11 w-full sm:w-auto" onClick={() => setDialog({ kind: "add" })}>
						<PlusIcon />
						Adicionar usuário
					</Button>
				}
			/>
			<TabsList className="h-11 w-max">
				<TabsTrigger value="users" className="h-full px-3">
					Todos os usuários
				</TabsTrigger>
				<TabsTrigger value="levels" className="h-full px-3">
					Níveis e permissões
				</TabsTrigger>
			</TabsList>

			<TabsContent value="users" className="flex flex-col gap-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div
						className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
						role="group"
						aria-label="Filtrar por nível"
					>
						{(["all", ...ROLES] as Filter[]).map(key => (
							<button
								key={key}
								type="button"
								aria-pressed={filter === key}
								onClick={() => {
									setFilter(key);
									setSelected(new Set());
								}}
								className={cn(
									"border-b-2 border-transparent py-1 font-semibold",
									filter === key
										? "border-primary text-primary"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{key === "all" ? "Todos" : ROLE_LABEL[key].plural}{" "}
								<span className="opacity-75">
									({key === "all" ? users.length : counts[key]})
								</span>
							</button>
						))}
					</div>
					<div className="relative sm:w-72">
						<SearchIcon
							className="text-muted-foreground pointer-events-none absolute top-3.5 left-3 size-4"
							aria-hidden
						/>
						<Input
							type="search"
							value={query}
							onChange={event => setQuery(event.target.value)}
							placeholder="Buscar por nome ou e-mail"
							aria-label="Buscar usuário"
							className="h-11 pl-9"
						/>
					</div>
				</div>

				{chosen.length > 0 && (
					<div className="bg-primary/5 border-primary/25 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold">
						<span>{chosen.length} selecionado(s)</span>
						<span className="flex-1" />
						<Button
							size="sm"
							variant="outline"
							disabled={pending}
							onClick={() => ask("admin", chosen)}
						>
							Tornar Administrador
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={pending}
							onClick={() => ask("colaborador", chosen)}
						>
							Tornar Colaborador
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={pending}
							onClick={() => ask("on", chosen)}
						>
							Ativar
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={pending}
							onClick={() => ask("off", chosen)}
						>
							Desativar
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={pending}
							className="text-destructive border-destructive/40"
							onClick={() => ask("delete", chosen)}
						>
							Excluir
						</Button>
					</div>
				)}

				<div className="glass overflow-hidden rounded-xl">
					{rows.length === 0 ? (
						<p className="text-muted-foreground px-4 py-10 text-center text-sm">
							Nenhum usuário encontrado.
						</p>
					) : (
						<>
							<table className="hidden w-full text-sm md:table">
								<thead>
									<tr className="text-muted-foreground border-b text-xs">
										<th className="w-12 py-3 pl-4 text-left">
											<input
												type="checkbox"
												className="accent-primary size-4"
												aria-label="Selecionar todos"
												checked={allOn}
												disabled={visibleIds.size === 0}
												onChange={event =>
													setSelected(
														event.target.checked
															? new Set(visibleIds)
															: new Set(),
													)
												}
											/>
										</th>
										<th className="px-3 py-3 text-left font-medium">Usuário</th>
										<th className="px-3 py-3 text-left font-medium">Nível</th>
										<th className="px-3 py-3 text-left font-medium">Status</th>
										<th className="px-3 py-3 text-left font-medium">Último acesso</th>
										<th className="px-3 py-3 text-left font-medium">Criado em</th>
									</tr>
								</thead>
								<tbody>
									{rows.map(u => (
										<tr key={u.id} className="hover:bg-muted/30 border-b last:border-0">
											<td className="py-3 pl-4 align-middle">{check(u)}</td>
											<td className="px-3 py-3">
												{who(u)}
												<div className="pl-12">{rowActions(u)}</div>
											</td>
											<td className="px-3 py-3">{badge(u)}</td>
											<td className="px-3 py-3">{status(u)}</td>
											<td className="text-muted-foreground num px-3 py-3 text-xs whitespace-nowrap">
												{lastSeen(u)}
											</td>
											<td className="text-muted-foreground num px-3 py-3 text-xs whitespace-nowrap">
												{formatDateTime(u.createdAt, timeZone).split(",")[0]}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							<ul className="flex flex-col md:hidden">
								{rows.map(u => (
									<li key={u.id} className="border-b p-4 last:border-0">
										<div className="flex items-start gap-3">
											<span className="pt-2.5">{check(u)}</span>
											{who(u)}
										</div>
										<div className="mt-2.5 ml-7 flex flex-wrap items-center gap-x-3 gap-y-1.5">
											{badge(u)}
											{status(u)}
											<span className="text-muted-foreground text-xs">
												Acesso: {lastSeen(u)}
											</span>
										</div>
										<div className="ml-7 [&_button]:min-h-8 [&_button]:text-[13px]">
											{rowActions(u)}
										</div>
									</li>
								))}
							</ul>
						</>
					)}
				</div>
			</TabsContent>

			<TabsContent value="levels">
				<LevelsPanel counts={counts} />
			</TabsContent>

			<UserDialog
				key={dialog?.kind === "edit" ? `edit-${dialog.user.id}` : "add"}
				open={dialog?.kind === "add" || dialog?.kind === "edit"}
				onOpenChange={open => !open && setDialog(null)}
				user={dialog?.kind === "edit" ? dialog.user : undefined}
				isSelf={dialog?.kind === "edit" && selfOf(dialog.user)}
			/>
			{dialog?.kind === "password" && (
				<PasswordDialog
					key={`pw-${dialog.user.id}`}
					open
					onOpenChange={open => !open && setDialog(null)}
					user={dialog.user}
					isSelf={selfOf(dialog.user)}
				/>
			)}
			<AlertDialog open={!!confirm} onOpenChange={open => !open && setDialog(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
						<AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
						<AlertDialogAction
							variant={confirm?.danger ? "destructive" : "default"}
							className="h-11"
							disabled={pending}
							onClick={event => {
								event.preventDefault();
								if (dialog?.kind === "confirm") apply(dialog.action, dialog.users);
							}}
						>
							{confirm?.cta}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Tabs>
	);
}
