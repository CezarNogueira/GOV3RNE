import type {
  ApprovalState,
  BudgetLine,
  CampaignPromise,
  CongressState,
  DiplomacyState,
  EconomyState,
  FamilyMember,
  FederalUnit,
  GameState,
  GovernmentState,
  Minister,
  MinistryId,
  NationState,
  PartyBloc,
  PartyProfile,
  President,
  Region,
  SocialGroup,
  TaxLine,
} from '../types/index';
import type { NewGameInput } from '../schemas/setup';
import { MACRO_BASELINE } from '../data/generated/baseline';
import { STATES, STATE_PROFILE } from '../data/states';
import { PARTIES, PARTY_BY_ID, TOTAL_CHAMBER_SEATS, TOTAL_SENATE_SEATS } from '../data/parties';
import { MINISTRIES, MINISTRY_IDS } from '../data/ministries';
import { SOCIAL_GROUPS } from '../data/social-groups';
import { COUNTRIES, DIPLOMATIC_BLOCS } from '../data/countries';
import { PROMISE_CATALOG } from '../data/promises';
import {
  CHAMBER_SPEAKERS,
  MINISTER_POOL,
  OPPOSITION_LEADERS,
  SENATE_SPEAKERS,
  VICE_POOL,
  FIRST_NAMES,
  LAST_NAMES,
} from '../data/people';
import { INHERITED_PROGRAMS } from '../data/programs';
import { buildCompaniesState } from './companies/company-service';

/** Custo anualizado dos programas herdados, já contabilizado como custeio mensal. */
const INHERITED_PROGRAM_ANNUAL_COST = INHERITED_PROGRAMS.reduce(
  (total, program) => total + program.monthlyCost * 12,
  0,
);
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { Rng, createSeed } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { makeId, monthLabel } from '../utils/index';

/**
 * 2 — entrada do sistema nacional de empresas. Saves da versão 1 guardavam uma
 * lista decorativa de "corporations"; a migração descarta aquela lista e monta
 * o sistema novo a partir dos dados de referência.
 */
export const GAME_STATE_VERSION = 3;

/**
 * Monta uma partida inteira a partir das escolhas de campanha.
 *
 * Os indicadores macro partem de dados oficiais (ver MACRO_BASELINE) e são
 * ajustados pela dificuldade escolhida: em Realista o presidente herda um país
 * pior do que o real, em Fácil herda um melhor. Do primeiro tick em diante,
 * nenhum número aqui corresponde mais à realidade.
 */
export function createGame(input: NewGameInput): GameState {
  const seed = input.seed ?? createSeed();
  const rng = new Rng(seed);
  const preset = DIFFICULTY_PRESETS[input.difficulty];
  const now = new Date().toISOString();

  const party = resolveParty(input);
  const president = buildPresident(input);
  const family = buildFamily(input, rng);
  const economy = buildEconomy(preset.startingTreasury, input.difficulty);
  const nation = buildNation();
  const states = buildStates(rng, party);
  const socialGroups = buildSocialGroups(president, party);
  const congress = buildCongress(rng, party, input);
  const government = buildGovernment(rng, input, party);
  const diplomacy = buildDiplomacy();
  const promises = buildPromises(input.promises);
  const approval = buildApproval(preset.startingApproval, states, socialGroups, congress);

  return {
    id: makeId('game', rng),
    version: GAME_STATE_VERSION,
    createdAt: now,
    updatedAt: now,
    seed,
    rngCursor: rng.cursor,
    phase: 'posse',
    month: 1,
    startYear: input.startYear,
    totalMonths: 48,
    term: 1,
    settings: {
      difficulty: input.difficulty,
      animations: true,
      volume: 70,
      eventFrequency: 1,
      dataMode: 'inicial_real',
      language: 'pt-BR',
      tutorialDone: false,
      reelection: input.reelection,
    },
    flags: {
      tutorialStep: 0,
      seenIntro: false,
      firedEvents: [],
      gameOver: false,
    },
    president,
    party,
    family,
    promises,
    economy,
    nation,
    approval,
    agenda: {
      points: preset.agendaPoints,
      maxPoints: preset.agendaPoints,
      scheduled: [],
      travelBooked: false,
    },
    government,
    congress,
    diplomacy,
    states,
    socialGroups,
    budget: buildBudget(),
    taxes: buildTaxes(),
    // O sistema de empresas nasce ancorado na macro da posse: é contra ela que
    // cada companhia vai medir juro, câmbio e inflação pelo resto do mandato.
    companies: buildCompaniesState(party.ideology, {
      selic: economy.selic,
      usd: economy.usd,
      inflation: economy.inflation,
      gdpGrowth: economy.gdpGrowth,
    }),
    // A disputa só é montada no quarto ano, quando a janela eleitoral abre.
    election: null,
    policies: [],
    programs: INHERITED_PROGRAMS.map((program) => ({ ...program, createdMonth: 0 })),
    pendingEvents: [],
    consequences: [],
    news: [],
    posts: [],
    decisions: [],
    timeline: [
      {
        id: makeId('tl', rng),
        month: 1,
        monthLabel: monthLabel(1, input.startYear),
        title: 'Posse',
        detail: `${president.politicalName} assume a Presidência da República com ${round(
          preset.startingApproval,
          1,
        )}% de aprovação e uma base de ${congress.governmentSeatsChamber} deputados.`,
        kind: 'posse',
        approvalAfter: preset.startingApproval,
      },
    ],
    history: [],
    lastResult: null,
  };
}

