import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Política de Privacidade | Rastrewin" };

const CONTACT_EMAIL = "contatosimintermediacoes@gmail.com";

const SECTIONS: { title: string; body: string[]; list?: string[] }[] = [
	{
		body: [
			'A Rastrewin é a controladora dos dados pessoais tratados por meio do site https://rastrewin.com/ e dos serviços digitais a ele associados, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018, "LGPD"). O canal para qualquer assunto relacionado a dados pessoais é o e-mail indicado ao final desta política.',
		],
		title: "1. Quem Somos (Controlador)",
	},
	{
		body: [
			"Tratamos apenas os dados necessários para prestar o serviço. Eles chegam até nós de três formas:",
		],
		list: [
			"Fornecidos por você no cadastro: nome, e-mail, CPF, telefone (WhatsApp), cidade, chave PIX (quando informada) e o plano escolhido.",
			"Gerados pelo uso do serviço: senha (armazenada somente em formato criptografado, nunca em texto puro), status e data de vigência da assinatura, participações em sorteios, resultados e registros de verificação do telefone e de recuperação de senha.",
			"Recebidos de terceiros: confirmações de pagamento enviadas pelo gateway de pagamento (identificação do pedido, e-mail do comprador e situação da cobrança). Não recebemos nem armazenamos dados de cartão de crédito.",
		],
		title: "2. Dados que Coletamos",
	},
	{
		body: ["Cada finalidade abaixo se apoia em uma base legal prevista no art. 7º da LGPD:"],
		list: [
			"Criar e manter sua conta, liberar o acesso após a confirmação do pagamento e enviar suas credenciais por e-mail — execução de contrato.",
			"Processar pagamentos, renovações e cancelamentos da assinatura — execução de contrato.",
			"Inscrever você em sorteios, apurar vencedores e entrar em contato para entrega de prêmios, incluindo o uso da chave PIX — execução de contrato.",
			"Confirmar que o telefone cadastrado é seu, por meio de código enviado ao nosso WhatsApp, e recuperar sua senha por código enviado por e-mail — prevenção a fraudes e garantia da segurança da conta (legítimo interesse).",
			"Cumprir obrigações legais, fiscais e regulatórias, e exercer direitos em processos judiciais, administrativos ou arbitrais — cumprimento de obrigação legal e exercício regular de direitos.",
			"Responder a dúvidas e solicitações enviadas por você — execução de contrato e legítimo interesse.",
		],
		title: "3. Para que Usamos seus Dados e Bases Legais",
	},
	{
		body: [
			"Não vendemos nem alugamos seus dados pessoais. O compartilhamento ocorre somente na medida necessária para operar o serviço, com:",
		],
		list: [
			"Gateway de pagamento (simpay): processa as cobranças e nos informa o resultado.",
			"Provedor de e-mail (SMTP): envia credenciais de acesso e códigos de recuperação de senha.",
			"Provedor de mensagens do WhatsApp: recebe a mensagem que você envia ao nosso número para verificar o telefone e nos entrega o número remetente e o texto.",
			"Provedores de hospedagem e infraestrutura que mantêm o site e o banco de dados em funcionamento.",
			"Autoridades públicas, quando houver determinação legal ou ordem judicial.",
		],
		title: "4. Com Quem Compartilhamos",
	},
	{
		body: [
			"Quando você é o vencedor de um sorteio, o seu nome pode ser exibido no site como resultado do sorteio. Não divulgamos publicamente seu CPF, e-mail, telefone ou chave PIX. Se tiver objeções à divulgação do seu nome, entre em contato pelo canal indicado nesta política.",
		],
		title: "5. Exibição Pública de Vencedores",
	},
	{
		body: [
			'O site armazena no seu navegador, por meio do armazenamento local (localStorage), o identificador da sua conta e o token de sessão, estritamente para mantê-lo autenticado. Esses itens são removidos quando você clica em "Sair" e você também pode apagá-los a qualquer momento nas configurações do navegador, o que exigirá novo login.',
			"No momento, não utilizamos cookies de publicidade nem ferramentas de rastreamento de terceiros para criar perfis de comportamento. Caso isso mude, atualizaremos esta política antes de começar. Os Termos de Uso também tratam de cookies e informações de navegação.",
		],
		title: "6. Cookies e Armazenamento Local",
	},
	{
		body: [
			"Mantemos seus dados enquanto a conta estiver ativa e pelo tempo necessário para cumprir as finalidades acima. Depois do encerramento ou da exclusão da conta, podemos reter apenas o que for exigido para cumprimento de obrigações legais e regulatórias, prevenção a fraudes e defesa em eventuais disputas, pelos prazos aplicáveis. Encerrado esse período, os dados são excluídos ou anonimizados.",
			"Códigos de verificação e de recuperação de senha são temporários e expiram após curto período ou após o uso.",
		],
		title: "7. Por Quanto Tempo Guardamos",
	},
	{
		body: [
			"Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda, alteração ou divulgação indevida, entre elas: senhas armazenadas com hash, códigos temporários protegidos, autenticação por token, limitação de tentativas na recuperação de senha e acesso administrativo restrito.",
			"Nenhum sistema é totalmente imune a incidentes. Se ocorrer um incidente de segurança que possa causar risco ou dano relevante a você, comunicaremos você e a Autoridade Nacional de Proteção de Dados (ANPD) nos termos da lei. Mantenha sua senha em sigilo e avise-nos caso suspeite de uso indevido da sua conta.",
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
			"eliminação dos dados tratados com base no seu consentimento, quando aplicável;",
			"informações sobre com quais entidades compartilhamos seus dados;",
			"informação sobre a possibilidade de não fornecer consentimento e suas consequências, e revogação do consentimento;",
			"oposição a tratamento realizado com base em outra hipótese legal, em caso de descumprimento da LGPD;",
			"revisão de decisões tomadas unicamente de forma automatizada que afetem seus interesses.",
		],
		title: "9. Seus Direitos como Titular",
	},
	{
		body: [
			"Envie sua solicitação para o e-mail indicado ao final desta política, a partir do endereço cadastrado na sua conta. Para sua segurança, podemos pedir informações adicionais para confirmar sua identidade antes de atender ao pedido. Responderemos dentro do prazo legal. Alguns dados poderão ser mantidos quando a lei exigir sua guarda. Você também pode apresentar reclamação à ANPD (www.gov.br/anpd).",
		],
		title: "10. Como Exercer seus Direitos",
	},
	{
		body: [
			"Nossos serviços são destinados a maiores de 18 anos. Não coletamos intencionalmente dados de menores. Se identificarmos um cadastro de menor de idade, a conta poderá ser encerrada e os dados excluídos, ressalvadas as obrigações legais. Se você acredita que isso ocorreu, avise-nos.",
		],
		title: "11. Crianças e Adolescentes",
	},
	{
		body: [
			"Alguns dos provedores que utilizamos podem armazenar ou processar dados fora do Brasil. Nesses casos, buscamos garantir um nível de proteção compatível com o da LGPD, por meio de cláusulas contratuais e de provedores que adotem padrões adequados de segurança e privacidade.",
		],
		title: "12. Transferência Internacional",
	},
	{
		body: [
			"Podemos atualizar esta política para refletir mudanças nos serviços ou na legislação. A versão mais recente ficará sempre disponível nesta página, com a data de atualização. Em caso de mudanças relevantes, faremos o possível para avisá-lo pelos meios de contato cadastrados.",
		],
		title: "13. Alterações desta Política",
	},
];

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
						margin: "0 auto",
						maxWidth: 760,
						padding: "56px 20px 72px",
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
						Última atualização: 4 de novembro de 2026.
					</p>
					<p style={{ color: "var(--txt-2)", font: "500 17px/1.65 var(--f-body)" }}>
						Esta política explica, de forma clara, quais dados pessoais a Rastrewin coleta quando
						você usa o site{" "}
						<a href="https://rastrewin.com/" style={{ textDecoration: "underline" }}>
							https://rastrewin.com/
						</a>
						, por que os coleta, como os protege, com quem os compartilha e quais são os seus
						direitos, em conformidade com a LGPD.
					</p>
					<p style={{ color: "var(--txt-2)", font: "500 17px/1.65 var(--f-body)" }}>
						Ao criar uma conta ou usar nossos serviços, você declara ter lido esta política. Ela
						deve ser lida em conjunto com os nossos{" "}
						<a href="/termos" style={{ textDecoration: "underline" }}>
							Termos de Uso
						</a>
						.
					</p>
					{SECTIONS.map(s => (
						<section key={s.title} style={{ display: "grid", gap: 12 }}>
							<h2 className="display" style={{ fontSize: 26 }}>
								{s.title}
							</h2>
							{s.body.map((p, i) => (
								<p
									key={i}
									style={{ color: "var(--txt-2)", font: "500 16px/1.7 var(--f-body)" }}
								>
									{p}
								</p>
							))}
							{s.list && (
								<ul
									style={{
										color: "var(--txt-2)",
										display: "grid",
										font: "500 16px/1.7 var(--f-body)",
										gap: 8,
										listStyle: "disc",
										paddingLeft: 22,
									}}
								>
									{s.list.map(item => (
										<li key={item}>{item}</li>
									))}
								</ul>
							)}
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
						<p style={{ color: "var(--txt-2)", font: "500 16px/1.7 var(--f-body)" }}>
							Para exercer seus direitos ou tirar dúvidas sobre esta política e o tratamento dos
							seus dados, escreva para{" "}
							<a href={`mailto:${CONTACT_EMAIL}`} style={{ textDecoration: "underline" }}>
								{CONTACT_EMAIL}
							</a>
							.
						</p>
					</section>
				</main>
			</div>
		</div>
	);
}
