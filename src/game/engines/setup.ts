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
  Occupation,
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
import { GOVERNOR_BY_STATE } from '../data/governors';
import { PARTIES, PARTY_BY_ID, TOTAL_CHAMBER_SEATS, TOTAL_SENATE_SEATS, partyKey } from '../data/parties';
import { MINISTRIES, MINISTRY_IDS } from '../data/ministries';
import { SOCIAL_GROUPS } from '../data/social-groups';
import { COUNTRIES, DIPLOMATIC_BLOCS } from '../data/countries';
import { PROMISE_CATALOG } from '../data/promises';
import {
  candidateFitsMinistry,
  outOfFieldIn,
  CHAMBER_SPEAKERS,
  MINISTER_POOL,
  type MinisterCandidate,
  OPPOSITION_LEADERS,
  SENATE_SPEAKERS,
  VICE_POOL,
  FIRST_NAMES,
  LAST_NAMES,
} from '../data/people';
import { INHERITED_PROGRAMS } from '../data/programs';
import { buildRegime, buildWar } from './regime-setup';
import { buildCompaniesState } from './companies/company-service';

/** Custo anualizado dos programas herdados, já contabilizado como custeio mensal. */
const INHERITED_PROGRAM_ANNUAL_COST = INHERITED_PROGRAMS.reduce(
  (total, program) => total + program.monthlyCost * 12,
  0,
);
import { GAME_CALIBRATION } from '../data/calibration';
import { BRASIL_HOJE, INHERITED_TREATIES } from '../data/brasil-hoje';
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
 * O país da posse é o Brasil real: os indicadores macro vêm das séries
 * oficiais (MACRO_BASELINE) e os sociais, dos levantamentos em BRASIL_HOJE,
 * sem ajuste nenhum. Do primeiro tick em diante, nenhum número aqui corresponde
 * mais à realidade.
 */
export function createGame(input: NewGameInput): GameState {
  const seed = input.seed ?? createSeed();
  const rng = new Rng(seed);
  const preset = GAME_CALIBRATION;
  const now = new Date().toISOString();

  const party = resolveParty(input);
  const president = buildPresident(input);
  const family = buildFamily(input, rng);
  const economy = buildEconomy(preset.startingTreasury);
  const nation = buildNation();
  const states = buildStates(rng, party);
  const socialGroups = buildSocialGroups(president, party);
  const congress = buildCongress(rng, party, input);
  const government = buildGovernment(rng, input, party);
  const diplomacy = buildDiplomacy();
  const promises = buildPromises(input.promises);
  // Quem não traz bancada traz gente: um vice conhecido do país inteiro e um
  // gabinete popular entram na largada como aprovação, que é a moeda que esse
  // tipo de nome realmente carrega. É a contrapartida de não ter deputado
  // nenhum atrás de si.
  const vice = VICE_POOL.find((candidate) => candidate.id === input.viceId);
  const gabinete = Object.values(input.cabinet)
    .map((candidateId) => MINISTER_POOL.find((m) => m.id === candidateId))
    .filter((candidate): candidate is MinisterCandidate => Boolean(candidate));
  const popularidadeMedia =
    gabinete.length > 0
      ? gabinete.reduce((total, candidate) => total + candidate.popularity, 0) / gabinete.length
      : 50;
  const bonusDeFama = round(
    ((vice?.popularity ?? 50) - 50) * 0.06 + (popularidadeMedia - 50) * 0.05,
    2,
  );

  const approval = buildApproval(
    clamp(preset.startingApproval + bonusDeFama, 20, 80),
    states,
    socialGroups,
    congress,
  );

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
      eventCooldowns: {},
      pendingFollowUps: [],
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
    regime: buildRegime(preset.startingApproval),
    war: buildWar(),
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
/**
 * Quanto o presidente tem na conta pessoal no dia da posse, pela carreira que
 * teve antes do Planalto. É a base para quem tem 35 anos, a idade mínima para
 * disputar a Presidência.
 */
export const STARTING_WEALTH_BY_OCCUPATION: Record<Occupation, number> = {
  politico_carreira: 120_000,
  empresario: 95_000,
  magistrado: 90_000,
  advogado: 90_000,
  medico: 40_000,
  militar: 10_000,
  professor: 4_000,
  servidor_publico: 4_000,
  sindicalista: 4_000,
  lider_religioso: 4_000,
  produtor_rural: 4_000,
  comunicador: 2_000,
};

const IDADE_MINIMA_PRESIDENTE = 35;

/** Dinheiro inicial: a base da carreira, com +1% por ano de idade acima de 35. */
export function startingPersonalWealth(occupation: Occupation, age: number): number {
  const base = STARTING_WEALTH_BY_OCCUPATION[occupation] ?? 0;
  const anosAMais = Math.max(0, Math.floor(age) - IDADE_MINIMA_PRESIDENTE);
  return Math.round(base * (1 + anosAMais / 100));
}

function buildPresident(input: NewGameInput): President {
  const draft = input.president;
  const heavySchedule = draft.age > 68;

  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    politicalName: draft.politicalName,
    age: draft.age,
    gender: draft.gender,
    homeState: draft.homeState,
    occupation: draft.occupation,
    religion: draft.religion,
    traits: draft.traits,
    avatar: draft.avatar,
    health: clamp100(96 - (draft.age - 45) * 0.7),
    energy: clamp100(92 - (heavySchedule ? 10 : 0)),
    mood: 74,
    stress: 18,
    personalApproval: GAME_CALIBRATION.startingApproval + 3,
    personalWealth: startingPersonalWealth(draft.occupation, draft.age),
    monthlySalary: 46_366,
    possessions: [],
    lastSpendMonth: {},
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
      stress: 12,
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
      stress: 8,
      exposure: 15,
    });
  }

  return family;
}

