import type { Company, FamilyMember, GameState, Minister, Policy } from '../types/index';
import type { CountryRelation, FederalUnit } from '../types/world';
import type { PartyBloc } from '../types/politics';
import { MINISTRY_BY_ID } from '../data/ministries';
import { COMMENTATORS, FIRST_NAMES, LAST_NAMES, NEWS_OUTLETS } from '../data/people';
import { Rng } from '../utils/rng';

/**
 * QUEM ENTRA NA CENA
 *
 * Um evento dinâmico não escreve nomes: ele PEDE gente ao estado da partida.
 * Este módulo é o balcão desse pedido — e a regra dele é uma só: só devolve
 * quem existe e quem faz sentido no papel.
 *
 * "Senador aliado recebeu propina" não pode sortear um senador da oposição;
 * "escândalo em estatal" não pode sortear uma empresa privada; "país impôs
 * sanções" não pode sortear um país sem comércio com o Brasil. Quando não há
 * ninguém que sirva, a resposta é `null`, e o evento inteiro é descartado em
 * silêncio — que é melhor do que uma frase incoerente.
 */

/** Sorteio que aceita lista vazia sem quebrar. */
function pick<T>(items: readonly T[], rng: Rng): T | null {
  return items.length === 0 ? null : rng.pick(items);
}

// ---------------------------------------------------------------------------
// Governo
// ---------------------------------------------------------------------------

export function randomMinister(state: GameState, rng: Rng): Minister | null {
  return pick(state.government.ministers, rng);
}

/** O ministro mais desgastado: quem já estava sob pressão vira notícia antes. */
export function wornMinister(state: GameState, rng: Rng): Minister | null {
  const ministers = [...state.government.ministers].sort(
    (a, b) => b.wear + b.scandalRisk - (a.wear + a.scandalRisk),
  );
  return pick(ministers.slice(0, 4), rng);
}

export function ministryName(minister: Minister): string {
  return MINISTRY_BY_ID[minister.ministryId]?.shortName ?? 'governo';
}

// ---------------------------------------------------------------------------
// Federação
// ---------------------------------------------------------------------------

export interface GovernorPick {
  unit: FederalUnit;
  name: string;
  party: string;
  relation: number;
}

/**
 * Governador, com filtro de alinhamento.
 *
 * `aliado` pega quem tem relação acima de 55 — é dele que o rompimento dói.
 * `adversario` pega quem já está longe, e é dele que vem o ataque.
 */
export function randomGovernor(
  state: GameState,
  rng: Rng,
  filter: 'qualquer' | 'aliado' | 'adversario' = 'qualquer',
): GovernorPick | null {
  const pool = state.states.filter((unit) => {
    if (filter === 'aliado') return unit.governorRelation >= 55;
    if (filter === 'adversario') return unit.governorRelation <= 40;
    return true;
  });

  const unit = pick(pool.length > 0 ? pool : state.states, rng);
  if (!unit) return null;
  return {
    unit,
    name: unit.governorName,
    party: unit.governorParty,
    relation: unit.governorRelation,
  };
}

// ---------------------------------------------------------------------------
// Congresso
// ---------------------------------------------------------------------------

export interface ParliamentPick {
  name: string;
  party: string;
  bloc: PartyBloc;
  /** Casa em que a pessoa fala, para o texto e para o peso político. */
  house: 'camara' | 'senado';
  allied: boolean;
}

/**
 * Parlamentar, tirado das bancadas que já existem.
 *
 * O jogo não guarda 513 deputados um a um — guarda bancadas com líder, apoio e
 * disciplina. É de lá que sai quem fala: o líder da bancada, com o alinhamento
 * REAL dela. Assim "deputado da oposição" nunca cai num aliado, e o efeito da
 * briga recai sobre a bancada certa.
 */
