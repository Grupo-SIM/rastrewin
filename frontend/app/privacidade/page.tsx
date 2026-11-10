import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CookiePreferencesButton } from "@/components/CookiePreferencesButton";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Política de Privacidade | Rastrewin" };

/*
 * RASCUNHO-BASE da política (LGPD). Descreve o que o sistema faz de fato (banner, track, prazos);
 * revise com um advogado antes de publicar. Pontos a ajustar estão marcados com PERSONALIZAR.
 * Guia do que foi construído: track/docs/lgpd.md.
 */

// PERSONALIZAR: canal do encarregado (DPO). Se nomear um encarregado, preencha ENCARREGADO com o nome.
const CONTACT_EMAIL = "contatosimintermediacoes@gmail.com";
const ENCARREGADO = "";
// PERSONALIZAR: razão social, CNPJ e endereço do controlador (aparecem na seção 1 quando preenchidos).
const CONTROLADOR = { cnpj: "", endereco: "", razaoSocial: "" };
// PERSONALIZAR: mantenha igual à "Versão do texto" do banner (painel do track › Configurações › Privacidade).
const POLICY_VERSION = "1";
const UPDATED_AT = "10 de novembro de 2026";

interface Section {
	title: string;
	body: ReactNode[];
	/** Botão logo depois do texto (ex.: abrir as preferências de cookies). */
	action?: ReactNode;
	list?: ReactNode[];
	table?: { caption: string; head: string[]; rows: string[][] };
	after?: ReactNode[];
}

const link = (href: string, label: string) => (
	<a href={href} style={{ textDecoration: "underline" }}>
		{label}
	</a>
);

const controllerId = [
	CONTROLADOR.razaoSocial,
	CONTROLADOR.cnpj && `CNPJ ${CONTROLADOR.cnpj}`,
	CONTROLADOR.endereco,
]
	.filter(Boolean)
	.join(", ");

