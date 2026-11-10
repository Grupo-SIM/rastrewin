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

## 3. Minimização: o que vai para a Meta e o Google

- **Meta (Conversions API):**
    - Vão em **SHA-256**: email, telefone, nome, sobrenome, cidade, estado, país e o id do visitante (`external_id`).
    - Vão **sem hash**, porque a Meta exige assim: IP, navegador (user agent), `fbp` e `fbc`, que são identificadores da própria Meta.
    - Um teste automático (`src/lib/meta/capi.test.ts`) garante que nenhum email, telefone, nome ou cidade sai em claro.
- **Google (GA4):**
    - Os eventos do site vão pela gtag no navegador, e só depois do aceite.
    - A compra vai pelo Measurement Protocol com o `client_id` do próprio GA, a compra (pedido, valor, itens), o local aproximado (país, estado e cidade) e o tipo de aparelho. **Nenhum** email, telefone ou nome, nem em hash. Teste em `src/lib/ga4/mp.test.ts`.
- **Só com consentimento:** sem o aceite de marketing, nada vai a nenhuma das duas (seção 1).
- **No banco do track:**
    - O email do visitante fica em texto, para a busca no painel. Telefone e nome ficam só em hash.
    - O registro de consentimento não guarda IP nem navegador.
    - O link de origem (`referrer`) é guardado sem parâmetros.

## 4. Retenção: por quanto tempo cada dado fica

A limpeza roda todo dia a partir das 03:15 (Brasília), dentro do app. O painel mostra a última execução e as contagens em Configurações › Geral › Manutenção e servidor.

| Dado                                                                     | Prazo                      | O que acontece                                                                          |
| ------------------------------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------- |
| Conteúdo enviado e recebido da Meta e do GA4 em cada evento              | 14 dias                    | apagado (o evento fica)                                                                 |
| IP e navegador dos eventos e dos visitantes                              | 90 dias                    | apagados                                                                                |
| Corpo bruto do webhook de vendas (traz email, nome e telefone)           | 90 dias                    | apagado                                                                                 |
| Visitante sem atividade (email, hashes, ids da Meta e do Google, origem) | 13 meses                   | apagado; eventos e plays ficam ligados só a um id aleatório que não aponta para ninguém |
| Dados pessoais nas vendas (email, hashes, ids de marketing, cidade)      | 5 anos                     | anonimizados; valor, data, status, produto e campanha ficam                             |
| Prova de consentimento (cada escolha no banner)                          | 5 anos                     | apagada                                                                                 |
| Hash de quem pediu exclusão                                              | 30 dias                    | apagado (ficam data e contagens)                                                        |
| Pedidos de acesso e links não confirmados (backend)                      | 30 dias                    | apagados                                                                                |
| Sessões de login vencidas, cache de campanhas, histórico da limpeza      | 1 dia / 30 dias / 180 dias | apagados                                                                                |

**PERSONALIZAR:** os prazos ficam numa constante só, `RETENTION_DAYS` em `track/src/lib/maintenance/retention.ts`. Ao mudar um prazo, atualize a política de privacidade. Por que estes prazos:

- **90 dias de IP:** cobre a atribuição de compras (a Meta aceita até 7 dias) e investigações de fraude ou erro de integração.
- **13 meses de visitante:** cobre um ciclo anual de campanhas, como a Black Friday de um ano comparada com a do seguinte.
- **5 anos nas vendas:** prazo usual de guarda de registros fiscais e de defesa em processos. Confirme com o seu contador.
- **5 anos de prova de consentimento:** o controlador precisa provar o consentimento (art. 8º, §2º) pelo prazo em que pode ser cobrado.

Teste: `bun run test:retention` (Postgres descartável). Ele cria dados velhos e novos de cada tipo e confere que só os velhos são limpos.

## 5. Política de privacidade (rascunho)

A página fica em **rastrewin.com/privacidade** (`frontend/app/privacidade/page.tsx`) e descreve o que o sistema faz de fato:

- dados coletados, com a navegação só depois do aceite;
- bases legais: consentimento para marketing e medição;
- o que vai para a Meta e o Google, e como;
- tabela de cookies;
- tabela de prazos (seção 4 deste guia);
- direitos, com o formulário e os limites honestos (fiscal, Meta e GA4);
- transferência internacional;
- versão do texto.

Os Termos de Uso (seção 5) foram alinhados: antes falavam em "informações anônimas".

## Checklist do que personalizar antes de publicar

| #   | O quê                                                  | Onde                                                                                                                                 |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Razão social, CNPJ e endereço do controlador           | `CONTROLADOR` em `frontend/app/privacidade/page.tsx` (aparece na seção 1 quando preenchido)                                          |
| 2   | Encarregado (DPO): nome, se houver, e o email do canal | `ENCARREGADO` e `CONTACT_EMAIL` na política **e** `CONTACT_EMAIL` em `frontend/app/privacidade/solicitacao/page.tsx`                 |
| 3   | Versão e data da política                              | `POLICY_VERSION` e `UPDATED_AT` na política. A versão deve ser **igual** à "Versão do texto" do painel (Configurações › Privacidade) |
| 4   | Link da política no banner                             | Painel do track › Configurações › Privacidade › `https://rastrewin.com/privacidade`                                                  |
| 5   | Textos do banner                                       | Mesmo lugar (vazio = padrão)                                                                                                         |
| 6   | Visual do banner                                       | CSS do site (`#trck-consent { --trck-… }`)                                                                                           |
| 7   | Prazos de retenção (e a tabela da política)            | `RETENTION_DAYS` em `track/src/lib/maintenance/retention.ts` **e** seção 7 da política                                               |
| 8   | Prazo de 5 anos das vendas                             | Confirmar com o contador                                                                                                             |
| 9   | Promessa de apagar no GA4 "em até 15 dias"             | Cumprir pelo painel (Exclusões de dados) ou mudar o texto (política seção 10 e página de confirmação)                                |
| 10  | Lista de provedores e países                           | Política, seções 4 e 12                                                                                                              |
| 11  | Revisão jurídica do texto todo                         | Política, Termos, banner e emails                                                                                                    |

## Ordem para publicar

1. Aplicar no banco de produção do track as migrations `0010_consent`, `0011_privacy_erasures` e `0012_retention_lgpd` (`docker compose --profile tools run --rm migrate`). Sem elas, o track novo quebra.
2. Publicar o track. A partir daí, o banner aparece e nada de marketing roda sem aceite.
3. Publicar o backend. O `db push` do container cria a tabela `PrivacyRequest`.
4. Publicar o frontend e a VSL (formulário, política, links do rodapé).
5. No painel do track (Configurações › Privacidade), conferir o link da política e a versão do texto.