export function randomParliamentarian(
  state: GameState,
  rng: Rng,
  house: 'camara' | 'senado',
  filter: 'qualquer' | 'aliado' | 'oposicao' = 'qualquer',
): ParliamentPick | null {
  const seats = (bloc: PartyBloc) => (house === 'camara' ? bloc.chamberSeats : bloc.senateSeats);
  const pool = state.congress.blocs.filter((bloc) => {
    if (seats(bloc) < 3) return false;
    if (filter === 'aliado') return bloc.support > 45;
    if (filter === 'oposicao') return bloc.support < 15;
    return true;
  });

  const bloc = pool.length > 0 ? rng.weighted(pool, (entry) => seats(entry)) : null;
  if (!bloc) return null;

  return {
    name: bloc.leader,
    party: bloc.partyId,
    bloc,
    house,
    allied: bloc.support > 45,
  };
}

/** Prefeito de uma capital: nome sorteado, cidade real do estado escolhido. */
export function randomMayor(
  state: GameState,
  rng: Rng,
): { name: string; city: string; state: string } | null {
  const unit = pick(state.states, rng);
  if (!unit) return null;
  return {
    name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    city: unit.capital,
    state: unit.name,
  };
}

// ---------------------------------------------------------------------------
// Família
// ---------------------------------------------------------------------------

export interface SpousePick {
  member: FamilyMember;
  /** Como a imprensa se refere a ela ou a ele. */
  title: string;
  /** Artigo definido, para a frase concordar. */
  article: 'A' | 'O';
}

/**
 * O cônjuge, quando existe.
 *
 * O título sai do gênero do presidente: cônjuge de presidente homem é
 * Primeira-Dama, de presidente mulher é Primeiro-Cavalheiro. Nenhum dos dois
 * está escrito dentro de um evento — quem decide é este lugar, uma vez só.
 */
export function spouseOf(state: GameState): SpousePick | null {
  const member = state.family.find((entry) => entry.kind === 'conjuge');
  if (!member) return null;

  const presidentIsFemale = state.president.gender === 'feminino';
  return presidentIsFemale
    ? { member, title: 'Primeiro-Cavalheiro', article: 'O' }
    : { member, title: 'Primeira-Dama', article: 'A' };
}

export interface ChildPick {
  member: FamilyMember;
  article: 'O' | 'A';
  noun: 'filho' | 'filha';
}

/** Um filho ou filha, quando houver. */
export function randomChild(state: GameState, rng: Rng): ChildPick | null {
  const children = state.family.filter((entry) => entry.kind === 'filho');
  const member = pick(children, rng);
  if (!member) return null;

  // O jogo guarda o nome, não o gênero da criança: a terminação do nome é o
  // melhor palpite disponível, e erra pouco em português.
  const female = /a$/i.test(member.name.split(' ')[0] ?? '');
  return female
    ? { member, article: 'A', noun: 'filha' }
    : { member, article: 'O', noun: 'filho' };
}

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

/** Empresa estatal: a União tem participação. Nunca uma privada. */
export function randomStateCompany(state: GameState, rng: Rng): Company | null {
  const pool = state.companies.companies.filter(
    (company) => company.control === 'federal' && company.ownership.stateOwnership > 0,
  );
  return pool.length === 0 ? null : rng.weighted(pool, (company) => Math.max(1, company.employees / 1000));
}

/** Empresa privada de porte, para chantagem fiscal e ameaça de demissão. */
export function randomPrivateCompany(state: GameState, rng: Rng, minEmployees = 8_000): Company | null {
  const pool = state.companies.companies.filter(
    (company) => company.control === 'privada' && company.employees >= minEmployees,
  );
  const fallback = state.companies.companies.filter((company) => company.control === 'privada');
  const chosen = pool.length > 0 ? pool : fallback;
  return chosen.length === 0 ? null : rng.weighted(chosen, (company) => Math.max(1, company.employees / 1000));
}

export function randomCompany(state: GameState, rng: Rng): Company | null {
  return pick(state.companies.companies, rng);
}

