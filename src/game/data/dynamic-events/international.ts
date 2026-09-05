import type { DynamicEventDefinition } from '../../types/index';
import { fill, randomCountry } from '../../engines/event-actors';

/**
 * O MUNDO OLHANDO
 *
 * Acordo, elogio, sanção, espionagem. O que estes eventos têm em comum é que
 * nenhum deles escolhe o país no sorteio cego: sanção comercial vem de quem
 * compra do Brasil, elogio vem de quem já tem relação boa, e o tamanho do
 * efeito acompanha o peso daquele país no tabuleiro.
 *
 * Todos mexem na relação bilateral de verdade — a próxima visita e o próximo
 * acordo encontram o país no estado em que este evento o deixou.
 */
export const INTERNATIONAL_EVENTS: readonly DynamicEventDefinition[] = [
  {
    id: 'dyn_intl_acordo_comercial',
    category: 'internacional',
    severity: 'atencao',
    weight: 13,
    tags: ['diplomacia', 'economia'],
    cooldownMonths: 6,
    canGenerate: (state) => state.diplomacy.countries.some((country) => country.relation >= 50),
    pressure: (state) => 1 + Math.max(0, state.economy.gdpGrowth) * 0.1,
    build: (state, rng) => {
      const pick = randomCountry(state, rng, 'amigo');
      if (!pick) return null;
      const { country, leaderTitle } = pick;
      const escala = 0.4 + country.weight / 100;

      return {
        title: fill('Acordo de livre comércio com {country}', { country: country.name }),
        brief: fill(
          'O {title} do {country} assinou um acordo de livre comércio histórico com o nosso governo. A negociação estava parada há anos e destrava tarifa para os nossos produtos — e para os deles, o que o setor industrial daqui já avisou que não gostou.',
          { title: leaderTitle, country: country.name },
        ),
        options: [
          {
            id: 'assinar',
            label: 'Assinar o acordo',
            description: 'Cerimônia em Brasília e envio imediato ao Congresso.',
            warning: 'Exportação cresce em meses; a indústria que compete com o importado sente antes.',
            cost: 0,
            impacts: {
              gdpGrowth: 0.18 * escala,
              businessConfidence: 5 * escala,
              countryRisk: -8 * escala,
            },
            groupImpacts: [
              { groupId: 'agronegocio', delta: 2.6 * escala, reason: 'Mercado novo para a safra.' },
              { groupId: 'empresariado', delta: 1.4 * escala, reason: 'Acordo comercial fechado.' },
              { groupId: 'trabalhadores', delta: -1.2 * escala, reason: 'Concorrência com o importado.' },
            ],
            approvalDelta: 0.7 * escala,
            congressDelta: 2,
            stressDelta: 2,
            diplomacy: {
              countryId: country.id,
              relationDelta: 10,
              tradeDelta: 12,
              trustDelta: 6,
              isolationDelta: -4,
            },
          },
          {
            id: 'renegociar',
            label: 'Pedir salvaguardas para a indústria',
            description: 'Assinar com prazo de transição para os setores mais expostos.',
            warning: 'Protege o emprego industrial e adia metade do ganho.',
            cost: 0,
            impacts: { gdpGrowth: 0.08 * escala, businessConfidence: 2 * escala },
            groupImpacts: [
              { groupId: 'trabalhadores', delta: 0.8, reason: 'Salvaguarda para a indústria.' },
              { groupId: 'agronegocio', delta: 1.2 * escala, reason: 'Acordo saiu, mesmo que menor.' },
            ],
            approvalDelta: 0.4,
            congressDelta: 1,
            stressDelta: 3,
            diplomacy: { countryId: country.id, relationDelta: 5, tradeDelta: 6, isolationDelta: -2 },
          },
          {
            id: 'recusar',
            label: 'Não assinar',
            description: 'Deixar o acordo para outro momento político.',
            warning: 'A indústria agradece e o país que ofereceu procura outro parceiro na região.',
            cost: 0,
            impacts: { businessConfidence: -2 },
            groupImpacts: [
              { groupId: 'trabalhadores', delta: 1, reason: 'Governo recusou abrir o mercado.' },
              { groupId: 'agronegocio', delta: -2.4 * escala, reason: 'Mercado perdido.' },
            ],
            approvalDelta: -0.2,
            congressDelta: 0,
            stressDelta: 2,
            diplomacy: { countryId: country.id, relationDelta: -6, trustDelta: -4, isolationDelta: 2 },
          },
        ],
      };
    },
  },
  {
    id: 'dyn_intl_apoio_publico',
    category: 'internacional',
    severity: 'rotina',
    weight: 11,
    tags: ['diplomacia'],
    cooldownMonths: 5,
    canGenerate: (state) => state.diplomacy.countries.some((country) => country.relation >= 55),
    build: (state, rng) => {
      const pick = randomCountry(state, rng, 'amigo');
      if (!pick) return null;
      const { country } = pick;
      const escala = 0.4 + country.weight / 100;

      return {
        title: fill('{country} declara apoio às nossas posições', { country: country.name }),
        brief: fill(
          'O governo do {country} declarou apoio público e irrestrito às nossas políticas no conselho internacional de nações. O gesto não custa nada a eles e vale muito para nós: é voto garantido na próxima votação que importa.',
          { country: country.name },
        ),
        options: [
          {
            id: 'retribuir',
            label: 'Retribuir publicamente',
            description: 'Nota conjunta e apoio à candidatura deles no organismo multilateral.',
            warning: 'Aliança fica mais forte e o outro lado do tabuleiro registra de que lado você está.',
            cost: 0,
            impacts: { countryRisk: -4 * escala },
            groupImpacts: [],
            approvalDelta: 0.3,
            congressDelta: 0,
            stressDelta: 1,
            diplomacy: { countryId: country.id, relationDelta: 8, trustDelta: 8, isolationDelta: -5 },
          },
          {
            id: 'agradecer',
            label: 'Agradecer sem compromisso',
            description: 'Nota protocolar do Itamaraty, sem contrapartida.',
            warning: 'Guarda o capital diplomático para quando fizer falta.',
            cost: 0,
            impacts: {},
            groupImpacts: [],
            approvalDelta: 0.1,
            congressDelta: 0,
            stressDelta: 0,
            diplomacy: { countryId: country.id, relationDelta: 3, isolationDelta: -2 },
          },
        ],
      };
    },
  },
  {
    id: 'dyn_intl_investimento',
    category: 'internacional',
    severity: 'atencao',
    weight: 12,
    tags: ['infraestrutura', 'economia'],
    cooldownMonths: 7,
    canGenerate: (state) => state.diplomacy.countries.length > 0,
    pressure: (state) => 1 + Math.max(0, 60 - state.economy.countryRisk / 5) * 0.01,
    build: (state, rng) => {
      const pick = randomCountry(state, rng, 'parceiro_comercial');
      if (!pick) return null;
      const { country } = pick;
      const escala = 0.4 + country.weight / 100;
      const bilhoes = Math.round(20 + country.weight * 0.9);

      return {
        title: fill('Consórcio do {country} anuncia R$ {value} bi em infraestrutura', {
          country: country.name,
          value: bilhoes,
        }),
        brief: fill(
          'Um consórcio de grandes empresas do {country} anunciou um investimento de R$ {value} bilhões para modernizar nossa infraestrutura nacional — portos, transmissão e ferrovia. Querem garantia regulatória de trinta anos e uma reunião com você antes do anúncio oficial.',
          { country: country.name, value: bilhoes },
        ),
        options: [
          {
            id: 'garantir',
            label: 'Dar a garantia regulatória',
            description: 'Marco contratual de trinta anos, com arbitragem internacional.',
            warning: 'Destrava a obra e amarra as mãos de quem governar o país depois de você.',
            cost: 0,
            impacts: {
              infrastructureIndex: 2.4 * escala,
              gdpGrowth: 0.16 * escala,
              businessConfidence: 6 * escala,
              countryRisk: -10 * escala,
              unemployment: -0.06 * escala,
            },
            groupImpacts: [
              { groupId: 'empresariado', delta: 2.4 * escala, reason: 'Capital estrangeiro entrando.' },
              { groupId: 'trabalhadores', delta: 1.4 * escala, reason: 'Obra grande gera emprego.' },
              { groupId: 'universitarios', delta: -1, reason: 'Entrega de setor estratégico ao capital externo.' },
            ],
            approvalDelta: 0.8 * escala,
            congressDelta: 2,
            stressDelta: 3,
            diplomacy: { countryId: country.id, relationDelta: 9, tradeDelta: 8, isolationDelta: -4 },
          },
          {
            id: 'parcial',
            label: 'Aceitar só parte dos projetos',
            description: 'Portos e transmissão sim; ferrovia continua estatal.',
            warning: 'Metade do investimento, metade da polêmica, e o setor estratégico fica em casa.',
            cost: 0,
            impacts: {
              infrastructureIndex: 1.2 * escala,
              gdpGrowth: 0.07 * escala,
              businessConfidence: 2 * escala,
            },
            groupImpacts: [
              { groupId: 'trabalhadores', delta: 0.6, reason: 'Parte da obra sai.' },
            ],
            approvalDelta: 0.4,
            congressDelta: 1,
            stressDelta: 3,
            diplomacy: { countryId: country.id, relationDelta: 4, tradeDelta: 4 },
          },
          {
            id: 'recusar',
            label: 'Recusar a garantia',
            description: 'Sem cláusula de arbitragem internacional, sem acordo.',
            warning: 'Preserva soberania regulatória e manda o dinheiro para o país vizinho.',
            cost: 0,
            impacts: { businessConfidence: -4 * escala, countryRisk: 6 * escala },
            groupImpacts: [
              { groupId: 'universitarios', delta: 1.2, reason: 'Governo recusou arbitragem externa.' },
              { groupId: 'empresariado', delta: -2 * escala, reason: 'Investimento perdido.' },
            ],
            approvalDelta: -0.2,
            congressDelta: -1,
            stressDelta: 4,
            diplomacy: { countryId: country.id, relationDelta: -5, tradeDelta: -3, isolationDelta: 2 },
          },
        ],
      };
    },
  },
  {
    id: 'dyn_intl_parceria_tecnologica',
    category: 'internacional',
    severity: 'atencao',
    weight: 10,
    tags: ['educacao', 'diplomacia'],
    cooldownMonths: 9,
    conditions: { minMonth: 6 },
    canGenerate: (state) => state.diplomacy.countries.some((country) => country.weight >= 45),
    build: (state, rng) => {
      const pick = randomCountry(state, rng, 'amigo');
      if (!pick) return null;
      const { country } = pick;
      const escala = 0.4 + country.weight / 100;

      return {
        title: fill('Parceria tecnológica com {country}', { country: country.name }),
        brief: fill(
          'O Ministério da Ciência do {country} oficializou uma parceria tecnológica exclusiva que pode alavancar nossa indústria espacial e de defesa. A cláusula de exclusividade é o problema: assinar significa fechar a porta para o outro polo do tabuleiro.',
          { country: country.name },
        ),
        options: [
          {
            id: 'assinar',
            label: 'Assinar a exclusividade',
            description: 'Transferência de tecnologia e centro de pesquisa conjunto.',
            warning: 'Ganha uma década de tecnologia e perde a neutralidade que te dava trânsito nos dois lados.',
            cost: 2,
            impacts: {
              gdpGrowth: 0.08 * escala,
              businessConfidence: 3 * escala,
              primaryBalance: -2,
              educationIndex: 0.6 * escala,
            },
            groupImpacts: [
              { groupId: 'universitarios', delta: 2.2 * escala, reason: 'Pesquisa com financiamento novo.' },
              { groupId: 'militares', delta: 2 * escala, reason: 'Indústria de defesa fortalecida.' },
            ],
            approvalDelta: 0.5 * escala,
            congressDelta: 1,
            stressDelta: 4,
            diplomacy: { countryId: country.id, relationDelta: 12, trustDelta: 10, isolationDelta: -3 },
          },
          {
            id: 'sem_exclusividade',
            label: 'Assinar sem exclusividade',
            description: 'Cooperação aberta, com a porta do outro lado igualmente aberta.',
            warning: 'Menos tecnologia agora e nenhuma ponte queimada.',
            cost: 1,
            impacts: { educationIndex: 0.3 * escala, primaryBalance: -1 },
            groupImpacts: [
              { groupId: 'universitarios', delta: 1.2, reason: 'Cooperação científica.' },
            ],
            approvalDelta: 0.2,
            congressDelta: 0,
            stressDelta: 2,
            diplomacy: { countryId: country.id, relationDelta: 4, trustDelta: 3 },
          },
        ],
      };
    },
  },
  {
    id: 'dyn_intl_elogio_cupula',
    category: 'internacional',
    severity: 'rotina',
    weight: 10,
    tags: ['diplomacia'],
    cooldownMonths: 6,
    conditions: { minApproval: 45 },
    canGenerate: (state) => state.diplomacy.countries.length > 0 && state.economy.gdpGrowth > 0.8,
    pressure: (state) => 1 + Math.max(0, state.economy.gdpGrowth - 1) * 0.2,
    build: (state, rng) => {
      const pick = randomCountry(state, rng, 'amigo');
      if (!pick) return null;
      const { country, leaderTitle } = pick;
      const escala = 0.4 + country.weight / 100;

      return {
        title: fill('{country} chama o Brasil de exemplo global', { country: country.name }),
        brief: fill(
          'O {title} do {country} elogiou publicamente o nosso país como "exemplo global de estabilidade e crescimento" durante a cúpula mundial. A frase já está em todos os terminais de notícia econômica do planeta, e os fundos que olham país emergente estão relendo o relatório do Brasil.',
          { title: leaderTitle, country: country.name },
        ),
        options: [
          {
            id: 'capitalizar',
            label: 'Capitalizar com os investidores',
            description: 'Roadshow imediato com fundos e agências de risco.',
            warning: 'Transforma elogio em capital — e cobra entrega no trimestre seguinte.',
            cost: 0.4,
            impacts: {
              countryRisk: -14 * escala,
              businessConfidence: 5 * escala,
              primaryBalance: -0.4,
            },
            groupImpacts: [
              { groupId: 'mercado_financeiro', delta: 2.6 * escala, reason: 'Reconhecimento internacional.' },
              { groupId: 'empresariado', delta: 1.4 * escala, reason: 'Ambiente de negócios elogiado.' },
            ],
            approvalDelta: 0.6,
            congressDelta: 1,
            stressDelta: 1,
            diplomacy: { countryId: country.id, relationDelta: 5, isolationDelta: -6 },
          },
          {
            id: 'discreto',
            label: 'Agradecer discretamente',
            description: 'Nota do Itamaraty, sem alarde interno.',
            warning: 'Evita parecer que o governo se anima com elogio de fora.',
            cost: 0,
            impacts: { countryRisk: -5 * escala },
            groupImpacts: [],
            approvalDelta: 0.2,
            congressDelta: 0,
            stressDelta: 0,
            diplomacy: { countryId: country.id, relationDelta: 3, isolationDelta: -3 },
          },
        ],
      };
    },
  },

  // ------------------------------------------------------------- NEGATIVOS
  {
    id: 'dyn_intl_sancoes',
    category: 'internacional',
    severity: 'critico',
    weight: 9,
    tags: ['diplomacia', 'economia'],
    cooldownMonths: 10,
    conditions: { minMonth: 5 },
    // Sanção só dói vinda de quem compra: país sem comércio não paralisa nada.
    canGenerate: (state) => state.diplomacy.countries.some((country) => country.trade >= 55),
    pressure: (state) => 1 + Math.max(0, 50 - state.diplomacy.isolation) * 0.005,
    build: (state, rng) => {
      const pick = randomCountry(state, rng, 'parceiro_comercial');
      if (!pick || pick.country.trade < 45) return null;
      const { country } = pick;
      const escala = 0.3 + (country.trade / 100) * 1.6;

      return {
        title: fill('{country} impõe sanções aos nossos produtos', { country: country.name }),
        brief: fill(
          'O governo do {country} impôs sanções econômicas e embargo aos nossos principais produtos de exportação. É o nosso parceiro com {trade} de intensidade comercial — o que significa contêiner parado no porto a partir de segunda-feira.',
          { country: country.name, trade: country.trade.toFixed(0) },
        ),
        options: [
          {
            id: 'negociar',
            label: 'Enviar missão negociadora',
            description: 'Chanceler e ministro da Fazenda no primeiro voo, com proposta na mão.',
            warning: 'Costuma funcionar em semanas. Até lá, o prejuízo corre.',
            cost: 0.5,
            impacts: {
              gdpGrowth: -0.12 * escala,
              businessConfidence: -3 * escala,
              primaryBalance: -0.5,
            },
            groupImpacts: [
              { groupId: 'agronegocio', delta: -2.4 * escala, reason: 'Exportação embargada.' },
              { groupId: 'empresariado', delta: -1.8 * escala, reason: 'Contrato externo travado.' },
            ],
            approvalDelta: -0.4,
            congressDelta: 0,
            stressDelta: 9,
            diplomacy: { countryId: country.id, relationDelta: 4, tensionDelta: -6, isolationDelta: 2 },
          },
          {
            id: 'retaliar',
            label: 'Retaliar na mesma moeda',
            description: 'Tarifa espelho sobre os produtos deles e queixa na OMC.',
            warning: 'Firmeza que agrada em casa e transforma um embargo em guerra comercial.',
            cost: 0,
            impacts: {
              gdpGrowth: -0.24 * escala,
              inflation: 0.22 * escala,
              businessConfidence: -6 * escala,
              countryRisk: 14 * escala,
            },
            groupImpacts: [
              { groupId: 'trabalhadores', delta: 1, reason: 'Governo reagiu ao embargo.' },
              { groupId: 'agronegocio', delta: -3.4 * escala, reason: 'Guerra comercial aberta.' },
              { groupId: 'mercado_financeiro', delta: -2.6 * escala, reason: 'Escalada comercial.' },
            ],
            approvalDelta: 0.4,
            congressDelta: -1,
            stressDelta: 12,
            diplomacy: { countryId: country.id, relationDelta: -18, tradeDelta: -14, tensionDelta: 20, isolationDelta: 6 },
          },
          {
            id: 'redirecionar',
            label: 'Buscar outros mercados',
            description: 'Missão comercial para redirecionar a safra e a manufatura embargadas.',
            warning: 'Demora um ano para compensar e não depende de ninguém voltar atrás.',
            cost: 1.2,
            impacts: {
              gdpGrowth: -0.16 * escala,
              primaryBalance: -1.2,
              businessConfidence: -1 * escala,
            },
            groupImpacts: [
              { groupId: 'agronegocio', delta: -1.4 * escala, reason: 'Safra sem comprador imediato.' },
            ],
            approvalDelta: -0.2,
            congressDelta: 1,
            stressDelta: 7,
            diplomacy: { countryId: country.id, relationDelta: -6, tradeDelta: -8, isolationDelta: -2 },
          },
        ],
      };
    },
  },
  {
    id: 'dyn_intl_embaixador_ofende',
    category: 'internacional',
    severity: 'atencao',
    weight: 11,
    tags: ['diplomacia'],
    cooldownMonths: 6,
    canGenerate: (state) => state.diplomacy.countries.length > 0,
    pressure: (state) => 1 + state.diplomacy.isolation * 0.01,
    build: (state, rng) => {
      const pick = randomCountry(state, rng, 'tenso');
      if (!pick) return null;
      const { country } = pick;

      return {
        title: fill('Embaixador do {country} ofende ministros brasileiros', { country: country.name }),
        brief: fill(
          'O embaixador do {country} ofendeu publicamente os seus ministros — chamou a equipe econômica de "amadores simpáticos" — e ameaçou cortar relações diplomáticas depois de um mal-entendido sobre uma nota do Itamaraty. O vídeo da coletiva tem legenda em quatro idiomas.',
          { country: country.name },
        ),
        options: [
          {
            id: 'expulsar',
            label: 'Declará-lo persona non grata',
            description: 'Expulsão do embaixador em 72 horas.',
            warning: 'Resposta que a opinião pública adora e que fecha a embaixada por meses.',
            cost: 0,
            impacts: { businessConfidence: -2, countryRisk: 5 },
            groupImpacts: [
              { groupId: 'militares', delta: 1.4, reason: 'Soberania defendida.' },
              { groupId: 'empresariado', delta: -1.2, reason: 'Crise diplomática com parceiro.' },
            ],
            approvalDelta: 0.8,
            congressDelta: 1,
            stressDelta: 6,
            diplomacy: { countryId: country.id, relationDelta: -14, tensionDelta: 18, isolationDelta: 4 },
          },
          {
            id: 'nota',
            label: 'Nota de protesto formal',
            description: 'Convocação do embaixador ao Itamaraty e nota dura, sem expulsão.',
            warning: 'O caminho diplomático. Rende meia manchete e preserva a relação.',
            cost: 0,
            impacts: {},
            groupImpacts: [],
            approvalDelta: 0.2,
            congressDelta: 0,
            stressDelta: 3,
            diplomacy: { countryId: country.id, relationDelta: -3, tensionDelta: 6 },
          },
          {
            id: 'ignorar',
            label: 'Tratar como ruído',
            description: 'Nenhuma resposta: embaixador não fala pelo governo dele.',
            warning: 'Evita a crise e deixa a ofensa sem resposta na frente do país inteiro.',
            cost: 0,
            impacts: {},
            groupImpacts: [{ groupId: 'militares', delta: -1, reason: 'Ofensa sem resposta.' }],
            approvalDelta: -0.5,
            congressDelta: 0,
            stressDelta: 2,
            diplomacy: { countryId: country.id, relationDelta: 1, tensionDelta: 2 },
          },
        ],
      };
    },
  },
  {
    id: 'dyn_intl_espionagem',
    category: 'internacional',
    severity: 'critico',
    weight: 7,
    tags: ['diplomacia', 'seguranca'],
    cooldownMonths: 12,
    conditions: { minMonth: 8 },
    canGenerate: (state) => state.diplomacy.countries.some((country) => country.weight >= 40),
    build: (state, rng) => {
      const pick = randomCountry(state, rng, 'tenso');
      if (!pick) return null;
      const { country } = pick;

      return {
        title: fill('Agentes do {country} presos em instalação de pesquisa', { country: country.name }),
        brief: fill(
          'Agentes do serviço de inteligência do {country} foram capturados tentando roubar segredos de Estado nas nossas instalações de pesquisa. A embaixada nega tudo e chama a prisão de "provocação". Os três estão presos, e a decisão do que fazer com eles é sua.',
          { country: country.name },
        ),
        options: [
          {
            id: 'expor',
            label: 'Expor tudo publicamente',
            description: 'Coletiva com provas, imagens e o material apreendido.',
            warning: 'Vira crise internacional de primeira grandeza. E ninguém mais tenta.',
            cost: 0,
            impacts: { securityIndex: 2, countryRisk: 10, businessConfidence: -3 },
            groupImpacts: [
              { groupId: 'militares', delta: 3, reason: 'Contrainteligência funcionou.' },
              { groupId: 'policiais', delta: 1.6, reason: 'Prisão em flagrante divulgada.' },
              { groupId: 'empresariado', delta: -1.4, reason: 'Tensão internacional.' },
            ],
            approvalDelta: 1.4,
            congressDelta: 2,
            stressDelta: 12,
            diplomacy: { countryId: country.id, relationDelta: -22, trustDelta: -20, tensionDelta: 26, isolationDelta: 5 },
          },
          {
            id: 'negociar_silencio',
            label: 'Negociar em silêncio',
            description: 'Devolver os agentes em troca de concessões comerciais e tecnológicas.',
            warning: 'Ganha muito e não pode contar a ninguém. Se vazar, vira acobertamento.',
            cost: 0,
            impacts: { businessConfidence: 2, gdpGrowth: 0.05 },
            groupImpacts: [
              { groupId: 'militares', delta: -1.8, reason: 'Caso resolvido por baixo do pano.' },
            ],
            approvalDelta: -0.2,
            congressDelta: 0,
            stressDelta: 10,
            diplomacy: { countryId: country.id, relationDelta: 6, tradeDelta: 6, tensionDelta: -4 },
          },
          {
            id: 'processar',
            label: 'Processar pela lei brasileira',
            description: 'Julgamento comum, sem tratamento diplomático especial.',
            warning: 'Institucional e lento. A crise dura o tempo do processo.',
            cost: 0,
            impacts: { securityIndex: 1 },
            groupImpacts: [{ groupId: 'militares', delta: 1.2, reason: 'Resposta legal firme.' }],
            approvalDelta: 0.6,
            congressDelta: 1,
            stressDelta: 8,
            diplomacy: { countryId: country.id, relationDelta: -12, tensionDelta: 14, isolationDelta: 2 },
          },
        ],
      };
    },
  },
  {
    id: 'dyn_intl_cobranca_divida',
    category: 'internacional',
    severity: 'grave',
    weight: 8,
    tags: ['economia', 'diplomacia'],
    cooldownMonths: 10,
    conditions: { minMonth: 6, minDebt: 74 },
    canGenerate: (state) => state.diplomacy.countries.some((country) => country.weight >= 50),
    pressure: (state) => 1 + Math.max(0, state.economy.debtToGdp - 78) * 0.05,
    build: (state, rng) => {
      const pick = randomCountry(state, rng, 'parceiro_comercial');
      if (!pick) return null;
      const { country, leaderTitle } = pick;
      const escala = 0.4 + country.weight / 100;
      const valor = Math.round(8 + country.weight * 0.4);

      return {
        title: fill('{country} cobra dívida antiga e ameaça congelar ativos', { country: country.name }),
        brief: fill(
          'O {title} do {country} exigiu o pagamento imediato de uma dívida externa antiga de R$ {value} bi, ameaçando congelar nossos ativos no exterior. O contrato é dos anos 90, a cláusula é ruim e os advogados do Tesouro dizem que a chance de ganhar na arbitragem é de meio a meio.',
          { title: leaderTitle, country: country.name, value: valor },
        ),
        options: [
          {
            id: 'pagar',
            label: 'Pagar a dívida',
            description: 'Quitar à vista e encerrar o assunto.',
            warning: 'Custa caro no exercício e devolve credibilidade externa imediata.',
            cost: valor,
            impacts: {
              primaryBalance: -valor,
              countryRisk: -12 * escala,
              fiscalCredibility: 3,
            },
            groupImpacts: [
              { groupId: 'mercado_financeiro', delta: 2 * escala, reason: 'Dívida honrada.' },
              { groupId: 'servidores', delta: -1.6, reason: 'Dinheiro que faltará em outro lugar.' },
            ],
            approvalDelta: -0.8,
            congressDelta: -1,
            stressDelta: 7,
            diplomacy: { countryId: country.id, relationDelta: 8, trustDelta: 10, tensionDelta: -10 },
          },
          {
            id: 'arbitragem',
            label: 'Levar à arbitragem internacional',
            description: 'Contestar a cláusula e disputar no tribunal arbitral.',
            warning: 'Ganha tempo e pode ganhar tudo. Enquanto corre, o risco-país sobe.',
            cost: 0.6,
            impacts: { countryRisk: 9 * escala, primaryBalance: -0.6 },
            groupImpacts: [
              { groupId: 'mercado_financeiro', delta: -1.4 * escala, reason: 'Disputa jurídica externa.' },
            ],
            approvalDelta: 0.2,
            congressDelta: 1,
            stressDelta: 9,
            diplomacy: { countryId: country.id, relationDelta: -8, tensionDelta: 12 },
          },
          {
            id: 'renegociar',
            label: 'Renegociar prazo e juros',
            description: 'Parcelar com deságio, dando garantia soberana.',
            warning: 'A saída chata que quase sempre é a certa: menos caixa hoje, sem crise externa.',
            cost: valor * 0.35,
            impacts: {
              primaryBalance: -valor * 0.35,
              countryRisk: -4 * escala,
              debtToGdp: 0.2,
            },
            groupImpacts: [],
            approvalDelta: -0.2,
            congressDelta: 0,
            stressDelta: 5,
            diplomacy: { countryId: country.id, relationDelta: 4, trustDelta: 5, tensionDelta: -6 },
          },
        ],
      };
    },
  },
  {
    id: 'dyn_intl_condenacao_assembleia',
    category: 'internacional',
    severity: 'grave',
    weight: 9,
    tags: ['diplomacia', 'institucional'],
    cooldownMonths: 8,
    conditions: { minMonth: 4 },
    canGenerate: (state) => state.diplomacy.countries.length > 0,
    pressure: (state) => 1 + state.diplomacy.isolation * 0.012 + state.congress.impeachmentRisk * 0.01,
    build: (state, rng) => {
      const pick = randomCountry(state, rng, 'tenso');
      if (!pick) return null;
      const { country } = pick;
      const escala = 0.4 + country.weight / 100;

      return {
        title: fill('{country} condena o Brasil em assembleia global', { country: country.name }),
        brief: fill(
          'O líder do {country} condenou duramente nosso país em uma assembleia global, acusando o seu governo de práticas autoritárias e de violar acordos internacionais assinados. Sete delegações aplaudiram, o que é mais grave do que o discurso.',
          { country: country.name },
        ),
        options: [
          {
            id: 'responder',
            label: 'Responder no mesmo fórum',
            description: 'Direito de resposta na tribuna, com dados e documentos.',
            warning: 'Enfrentar de igual para igual funciona quando existe o que mostrar.',
            cost: 0,
            impacts: { countryRisk: 4 * escala },
            groupImpacts: [
              { groupId: 'militares', delta: 1.2, reason: 'Governo defendeu a soberania.' },
              { groupId: 'universitarios', delta: -0.8, reason: 'Escalada retórica.' },
            ],
            approvalDelta: 0.6,
            congressDelta: 0,
            stressDelta: 7,
            diplomacy: { countryId: country.id, relationDelta: -8, tensionDelta: 12, isolationDelta: 2 },
          },
          {
            id: 'diplomacia',
            label: 'Trabalhar nos bastidores',
            description: 'Chanceler negocia com as delegações que aplaudiram, sem holofote.',
            warning: 'Não rende manchete e é o que efetivamente desmonta um isolamento.',
            cost: 0.8,
            impacts: { primaryBalance: -0.8 },
            groupImpacts: [],
            approvalDelta: -0.2,
            congressDelta: 1,
            stressDelta: 5,
            diplomacy: { countryId: country.id, relationDelta: 2, isolationDelta: -6 },
          },
          {
            id: 'ignorar',
            label: 'Ignorar a acusação',
            description: 'Nenhuma resposta oficial ao discurso.',
            warning: 'O silêncio é lido como confirmação por quem já desconfiava.',
            cost: 0,
            impacts: { countryRisk: 6 * escala },
            groupImpacts: [],
            approvalDelta: -0.6,
            congressDelta: -1,
            stressDelta: 4,
            diplomacy: { countryId: country.id, relationDelta: -4, isolationDelta: 5 },
          },
        ],
      };
    },
  },
];
