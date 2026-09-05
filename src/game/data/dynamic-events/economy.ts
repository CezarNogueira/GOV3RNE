import type { DynamicEventDefinition, EventOption, PolicyImpact } from '../../types/index';
import {
  economicWeight,
  fill,
  randomPrivateCompany,
  randomStateCompany,
} from '../../engines/event-actors';

/**
 * ECONOMIA E SOCIEDADE
 *
 * O país reagindo por conta própria: categoria que para, estatal que aparece no
 * noticiário, empresa que ameaça ir embora se não receber isenção.
 *
 * Duas coisas são calculadas, nunca escritas: QUEM entra em cena (a estatal e a
 * multinacional saem do banco de empresas) e QUANTO aquilo pesa (o impacto é
 * proporcional ao tamanho da empresa e à categoria que cruzou os braços).
 */

/** As categorias que podem parar o país, e o que cada uma paralisa. */
const UNIONS: readonly {
  id: string;
  label: string;
  demand: string;
  impacts: PolicyImpact;
  groups: { groupId: string; delta: number; reason: string }[];
}[] = [
  {
    id: 'caminhoneiros',
    label: 'caminhoneiros',
    demand: 'preço do diesel e piso do frete',
    impacts: { inflation: 0.5, gdpGrowth: -0.35, businessConfidence: -6 },
    groups: [
      { groupId: 'caminhoneiros', delta: 2.4, reason: 'A categoria se sentiu ouvida ao parar.' },
      { groupId: 'empresariado', delta: -2.6, reason: 'Estoque parado na estrada.' },
      { groupId: 'baixa_renda', delta: -1.8, reason: 'Prateleira vazia e preço subindo.' },
    ],
  },
  {
    id: 'professores',
    label: 'professores',
    demand: 'piso salarial e condições de trabalho',
    impacts: { educationIndex: -1.2, gdpGrowth: -0.05 },
    groups: [
      { groupId: 'professores', delta: 3, reason: 'Categoria mobilizada.' },
      { groupId: 'classe_media', delta: -1.6, reason: 'Filho sem aula.' },
      { groupId: 'baixa_renda', delta: -1.2, reason: 'Escola fechada e merenda parada.' },
    ],
  },
  {
    id: 'servidores',
    label: 'servidores públicos federais',
    demand: 'reajuste depois de anos sem correção',
    impacts: { fiscalCredibility: -2, gdpGrowth: -0.08 },
    groups: [
      { groupId: 'servidores', delta: 3.2, reason: 'Greve pelo reajuste.' },
      { groupId: 'classe_media', delta: -1.4, reason: 'Serviço público parado.' },
    ],
  },
  {
    id: 'metalurgicos',
    label: 'trabalhadores da indústria',
    demand: 'reajuste e fim das demissões em massa',
    impacts: { gdpGrowth: -0.28, businessConfidence: -4 },
    groups: [
      { groupId: 'trabalhadores', delta: 2.6, reason: 'Chão de fábrica parado.' },
      { groupId: 'empresariado', delta: -3, reason: 'Linha de produção interrompida.' },
    ],
  },
  {
    id: 'portuarios',
    label: 'portuários',
    demand: 'segurança no cais e revisão da escala',
    impacts: { gdpGrowth: -0.22, businessConfidence: -5, inflation: 0.15 },
    groups: [
      { groupId: 'trabalhadores', delta: 1.8, reason: 'Cais parado por reivindicação.' },
      { groupId: 'agronegocio', delta: -3.2, reason: 'Safra parada no porto.' },
    ],
  },
  {
    id: 'saude',
    label: 'profissionais da saúde',
    demand: 'contratação e pagamento de plantões atrasados',
    impacts: { healthIndex: -1.6 },
    groups: [
      { groupId: 'servidores', delta: 2.2, reason: 'Categoria em greve por plantão atrasado.' },
      { groupId: 'baixa_renda', delta: -2.4, reason: 'Fila do posto parada.' },
    ],
  },
];