// ---------------------------------------------------------------------------
// Partido
// ---------------------------------------------------------------------------
function resolveParty(input: NewGameInput): PartyProfile {
  if (input.customParty) {
    const custom = input.customParty;
    return {
      id: `custom_${custom.acronym.toLowerCase()}`,
      name: custom.name,
      acronym: custom.acronym,
      color: custom.color,
      ideology: custom.ideology,
      // Legenda nova nasce sem bancada: só migra quem já perdeu o lugar em casa.
      chamberSeats: 8,
      senateSeats: 1,
      influence: 20,
      popularity: 30,
      discipline: 76,
      socialBase: [],
      priorities: custom.priorities,
      regionalStrength: {},
      founded: true,
      description:
        'Legenda fundada para esta candidatura. Sem bancada herdada, sem cacique cobrando pasta e sem ninguém obrigado a te obedecer.',
    };
  }
  const existing = input.partyId ? PARTY_BY_ID[input.partyId] : undefined;
  if (!existing) throw new Error(`Partido desconhecido: ${input.partyId}`);
  return { ...existing };
}

// ---------------------------------------------------------------------------
// Presidente e família
// ---------------------------------------------------------------------------
function buildPresident(input: NewGameInput): President {
  const draft = input.president;
  const hasHealthyHabit = draft.habits.includes('corredor');
  const heavySchedule = draft.age > 68;

  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    politicalName: draft.politicalName,
    age: draft.age,
    gender: draft.gender,
    homeState: draft.homeState,
    homeCity: draft.homeCity,
    occupation: draft.occupation,
    education: draft.education,
    religion: draft.religion,
    traits: draft.traits,
    habits: draft.habits,
    avatar: draft.avatar,
    health: clamp100(96 - (draft.age - 45) * 0.7 + (hasHealthyHabit ? 6 : 0)),
    energy: clamp100(92 - (heavySchedule ? 10 : 0) + (hasHealthyHabit ? 5 : 0)),
    mood: 74,
    stress: 18,
    personalApproval: DIFFICULTY_PRESETS[input.difficulty].startingApproval + 3,
    personalWealth: 650_000,
    monthlySalary: 46_366,
  };
}