/**
 * Peso econômico da empresa, 0-1.
 *
 * É ele que faz uma crise na Petrobras não valer o mesmo que uma crise numa
 * estatal pequena: o impacto de todo evento empresarial é multiplicado por
 * este número.
 */
export function economicWeight(state: GameState, company: Company): number {
  const employees = state.companies.companies.reduce((total, entry) => total + entry.employees, 0);
  const revenue = state.companies.companies.reduce((total, entry) => total + entry.financials.revenue, 0);
  const shareOfJobs = employees > 0 ? company.employees / employees : 0;
  const shareOfRevenue = revenue > 0 ? company.financials.revenue / revenue : 0;

  return Math.min(1, (shareOfJobs * 0.45 + shareOfRevenue * 0.55) * 3.2);
}

// ---------------------------------------------------------------------------
// Mundo
// ---------------------------------------------------------------------------

export interface CountryPick {
  country: CountryRelation;
  /** Como se chama quem manda lá, para o texto não repetir "presidente". */
  leaderTitle: string;
}

const LEADER_TITLES = ['presidente', 'primeiro-ministro', 'chefe de Estado', 'chanceler'];

/**
 * Um país, com filtro de relevância.
 *
 * Sanção comercial só faz sentido vinda de quem compra do Brasil; elogio
 * diplomático, de quem já tem relação razoável. Escolher qualquer país para
 * qualquer coisa é o que faria a agenda internacional parecer sorteio.
 */
export function randomCountry(
  state: GameState,
  rng: Rng,
  filter: 'qualquer' | 'parceiro_comercial' | 'amigo' | 'tenso' = 'qualquer',
): CountryPick | null {
  const countries = state.diplomacy.countries;
  const pool = countries.filter((country) => {
    if (filter === 'parceiro_comercial') return country.trade >= 45;
    if (filter === 'amigo') return country.relation >= 55;
    if (filter === 'tenso') return country.relation <= 45;
    return true;
  });

  const chosen = pool.length > 0 ? pool : countries;
  const country = chosen.length === 0 ? null : rng.weighted(chosen, (entry) => Math.max(5, entry.trade));
  if (!country) return null;

  return { country, leaderTitle: rng.pick(LEADER_TITLES) };
}

// ---------------------------------------------------------------------------
// Imprensa
// ---------------------------------------------------------------------------

export function randomJournalist(rng: Rng): { name: string; handle: string } {
  const pool = COMMENTATORS.filter((entry) => entry.kind === 'jornalista');
  const chosen = pool.length > 0 ? rng.pick(pool) : COMMENTATORS[0]!;
  return { name: chosen.name, handle: chosen.handle };
}

export function randomOutlet(rng: Rng, minReach = 0): { name: string; reach: number } {
  const pool = NEWS_OUTLETS.filter((entry) => entry.reach >= minReach);
  const chosen = pool.length > 0 ? rng.weighted(pool, (entry) => entry.reach) : NEWS_OUTLETS[0]!;
  return { name: chosen.name, reach: chosen.reach };
}

// ---------------------------------------------------------------------------
// O que o governo andou fazendo
// ---------------------------------------------------------------------------

/**
 * A medida mais recente que ainda está de pé.
 *
 * É o que permite a oposição protestar contra a SUA reforma, e não contra "as
 * medidas do governo" — a diferença entre um mundo que reage e um cenário.
 */
export function recentMeasure(state: GameState, withinMonths = 6): Policy | null {
  const candidates = state.policies.filter(
    (policy) =>
      state.month - policy.createdMonth <= withinMonths &&
      (policy.status === 'vigente' || policy.status === 'tramitando' || policy.status === 'aprovada'),
  );
  if (candidates.length === 0) return null;

  // A maior medida do período: é dela que o país fala.
  return [...candidates].sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost))[0] as Policy;
}

/** Preenche `{marcadores}` de um molde com os valores dados. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
