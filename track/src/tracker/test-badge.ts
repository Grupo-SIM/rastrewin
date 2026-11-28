/*
 * Faixa do modo teste (montada pelo t.js só no navegador da equipe que abriu ?rw_teste=1).
 * Shadow DOM: o CSS do site não muda a faixa, e a faixa não muda o site. Fica uma camada abaixo do
 * banner de cookies (o banner, quando aberto, passa por cima).
 */

const CSS = `
:host { all: initial; }
.bar {
	position: fixed; z-index: 2147482000; left: 12px; bottom: 12px; max-width: calc(100vw - 24px);
	display: flex; align-items: center; gap: 8px; box-sizing: border-box;
	padding: 8px 12px; border-radius: 12px; border: 1px solid #6b4bb3; background: #1d1430; color: #efe6ff;
	font: 500 12.5px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
	box-shadow: 0 8px 24px rgba(0, 0, 0, .35);
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: #b48cff; flex: none; }
b { font-weight: 700; }
button {
	all: unset; cursor: pointer; margin-left: 4px; padding: 4px 6px; border-radius: 6px;
	color: #cdb6ff; font-weight: 700; text-decoration: underline; white-space: nowrap;
}
button:focus-visible { outline: 2px solid #cdb6ff; outline-offset: 2px; }
`;

/** Mostra a faixa. `onExit` desliga o modo teste. */
export function showTestBadge(onExit: () => void): void {
	if (!document.body || document.getElementById("trck-test")) return;
	const host = document.createElement("div");
	host.id = "trck-test";
	const root = host.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = CSS;
	const bar = document.createElement("div");
	bar.className = "bar";
	bar.setAttribute("role", "status");
	const dot = document.createElement("span");
	dot.className = "dot";
	const label = document.createElement("span");
	const strong = document.createElement("b");
	strong.textContent = "Modo teste";
	label.append(strong, " · nada vai para Meta/GA4");
	const exit = document.createElement("button");
	exit.type = "button";
	exit.textContent = "Sair";
	exit.addEventListener("click", onExit);
	bar.append(dot, label, exit);
	root.append(style, bar);
	document.body.appendChild(host);
}
