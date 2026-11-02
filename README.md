# GOV3RNE

Simulador presidencial por **cartas de decisão mensais**. Obra de ficção: números, países do ranking e acontecimentos são simulação inventada.

Todo mês o jogo oferece três medidas diferentes. Você escolhe **uma**, ela pode dar certo ou fracassar, e o país reage: serviços, recursos, cofre, moeda, ranking de PIB e a satisfação de cinco grupos sociais.

```bash
npm install
npm run dev        # jogo em http://localhost:5173
npm test           # testes (motor + interface)
npm run typecheck
npm run build
npm run simulate   # simula partidas com robôs e imprime estatísticas de equilíbrio
```

## Regras em uma página

| Área | Regra |
|---|---|
| Cartas | 3 por mês, sem repetição, escolha de apenas 1. Falhou: o custo é pago, o efeito não vem. |
| Serviços | Saúde, Educação, Segurança, Agricultura, Infraestrutura. Começam em 50, vão de 0 a 100. Cada mês alguns ganham meta de 0 a 2 pontos acima. |
| IDH | 500/1000. Todas as metas cumpridas: +1. Alguma perdida: −1. |
| Comércio | 500/1000. Agricultura e Educação na meta: +5. Alguma abaixo: −20. |
| Moeda | US$ 0,20. Comércio subiu: 50% de +0,05. Não subiu: 25% de −0,10. |
| Dívida | 80%. Acima de 50%: 10% de chance mensal de −0,10, mais 10 pontos a cada 50 pontos de dívida. |
| PIB | 10º lugar. Superar os 5 serviços do país de cima por 2 meses seguidos. Cada posição paga recompensa uma vez. |
| Recursos | Comida, Energia, Tecnologia, Turismo, Capital Humano (0 a 1000). Cada ponto rende R$ por mês. |
| Economia | Cofre = cofre + impostos + receita dos recursos − gastos − custo da medida. Cofre negativo: crise de 6 meses. |
| Sociedade | Pobres, Ricos, Militares, Indígenas, Empresários. Começam em 50. |
| Derrota | Qualquer serviço, recurso ou grupo em 0, ou moeda em US$ 0. Não há limite de meses. |

## Arquitetura

```
src/game/            núcleo puro (sem DOM, sem I/O) — roda igual no navegador e nos testes
  data/config.ts       TODOS os números ajustáveis do equilíbrio
  data/cards.ts        catálogo das 60 cartas, como dados
  data/rivals.ts       escada do ranking de PIB
  data/meta.ts         rótulos, receita por ponto, pesos dos serviços, gostos dos grupos
  engines/
    services.ts          metas mensais
    resources.ts         serviços → recursos (gradual) e receita
    economy.ts           cofre, pressão tributária, crise de 6 meses
    international.ts     IDH, Comércio, moeda, dívida, ranking, recompensas
    society.ts           satisfação dos grupos
    cards.ts             disponibilidade, sorteio das 3 cartas, textos
    turn.ts              escolha da carta (única porta de entrada dos efeitos)
    month.ts             passagem do mês: os 17 passos do enunciado, em ordem
    defeat.ts            condições de derrota
src/state/           repositório de saves (localStorage) e store (zustand), sem regra de jogo
src/pages, src/components   interface
scripts/simulate.ts  simulador de equilíbrio
```

Princípios:

- **Cartas são dados.** Mudar chance, custo ou efeito é editar uma linha de `cards.ts`.
- **Cada efeito entra uma vez.** A carta é aplicada na escolha; a marca `applied` impede que a passagem do mês a aplique de novo.
- **Aleatoriedade isolada.** Todo sorteio passa por `RandomSource`; os testes usam um sorteador roteirizado. O cursor do sorteador fica no save, então recarregar a página não muda cartas nem rolagens.
- **Sem erro de arredondamento.** Dinheiro em reais inteiros, moeda em centavos de dólar, recursos em décimos de ponto (toda receita por ponto é múltipla de 10).
- **Limites centralizados.** Todo serviço, recurso, grupo, IDH, Comércio, moeda e dívida passa por uma função `clamp*`.

## Decisões de projeto que o enunciado não definia

Estão todas em `src/game/data/config.ts` ou `rivals.ts`, e `npm run simulate` mede o efeito de cada mudança.

- **Frequência das metas**: 50% de chance por serviço, 0/1/2 pontos acima (35/40/25%). Sempre há ao menos uma meta.
- **Serviço sem meta** não pode ficar "abaixo da meta": só uma meta perdida pune o Comércio.
- **Dívida**: o enunciado dá o risco, mas não diz o que a move. Aqui ela acompanha o saldo fechado do mês anterior (cada R$ 5 mi de superávit = −1 ponto, no máximo −3; déficit sobe até +3) e sobe 5 pontos por mês de crise.
- **Recursos**: cada serviço gera um sinal mensal (avanço no mês, +0,5 se bateu a meta, −0,5 se perdeu) que escoa para o recurso com inércia de 70% ao mês.
- **Crise**: durante os 6 meses, −2 pontos por serviço, −10% (mínimo 5) por recurso e −3 por grupo, a cada mês.
- **Pressão tributária**: imposto 5% acima do inicial reduz Comércio, Capital Humano e Turismo todo mês; 5% abaixo ajuda o Comércio.
- **Ranking**: ao ultrapassar um país a contagem zera (cada posição exige seus 2 meses). Posições não se perdem. Os países têm nomes reais só como ambientação; os valores são inventados.
- **Efeitos de fracasso**: o catálogo não define nenhum, então nenhuma carta tem. O campo `failureEffects` já funciona.
- Cartas 19 e 45 (incentivos fiscais): a renúncia de arrecadação vale mesmo se a medida fracassar; o ganho de serviço, não.
- Carta 48: "+2 de satisfação" do efeito principal e "+5" da consequência social foram somados (+7 Indígenas).

## Saves

Ficam no `localStorage` sob `gov3rne.v2.*`. Saves do simulador anterior (outro formato) permanecem intactos no navegador, mas não são lidos por esta versão.