// ---------------------------------------------------------------------------
// Economia
// ---------------------------------------------------------------------------
function buildEconomy(startingTreasury: number): EconomyState {
  const b = MACRO_BASELINE;
  const hoje = BRASIL_HOJE;

  // PIB dos últimos 12 meses em valores correntes, direto do Banco Central.
  const gdpNominal = b.gdpNominalBillion.value;
  // Já no sinal de resultado: negativo é déficit. A série do BCB é NFSP, que
  // usa o sinal oposto — era por isso que o jogo mostrava superávit onde havia
  // déficit.
  const primaryPct = b.primaryBalancePctGdp.value;

  return {
    gdpNominal: round(gdpNominal, 0),
    gdpGrowth: hoje.gdpGrowth.value,
    inflation: b.inflation12m.value,
    unemployment: b.unemployment.value,
    selic: b.selic.value,
    inflationTarget: 3,
    usd: b.usd.value,
    fxAnchor: b.usd.value,
    debtToGdp: b.debtToGdp.value,
    primaryBalance: round((primaryPct / 100) * gdpNominal, 1),
    revenue: round(gdpNominal * 0.212, 1),
    // Despesa OBRIGATÓRIA apenas. Os programas herdados são contados à parte,
    // via custo mensal, para não entrarem duas vezes no resultado primário.
    spending: round(gdpNominal * (0.212 - primaryPct / 100) - INHERITED_PROGRAM_ANNUAL_COST, 1),
    reserves: b.reservesUsdBillion.value,
    ibovespa: hoje.ibovespa.value,
    countryRisk: hoje.countryRisk.value,
    // Índices internos do jogo, sem série oficial equivalente.
    fiscalCredibility: 58,
    businessConfidence: 54,
    commodityIndex: 74,
    minimumWage: b.minimumWage.value,
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
  const hoje = BRASIL_HOJE;
  return {
    population: MACRO_BASELINE.population.value,
    hdi: hoje.hdi.value,
    lifeExpectancy: hoje.lifeExpectancy.value,
    literacy: hoje.literacy.value,
    povertyRate: hoje.povertyRate.value,
    gini: hoje.gini.value,
    homicideRate: hoje.homicideRate.value,
    corruptionPerception: hoje.corruptionPerception.value,
    // Índices internos do jogo (0-100), sem série oficial equivalente.
    healthIndex: 56,
    educationIndex: 54,
    securityIndex: 48,
    sanitationIndex: 52,
    infrastructureIndex: 55,
    environmentIndex: 51,
    averageIncome: hoje.averageIncome.value,
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
    // O governador real do estado, quando existe no banco. O sorteio continua
    // valendo como rede de segurança: estado sem entrada cadastrada recebe um
    // nome procedural em vez de quebrar a criação da partida.
    const real = GOVERNOR_BY_STATE[state.id];
    const governorParty = real
      ? (PARTIES.find((p) => p.acronym === real.party || p.id === real.party) ??
        rng.weighted(bigParties, (p) => (p.regionalStrength[state.region] ?? 30) + p.chamberSeats * 0.4))
      : rng.weighted(bigParties, (p) => {
          const regional = p.regionalStrength[state.region] ?? 30;
          return regional + p.chamberSeats * 0.4;
        });
    const aligned = governorParty.id === party.id;

    // A relação com o Planalto nasce da distância ideológica declarada, e não
    // de um sorteio: um governador de direita começa longe de um presidente de
    // esquerda mesmo sem nenhum atrito ter acontecido ainda.
    const distancia = real
      ? Math.abs(real.ideology - party.ideology.economic) / 100
      : Math.abs(governorParty.ideology.economic - party.ideology.economic) / 100;

    return {
      ...state,
      governorName: real?.name ?? `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      governorParty: governorParty.acronym,
      // A distância pesa, mas não define: governador de oposição começa frio,
      // não em guerra. Um mandato tem quatro anos para azedar isso sozinho.
      governorRelation: clamp100(
        56 + (aligned ? 18 : 0) - distancia * 16 + rng.noise(real ? 5 : 10),
      ),
      governorAmbition: real
        ? clamp100(real.ambition + rng.noise(4))
        : clamp100(rng.range(10, 80) + state.gdpShare * 1.2),
      approval: clamp100(52 + rng.noise(8)),
      poverty: profile.poverty,
      unemployment: profile.unemployment,
      income: profile.income,
      hdi: profile.hdi,
      crime: profile.crime,
      infrastructure: profile.infrastructure,
      // A produtividade de partida acompanha o que o estado já é: renda,
      // escolaridade e infraestrutura são o retrato do que ele consegue
      // produzir por hora trabalhada. É a base sobre a qual a política vai (ou
      // não) construir alguma coisa.
      productivity: round(
        clamp100(
          22 + (profile.income / BRASIL_HOJE.averageIncome.value) * 26 + profile.hdi * 34 + profile.infrastructure * 0.16,
        ),
        1,
      ),
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
  const preset = GAME_CALIBRATION;
  const vice = VICE_POOL.find((candidate) => candidate.id === input.viceId);
  const viceParty = partyKey(vice?.party);

  // Cargos entregues a partidos na formação do gabinete compram bancada.
  // O banco de nomes tipa o partido como sigla conhecida; os blocos do
  // Congresso são indexados por string. O conjunto guarda string para os dois
  // lados se encontrarem.
  const cabinetParties = new Set<string>(
    Object.values(input.cabinet)
      .map((candidateId) => partyKey(MINISTER_POOL.find((m) => m.id === candidateId)?.party))
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

    // O peso PESSOAL de quem foi convidado, além do cargo entregue à legenda.
    // Chamar o líder que arrasta 22 deputados não é a mesma coisa que chamar um
    // deputado de primeiro mandato do mesmo partido, e o número mostrado na
    // tela de montagem passa a valer aqui.
    const pesoPessoal =
      (isVice ? (vice?.seatsBrought ?? 0) : 0) +
      Object.values(input.cabinet)
        .map((candidateId) => MINISTER_POOL.find((m) => m.id === candidateId))
        .filter((candidate) => candidate?.party === p.id)
        .reduce((total, candidate) => total + (candidate?.seatsBrought ?? 0), 0);

    // Cargo compra apoio na proporção da fisiologia da legenda. Entregar um
    // ministério ao PP move a bancada inteira; entregar ao PSOL move quase
    // nada, porque o apoio deles nunca foi sobre cargo. Os dois recebem alguma
    // coisa: estar no governo é estar no governo.
    const fisiologia = p.fisiologia ?? 50;

    let support = 30 - ideologicalDistance * 0.55;
    if (isPresidentParty) support = 92;
    if (hasCabinet) support += 12 + fisiologia * 0.34;
    if (isVice) support += 8 + fisiologia * 0.2;
    support += pesoPessoal * 0.6;

    return {
      partyId: p.id,
      chamberSeats: isPresidentParty && party.founded ? party.chamberSeats : p.chamberSeats,
      senateSeats: isPresidentParty && party.founded ? party.senateSeats : p.senateSeats,
      support: clamp(support, -100, 100),
      // Partido indisciplinado cobra mais caro por voto: o líder não entrega sozinho.
      // Preço do voto: indisciplina encarece (o líder não entrega sozinho),
      // fisiologia encarece (vende porque vender é o negócio) e estar no bloco
      // do centro encarece mais ainda, porque quem controla a Mesa cobra pela
      // Mesa.
      price: clamp(
        (100 - p.discipline) * 0.5 +
          (isPresidentParty ? -30 : 18) * 1 +
          p.influence * 0.25 +
          fisiologia * 0.25 +
          (p.centrao ? 8 : 0),
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
    if (!candidateFitsMinistry(candidate, ministryId)) {
      throw new Error(`${candidate.name} não pode assumir a pasta ${ministryId}.`);
    }
    const outOfField = outOfFieldIn(candidate, ministryId);

    return {
      id: makeId('min', rng),
      name: candidate.name,
      ministryId,
      party: candidate.party,
      competence: clamp100(candidate.competence + (outOfField ? -14 : 6)),
      loyalty: candidate.loyalty,
      popularity: candidate.popularity,
      influence: candidate.influence,
      experience: candidate.experience,
      wear: 0,
      delivery: 0,
      monthsInOffice: 0,
      scandalRisk: candidate.scandalRisk,
      bio: candidate.bio,
      avatar: candidate.avatar,
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
    vicePresidentAvatar: vice.avatar,
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
    // O que o Brasil já tem assinado no dia da posse.
    treaties: INHERITED_TREATIES.flatMap((acordo) => {
      const pais = COUNTRIES.find((country) => country.id === acordo.countryId);
      return pais
        ? [
            {
              id: `herdado_${acordo.countryId}_${acordo.treatyId}`,
              treatyId: acordo.treatyId,
              countryId: pais.id,
              countryName: pais.name,
              countryFlag: pais.flag,
              signedMonth: 0,
              monthlyCost: 0,
              label: acordo.label,
              inherited: true,
            },
          ]
        : [];
    }),
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
    // Quase tudo discricionário: é orçamento de gabinete, não de programa.
    case 'sri':
      return 0.3;
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