export const ECONOMY_EVENTS: readonly DynamicEventDefinition[] = [
  {
    id: 'dyn_greve_categoria',
    category: 'social',
    severity: 'grave',
    weight: 18,
    tags: ['trabalho', 'economia'],
    cooldownMonths: 4,
    pressure: (state) => {
      const eco = state.economy;
      const mobilization =
        state.socialGroups.reduce((total, group) => total + group.mobilization, 0) /
        Math.max(1, state.socialGroups.length);
      return (
        1 +
        Math.max(0, eco.inflation - eco.inflationTarget) * 0.12 +
        Math.max(0, eco.unemployment - 7) * 0.1 +
        mobilization * 0.015
      );
    },
    build: (_state, rng) => {
      const union = rng.pick(UNIONS);
      const negociar: EventOption = {
        id: 'negociar',
        label: 'Sentar à mesa',
        description: `Abrir negociação sobre ${union.demand}.`,
        warning: 'Encerra a paralisação em dias e abre precedente para a próxima categoria.',
        cost: 3.5,
        impacts: { primaryBalance: -3.5, fiscalCredibility: -1 },
        groupImpacts: union.groups.map((group) => ({ ...group, delta: group.delta * 0.5 })),
        approvalDelta: 0.4,
        congressDelta: 0,
        stressDelta: 5,
      };

      return {
        title: fill('Greve geral dos {union}', { union: union.label }),
        brief: fill(
          'O sindicato dos {union} declarou greve geral por {demand}, paralisando parte da infraestrutura do país. A categoria diz que fica parada o tempo que for preciso; o governo tem alguns dias antes de o efeito aparecer no preço.',
          { union: union.label, demand: union.demand },
        ),
        options: [
          negociar,
          {
            id: 'aguentar',
            label: 'Aguentar a greve',
            description: 'Nenhuma concessão: a categoria volta quando o salário fizer falta.',
            warning: 'Não custa caixa. Custa tudo o que a paralisação quebrar enquanto durar.',
            cost: 0,
            impacts: union.impacts,
            groupImpacts: union.groups,
            approvalDelta: -1.4,
            congressDelta: -1,
            stressDelta: 9,
          },
          {
            id: 'judicializar',
            label: 'Declarar a greve abusiva',
            description: 'Ir à Justiça pedir multa diária e serviço mínimo obrigatório.',
            warning: 'Resolve no papel e radicaliza na rua. O sindicato ganha um mártir.',
            cost: 0,
            impacts: { ...union.impacts, gdpGrowth: (union.impacts.gdpGrowth ?? 0) * 0.5 },
            groupImpacts: union.groups.map((group) => ({
              ...group,
              delta: group.delta > 0 ? -group.delta * 0.8 : group.delta * 0.5,
            })),
            approvalDelta: -0.9,
            congressDelta: 1,
            stressDelta: 7,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_escandalo_estatal',
    category: 'economico',
    severity: 'grave',
    weight: 14,
    tags: ['economia', 'institucional'],
    cooldownMonths: 8,
    conditions: { minMonth: 4 },
    canGenerate: (state) =>
      state.companies.companies.some(
        (company) => company.control === 'federal' && company.ownership.stateOwnership > 0,
      ),
    pressure: (state) => 1 + Math.max(0, 55 - state.nation.corruptionPerception) * 0.02,
    build: (state, rng) => {
      const company = randomStateCompany(state, rng);
      if (!company) return null;

      // Crise na maior estatal do país não pode valer o mesmo que crise numa
      // estatal pequena: tudo aqui é multiplicado pelo peso econômico dela.
      const weight = economicWeight(state, company);
      const escala = 0.4 + weight * 2.2;

      return {
        title: fill('Escândalo de corrupção atinge {company}', { company: company.name }),
        brief: fill(
          'Um escândalo de corrupção explodiu envolvendo os diretores da estatal {company} — {employees} empregados e R$ {revenue} bi de faturamento ao ano. A denúncia fala em superfaturamento em contratos de manutenção; a diretoria foi indicada por gente do seu governo, e a imprensa já tem a lista.',
          {
            company: company.name,
            employees: company.employees.toLocaleString('pt-BR'),
            revenue: (company.financials.revenue / 1000).toFixed(0),
          },
        ),
        followUp: { definitionId: 'dyn_oposicao_cpi_familia', afterMonths: 3 },
        options: [
          {
            id: 'trocar_diretoria',
            label: 'Trocar a diretoria inteira',
            description: 'Demitir o conselho, abrir auditoria e nomear direção técnica.',
            warning: 'Resolve o problema e desmonta o arranjo político que sustentava aquelas cadeiras.',
            cost: 0,
            impacts: {
              corruptionPerception: 4 * escala,
              businessConfidence: 2 * escala,
              countryRisk: -6 * escala,
            },
            groupImpacts: [
              { groupId: 'classe_media', delta: 1.8 * escala, reason: 'Diretoria trocada.' },
              { groupId: 'mercado_financeiro', delta: 1.4 * escala, reason: 'Governança restabelecida.' },
            ],
            approvalDelta: 0.6 * escala,
            congressDelta: -4,
            stressDelta: 9,
          },
          {
            id: 'auditoria',
            label: 'Auditoria sem demissões',
            description: 'Apurar antes de punir, mantendo a operação e a diretoria no lugar.',
            warning: 'Institucional e lento. Enquanto a auditoria roda, a manchete se repete.',
            cost: 0.6,
            impacts: { corruptionPerception: 1 * escala, primaryBalance: -0.6 },
            groupImpacts: [],
            approvalDelta: -0.3 * escala,
            congressDelta: 0,
            stressDelta: 6,
          },
          {
            id: 'negar',
            label: 'Tratar como perseguição',
            description: 'Defender a diretoria e apontar interesse na privatização por trás da denúncia.',
            warning: 'Se a denúncia se confirmar, o governo terá defendido os denunciados por escrito.',
            cost: 0,
            impacts: {
              corruptionPerception: -7 * escala,
              businessConfidence: -4 * escala,
              countryRisk: 10 * escala,
            },
            groupImpacts: [
              { groupId: 'classe_media', delta: -2.4 * escala, reason: 'Governo defendeu a diretoria.' },
              { groupId: 'mercado_financeiro', delta: -2.2 * escala, reason: 'Governança ignorada.' },
            ],
            approvalDelta: -1.8 * escala,
            congressDelta: -3,
            stressDelta: 8,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_multinacional_chantagem',
    category: 'economico',
    severity: 'grave',
    weight: 13,
    tags: ['economia', 'trabalho'],
    cooldownMonths: 7,
    canGenerate: (state) => state.companies.companies.some((company) => company.control === 'privada'),
    pressure: (state) => 1 + Math.max(0, state.economy.unemployment - 7) * 0.12,
    build: (state, rng) => {
      const company = randomPrivateCompany(state, rng);
      if (!company) return null;

      const weight = economicWeight(state, company);
      const escala = 0.4 + weight * 2.4;
      // Ameaça de demissão em cima do quadro real da empresa, não um número
      // inventado: é o que faz a chantagem doer mais quando vem de quem emprega.
      const ameacados = Math.round(company.employees * 0.18);
      // A receita da empresa é guardada em R$ MILHÕES; a isenção pedida é uma
      // fração dela, convertida para os R$ bilhões em que o orçamento fala.
      const isencao = Math.max(1.5, Math.round((company.financials.revenue / 1000) * 0.03));

      return {
        title: fill('{company} ameaça fechar as portas', { company: company.name }),
        brief: fill(
          'A {company}, do setor de {sector}, ameaça encerrar operações no país e demitir {jobs} funcionários se não receber isenção fiscal de R$ {value} bi por ano. A empresa emprega {employees} pessoas no total, e o anúncio saiu antes de qualquer conversa com o governo.',
          {
            company: company.name,
            sector: company.sector,
            jobs: ameacados.toLocaleString('pt-BR'),
            value: isencao,
            employees: company.employees.toLocaleString('pt-BR'),
          },
        ),
        options: [
          {
            id: 'ceder',
            label: 'Conceder a isenção',
            description: 'Regime especial para o setor, com contrapartida de manutenção do emprego.',
            warning: 'Salva os empregos e ensina a toda empresa grande que ameaçar funciona.',
            cost: isencao,
            impacts: {
              primaryBalance: -isencao,
              unemployment: -0.06 * escala,
              businessConfidence: 3 * escala,
            },
            groupImpacts: [
              { groupId: 'trabalhadores', delta: 1.4 * escala, reason: 'Emprego preservado.' },
              { groupId: 'empresariado', delta: 2 * escala, reason: 'Governo cedeu à demanda.' },
              { groupId: 'servidores', delta: -1.2, reason: 'Renúncia fiscal enquanto falta orçamento.' },
            ],
            approvalDelta: 0.2,
            congressDelta: 1,
            stressDelta: 6,
          },
          {
            id: 'recusar',
            label: 'Recusar a chantagem',
            description: 'Nota dizendo que política tributária não se decide por ameaça.',
            warning: 'Se ela for embora, o desemprego aparece na sua conta. Se ficar, você ganhou.',
            cost: 0,
            impacts: {
              unemployment: 0.09 * escala,
              businessConfidence: -4 * escala,
              gdpGrowth: -0.08 * escala,
            },
            groupImpacts: [
              { groupId: 'empresariado', delta: -2.4 * escala, reason: 'Governo recusou negociar.' },
              { groupId: 'trabalhadores', delta: -1.6 * escala, reason: 'Ameaça de demissão de pé.' },
              { groupId: 'classe_media', delta: 1, reason: 'Governo não cedeu à chantagem.' },
            ],
            approvalDelta: 0.3,
            congressDelta: -1,
            stressDelta: 8,
          },
          {
            id: 'negociar_contrapartida',
            label: 'Negociar com contrapartida dura',
            description: 'Metade da isenção, condicionada a investimento novo e emprego auditado.',
            warning: 'A empresa reclama, os dois lados assinam, e o acordo tem prazo e fiscal.',
            cost: isencao * 0.5,
            impacts: {
              primaryBalance: -isencao * 0.5,
              businessConfidence: 1 * escala,
              unemployment: -0.03 * escala,
            },
            groupImpacts: [
              { groupId: 'trabalhadores', delta: 0.8 * escala, reason: 'Emprego com contrapartida.' },
              { groupId: 'empresariado', delta: 0.6, reason: 'Acordo com condições.' },
            ],
            approvalDelta: 0.4,
            congressDelta: 1,
            stressDelta: 5,
          },
        ],
      };
    },
  },
];
