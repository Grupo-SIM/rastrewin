# Usuários e níveis de acesso do painel

Guia da aba **Usuários** (`/painel/usuarios`): quem pode fazer o quê, como cadastrar pessoas, o que o Colaborador enxerga e como recuperar o acesso se a senha do administrador se perder. No fim, as regras para quem mexe no código.

## Os dois níveis

|                                                                             | Administrador ("Acesso total") | Colaborador ("Acesso limitado")                        |
| --------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------ |
| Visão geral, Eventos, Faturamento, Campanhas, Páginas, Vídeos, Geo          | Sim                            | Sim                                                    |
| Jornada do visitante, detalhes de eventos e vendas                          | Sim                            | Sim, com dados de clientes **mascarados**              |
| Atualizar dados de campanhas                                                | Sim                            | Sim                                                    |
| Dados brutos da venda (webhook)                                             | Sim                            | Não                                                    |
| Buscar venda por e-mail (Faturamento)                                       | Sim                            | Não (busca por pedido e produto)                       |
| Configurações (contas da Meta e do GA4, webhook, sites, privacidade, Saúde) | Sim                            | Não: o menu some e o endereço volta para a Visão geral |
| Faixa de saúde no topo                                                      | Sim                            | Não                                                    |
| Usuários                                                                    | Sim                            | Não                                                    |

Os níveis são fixos: não há permissões soltas para configurar errado. Quem já tinha login antes desta aba virou Administrador; quem é criado depois começa como Colaborador.

## Usar a aba

- **Adicionar usuário:** nome, e-mail, senha e nível. Você define a senha (mínimo de 12 caracteres). Use **Gerar senha forte** e **Copiar**, e passe a senha para a pessoa por um canal seguro (não por e-mail aberto num grupo). Não existe senha temporária nem e-mail automático.
- **Editar:** nome, e-mail e nível de outra pessoa. Uma mudança de nível vale no próximo clique da pessoa, sem precisar sair e entrar.
- **Redefinir senha:** você digita (ou gera) a senha nova. A pessoa é **desconectada de todos os aparelhos** na hora.
- **Desativar:** a pessoa é desconectada na hora e, ao tentar entrar, vê "Conta desativada. Fale com o administrador.". **Reativar** devolve o acesso com a mesma senha.
- **Excluir:** apaga o login e as sessões. Não pode ser desfeito. Os dados de eventos e vendas não mudam (nenhum deles pertence a um usuário do painel).
- **Ações em massa:** marque as caixas e use Tornar Administrador, Tornar Colaborador, Ativar, Desativar ou Excluir.
- **Na sua própria linha:** Editar só muda o nome, e **Trocar senha** pede a senha atual e desconecta os seus outros aparelhos.

### Travas (valem mesmo se alguém tentar chamar o servidor direto)

- Ninguém muda o próprio nível, nem se desativa, nem se exclui.
- O painel nunca fica sem pelo menos um Administrador ativo.
- Quem faz a ação precisa continuar Administrador no momento de gravar: se dois administradores tentarem rebaixar um ao outro ao mesmo tempo, só um consegue.
- O login aceita 5 tentativas por minuto por IP.

## O que o Colaborador vê dos clientes

Os dados saem **mascarados do servidor**: o dado completo nunca chega ao navegador dele.

| Dado     | Administrador          | Colaborador            |
| -------- | ---------------------- | ---------------------- |
| Nome     | Marina Alves           | M\*\*\*\*\* A\*\*\*\*  |
| E-mail   | marina.alves@gmail.com | m\*\*\*@gmail.com      |
| Telefone | (11) 98765-4321        | (11) \*\*\*\*\*-\*\*21 |
| IP       | 187.45.120.33          | 187.45.\*.\*           |

Nos dados enviados à Meta e ao GA4 (abas dos detalhes), e-mail, telefone, nome, cidade, IP e identificadores com hash aparecem como `oculto`. O `fbc`, o `fbp` e o navegador continuam visíveis, porque servem para diagnosticar o envio.

## Recuperar o acesso

Só existe "esqueci minha senha" por dentro do painel: um Administrador redefine a senha de outra pessoa. **Guarde a sua senha num gerenciador de senhas** (Chaves do iCloud, Bitwarden etc.). Ter dois administradores de confiança também evita depender do servidor.

Se o único Administrador perdeu a senha, crie um administrador de recuperação direto no servidor e use-o para redefinir a senha da conta original:

1. Abra um terminal **dentro do container do track** em produção:
    - no Komodo: Stack do track › container do app › **Terminal**; ou
    - por SSH na VPS: `docker ps` (ache o container do track) e depois `docker exec -it <container-do-track> sh`.
2. Rode, trocando o e-mail (precisa ser um e-mail que **ainda não** tem acesso ao painel):

    ```bash
    node scripts/create-admin.mjs --email recuperacao@seudominio.com --name "Recuperação"
    ```

    O comando pede a senha duas vezes sem mostrar na tela (mínimo de 12 caracteres). Ele cria um **Administrador**.

3. Entre no painel com esse e-mail, abra **Usuários** e use **Redefinir senha** na sua conta original.
4. Entre com a sua conta original e **exclua** o administrador de recuperação na aba Usuários.

Se o e-mail já existir, o comando recusa; use outro. Fora do painel também dá para apagar um usuário com `node scripts/delete-user.mjs --email <e-mail>` no mesmo terminal.

## Para quem mexe no código

- **Toda checagem de nível é no servidor.** Esconder um botão ou um item de menu nunca é a proteção.
    - Página só de administrador: `await requireAdmin()` (`src/lib/dal.ts`); o Colaborador é redirecionado para `/painel`.
    - Leitura só de administrador: `readAsAdmin()`.
    - Server Action só de administrador: a **primeira linha** é `const denied = await denyUnlessAdmin(); if (denied) return denied;`.
    - O teste `src/lib/admin-guard.test.ts` falha se uma action de administrador perder essa trava ou se surgir um arquivo de actions do painel sem classificação (admin ou aberto aos dois níveis). O `bun run security:check` reconhece `denyUnlessAdmin`/`requireAdmin` como trava de sessão.
- **Toda tela ou action nova que mostre dado pessoal de cliente** (nome, e-mail, telefone, IP, webhook, payloads da Meta/GA4) passa pela máscara de `src/lib/privacy/mask.ts` quando quem pede não é Administrador (`isAdmin()`), **antes** de devolver o dado. Exemplos: `src/lib/dashboard/journey.ts`, `details.ts` e a busca de `revenue.ts`.
- O nível fica em `user.role` (`admin` | `colaborador`, com CHECK no banco, migration `0014`) e é lido do banco a cada pedido. Constantes em `src/lib/roles.ts`.
- Usuários são geridos só pelas actions de `src/app/painel/usuarios/actions.ts`. As rotas HTTP do plugin admin do Better Auth (`/api/auth/admin/*`) respondem 404 (`src/lib/auth-admin-paths.ts`), e a personificação está desligada.
- Mudanças em usuários existentes rodam em `withLockedUsers` (`src/lib/users/data.ts`): trava as linhas e confere `checkUserChange` (`src/lib/users/rules.ts`, testado) antes de gravar.
- A RLS do banco **não** conhece os níveis: o `app_reader` lê para qualquer sessão válida. A separação entre Administrador e Colaborador é do código do servidor, coberta pelos testes acima.