function buildFamily(input: NewGameInput, rng: Rng): FamilyMember[] {
  const family: FamilyMember[] = [];
  const draft = input.family;

  if (draft.hasSpouse) {
    family.push({
      id: makeId('fam', rng),
      name: draft.spouseName?.trim() || `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      kind: 'conjuge',
      age: draft.spouseAge ?? Math.max(25, input.president.age - rng.int(0, 8)),
      occupation: draft.spouseOccupation || 'Sem ocupação declarada',
      approval: 53,
      influence: 48,
      friction: 0,
      stance: draft.spouseStance ?? 'fora_dos_holofotes',
      exposure: draft.spouseStance === 'palanque_permanente' ? 60 : 20,
    });
  }

  for (let i = 0; i < draft.childrenCount; i += 1) {
    family.push({
      id: makeId('fam', rng),
      name: `${rng.pick(FIRST_NAMES)} ${input.president.lastName}`,
      kind: 'filho',
      age: rng.int(6, 42),
      approval: 50,
      influence: 12,
      friction: 0,
      exposure: 15,
    });
  }

  return family;
}

// ---------------------------------------------------------------------------
// Economia
// ---------------------------------------------------------------------------
function buildEconomy(startingTreasury: number, difficulty: string): EconomyState {
  const b = MACRO_BASELINE;
  // A dificuldade piora (ou melhora) a herança, sem inventar um país diferente.
  const drag =
    difficulty === 'realista' ? 1 : difficulty === 'dificil' ? 0.55 : difficulty === 'normal' ? 0 : -0.5;

  const gdpNominal = b.gdpNominalBillion.value * 1.18; // projeção nominal até o ano da posse
  const debtToGdp = clamp(b.debtToGdp.value + drag * 4, 40, 140);
  const primaryPct = b.primaryBalancePctGdp.value - drag * 1.6;

  return {
    gdpNominal: round(gdpNominal, 0),
    gdpGrowth: round(2.2 - drag * 0.9, 2),
    inflation: round(b.inflation12m.value + drag * 1.1, 2),
    unemployment: round(b.unemployment.value + drag * 1.4, 2),
    selic: round(b.selic.value + drag * 0.75, 2),
    inflationTarget: 3,
    usd: round(b.usd.value * (1 + drag * 0.06), 4),
    fxAnchor: round(b.usd.value * (1 + drag * 0.06), 4),
    debtToGdp: round(debtToGdp, 2),
    primaryBalance: round((primaryPct / 100) * gdpNominal, 1),
    revenue: round(gdpNominal * 0.212, 1),
    // Despesa OBRIGATÓRIA apenas. Os programas herdados são contados à parte,
    // via custo mensal, para não entrarem duas vezes no resultado primário.
    spending: round(gdpNominal * (0.212 - primaryPct / 100) - INHERITED_PROGRAM_ANNUAL_COST, 1),
    reserves: round(b.reservesUsdBillion.value, 1),
    ibovespa: Math.round(142_000 - drag * 12_000),
    countryRisk: Math.round(215 + drag * 55),
    fiscalCredibility: clamp100(58 - drag * 11),
    businessConfidence: clamp100(54 - drag * 10),
    commodityIndex: 74,
    minimumWage: 1_620,
    treasuryCash: startingTreasury,
    pipeline: {
      fiscalImpulse: 0,
      inflationPressure: 0,
      supplyShock: 0,
      investmentImpulse: 0,
      monetaryDrag: 0,
    },
  };
}

function buildNation(): NationState {
  return {
    population: MACRO_BASELINE.population.value,
    hdi: 0.786,
    lifeExpectancy: 75.5,
    literacy: 93.2,
    povertyRate: 27.4,
    gini: 0.518,
    homicideRate: 22.6,
    corruptionPerception: 38,
    healthIndex: 56,
    educationIndex: 54,
    securityIndex: 48,
    sanitationIndex: 52,
    infrastructureIndex: 55,
    environmentIndex: 51,
    averageIncome: 1_980,
    origin: 'inicial',
  };
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------
function buildStates(rng: Rng, party: PartyProfile): FederalUnit[] {
  const bigParties = PARTIES.filter((p) => p.chamberSeats >= 9);

  return STATES.map((state) => {
    const profile = STATE_PROFILE[state.id];
    if (!profile) throw new Error(`Perfil ausente para ${state.id}`);
    const governorParty = rng.weighted(bigParties, (p) => {
      const regional = p.regionalStrength[state.region] ?? 30;
      return regional + p.chamberSeats * 0.4;
    });
    const aligned = governorParty.id === party.id;

    return {
      ...state,
      governorName: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      governorParty: governorParty.acronym,
      governorRelation: clamp100(48 + (aligned ? 22 : 0) + rng.noise(10)),
      governorAmbition: clamp100(rng.range(10, 80) + state.gdpShare * 1.2),
      approval: clamp100(52 + rng.noise(8)),
      poverty: profile.poverty,
      unemployment: profile.unemployment,
      income: profile.income,
      hdi: profile.hdi,
      crime: profile.crime,
      infrastructure: profile.infrastructure,
      unrest: clamp100(profile.poverty * 0.3 + rng.range(0, 12)),
    };
  });
}

// ---------------------------------------------------------------------------
// Grupos sociais
// ---------------------------------------------------------------------------
function buildSocialGroups(president: President, party: PartyProfile): SocialGroup[] {
  return SOCIAL_GROUPS.map((group) => {
    let approval = group.approval;

    // A base declarada do partido já começa mais simpática.
    if (party.socialBase.includes(group.id)) approval += 9;

    // A origem do presidente também pesa antes do primeiro discurso.
    approval += originAffinity(president, group.id);

    // Distância ideológica entre o partido e as demandas do grupo.
    if (group.demands.includes('economia') && party.ideology.economic > 40) approval += 3;
    if (group.demands.includes('social') && party.ideology.economic < -30) approval += 4;
    if (group.demands.includes('meio_ambiente') && party.ideology.economic > 55) approval -= 5;

    return { ...group, approval: clamp100(approval) };
  });
}

function originAffinity(president: President, groupId: string): number {
  const map: Record<string, Partial<Record<string, number>>> = {
    empresario: { empresariado: 12, mercado_financeiro: 8, trabalhadores: -6, servidores: -4 },
    sindicalista: { trabalhadores: 14, servidores: 8, empresariado: -8, mercado_financeiro: -6 },
    militar: { militares: 16, policiais: 10, universitarios: -8, artistas: -6 },
    magistrado: { classe_media: 6, mercado_financeiro: 4 },
    lider_religioso: { evangelicos: 15, catolicos: 6, artistas: -8, universitarios: -5 },
    medico: { baixa_renda: 8, classe_media: 6, professores: 4 },
    professor: { professores: 15, universitarios: 10, empresariado: -3 },
    produtor_rural: { agronegocio: 16, ambientalistas: -10, indigenas: -7 },
    comunicador: { classe_media: 7, artistas: 5 },
    politico_carreira: { classe_media: -4, universitarios: -5 },
    servidor_publico: { servidores: 14, professores: 6, empresariado: -4 },
    advogado: { classe_media: 5, mercado_financeiro: 3 },
  };
  const fromOccupation = map[president.occupation]?.[groupId] ?? 0;
  const fromReligion =
    (president.religion === 'evangelico' && groupId === 'evangelicos') ||
    (president.religion === 'catolico' && groupId === 'catolicos')
      ? 7
      : 0;
  return fromOccupation + fromReligion;
}

// ---------------------------------------------------------------------------
// Congresso
// ---------------------------------------------------------------------------
function buildCongress(rng: Rng, party: PartyProfile, input: NewGameInput): CongressState {
  const preset = DIFFICULTY_PRESETS[input.difficulty];
  const vice = VICE_POOL.find((candidate) => candidate.id === input.viceId);
  const viceParty = vice?.party ?? null;

  // Cargos entregues a partidos na formação do gabinete compram bancada.
  const cabinetParties = new Set(
    Object.values(input.cabinet)
      .map((candidateId) => MINISTER_POOL.find((m) => m.id === candidateId)?.party)
      .filter((value): value is string => Boolean(value)),
  );

  const blocs: PartyBloc[] = PARTIES.map((p) => {
    const isPresidentParty = p.id === party.id;
    const hasCabinet = cabinetParties.has(p.id);
    const isVice = viceParty === p.id;

    const ideologicalDistance =
      Math.abs(p.ideology.economic - party.ideology.economic) * 0.35 +
      Math.abs(p.ideology.social - party.ideology.social) * 0.25 +
      Math.abs(p.ideology.institutional - party.ideology.institutional) * 0.15;

    let support = 30 - ideologicalDistance * 0.55;
    if (isPresidentParty) support = 92;
    if (hasCabinet) support += 34;
    if (isVice) support += 22;

    return {
      partyId: p.id,
      chamberSeats: isPresidentParty && party.founded ? party.chamberSeats : p.chamberSeats,
      senateSeats: isPresidentParty && party.founded ? party.senateSeats : p.senateSeats,
      support: clamp(support, -100, 100),
      // Partido indisciplinado cobra mais caro por voto: o líder não entrega sozinho.
      price: clamp(
        (100 - p.discipline) * 0.5 + (isPresidentParty ? -30 : 18) * 1 + p.influence * 0.25,
        5,
        95,
      ) * preset.congressPrice,
      discipline: p.discipline,
      inGovernment: isPresidentParty || hasCabinet || isVice,
      leader: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    };
  });

  // Partido fundado pelo jogador entra na lista se ainda não existir.
  if (party.founded) {
    blocs.push({
      partyId: party.id,
      chamberSeats: party.chamberSeats,
      senateSeats: party.senateSeats,
      support: 95,
      price: 5,
      discipline: party.discipline,
      inGovernment: true,
      leader: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    });
  }

  const governmentSeatsChamber = blocs
    .filter((bloc) => bloc.support > 45)
    .reduce((total, bloc) => total + bloc.chamberSeats, 0);
  const governmentSeatsSenate = blocs
    .filter((bloc) => bloc.support > 45)
    .reduce((total, bloc) => total + bloc.senateSeats, 0);

  return {
    blocs,
    governmentSeatsChamber,
    governmentSeatsSenate,
    goodwill: clamp100(52 - (preset.congressPrice - 1) * 22),
    amendmentsReleased: 0,
    amendmentsPending: 0,
    chamberSpeaker: rng.pick(CHAMBER_SPEAKERS),
    senateSpeaker: rng.pick(SENATE_SPEAKERS),
    impeachmentRequests: 0,
    impeachmentRisk: 0,
    impeachmentStage: 'nenhum',
    cpis: [],
  };
}

// ---------------------------------------------------------------------------
// Governo
// ---------------------------------------------------------------------------
function buildGovernment(rng: Rng, input: NewGameInput, party: PartyProfile): GovernmentState {
  const vice = VICE_POOL.find((candidate) => candidate.id === input.viceId) ?? VICE_POOL[0];
  if (!vice) throw new Error('Nenhum vice disponível.');

  const ministers: Minister[] = MINISTRY_IDS.map((ministryId) => {
    const candidateId = input.cabinet[ministryId];
    const candidate = MINISTER_POOL.find((m) => m.id === candidateId);
    if (!candidate) throw new Error(`Nomeação inválida para a pasta ${ministryId}`);
    const fitsPortfolio = candidate.fits.length === 0 || candidate.fits.includes(ministryId);

    return {
      id: makeId('min', rng),
      name: candidate.name,
      ministryId,
      party: candidate.party,
      competence: clamp100(candidate.competence + (fitsPortfolio ? 6 : -14)),
      loyalty: candidate.loyalty,
      popularity: candidate.popularity,
      influence: candidate.influence,
      experience: candidate.experience,
      wear: 0,
      delivery: 0,
      monthsInOffice: 0,
      scandalRisk: candidate.scandalRisk,
      bio: candidate.bio,
      appointmentKind: candidate.kind,
    };
  });

  const oppositionLeader = rng.pick(
    OPPOSITION_LEADERS.filter((leader) => leader.party !== party.id),
  );

  return {
    ministers,
    vicePresidentId: vice.id,
    vicePresidentName: vice.name,
    vicePresidentParty: vice.party,
    vicePresidentLoyalty: vice.loyalty,
    vicePresidentArticulation: vice.ambitious ? 20 : 0,
    vicePresidentStatus: 'na_linha',
    intelligenceActive: false,
    intelligenceExposure: 0,
    cabinetReshuffles: 0,
    committees: buildCommittees(rng),
    supremeCourt: {
      relation: 58,
      vacancies: rng.int(1, 3),
      appointments: 0,
      overrideRisk: 24,
      pendingCases: rng.int(2, 6),
    },
    opposition: {
      leaderName: oppositionLeader.name,
      leaderParty: oppositionLeader.party,
      strength: 40,
      strategy: 'desgaste',
      lastMove: oppositionLeader.style,
      objectives: ['Derrubar a aprovação abaixo de 45%', 'Forçar a queda de um ministro'],
    },
  };
}

function buildCommittees(rng: Rng) {
  const topics = [
    { id: 'cae', name: 'Assuntos Econômicos', topic: 'economia' as const, chamber: 'senado' as const },
    { id: 'cft', name: 'Finanças e Tributação', topic: 'economia' as const, chamber: 'camara' as const },
    { id: 'ccj', name: 'Constituição e Justiça', topic: 'institucional' as const, chamber: 'camara' as const },
    { id: 'cssf', name: 'Seguridade Social e Família', topic: 'saude' as const, chamber: 'camara' as const },
    { id: 'ce', name: 'Educação e Cultura', topic: 'educacao' as const, chamber: 'camara' as const },
    { id: 'cssp', name: 'Segurança Pública', topic: 'seguranca' as const, chamber: 'camara' as const },
    { id: 'cma', name: 'Meio Ambiente', topic: 'meio_ambiente' as const, chamber: 'senado' as const },
    { id: 'capadr', name: 'Agricultura e Desenvolvimento Rural', topic: 'agricultura' as const, chamber: 'camara' as const },
    { id: 'cre', name: 'Relações Exteriores', topic: 'diplomacia' as const, chamber: 'senado' as const },
    { id: 'cvt', name: 'Viação e Transportes', topic: 'infraestrutura' as const, chamber: 'camara' as const },
  ];

  return topics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    chamber: topic.chamber,
    chairParty: rng.pick(PARTIES.filter((p) => p.chamberSeats > 10)).acronym,
    control: clamp100(45 + rng.noise(18)),
    topic: topic.topic,
    pendingBills: rng.int(3, 22),
  }));
}

// ---------------------------------------------------------------------------
// Diplomacia, orçamento, tributos, empresas
// ---------------------------------------------------------------------------
function buildDiplomacy(): DiplomacyState {
  return {
    alignment: 0,
    isolation: 28,
    countries: COUNTRIES.map((country) => ({ ...country, treatyAffinity: [...country.treatyAffinity] })),
    blocs: DIPLOMATIC_BLOCS.map((bloc) => ({ ...bloc })),
    visits: [],
    treaties: [],
    pendingOffers: [],
  };
}

function buildBudget(): BudgetLine[] {
  return MINISTRIES.map((ministry) => ({
    id: `budget_${ministry.id}`,
    ministryId: ministry.id,
    label: ministry.shortName,
    allocated: ministry.budget,
    mandatoryShare: mandatoryShareFor(ministry.id),
    execution: 0,
    origin: 'estimado' as const,
  }));
}

function mandatoryShareFor(ministryId: MinistryId): number {
  switch (ministryId) {
    case 'desenvolvimento_social':
      return 0.94;
    case 'saude':
      return 0.82;
    case 'educacao':
      return 0.78;
    case 'defesa':
      return 0.86;
    case 'justica':
      return 0.71;
    case 'fazenda':
      return 0.64;
    default:
      return 0.42;
  }
}

function buildTaxes(): TaxLine[] {
  return [
    {
      id: 'irpf',
      label: 'Imposto de Renda Pessoa Física',
      rate: 27.5,
      revenue: 340,
      incidence: ['classe_media', 'servidores'],
      elasticity: 0.35,
    },
    {
      id: 'irpj',
      label: 'Imposto de Renda Pessoa Jurídica e CSLL',
      rate: 34,
      revenue: 460,
      incidence: ['empresariado', 'mercado_financeiro'],
      elasticity: 0.62,
    },
    {
      id: 'consumo',
      label: 'Tributos sobre consumo',
      rate: 26.5,
      revenue: 980,
      incidence: ['baixa_renda', 'classe_media', 'trabalhadores'],
      elasticity: 0.48,
    },
    {
      id: 'folha',
      label: 'Contribuição sobre a folha',
      rate: 20,
      revenue: 620,
      incidence: ['empresariado', 'trabalhadores'],
      elasticity: 0.55,
    },
    {
      id: 'importacao',
      label: 'Imposto de importação',
      rate: 11.2,
      revenue: 84,
      incidence: ['empresariado', 'classe_media'],
      elasticity: 0.78,
    },
    {
      id: 'financeiro',
      label: 'Tributos sobre operações financeiras',
      rate: 15,
      revenue: 118,
      incidence: ['mercado_financeiro'],
      elasticity: 0.84,
    },
  ];
}


// ---------------------------------------------------------------------------
// Promessas e aprovação
// ---------------------------------------------------------------------------
function buildPromises(ids: string[]): CampaignPromise[] {
  return ids.map((id) => {
    const template = PROMISE_CATALOG.find((promise) => promise.id === id);
    if (!template) throw new Error(`Promessa desconhecida: ${id}`);
    return { ...template, status: 'pendente', progress: 0 };
  });
}

function buildApproval(
  base: number,
  states: FederalUnit[],
  groups: SocialGroup[],
  congress: CongressState,
): ApprovalState {
  const byRegion = {} as Record<Region, number>;
  for (const region of ['norte', 'nordeste', 'centro-oeste', 'sudeste', 'sul'] as Region[]) {
    const regionStates = states.filter((state) => state.region === region);
    const povertyAverage =
      regionStates.reduce((total, state) => total + state.poverty, 0) / (regionStates.length || 1);
    // Região mais pobre parte de aprovação mais alta: sente mais o programa federal.
    byRegion[region] = clamp100(base + (povertyAverage - 28) * 0.28);
  }

  const byGroup: Record<string, number> = {};
  for (const group of groups) byGroup[group.id] = group.approval;

  const supportShare = congress.governmentSeatsChamber / TOTAL_CHAMBER_SEATS;

  return {
    overall: base,
    personal: base + 3,
    byRegion,
    byGroup,
    congress: clamp100(supportShare * 100),
    governors: 52,
    momentum: 0,
    history: [base],
  };
}

export { TOTAL_CHAMBER_SEATS, TOTAL_SENATE_SEATS };