const SECTIONS: Section[] = [
	{
		body: [
			`A Rastrewin${controllerId ? ` (${controllerId})` : ""} é a controladora dos dados pessoais tratados por meio do site https://rastrewin.com/, da página de apresentação em https://vsl.rastrewin.com/ e dos serviços digitais associados, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018, "LGPD").`,
			<>
				{ENCARREGADO
					? `O encarregado pelo tratamento de dados pessoais é ${ENCARREGADO}, `
					: "O canal do encarregado pelo tratamento de dados pessoais é "}
				o e-mail {link(`mailto:${CONTACT_EMAIL}`, CONTACT_EMAIL)}.
			</>,
		],
		title: "1. Quem Somos (Controlador)",
	},
	{
		after: [
			"Se você recusar, guardamos apenas a sua escolha (no seu navegador) e um registro anônimo de que ela foi feita, com data, versão deste texto e página. Esse registro não tem IP, navegador ou qualquer dado que identifique você.",
		],
		body: [
			"Tratamos apenas os dados necessários para cada finalidade. Eles chegam até nós de quatro formas:",
		],
		list: [
			"Fornecidos por você no cadastro: nome, e-mail, CPF, telefone (WhatsApp), cidade, chave PIX (quando informada) e o plano escolhido.",
			"Gerados pelo uso do serviço: senha (armazenada somente em formato criptografado, nunca em texto puro), status e vigência da assinatura, participações em sorteios, resultados e registros de verificação do telefone e de recuperação de senha.",
			"Recebidos do gateway de pagamento: identificação do pedido, nome, e-mail e telefone do comprador, valor e situação da cobrança. Não recebemos nem armazenamos dados de cartão.",
			<>
				Coletados na navegação{" "}
				<b>somente se você aceitar &quot;Marketing e medição&quot; no aviso de cookies</b>: um
				identificador aleatório do visitante, as páginas e ações no site (como iniciar o cadastro ou o
				pagamento), a origem da visita (parâmetros de campanha, como utm_source, e o identificador do
				clique em anúncios da Meta), o quanto você assistiu do vídeo de apresentação, o endereço IP e
				o navegador (usados para estimar cidade e estado e para a plataforma de anúncios reconhecer a
				visita) e, quando você se cadastra, e-mail, telefone e nome, para ligar a compra à visita que
				a originou.
			</>,
		],
		title: "2. Dados que Coletamos",
	},
	{
		body: ["Cada finalidade abaixo se apoia em uma base legal prevista na LGPD:"],
		list: [
			"Criar e manter sua conta, liberar o acesso após a confirmação do pagamento e enviar suas credenciais por e-mail — execução de contrato (art. 7º, V).",
			"Processar pagamentos, renovações e cancelamentos — execução de contrato.",
			"Inscrever você em sorteios, apurar vencedores e entrar em contato para a entrega de prêmios, incluindo o uso da chave PIX — execução de contrato.",
			"Confirmar que o telefone cadastrado é seu e recuperar sua senha — prevenção a fraudes e segurança da conta (legítimo interesse, art. 7º, IX).",
			"Medir de onde vêm as visitas e as compras, avaliar nossos anúncios e informar à Meta e ao Google as compras concluídas — consentimento (art. 7º, I), que você dá ou recusa no aviso de cookies e pode revogar a qualquer momento, sem prejuízo do uso do site.",
			"Guardar a prova da sua escolha sobre cookies e atender seus pedidos de acesso e exclusão — cumprimento de obrigação legal (art. 7º, II, e art. 8º, §2º).",
			"Cumprir obrigações legais, fiscais e regulatórias, e exercer direitos em processos judiciais, administrativos ou arbitrais — obrigação legal e exercício regular de direitos (art. 7º, II e VI).",
			"Responder a dúvidas e solicitações enviadas por você — execução de contrato e legítimo interesse.",
		],
		title: "3. Para que Usamos seus Dados e Bases Legais",
	},
	{
		after: [
			"A Meta e o Google tratam esses dados também conforme as políticas de privacidade deles. Quem recusa o aviso de cookies não tem nenhum dado de navegação ou de compra enviado a essas plataformas.",
		],
		body: [
			"Não vendemos nem alugamos seus dados pessoais. O compartilhamento ocorre somente na medida necessária, com:",
		],
		list: [
			<>
				<b>Meta (Facebook e Instagram), só com o seu consentimento:</b> eventos de navegação e de
				compra, pelo Pixel no seu navegador e pela Conversions API no nosso servidor. E-mail,
				telefone, nome, cidade e estado são enviados embaralhados (hash SHA-256), nunca em texto. O
				IP, o navegador e os identificadores da própria Meta (cookies _fbp e _fbc) seguem como são,
				porque a Meta precisa deles para reconhecer a visita.
			</>,
			<>
				<b>Google (Google Analytics), só com o seu consentimento:</b> eventos de navegação, pelo seu
				navegador, e a compra, pelo nosso servidor, com o identificador do próprio Google Analytics, a
				localização aproximada e o tipo de aparelho. Não enviamos e-mail, telefone ou nome ao Google.
			</>,
			"Gateway de pagamento: processa as cobranças e nos informa o resultado.",
			"Provedor de e-mail (SMTP): envia credenciais de acesso, códigos de recuperação de senha e links de confirmação dos pedidos de privacidade.",
			"Provedor de mensagens do WhatsApp: recebe a mensagem que você envia ao nosso número para verificar o telefone.",
			"Provedores de hospedagem e infraestrutura que mantêm o site e os bancos de dados em funcionamento.",
			"Autoridades públicas, quando houver determinação legal ou ordem judicial.",
		],
		title: "4. Com Quem Compartilhamos",
	},
	{
		body: [
			"Quando você é o vencedor de um sorteio, o seu nome pode ser exibido no site como resultado. Não divulgamos publicamente seu CPF, e-mail, telefone ou chave PIX. Se tiver objeções à divulgação do seu nome, entre em contato pelo canal indicado nesta política.",
		],
		title: "5. Exibição Pública de Vencedores",
	},
	{
		action: <CookiePreferencesButton className="btn-dark" label="Abrir preferências de cookies" />,
		after: [
			"Você também pode apagar ou bloquear cookies nas configurações do navegador. Bloquear os necessários pode impedir o login.",
		],
		body: [
			<>
				Na primeira visita, um aviso pergunta se você aceita os cookies de <b>marketing e medição</b>.
				Recusar é tão simples quanto aceitar, e o site funciona do mesmo jeito. Antes da sua escolha,
				nenhum cookie de marketing é gravado e nada é enviado à Meta ou ao Google.
			</>,
			'Você pode mudar de ideia a qualquer momento, pelo botão abaixo ou por "Preferências de cookies" no rodapé do site. Se retirar o consentimento, apagamos os cookies de marketing do seu navegador e paramos de usar os identificadores de marketing ligados a você.',
		],
		table: {
			caption: "Cookies e itens de armazenamento local que usamos",
			head: ["Nome", "De quem", "Para quê", "Duração", "Categoria"],
			rows: [
				["_trck_consent", "Rastrewin", "Guardar a sua escolha sobre cookies", "1 ano", "Necessário"],
				[
					"userId, userToken (armazenamento local)",
					"Rastrewin",
					"Manter você conectado à sua conta",
					"Até você sair",
					"Necessário",
				],
				[
					"_trck (cookie e armazenamento local)",
					"Rastrewin",
					"Identificador aleatório do visitante",
					"400 dias",
					"Marketing e medição",
				],
				[
					"_trck_utm (armazenamento local)",
					"Rastrewin",
					"Origem da visita (campanha)",
					"90 dias",
					"Marketing e medição",
				],
				[
					"_fbp",
					"Meta",
					"Reconhecer o navegador nas campanhas da Meta",
					"90 dias",
					"Marketing e medição",
				],
				[
					"_fbc",
					"Meta",
					"Registrar o clique em um anúncio da Meta",
					"90 dias",
					"Marketing e medição",
				],
				[
					"_ga, _ga_*",
					"Google",
					"Google Analytics (visitas e sessões)",
					"Até 2 anos",
					"Marketing e medição",
				],
			],
		},
		title: "6. Cookies e Armazenamento Local",
	},
	{
		after: [
			"Depois do encerramento ou da exclusão da conta, mantemos apenas o que a lei exige (como pedido, valor e data das compras, para fins fiscais), sem identificar você. Códigos de verificação e de recuperação de senha expiram em minutos.",
		],
		body: [
			"Mantemos os dados da sua conta enquanto ela estiver ativa e pelo tempo necessário às finalidades acima. Os demais dados têm prazos fixos, aplicados automaticamente todos os dias:",
		],
		table: {
			caption: "Prazos de retenção",
			head: ["Dado", "Prazo", "Depois do prazo"],
			rows: [
				["Conteúdo técnico enviado à Meta e ao Google em cada evento", "14 dias", "Apagado"],
				["Endereço IP e navegador", "90 dias", "Apagados"],
				[
					"Cópia bruta da confirmação de pagamento (traz nome, e-mail e telefone)",
					"90 dias",
					"Apagada",
				],
				[
					"Dados de navegação de quem não volta ao site (identificadores e e-mail)",
					"13 meses sem atividade",
					"Apagados",
				],
				[
					"Dados pessoais ligados às compras",
					"5 anos",
					"Anonimizados (valor e data ficam, sem identificar você)",
				],
				["Registro das suas escolhas de cookies", "5 anos", "Apagado"],
				["Pedidos de acesso e links de confirmação não usados", "30 dias", "Apagados"],
			],
		},
		title: "7. Por Quanto Tempo Guardamos",
	},
	{
		body: [
			"Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda, alteração ou divulgação indevida, entre elas: senhas armazenadas com hash, credenciais de integração cifradas, dados de contato enviados às plataformas de anúncios somente embaralhados (hash), acesso aos painéis restrito e controlado por permissões no banco de dados, e limitação de tentativas nas operações sensíveis.",
			"Nenhum sistema é totalmente imune a incidentes. Se ocorrer um incidente de segurança que possa causar risco ou dano relevante a você, comunicaremos você e a Autoridade Nacional de Proteção de Dados (ANPD) nos termos da lei.",
		],
		title: "8. Segurança",
	},
	{
		body: ["Conforme o art. 18 da LGPD, você pode solicitar a qualquer momento:"],
		list: [
			"confirmação de que tratamos seus dados e acesso a eles;",
			"correção de dados incompletos, inexatos ou desatualizados;",
			"anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei;",
			"portabilidade dos dados, mediante requisição expressa;",
			"eliminação dos dados tratados com base no seu consentimento;",
			"informações sobre com quais entidades compartilhamos seus dados;",
			"informação sobre a possibilidade de não fornecer consentimento e suas consequências, e revogação do consentimento;",
			"oposição a tratamento realizado com base em outra hipótese legal, em caso de descumprimento da LGPD;",
			"revisão de decisões tomadas unicamente de forma automatizada que afetem seus interesses.",
		],
		title: "9. Seus Direitos como Titular",
	},
	{
		body: [
			<>
				<b>Ver ou excluir seus dados:</b> use o formulário em{" "}
				{link("/privacidade/solicitacao", "rastrewin.com/privacidade/solicitacao")}. Para confirmar
				que o pedido é seu, enviamos um link ao e-mail informado; ao confirmar, você vê seus dados na
				hora (com download em arquivo) ou a exclusão é feita na hora.
			</>,
			<>
				<b>Retirar o consentimento de cookies:</b> use &quot;Preferências de cookies&quot;, no rodapé
				do site ou na seção 6.
			</>,
			<>
				<b>Outros pedidos</b> (correção, portabilidade, oposição, informações) ou se você só tem o
				telefone: escreva para {link(`mailto:${CONTACT_EMAIL}`, CONTACT_EMAIL)}. Podemos pedir
				informações para confirmar sua identidade. Respondemos em até 15 dias.
			</>,
			"Limites da exclusão, com transparência: pedido, valor e data das compras ficam guardados sem identificar você, por obrigação fiscal; os dados já enviados ao Google Analytics são apagados por nós lá em até 15 dias; a Meta não oferece forma de apagar eventos que já recebeu — eles foram enviados com e-mail, telefone e nome embaralhados (hash).",
			<>
				Você também pode apresentar reclamação à ANPD (
				{link("https://www.gov.br/anpd", "www.gov.br/anpd")}).
			</>,
		],
		title: "10. Como Exercer seus Direitos",
	},
	{
		body: [
			"Nossos serviços são destinados a maiores de 18 anos. Não coletamos intencionalmente dados de menores. Se identificarmos um cadastro de menor de idade, a conta poderá ser encerrada e os dados excluídos, ressalvadas as obrigações legais.",
		],
		title: "11. Crianças e Adolescentes",
	},
	{
		body: [
			"A Meta e o Google, quando você consente com os cookies de marketing e medição, e alguns provedores de infraestrutura podem armazenar ou processar dados fora do Brasil, inclusive nos Estados Unidos. Nesses casos, buscamos garantir um nível de proteção compatível com o da LGPD, por meio de cláusulas contratuais e de provedores que adotem padrões adequados de segurança e privacidade.",
		],
		title: "12. Transferência Internacional",
	},
	{
		body: [
			"Podemos atualizar esta política para refletir mudanças nos serviços ou na legislação. A versão mais recente fica sempre nesta página, com a data e o número da versão. Quando mudarmos o que coletamos na navegação ou com quem compartilhamos, o aviso de cookies pede a sua escolha de novo.",
		],
		title: "13. Alterações desta Política",
	},
];

