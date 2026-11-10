# LGPD no rastreamento — o que existe e o que personalizar

Este guia é a **base** de conformidade com a LGPD (Lei 13.709/2018) do rastreamento da Rastrewin: track, `t.js`, rastrewin.com e VSL. Ele descreve o que o sistema faz e marca com **PERSONALIZAR** o que você precisa ajustar ao seu produto e ao seu público.

> Não é parecer jurídico. Os textos são um rascunho honesto, com base na LGPD e no guia de cookies da ANPD. Revise a política e o banner com um advogado antes de publicar.

## 1. Consentimento (banner de cookies)

### Como funciona

- O `t.js` mostra um banner em todos os sites que o carregam (VSL e rastrewin.com).
- Opções:
    - **Recusar** e **Aceitar todos**, com o mesmo destaque, já na primeira tela;
    - **Preferências**, com duas categorias:
        - **Necessários:** só o cookie que guarda a escolha. Não identifica a pessoa e não pode ser desligado.
        - **Marketing e medição:** identificador do visitante, origem da visita (UTMs e clique no anúncio), páginas e eventos, progresso do vídeo, Pixel da Meta e Google Analytics.
- **Antes do aceite, nada de marketing ou medição roda:**
    - nenhum cookie `_trck`, `_fbp` ou `_fbc`, e nenhuma UTM é guardada;
    - o Pixel e o GA4 não são carregados;
    - o track não recebe evento nenhum.
    - Comandos `trck(...)` do site feitos antes do aceite são descartados (não ficam em fila).
- **Recusou:** continua assim. A compra dessa pessoa entra no Faturamento, mas **não** vai à Meta nem ao GA4. O painel mostra "Sem consentimento".
- **Mudou de ideia:** o link "Preferências de cookies" no rodapé reabre o banner.
    - Quem tinha aceitado e agora recusa tem a escolha registrada como **revogação**.
    - Os cookies de marketing do navegador são apagados, e os identificadores da Meta e do Google daquele visitante são apagados no track.
- **Prova do consentimento** (LGPD art. 8º): cada escolha fica na tabela `consent_records` com:
    - um id aleatório da escolha;
    - a ação (aceite, recusa, personalizada ou revogação);
    - a **versão do texto**, o site e a página (sem parâmetros).
    - Não guarda IP nem navegador.
    - O painel mostra os totais dos últimos 30 dias em Configurações › Privacidade.

### Onde personalizar

| O quê                                                | Onde                                                                                                                                 | Observação                                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Textos do banner (título, texto, botões, categorias) | Painel do track › Configurações › Privacidade                                                                                        | Campo vazio usa o padrão do código (`src/lib/privacy/consent-texts.ts`). **PERSONALIZAR** com a linguagem do seu público.                                     |
| Link da política de privacidade                      | Mesmo lugar                                                                                                                          | Use o endereço final da sua política.                                                                                                                         |
| Versão do texto                                      | Mesmo lugar                                                                                                                          | Suba a versão quando mudar **o que** é coletado ou **com quem** é compartilhado: o banner aparece de novo para todo mundo. Correção de digitação não precisa. |
| Visual do banner (cores, fonte, cantos)              | CSS do site: `#trck-consent { --trck-bg: …; --trck-fg: …; --trck-accent: …; --trck-accent-fg: …; --trck-font: …; --trck-radius: … }` | Padrão neutro, com modo claro e escuro automáticos.                                                                                                           |
| Validade da escolha                                  | `CONSENT_DAYS` em `src/tracker/trck.ts` (hoje 365 dias)                                                                              | Depois disso a pessoa é perguntada de novo.                                                                                                                   |
| Banner próprio do site                               | Atributo `data-no-banner` na tag do `t.js` + `trck('consent', { marketing: true \| false })`                                         | Para quem já usa outra ferramenta de consentimento.                                                                                                           |
| Link "Preferências de cookies"                       | Rodapé de cada site: `trck('consent', 'open')`                                                                                       | Já está no rastrewin.com e na VSL. Coloque em qualquer site novo.                                                                                             |

### Limites honestos

- Visitantes de **antes do banner** contam como "sem consentimento" até aceitarem: compras deles não vão à Meta/GA4. Os dados antigos continuam no banco e seguem a retenção (Parte 4).
- Se o site carregar o Pixel ou a gtag por conta própria (`data-no-pixel`/`data-no-ga`), **o site** é quem precisa esperar o aceite para carregar. O `t.js` só avisa a Meta e o Google da escolha (`fbq('consent', …)`, Consent Mode do Google).
- Quem recusa deixa de ser medido. Os números do painel e das plataformas passam a contar só quem aceitou: é o efeito esperado do consentimento.

