# Aba Vídeos — como ler e por que é calculada assim

Objetivo da aba: entender **quanto do vídeo da VSL é consumido**, **por quanto tempo as pessoas assistem** e **em que pontos a retenção cai**.

Código: `src/lib/dashboard/videos.ts` (consultas), `src/lib/dashboard/video-stats.ts` (curva e faixas) e `src/app/painel/videos/page.tsx` (tela). A coleta vem da VSL por `trck('video')` e vai para a tabela `video_views`. Nunca vai para Meta nem GA4.

## O caminho que a aba mostra

```
Visitou a VSL → deu play → assistiu → chegou ao botão → assistiu até o fim → comprou
      ↑ Taxa de play        ↑ % médio, tempo médio, curva          ↑ Compraram
```

## 1. Quanto do conteúdo é consumido

- **Taxa de play:** dos que abriram a VSL, quantos deram play. Taxa baixa indica problema **antes** do vídeo, como a página, a thumbnail ou o carregamento.
- **% médio assistido:** em média, até que ponto do vídeo cada play chegou.
- **Chegaram ao botão:** quantos passaram do segundo em que o botão aparece (hoje, 2:30). É o ponto que mais importa para vender.
- **Assistiram até o fim:** quantos chegaram ao último segundo.

## 2. Por quanto tempo ficam assistindo

- **Tempo médio assistido:** conta só os segundos realmente assistidos, em reprodução normal.
- Pular para frente ou voltar e repetir um trecho **não** soma tempo. Por isso o número mostra o consumo real, e não só até onde a barra chegou.

## 3. Onde a retenção cai

- **Curva de retenção:** para cada ponto do vídeo, de 5% em 5%, mostra quantos plays ainda estavam assistindo. Uma queda forte da linha marca o trecho onde as pessoas saem.
- **Linha tracejada do botão:** mostra se a saída acontece antes ou depois de o botão aparecer.
- **Onde as pessoas pararam:** agrupa os plays por faixa (até 25%, 25–50%, 50–75%, 75% ao fim). Mostra rápido qual quarto do vídeo perde mais gente.

## Ajuste da taxa de play (07/11/2026)

**Regra:** taxa de play = plays ÷ visualizações (PageView) da página do vídeo. As visualizações só contam **a partir do primeiro play registrado daquele vídeo**. Quando esse início cai dentro do período, o ⓘ do cartão mostra a data e a hora.

### O problema que corrigiu

- **Causa:** a medição de vídeo entrou no ar em 06/11/2026. Antes do ajuste, a taxa dividia os plays por **todas** as visitas do período, inclusive as de antes da medição existir, quando nenhum play podia ser registrado.
- **Efeito:** o mesmo vídeo, com os mesmos 2 plays, mostrava 66,7% em "Hoje e ontem" (2 ÷ 3) e 28,6% em "Últimos 7 dias" (2 ÷ 7). A taxa mudava conforme o filtro escolhido, e não conforme o vídeo, então não servia para comparar nem para decidir.

### Por que esta é a melhor forma

- **Mesmo intervalo:** plays e visitas passam a cobrir o mesmo pedaço de tempo. A taxa reflete só o vídeo e fica comparável entre filtros e ao longo das semanas.
- **Sem passo manual:** uma data fixa digitada por alguém poderia ser esquecida, e cada vídeo novo exigiria ajuste. Aqui o primeiro play de cada vídeo marca o início da medição sozinho.
- **Sem risco para o rastreio:** nada muda no banco nem na coleta, só a conta do painel.

## Limites, para ler os números certo

- **Precisão da curva:** pontos de 5% em 5%. No vídeo de 5:31, cada ponto equivale a uns 16 segundos, então a curva mostra o **trecho** da queda, não o segundo exato.
- **Pulos para frente:** a curva usa o ponto mais distante a que a pessoa chegou. Quem pula para frente conta como tendo passado pelo trecho pulado. O tempo médio assistido compensa isso, porque não soma pulos.
- **Recarregar a página conta outro play.** O cartão "Pessoas" mostra quantas pessoas diferentes foram.
- **Fim abrupto:** a VSL envia o progresso no play, a cada 15 s, na pausa, no fim e ao sair da página. Se a pessoa fecha o navegador de forma brusca, podem se perder até 15 segundos do final daquele play.
- **Visitas antes do primeiro play:** as que aconteceram entre o deploy da VSL e o primeiro play ficam fora da conta. A taxa fica um pouco mais alta, mas o efeito é pequeno e some com o tempo.

## Como interpretar uma queda logo depois do botão

Com tráfego real, uma queda logo após o botão é comum: parte das pessoas clica e vai para a compra. Para saber se é clique ou abandono, compare a queda com:

- o cartão **Compraram**;
- os **checkouts** da aba Páginas.

**Volume mínimo:** conclusões sobre retenção só valem com algumas dezenas de plays.