const textStyle = { color: "var(--txt-2)", font: "500 16px/1.7 var(--f-body)" } as const;

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
	return (
		<div className="priv-table-wrap">
			<table className="priv-table policy-table">
				<caption className="sr-only">{caption}</caption>
				<thead>
					<tr>
						{head.map(h => (
							<th key={h}>{h}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map(r => (
						<tr key={r[0]}>
							{r.map((c, i) => (
								<td key={i} data-label={head[i]}>
									{c}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export default function Privacy() {
	return (
		<div className="auth-page">
			<div className="auth-frame">
				<nav className="nav">
					<a href="/">
						<Logo />
					</a>
					<a
						href="/"
						className="nav-hide"
						style={{ color: "var(--txt-2)", font: "500 15.5px var(--f-body)", paddingRight: 16 }}
					>
						Voltar ao início
					</a>
				</nav>
				<main
					style={{
						display: "grid",
						gap: 28,
						gridTemplateColumns: "minmax(0, 1fr)",
						margin: "0 auto",
						maxWidth: 760,
						padding: "56px 20px 72px",
						width: "100%",
					}}
				>
					<h1 className="display" style={{ fontSize: "clamp(36px, 6vw, 56px)", lineHeight: 1.05 }}>
						Política de{" "}
						<span className="accent" style={{ fontSize: "1.14em" }}>
							Privacidade
						</span>{" "}
						da Rastrewin
					</h1>
					<p style={{ color: "var(--txt-2)", font: "500 14px/1.6 var(--f-body)" }}>
						Versão {POLICY_VERSION} · última atualização: {UPDATED_AT}.
					</p>
					<p style={{ color: "var(--txt-2)", font: "500 17px/1.65 var(--f-body)" }}>
						Esta política explica, de forma clara, quais dados pessoais a Rastrewin coleta quando
						você usa o site {link("https://rastrewin.com/", "https://rastrewin.com/")}, por que os
						coleta, como os protege, com quem os compartilha, por quanto tempo os guarda e quais
						são os seus direitos, em conformidade com a LGPD.
					</p>
					<p style={{ color: "var(--txt-2)", font: "500 17px/1.65 var(--f-body)" }}>
						Ela deve ser lida em conjunto com os nossos {link("/termos", "Termos de Uso")}.
					</p>
					{SECTIONS.map(s => (
						<section key={s.title} style={{ display: "grid", gap: 12, minWidth: 0 }}>
							<h2 className="display" style={{ fontSize: 26 }}>
								{s.title}
							</h2>
							{s.body.map((p, i) => (
								<p key={i} style={textStyle}>
									{p}
								</p>
							))}
							{s.action && <div style={{ justifySelf: "start" }}>{s.action}</div>}
							{s.list && (
								<ul
									style={{
										...textStyle,
										display: "grid",
										gap: 8,
										listStyle: "disc",
										paddingLeft: 22,
									}}
								>
									{s.list.map((item, i) => (
										<li key={i}>{item}</li>
									))}
								</ul>
							)}
							{s.table && <Table {...s.table} />}
							{s.after?.map((p, i) => (
								<p key={`after-${i}`} style={textStyle}>
									{p}
								</p>
							))}
						</section>
					))}
					<section
						style={{
							borderTop: "1px solid var(--line)",
							display: "grid",
							gap: 12,
							paddingTop: 28,
						}}
					>
						<h2 className="display" style={{ fontSize: 26 }}>
							Fale com a Gente
						</h2>
						<p style={textStyle}>
							Para exercer seus direitos ou tirar dúvidas sobre esta política e o tratamento dos
							seus dados, use o {link("/privacidade/solicitacao", "formulário de privacidade")}{" "}
							ou escreva para {link(`mailto:${CONTACT_EMAIL}`, CONTACT_EMAIL)}.
						</p>
					</section>
				</main>
			</div>
		</div>
	);
}