## 2. Direitos da pessoa: acesso e exclusão

### Como funciona

1. A pessoa abre **rastrewin.com/privacidade/solicitacao**, escolhe **Ver meus dados** ou **Excluir meus dados** e informa o email (o telefone é opcional).
2. O backend manda um **link de confirmação** para esse email:
    - vale por 30 minutos e só pode ser usado uma vez;
    - o token é guardado só como HMAC;
    - a resposta da tela é sempre a mesma, para não revelar quem é cliente;
    - há limite de pedidos por IP e por email (no máximo um link a cada 2 minutos e 5 por dia).
3. No link, a pessoa clica em **Confirmar pedido**. Só abrir o link não executa nada: programas de email costumam abrir links sozinhos para checar segurança.
4. **Acesso:** a página mostra e permite baixar em `.json`:
    - o cadastro (sem senha nem códigos);
    - a assinatura e os sorteios;
    - os identificadores de navegação, os eventos e os vídeos;
    - as compras, dizendo se foram enviadas à Meta e ao Google;
    - as escolhas de cookies.
5. **Exclusão:**
    - **No track:** apaga visitante, eventos e plays de vídeo. Anonimiza as compras: ficam pedido, valor, data, status, produto e campanha, sem identificar a pessoa. Apaga o conteúdo bruto do webhook e desliga a pessoa dos registros de consentimento (a prova continua, anônima).
    - **No backend:** anonimiza o cadastro (nome, email, CPF, telefone, cidade, PIX, origem da visita), apaga a senha e os códigos, encerra o acesso e apaga as participações em sorteios. Num sorteio que ela ganhou, o nome vira "Participante". Plano, data de pagamento e número do pedido ficam (obrigação fiscal).
    - **O próprio pedido** de exclusão perde o email e fica só como prova (data e contagens).
    - Por **30 dias**, uma venda que ainda estava a caminho para o mesmo email ou telefone chega já anonimizada. Depois disso, quem se cadastrar de novo é tratado como pessoa nova.
6. **GA4:** o painel do track (Configurações › Privacidade › Exclusões de dados) lista os `client_id` daquela pessoa no GA4.
    - Apague cada um em **GA4 › Explorar › Explorador de usuários › Excluir usuário**.
    - Depois clique em **Concluído no GA4**, e a lista é apagada do painel.

### Onde personalizar

| O quê                                                         | Onde                                                                                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Email de contato do encarregado (formulário)                  | `CONTACT_EMAIL` em `frontend/app/privacidade/solicitacao/page.tsx` (**PERSONALIZAR**; use o mesmo da política).         |
| Textos do formulário e da página de resultado                 | `frontend/app/privacidade/solicitacao/page.tsx` e `.../confirmar/page.tsx`                                              |
| Texto do email de confirmação                                 | `sendPrivacyConfirmation` em `backend/src/email/email.service.ts`                                                       |
| O que é apagado ou mantido no cadastro                        | `PrivacyService.erase` em `backend/src/privacy/privacy.service.ts` (hoje: anonimiza e mantém plano, pagamento e pedido) |
| O que é apagado ou mantido no tracking                        | `eraseSubject` em `track/src/lib/privacy/subject.ts`                                                                    |
| Validade do link, limites e por quanto tempo os pedidos ficam | constantes no topo de `privacy.service.ts` e `privacy.controller.ts`                                                    |

### Limites honestos

- **Meta:** não existe forma de apagar eventos que a Conversions API já recebeu. Eles foram enviados com email, telefone e nome em hash. A política avisa isso.
- **GA4:** a exclusão lá é **manual** (painel do track → Explorador de usuários do GA4). A página de resultado promete que isso é feito "nos próximos dias": **cumpra**, ou troque o texto.
- **Só o telefone:** sem email não há como confirmar a identidade automaticamente. O formulário manda a pessoa escrever ao encarregado, e o atendimento é manual.
- **Prazo legal:** a LGPD prevê resposta em até 15 dias para o acesso completo (art. 19). Pelo formulário a resposta é imediata. Pedidos por email ao encarregado seguem o prazo.
- **Correção de dados** (art. 18, III) não tem tela: hoje é pelo contato do encarregado (ou pela área do cliente, para quem tem conta).
- O limite por IP do backend usa o cabeçalho `X-Real-IP` do proxy. Se o proxy da API não enviar esse cabeçalho, todos os pedidos parecem vir do mesmo IP, e o limite fica coletivo.
