"use client";

import { LoaderCircleIcon } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { savePrivacy } from "@/app/painel/config/actions";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PrivacyView } from "@/lib/config/types";
import type { ConsentTexts } from "@/lib/privacy/consent-texts";
import { CopyButton } from "./copy-button";
import { Field } from "./field";

const SHORT: { key: keyof ConsentTexts; label: string }[] = [
	{ key: "title", label: "Título" },
	{ key: "accept", label: "Botão Aceitar" },
	{ key: "reject", label: "Botão Recusar" },
	{ key: "preferences", label: "Botão Preferências" },
	{ key: "save", label: "Botão Salvar escolha" },
	{ key: "policyLink", label: "Texto do link da política" },
	{ key: "necessaryTitle", label: "Categoria necessária" },
	{ key: "marketingTitle", label: "Categoria de marketing" },
];
const LONG: { key: keyof ConsentTexts; label: string }[] = [
	{ key: "body", label: "Texto principal" },
	{ key: "necessaryDescription", label: "Descrição dos necessários" },
	{ key: "marketingDescription", label: "Descrição de marketing e medição" },
];

const PREFERENCES_LINK = `<a href="#" onclick="trck('consent','open');return false">Preferências de cookies</a>`;

/** Banner de consentimento (LGPD): o t.js mostra este banner e só rastreia depois do aceite. */
export function PrivacyForm({ privacy }: { privacy: PrivacyView }) {
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [pending, startTransition] = useTransition();

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const texts = Object.fromEntries(
			[...SHORT, ...LONG].map(({ key }) => [key, String(form.get(`text.${key}`) ?? "")]),
		);
		startTransition(async () => {
			const result = await savePrivacy({
				policyUrl: String(form.get("policyUrl") ?? ""),
				texts,
				version: String(form.get("version") ?? ""),
			});
			if (!result.ok) {
				setErrors(result.fieldErrors ?? {});
				return void toast.error(result.error);
			}
			setErrors({});
			toast.success(result.message);
		});
	}

	const { accepted, rejected, revoked } = privacy.stats;
	const total = accepted + rejected;

	return (
		<>
			<GlassCard>
				<CardHeader>
					<CardTitle className="font-semibold">Consentimento (LGPD)</CardTitle>
					<CardDescription>
						O script do site mostra um banner e só ativa Pixel, GA4 e a captura do track depois
						que a pessoa aceita. Quem recusa não é rastreado, e a compra dela não vai à Meta nem
						ao GA4.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<h3 className="text-sm font-medium">Escolhas nos últimos 30 dias</h3>
					<dl className="-mt-2 grid grid-cols-3 gap-3">
						{[
							{ label: "Aceites", value: accepted },
							{ label: "Recusas", value: rejected },
							{ label: "Revogações", value: revoked },
						].map(item => (
							<div key={item.label} className="rounded-lg border px-3 py-2">
								<dt className="text-muted-foreground text-xs">{item.label}</dt>
								<dd className="num text-lg font-semibold">{item.value}</dd>
							</div>
						))}
					</dl>
					<p className="text-muted-foreground text-xs">
						{total
							? `Taxa de aceite: ${Math.round((accepted / total) * 100)}% das escolhas.`
							: "Nenhuma escolha registrada nos últimos 30 dias."}{" "}
						Cada escolha conta uma vez, e a mesma pessoa pode escolher em mais de um site.
					</p>
					<div className="flex flex-col gap-2">
						<p className="text-sm">
							Coloque no rodapé de todos os sites um link para a pessoa mudar a escolha a
							qualquer momento:
						</p>
						<pre className="bg-muted/50 overflow-x-auto rounded-lg border p-3 font-mono text-xs">
							{PREFERENCES_LINK}
						</pre>
						<CopyButton value={PREFERENCES_LINK} label="Copiar link" className="self-start" />
					</div>
				</CardContent>
			</GlassCard>

			<GlassCard>
				<CardHeader>
					<CardTitle className="font-semibold">Banner de consentimento</CardTitle>
					<CardDescription>
						Campo em branco usa o texto padrão (mostrado em cinza). Escreva em linguagem simples,
						e diga o que é coletado, para quê e com quem é compartilhado.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2" noValidate>
						<Field
							id="version"
							label="Versão do texto"
							hint="Guardada junto de cada escolha. Ao mudar, o banner aparece de novo para TODOS os visitantes: suba a versão só quando mudar o que é coletado ou com quem é compartilhado."
							error={errors.version}
						>
							<Input
								id="version"
								name="version"
								defaultValue={privacy.version}
								className="h-11 font-mono text-sm"
								autoComplete="off"
								spellCheck={false}
							/>
						</Field>
						<Field
							id="policyUrl"
							label="Link da política de privacidade"
							hint="Aparece no banner. Ex.: https://meusite.com.br/privacidade"
							error={errors.policyUrl}
						>
							<Input
								id="policyUrl"
								name="policyUrl"
								type="url"
								defaultValue={privacy.policyUrl}
								placeholder="https://meusite.com.br/privacidade"
								className="h-11 text-sm"
								autoComplete="off"
								spellCheck={false}
							/>
						</Field>
						{SHORT.map(({ key, label }) => (
							<Field key={key} id={`text.${key}`} label={label} error={errors.texts}>
								<Input
									id={`text.${key}`}
									name={`text.${key}`}
									defaultValue={privacy.texts[key] ?? ""}
									placeholder={privacy.defaults[key]}
									className="h-11 text-sm"
									autoComplete="off"
								/>
							</Field>
						))}
						{LONG.map(({ key, label }) => (
							<div key={key} className="md:col-span-2">
								<Field id={`text.${key}`} label={label} error={errors.texts}>
									<Textarea
										id={`text.${key}`}
										name={`text.${key}`}
										defaultValue={privacy.texts[key] ?? ""}
										placeholder={privacy.defaults[key]}
										rows={3}
										className="text-sm"
									/>
								</Field>
							</div>
						))}
						<div className="md:col-span-2">
							<Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending}>
								{pending && <LoaderCircleIcon className="animate-spin" />}
								Salvar privacidade
							</Button>
						</div>
					</form>
				</CardContent>
			</GlassCard>
		</>
	);
}
