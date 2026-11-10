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
