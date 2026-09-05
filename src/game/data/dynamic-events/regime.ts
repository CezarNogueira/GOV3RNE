import type { DynamicEventDefinition } from '../../types/index';
import { fill, randomCountry, randomGovernor, randomOutlet } from '../../engines/event-actors';

/**
 * O PAÍS REAGINDO AO REGIME
 *
 * Depois que o governo começa a concentrar poder, a agenda muda de assunto
 * sozinha. Estes eventos são as duas metades dessa reação: a resistência de
 * quem perde e a consolidação de quem ganha.
 *
 * Nenhum deles é gratuito. Todos leem o estado institucional — lealdade
 * militar, nível de exceção, resistência acumulada, liberdades — e só entram no
 * sorteio quando o país realmente chegou ali.
 */
export const REGIME_EVENTS: readonly DynamicEventDefinition[] = [
  {
    id: 'dyn_regime_militares_insatisfeitos',
    category: 'governamental',
    severity: 'grave',
    weight: 14,
    tags: ['institucional', 'seguranca'],
    cooldownMonths: 5,
    canGenerate: (state) => state.regime.militaryLoyalty < 52,
    pressure: (state) => 1 + Math.max(0, 52 - state.regime.militaryLoyalty) * 0.05,
    build: (state) => ({
      title: 'Setores das Forças Armadas manifestam insatisfação',
      brief: fill(
        'Oficiais da ativa deixaram vazar um documento crítico às decisões recentes do governo. A lealdade militar está em {loyalty}% e o texto circula em grupos de coronéis desde ontem. Ninguém assinou — e é exatamente esse o recado.',
        { loyalty: state.regime.militaryLoyalty.toFixed(0) },
      ),
      options: [
        {
          id: 'ouvir',
          label: 'Chamar o comando para conversar',
          description: 'Reunião reservada com os três comandantes, sem imprensa.',
          warning: 'Acalma os quartéis e ensina que pressionar o Planalto funciona.',
          cost: 0,
          impacts: {},
          groupImpacts: [{ groupId: 'militares', delta: 2.4, reason: 'Presidente ouviu o comando.' }],
          approvalDelta: -0.2,
          congressDelta: 0,
          stressDelta: 6,
        },
        {
          id: 'orcamento',
          label: 'Resolver com orçamento',
          description: 'Recomposição imediata da verba de reaparelhamento.',
          warning: 'Lealdade comprada é lealdade alugada — e o aluguel vence todo ano.',
          cost: 8,
          impacts: { primaryBalance: -8 },
          groupImpacts: [
            { groupId: 'militares', delta: 4, reason: 'Verba recomposta.' },
            { groupId: 'servidores', delta: -1.6, reason: 'Dinheiro que faltou em outra pasta.' },
          ],
          approvalDelta: -0.4,
          congressDelta: -1,
          stressDelta: 4,
        },
        {
          id: 'punir',
          label: 'Punir os envolvidos',
          description: 'Abrir sindicância e afastar quem participou do documento.',
          warning: 'Autoridade restabelecida no papel. Na caserna, vira mártir.',
          cost: 0,
          impacts: {},
          groupImpacts: [
            { groupId: 'militares', delta: -3.5, reason: 'Punição a oficiais da ativa.' },
            { groupId: 'classe_media', delta: 1, reason: 'Poder civil afirmado.' },
          ],
          approvalDelta: 0.3,
          congressDelta: 1,
          stressDelta: 9,
        },
      ],
    }),
  },
  {
    id: 'dyn_regime_apoio_militar',
    category: 'governamental',
    severity: 'rotina',
    weight: 10,
    tags: ['institucional'],
    cooldownMonths: 6,
    canGenerate: (state) => state.regime.militaryLoyalty > 70,
    build: (state) => ({
      title: 'Alto comando declara apoio à continuidade do governo',
      brief: fill(
        'Os comandantes das três forças assinaram nota conjunta de apoio à continuidade do governo. Com lealdade militar em {loyalty}%, o gesto tranquiliza uma parte do país e assusta outra — porque nota de apoio militar a governo civil nunca é só uma nota.',
        { loyalty: state.regime.militaryLoyalty.toFixed(0) },
      ),
      options: [
        {
          id: 'agradecer',
          label: 'Agradecer publicamente',
          description: 'Cerimônia com os comandantes no Planalto.',
          warning: 'Consolida a aliança e aproxima o governo do fardamento aos olhos de todos.',
          cost: 0,
          impacts: {},
          groupImpacts: [
            { groupId: 'militares', delta: 2, reason: 'Apoio retribuído.' },
            { groupId: 'universitarios', delta: -1.4, reason: 'Proximidade do governo com a caserna.' },
          ],
          approvalDelta: 0.3,
          congressDelta: 0,
          stressDelta: 1,
        },
        {
          id: 'distancia',
          label: 'Agradecer e marcar distância',
          description: 'Nota lembrando que a autoridade civil não precisa de aval militar.',
          warning: 'Preserva a norma constitucional e esfria a relação com os quartéis.',
          cost: 0,
          impacts: {},
          groupImpacts: [
            { groupId: 'militares', delta: -1.2, reason: 'Governo marcou distância.' },
            { groupId: 'classe_media', delta: 1.4, reason: 'Autoridade civil reafirmada.' },
          ],
          approvalDelta: 0.4,
          congressDelta: 2,
          stressDelta: 2,
        },
      ],
    }),
  },
  {
    id: 'dyn_regime_governadores_questionam',
    category: 'politico',
    severity: 'grave',
    weight: 13,
    tags: ['institucional'],
    cooldownMonths: 5,
    canGenerate: (state) => state.regime.exceptionLevel > 20 || state.regime.executivePower > 62,
    pressure: (state) => 1 + state.regime.exceptionLevel * 0.02,
    build: (state, rng) => {
      const governor = randomGovernor(state, rng, 'adversario');
      if (!governor) return null;

      return {
        title: 'Governadores questionam os poderes extraordinários',
        brief: fill(
          'Um grupo de governadores, liderado por {name} ({party}), assinou manifesto contra a concentração de poder no Executivo federal e anunciou ação no Supremo. O poder do Executivo está em {power}% e a força institucional em {strength}%.',
          {
            name: governor.name,
            party: governor.party,
            power: state.regime.executivePower.toFixed(0),
            strength: state.regime.institutionalStrength.toFixed(0),
          },
        ),
        options: [
          {
            id: 'negociar',
            label: 'Negociar com os governadores',
            description: 'Reunião no Planalto com repasse extraordinário na mesa.',
            warning: 'Compra o silêncio de metade deles e custa caixa.',
            cost: 5,
            impacts: { primaryBalance: -5 },
            groupImpacts: [],
            approvalDelta: 0.2,
            congressDelta: 3,
            stressDelta: 5,
          },
          {
            id: 'ignorar',
            label: 'Ignorar o manifesto',
            description: 'Nenhuma resposta: que levem ao Supremo se quiserem.',
            warning: 'A federação se organiza contra o Planalto, e o Supremo entra na conta.',
            cost: 0,
            impacts: { countryRisk: 14 },
            groupImpacts: [{ groupId: 'classe_media', delta: -1.2, reason: 'Conflito federativo aberto.' }],
            approvalDelta: -0.6,
            congressDelta: -4,
            stressDelta: 6,
          },
          {
            id: 'retaliar',
            label: 'Retaliar com repasses',
            description: 'Suspender transferências voluntárias aos estados signatários.',
            warning: 'Mostra força e transforma um manifesto numa causa federativa.',
            cost: 0,
            impacts: { primaryBalance: 3, countryRisk: 22 },
            groupImpacts: [
              { groupId: 'baixa_renda', delta: -1.6, reason: 'Repasse suspenso ao estado.' },
              { groupId: 'classe_media', delta: -1.8, reason: 'Verba usada como arma política.' },
            ],
            approvalDelta: -1.2,
            congressDelta: -6,
            stressDelta: 8,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_regime_manifestacao_massa',
    category: 'social',
    severity: 'grave',
    weight: 16,
    tags: ['institucional'],
    cooldownMonths: 3,
    canGenerate: (state) => state.regime.protestLevel > 48,
    pressure: (state) => 1 + state.regime.protestLevel * 0.02 + state.regime.resistance * 0.02,
    build: (state) => ({
      title: 'Manifestação de massa toma as capitais',
      brief: fill(
        'Organizações civis convocaram atos simultâneos em vinte capitais contra o governo. O nível de mobilização está em {protest}%, a resistência organizada em {resistance}% e as liberdades civis em {liberties}% — e é essa combinação que enche uma praça.',
        {
          protest: state.regime.protestLevel.toFixed(0),
          resistance: state.regime.resistance.toFixed(0),
          liberties: state.regime.civilLiberties.toFixed(0),
        },
      ),
      options: [
        {
          id: 'garantir',
          label: 'Garantir o direito de manifestação',
          description: 'Nota assegurando o ato e orientando policiamento apenas de trânsito.',
          warning: 'A praça enche e a foto roda o mundo. Ninguém pode chamar isso de repressão.',
          cost: 0,
          impacts: {},
          groupImpacts: [
            { groupId: 'universitarios', delta: 1.6, reason: 'Direito de manifestação garantido.' },
            { groupId: 'artistas', delta: 1.4, reason: 'Governo não reprimiu.' },
          ],
          approvalDelta: 0.3,
          congressDelta: 1,
          stressDelta: 5,
        },
        {
          id: 'conter',
          label: 'Conter com aparato policial',
          description: 'Perímetro, contenção e dispersão ao fim do horário autorizado.',
          warning: 'A praça esvazia hoje. A resistência organizada cresce depois.',
          cost: 0,
          impacts: {},
          groupImpacts: [
            { groupId: 'policiais', delta: 1, reason: 'Ordem de contenção cumprida.' },
            { groupId: 'universitarios', delta: -2.4, reason: 'Ato contido pela polícia.' },
            { groupId: 'artistas', delta: -2, reason: 'Dispersão do ato.' },
          ],
          approvalDelta: -0.8,
          congressDelta: 0,
          stressDelta: 7,
        },
        {
          id: 'atender',
          label: 'Atender parte das pautas',
          description: 'Anunciar concessões concretas antes do domingo.',
          warning: 'Esvazia o ato pela raiz e custa caixa e autoridade.',
          cost: 4,
          impacts: { primaryBalance: -4 },
          groupImpacts: [
            { groupId: 'trabalhadores', delta: 2, reason: 'Governo cedeu à rua.' },
            { groupId: 'mercado_financeiro', delta: -1.6, reason: 'Concessão sob pressão.' },
          ],
          approvalDelta: 1,
          congressDelta: -1,
          stressDelta: 4,
        },
      ],
    }),
  },
  {
    id: 'dyn_regime_sancoes_democracia',
    category: 'internacional',
    severity: 'grave',
    weight: 13,
    tags: ['diplomacia', 'institucional'],
    cooldownMonths: 6,
    canGenerate: (state) =>
      state.regime.regime === 'autoritario' ||
      state.regime.regime === 'ditadura' ||
      state.regime.regime === 'regime_militar' ||
      state.regime.civilLiberties < 45,
    pressure: (state) => 1 + (100 - state.regime.civilLiberties) * 0.02,
    build: (state, rng) => {
      const pick = randomCountry(state, rng, 'parceiro_comercial');
      if (!pick) return null;
      const { country } = pick;

      return {
        title: fill('{country} anuncia sanções por ruptura democrática', { country: country.name }),
        brief: fill(
          'O governo do {country} anunciou sanções diplomáticas e suspensão de acordos, citando a redução das liberdades civis no Brasil — hoje em {liberties}%. Outros governos avisaram que avaliam o mesmo caminho.',
          { country: country.name, liberties: state.regime.civilLiberties.toFixed(0) },
        ),
        options: [
          {
            id: 'ceder',
            label: 'Anunciar restauração de garantias',
            description: 'Recuar em parte das restrições para desarmar a pressão externa.',
            warning: 'O mercado agradece e quem lucrava com as restrições registra o recuo.',
            cost: 0,
            impacts: { countryRisk: -30, businessConfidence: 6 },
            groupImpacts: [
              { groupId: 'mercado_financeiro', delta: 2.4, reason: 'Sinal de recuo autoritário.' },
              { groupId: 'universitarios', delta: 2, reason: 'Garantias restauradas.' },
            ],
            approvalDelta: 0.4,
            congressDelta: 3,
            stressDelta: 5,
            diplomacy: { countryId: country.id, relationDelta: 10, isolationDelta: -10 },
          },
          {
            id: 'soberania',
            label: 'Responder invocando soberania',
            description: 'Nota dura acusando ingerência em assunto interno.',
            warning: 'Agrada a base e confirma lá fora exatamente o que a sanção dizia.',
            cost: 0,
            impacts: { countryRisk: 30, businessConfidence: -6 },
            groupImpacts: [
              { groupId: 'militares', delta: 2, reason: 'Soberania invocada.' },
              { groupId: 'mercado_financeiro', delta: -2.6, reason: 'Escalada com parceiro comercial.' },
            ],
            approvalDelta: 0.5,
            congressDelta: -2,
            stressDelta: 6,
            diplomacy: { countryId: country.id, relationDelta: -14, tradeDelta: -10, isolationDelta: 10 },
          },
        ],
      };
    },
  },
  {
    id: 'dyn_regime_resistencia',
    category: 'social',
    severity: 'grave',
    weight: 12,
    tags: ['institucional'],
    cooldownMonths: 5,
    canGenerate: (state) => state.regime.resistance > 42,
    pressure: (state) => 1 + state.regime.resistance * 0.025,
    build: (state, rng) => {
      const outlet = randomOutlet(rng, 40);
      return {
        title: 'Resistência organizada aparece fora do radar do governo',
        brief: fill(
          'Redes formadas durante a repressão apareceram de uma vez: greve relâmpago em três estados, comunicados coordenados e uma reportagem do {outlet} mostrando como se organizaram. A resistência acumulada está em {resistance}% e o medo, em {fear}% — os dois convivem.',
          {
            outlet: outlet.name,
            resistance: state.regime.resistance.toFixed(0),
            fear: state.regime.publicFear.toFixed(0),
          },
        ),
        options: [
          {
            id: 'perseguir',
            label: 'Desarticular as redes',
            description: 'Investigação, prisões administrativas e monitoramento.',
            warning: 'Some por alguns meses. Volta maior, e agora com histórias para contar.',
            cost: 1,
            impacts: { corruptionPerception: -4, primaryBalance: -1 },
            groupImpacts: [
              { groupId: 'universitarios', delta: -3, reason: 'Perseguição a militantes.' },
              { groupId: 'artistas', delta: -2.6, reason: 'Monitoramento político.' },
              { groupId: 'policiais', delta: 1, reason: 'Operação autorizada.' },
            ],
            approvalDelta: -1.2,
            congressDelta: -2,
            stressDelta: 9,
          },
          {
            id: 'dialogar',
            label: 'Abrir canal de diálogo',
            description: 'Mesa com entidades civis e compromissos públicos.',
            warning: 'Reduz a temperatura e legitima quem o governo chamava de baderneiro.',
            cost: 2,
            impacts: { primaryBalance: -2 },
            groupImpacts: [
              { groupId: 'universitarios', delta: 2.4, reason: 'Governo abriu diálogo.' },
              { groupId: 'trabalhadores', delta: 1.6, reason: 'Mesa de negociação.' },
            ],
            approvalDelta: 0.8,
            congressDelta: 2,
            stressDelta: 4,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_guerra_exaustao',
    category: 'social',
    severity: 'grave',
    weight: 15,
    tags: ['institucional'],
    cooldownMonths: 3,
    canGenerate: (state) => state.war.status === 'guerra' && state.war.warExhaustion > 50,
    pressure: (state) => 1 + state.war.warExhaustion * 0.02,
    build: (state) => ({
      title: 'População cobra o fim da guerra',
      brief: fill(
        'Atos pelo fim da guerra com {country} reuniram famílias de convocados em frente ao Congresso. O apoio à guerra caiu para {support}% e a exaustão chegou a {exhaustion}% — a conta acumulada já é de R$ {cost} bi.',
        {
          country: state.war.countryName ?? 'o adversário',
          support: state.war.warSupport.toFixed(0),
          exhaustion: state.war.warExhaustion.toFixed(0),
          cost: state.war.totalCost.toFixed(0),
        },
      ),
      options: [
        {
          id: 'negociar',
          label: 'Abrir negociação de paz',
          description: 'Anunciar disposição de conversar, com ou sem proposta na mesa.',
          warning: 'A rua acalma. O adversário lê como fraqueza e endurece os termos.',
          cost: 0,
          impacts: {},
          groupImpacts: [
            { groupId: 'trabalhadores', delta: 1.8, reason: 'Governo buscou a paz.' },
            { groupId: 'militares', delta: -2, reason: 'Negociação sem vitória.' },
          ],
          approvalDelta: 1,
          congressDelta: 2,
          stressDelta: 6,
        },
        {
          id: 'insistir',
          label: 'Insistir até a vitória',
          description: 'Pronunciamento pedindo mais um esforço ao país.',
          warning: 'Compra alguns meses de apoio e cobra o dobro deles depois.',
          cost: 0,
          impacts: { gdpGrowth: -0.05 },
          groupImpacts: [
            { groupId: 'militares', delta: 2, reason: 'Governo manteve a guerra.' },
            { groupId: 'universitarios', delta: -2.4, reason: 'Guerra prolongada.' },
          ],
          approvalDelta: -1.4,
          congressDelta: -2,
          stressDelta: 10,
        },
      ],
    }),
  },
];
