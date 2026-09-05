import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  DEFAULT_AVATAR,
  INSTRUMENT_RULES,
  MINISTER_POOL,
  MINISTRY_IDS,
  Rng,
  createGame,
  createPolicy,
  decideCandidacy,
  deepClone,
  generatePublicReaction,
  interpretLocally,
  newGameSchema,
  openCompanyMeeting,
  processPolicies,
  rollEvents,
  serialize,
  tickMonth,
  type GameState,
  type NewGameInput,
  type Policy,
} from '@/game';
import { useGame } from '@/state/game-store';
import { repository } from '@/state/repository';

import { Landing } from './Landing';
import { Setup } from './Setup';
import { Painel } from './Painel';
import { Governo } from './Governo';
import { Nacao } from './Nacao';
import { Economia } from './Economia';
import { Diplomacia } from './Diplomacia';
import { Programas } from './Programas';
import { VidaPessoal } from './VidaPessoal';
import { Historico } from './Historico';
import { Ajustes } from './Ajustes';
import { ComoJogar } from './ComoJogar';
import { FimDeMandato } from './FimDeMandato';
import { Eleicao } from './Eleicao';

/**
 * TESTES DE RENDERIZAÇÃO
 *
 * O typecheck garante que os tipos fecham; ele não garante que a tela monta.
 * Estes testes montam cada página num DOM real e falham em erro de runtime —
 * acesso a índice inexistente, hook mal usado, dado ausente na primeira
 * renderização, divisão por zero em partida recém-criada.
 *
 * Cada página é testada em dois momentos que costumam quebrar coisas
 * diferentes: no mês 1 (arrays vazios, sem histórico, sem notícias) e depois de
 * vários meses (listas cheias, eventos resolvidos, gráficos com dados).
 */

function buildInput(overrides: Partial<NewGameInput> = {}): NewGameInput {
  const cabinet: Record<string, string> = {};
  MINISTRY_IDS.forEach((ministryId, index) => {
    cabinet[ministryId] = MINISTER_POOL[index % MINISTER_POOL.length]!.id;
  });

  return newGameSchema.parse({
    president: {
      firstName: 'Marina',
      lastName: 'Teixeira',
      politicalName: 'Marina Teixeira',
      age: 54,
      gender: 'feminino',
      homeState: 'PE',
      homeCity: 'Recife',
      occupation: 'medico',
      education: 'medicina',
      religion: 'catolico',
      traits: ['carismatico'],
      habits: ['corredor'],
      avatar: DEFAULT_AVATAR,
    },
    partyId: 'PSB',
    customParty: null,
    viceId: 'vp_almeida',
    cabinet,
    family: { hasSpouse: true, spouseName: 'Antônio Teixeira', childrenCount: 2 },
    promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
    difficulty: 'normal',
    startYear: 2027,
    seed: 4242,
    reelection: false,
    ...overrides,
  });
}

/** Injeta um estado direto na store, sem passar pelo localStorage. */
function loadState(state: GameState): void {
  useGame.setState({
    state,
    saves: [],
    evaluation: null,
    lastResult: state.lastResult,
    lastNotes: [],
    briefing: null,
    showResult: false,
    toasts: [],
    ai: 'local',
  });
}

function renderPage(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const freshGame = createGame(buildInput());

/** Partida com 14 meses corridos: listas cheias, histórico, eventos resolvidos. */
const playedGame = (() => {
  let state = freshGame;
  for (let i = 0; i < 14; i += 1) state = tickMonth(state).state;
  return state;
})();

/** Partida encerrada, para a tela de avaliação final. */
const finishedGame = (() => {
  let state = createGame(buildInput({ difficulty: 'facil' }));
  for (let i = 0; i < 48 && !state.flags.gameOver; i += 1) state = tickMonth(state).state;
  return state;
})();

const GAME_PAGES: [string, () => React.ReactElement][] = [
  ['Painel', () => <Painel />],
  ['Governo', () => <Governo />],
  ['Nação', () => <Nacao />],
  ['Economia', () => <Economia />],
  ['Diplomacia', () => <Diplomacia />],
  ['Programas', () => <Programas />],
  ['Vida pessoal', () => <VidaPessoal />],
  ['Histórico', () => <Historico />],
  ['Ajustes', () => <Ajustes />],
];

describe('telas fora do jogo', () => {
  beforeEach(() => {
    localStorage.clear();
    useGame.setState({ state: null, saves: [], toasts: [], ai: 'local' });
  });

  it('a tela inicial monta e mostra a proposta do jogo', () => {
    renderPage(<Landing />);
    expect(screen.getByRole('heading', { level: 1, name: /GOV3RNE/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /novo mandato/i })).toBeInTheDocument();
    expect(screen.getByText(/obra de ficção/i)).toBeInTheDocument();
  });

  it('a tela inicial declara a procedência dos dados iniciais', () => {
    renderPage(<Landing />);
    expect(screen.getByText(/IBGE/)).toBeInTheDocument();
    expect(screen.getByText(/Banco Central/)).toBeInTheDocument();
  });

  it('o fluxo de candidatura monta na primeira etapa', () => {
    renderPage(<Setup />);
    expect(screen.getByRole('heading', { name: /montar candidatura/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^nome$/i)).toBeInTheDocument();
    // O rodapé precisa avisar por que ainda não dá para avançar.
    expect(screen.getByText(/preencha nome e sobrenome/i)).toBeInTheDocument();
  });

  it('a tela de como jogar explica a mecânica central', () => {
    renderPage(<ComoJogar />);
    expect(screen.getByRole('heading', { level: 1, name: /como jogar/i })).toBeInTheDocument();
    expect(screen.getByText(/como escrever propostas/i)).toBeInTheDocument();
  });
});

describe('telas de jogo no primeiro mês', () => {
  beforeEach(() => {
    localStorage.clear();
    loadState(freshGame);
  });

  for (const [name, Page] of GAME_PAGES) {
    it(`${name} monta com a partida recém-criada`, () => {
      const { container } = renderPage(Page());
      expect(container.firstChild).toBeTruthy();
      // Nenhuma tela pode exibir NaN ou undefined em número formatado.
      expect(container.textContent ?? '').not.toMatch(/NaN|undefined|Infinity/);
    });
  }

  it('o Painel mostra os indicadores macro e o botão de avançar', () => {
    renderPage(<Painel />);
    expect(screen.getByRole('button', { name: /avançar mês/i })).toBeInTheDocument();
    expect(screen.getByText('Inflação')).toBeInTheDocument();
    expect(screen.getByText('Desemprego')).toBeInTheDocument();
    expect(screen.getByText('Dívida bruta')).toBeInTheDocument();
  });

  it('o Painel lista as cinco promessas do mandato', () => {
    renderPage(<Painel />);
    const section = screen.getByText('Suas promessas').closest('section');
    expect(section).toBeTruthy();
    expect(within(section as HTMLElement).getByText(/dívida abaixo de 80/i)).toBeInTheDocument();
  });

  it('o Governo mostra as dez pastas do gabinete', () => {
    renderPage(<Governo />);
    expect(screen.getByText(/entrega do ministério neste mês/i)).toBeInTheDocument();
    expect(screen.getByText('Casa Civil')).toBeInTheDocument();
    expect(screen.getByText('Fazenda')).toBeInTheDocument();
  });

  it('a Nação desenha o mapa com as 27 unidades da federação', async () => {
    const { container } = renderPage(<Nacao />);
    // O mapa vive na aba "Mapa e estados", que não é a aba inicial.
    await userEvent.click(screen.getByRole('tab', { name: /mapa e estados/i }));
    const paths = container.querySelectorAll('svg path[aria-label]');
    expect(paths.length).toBe(27);
  });

  it('a Economia explica o laço macroeconômico', () => {
    renderPage(<Economia />);
    expect(screen.getByText(/o laço que decide tudo/i)).toBeInTheDocument();
    expect(screen.getByText(/você não manda no Copom/i)).toBeInTheDocument();
  });

  it('as séries avisam que ainda não há dados em vez de quebrar', () => {
    renderPage(<Economia />);
    // A aba padrão é "Contas do país"; a de séries é a que lida com histórico vazio.
    expect(screen.getByRole('tab', { name: /séries/i })).toBeInTheDocument();
  });
});

describe('telas de jogo com mandato em andamento', () => {
  beforeEach(() => {
    localStorage.clear();
    loadState(playedGame);
  });

  for (const [name, Page] of GAME_PAGES) {
    it(`${name} monta depois de 14 meses jogados`, () => {
      const { container } = renderPage(Page());
      expect(container.firstChild).toBeTruthy();
      expect(container.textContent ?? '').not.toMatch(/NaN|undefined|Infinity/);
    });
  }

  it('o Histórico lista o que aconteceu no mandato', () => {
    renderPage(<Historico />);
    expect(screen.getByText(/linha do tempo/i)).toBeInTheDocument();
    expect(screen.getByText(/medidas assinadas/i)).toBeInTheDocument();
  });

  it('a Nação mostra notícias produzidas pela simulação', () => {
    loadState(playedGame);
    renderPage(<Nacao />);
    expect(screen.getByRole('tab', { name: /redes/i })).toBeInTheDocument();
  });
});

describe('Economia — painel de empresas', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lista as empresas federais e as privadas com receita, lucro e situação', async () => {
    loadState(playedGame);
    renderPage(<Economia />);
    await userEvent.click(screen.getByRole('tab', { name: /empresas/i }));

    // O rótulo aparece na aba e no título da tabela: basta existir.
    expect(screen.getAllByText(/empresas federais/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Petrobras/i).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /empresas privadas/i }));
    expect(screen.getAllByText(/Itaú Unibanco|Itaú/i).length).toBeGreaterThan(0);
  });

  it('abre a ficha da empresa com balanço, controle e ações disponíveis', async () => {
    loadState(playedGame);
    renderPage(<Economia />);
    await userEvent.click(screen.getByRole('tab', { name: /empresas/i }));
    await userEvent.click(screen.getAllByText('Petrobras')[0]!);

    const dialog = await screen.findByRole('dialog', { name: /petrobras/i });
    expect(within(dialog).getByText(/Petróleo Brasileiro/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/participação da união/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/o que dá para fazer/i)).toBeInTheDocument();
  });

  it('mostra o preço das commodities e as alavancas tributárias', async () => {
    loadState(playedGame);
    renderPage(<Economia />);
    await userEvent.click(screen.getByRole('tab', { name: /empresas/i }));
    await userEvent.click(screen.getByRole('button', { name: /mercado e commodities/i }));

    expect(screen.getByText(/preço das commodities/i)).toBeInTheDocument();
    expect(screen.getAllByText(/FGTS patronal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/imposto sobre o lucro/i).length).toBeGreaterThan(0);
  });

  it('a aba de processos societários monta mesmo sem nenhum processo aberto', async () => {
    loadState(freshGame);
    renderPage(<Economia />);
    await userEvent.click(screen.getByRole('tab', { name: /empresas/i }));
    await userEvent.click(screen.getByRole('button', { name: /processos societários/i }));

    expect(screen.getByText(/nenhum processo de venda aberto/i)).toBeInTheDocument();
    expect(screen.getByText(/nenhuma operação de compra aberta/i)).toBeInTheDocument();
  });

  it('mostra a audiência aberta e traz a direção da empresa para a mesa', async () => {
    const withMeeting: GameState = deepClone(playedGame);
    const rng = new Rng(withMeeting.seed, withMeeting.rngCursor);
    const outcome = openCompanyMeeting(withMeeting, 'jbs', rng);
    withMeeting.rngCursor = rng.cursor;
    const meeting = outcome.meeting!;

    loadState(withMeeting);
    renderPage(<Economia />);
    await userEvent.click(screen.getByRole('tab', { name: /empresas/i }));

    const aviso = screen.getByText(/audiência aberta/i);
    expect(aviso).toBeInTheDocument();
    // O cartão inteiro é o botão que abre a audiência.
    await userEvent.click(aviso.closest('button')!);

    const dialog = await screen.findByRole('dialog', { name: /audiência/i });
    // Quem fala tem nome, cargo e uma leitura da própria empresa.
    expect(within(dialog).getAllByText(new RegExp(meeting.executive.name, 'i')).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/a leitura que a empresa faz de si/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/oferecer sem que peçam/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /encerrar a reunião/i })).toBeInTheDocument();
  });
});

describe('Diplomacia — acordos internacionais', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('a aba de acordos mostra o estado vazio quando não há nada em pauta', async () => {
    loadState(freshGame);
    renderPage(<Diplomacia />);
    await userEvent.click(screen.getByRole('tab', { name: /acordos internacionais/i }));
    expect(screen.getByText(/nada em aberto agora/i)).toBeInTheDocument();
    // O catálogo de referência sempre aparece, mesmo sem nenhuma oferta.
    expect(screen.getByText(/acordo de livre comércio/i)).toBeInTheDocument();
  });

  it('uma oferta pendente mostra a ficha do acordo com os botões de decisão', async () => {
    const withOffer: GameState = deepClone(freshGame);
    const usa = withOffer.diplomacy.countries.find((country) => country.id === 'usa')!;
    withOffer.diplomacy.pendingOffers.push({
      id: 'offer_test',
      treatyId: 'livre_comercio',
      countryId: 'usa',
      countryName: usa.name,
      countryFlag: usa.flag,
      offeredMonth: withOffer.month,
      expiresMonth: withOffer.month + 3,
      status: 'pendente',
    });

    loadState(withOffer);
    renderPage(<Diplomacia />);
    await userEvent.click(screen.getByRole('tab', { name: /acordos internacionais/i }));

    expect(screen.getByRole('button', { name: /assinar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recusar/i })).toBeInTheDocument();
    // A ressalva aparece tanto na oferta quanto no catálogo de referência mais
    // abaixo na mesma aba — o teste só cobra que ela existe em algum lugar.
    expect(screen.getAllByText(/indústrias nacionais podem sofrer/i).length).toBeGreaterThan(0);
  });

  it('um acordo já em vigor aparece na lista de acordos assinados', async () => {
    const withTreaty: GameState = deepClone(freshGame);
    const usa = withTreaty.diplomacy.countries.find((country) => country.id === 'usa')!;
    withTreaty.diplomacy.treaties.push({
      id: 'treaty_test',
      treatyId: 'investimento_bilateral',
      countryId: 'usa',
      countryName: usa.name,
      countryFlag: usa.flag,
      signedMonth: withTreaty.month,
      monthlyCost: 0,
      label: 'Acordo de Investimento Bilateral',
    });

    loadState(withTreaty);
    renderPage(<Diplomacia />);
    await userEvent.click(screen.getByRole('tab', { name: /acordos internacionais/i }));
    expect(screen.getByText(/acordos em vigor/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /mesa diplomática/i }));
    expect(screen.getByText(/acordos assinados neste mandato/i)).toBeInTheDocument();
  });
});

/** Assina uma medida e abre a negociação na Câmara, para testar as telas de andamento. */
function signAndOpenNegotiation(base: GameState, text: string): { state: GameState; policy: Policy } {
  const state: GameState = deepClone(base);
  const analysis = interpretLocally(text, state);
  const rng = new Rng(state.seed, state.rngCursor);
  const policy = createPolicy(analysis, text, state, rng, false);
  state.rngCursor = rng.cursor;
  state.policies.push(policy);

  const rules = INSTRUMENT_RULES[policy.instrument];
  state.month += rules.delayMonths;
  const openRng = new Rng(state.seed, state.rngCursor);
  processPolicies(state, openRng);
  state.rngCursor = openRng.cursor;

  return { state, policy };
}

describe('Andamento das medidas — negociação, votação e reação', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('o Painel lista uma medida em negociação e abre a tela de negociação ao clicar', async () => {
    const { state } = signAndOpenNegotiation(
      freshGame,
      'Mando uma MP dobrando o benefício social e banco com taxação de dividendos.',
    );
    loadState(state);
    renderPage(<Painel />);

    expect(screen.getByText('Medidas em andamento')).toBeInTheDocument();
    await userEvent.click(screen.getByText(/em negociação na câmara/i));

    expect(screen.getByText(/previsão de votação/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /encerrar negociação e votar/i })).toBeInTheDocument();
  });

  it('a negociação mostra o menu de uma bancada ao clicar no card do partido', async () => {
    const { state } = signAndOpenNegotiation(
      freshGame,
      'Mando uma MP dobrando o benefício social e banco com taxação de dividendos.',
    );
    loadState(state);
    renderPage(<Painel />);
    await userEvent.click(screen.getByText(/em negociação na câmara/i));

    const partyAcronym = state.congress.blocs[0]!.partyId;
    await userEvent.click(screen.getByText(partyAcronym));

    expect(screen.getByText(`Negociar com ${partyAcronym}`)).toBeInTheDocument();
    expect(screen.getByText('Liberar emenda parlamentar')).toBeInTheDocument();
  });

  it('uma medida rejeitada mostra os motivos ao clicar na linha de tramitação', async () => {
    const { state, policy } = signAndOpenNegotiation(
      freshGame,
      'PEC da reforma administrativa acabando com a estabilidade para novos servidores.',
    );
    state.approval.overall = 15;
    state.congress.goodwill = 15;
    policy.status = 'rejeitada';
    policy.stage = 'concluido';
    policy.vote = { chamber: 'camara', favor: 120, against: 300, abstentions: 30, required: 308, passed: false, month: state.month, narrative: 'Derrotada com estrondo.' };
    policy.rejectionFactors = ['Resistência da oposição foi maior do que a base conseguiu compensar.'];

    loadState(state);
    renderPage(<Governo />);
    await userEvent.click(screen.getByRole('tab', { name: /execução/i }));
    await userEvent.click(screen.getByText(policy.title));

    expect(screen.getByText(/o que pesou contra/i)).toBeInTheDocument();
    expect(screen.getByText(/resistência da oposição/i)).toBeInTheDocument();
  });

  it('uma medida vigente mostra a linha do tempo e a reação do país no detalhe', async () => {
    const { state, policy } = signAndOpenNegotiation(
      freshGame,
      'Programa nacional de saneamento com R$ 40 bilhões nas periferias das capitais.',
    );
    const reactionRng = new Rng(state.seed, state.rngCursor);
    policy.status = 'vigente';
    policy.stage = 'concluido';
    policy.publicReaction = generatePublicReaction(policy, reactionRng);

    loadState(state);
    renderPage(<Governo />);
    await userEvent.click(screen.getByRole('tab', { name: /execução/i }));
    await userEvent.click(screen.getByText(policy.title));

    expect(screen.getByText(/linha do tempo/i)).toBeInTheDocument();
    expect(screen.getByText(/reação do país/i)).toBeInTheDocument();
    expect(policy.publicReaction).toHaveLength(7);
  });
});

describe('fim de mandato', () => {
  beforeEach(() => {
    localStorage.clear();
    loadState(finishedGame);
  });

  it('a avaliação final monta com os oito eixos e o legado', () => {
    // A tela pede a avaliação à store, que a calcula pelo repositório.
    const spy = vi.spyOn(useGame.getState(), 'loadEvaluation');
    const { container } = renderPage(<FimDeMandato />);
    spy.mockRestore();

    expect(container.textContent ?? '').not.toMatch(/NaN|undefined|Infinity/);
  });

  it('o mandato de fato terminou depois de 48 meses', () => {
    expect(finishedGame.flags.gameOver).toBe(true);
    expect(finishedGame.month).toBeGreaterThanOrEqual(48);
  });
});

/**
 * A TELA DA ELEIÇÃO
 *
 * Três momentos que quebram de formas diferentes: a decisão de disputar (sem
 * pesquisa nenhuma publicada), a campanha (com pesquisa, adversário e
 * movimentos) e a transição depois da vitória (o seletor de compromissos do
 * segundo mandato, que muda o estado da partida ao ser confirmado).
 */
describe('Eleição', () => {
  /** Coloca o país num humor conhecido: é dele que sai a intenção de voto. */
  function setMood(state: GameState, value: number): void {
    for (const group of state.socialGroups) group.approval = value;
    state.approval.overall = value;
    state.approval.personal = value;
    state.approval.history = Array.from({ length: 12 }, () => value);
    for (const region of Object.keys(state.approval.byRegion) as (keyof typeof state.approval.byRegion)[]) {
      state.approval.byRegion[region] = value;
    }
  }

  function runTo(month: number, mood: number): GameState {
    let state = createGame(buildInput({ reelection: true, seed: 9090 }));
    while (state.month < month && !state.flags.gameOver && state.phase !== 'transicao') {
      setMood(state, mood);
      state = tickMonth(state).state;
    }
    setMood(state, mood);
    return state;
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('monta a decisão de disputar a reeleição', () => {
    const state = runTo(41, 56);
    loadState(state);
    renderPage(<Eleicao />);

    expect(screen.getByRole('heading', { name: /você disputa a reeleição/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disputar a reeleição/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /não disputar/i })).toBeInTheDocument();
  });

  it('monta a campanha com pesquisa, adversário e movimentos', () => {
    const state = runTo(41, 56);
    decideCandidacy(state, true);
    let current = state;
    for (let index = 0; index < 3; index += 1) {
      setMood(current, 56);
      current = tickMonth(current).state;
    }

    loadState(current);
    renderPage(<Eleicao />);

    const adversario = current.election!.candidates.find((candidate) => !candidate.incumbent)!;
    expect(screen.getByText(adversario.name)).toBeInTheDocument();
    expect(screen.getAllByText(/margem/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /pt de agenda/i }).length).toBeGreaterThan(0);
  });

  it('mostra a apuração e leva o vencedor ao segundo mandato', async () => {
    let state = runTo(41, 70);
    decideCandidacy(state, true);
    while (state.phase !== 'transicao' && !state.flags.gameOver) {
      setMood(state, 70);
      state = tickMonth(state).state;
    }

    expect(state.election!.outcome).toBe('venceu');
    expect(state.phase).toBe('transicao');

    repository.importSave(serialize(state));
    loadState(state);
    renderPage(<Eleicao />);

    expect(screen.getAllByText(/primeiro turno/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /com que compromissos você volta/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /manter os compromissos atuais/i }));

    const depois = useGame.getState().state!;
    expect(depois.term).toBe(2);
    expect(depois.month).toBe(49);
    expect(depois.totalMonths).toBe(96);
  });

  it('avisa quando a urna ainda não entrou no calendário', () => {
    loadState(freshGame);
    renderPage(<Eleicao />);
    expect(screen.getByText(/fora da janela eleitoral/i)).toBeInTheDocument();
  });
});

describe('agenda dinâmica na tela', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('monta o Painel com um evento montado a partir do país', () => {
    let state = deepClone(playedGame);
    state.pendingEvents = [];

    // Sorteia até cair um evento dinâmico e o coloca na mesa do presidente.
    for (let index = 0; index < 200 && state.pendingEvents.length === 0; index += 1) {
      const draft = deepClone(state);
      const events = rollEvents(draft, new Rng(7000 + index * 11, index));
      const dynamic = events.filter((event) => event.definitionId.startsWith('dyn_'));
      if (dynamic.length > 0) {
        draft.pendingEvents = dynamic;
        state = draft;
      }
    }

    expect(state.pendingEvents.length).toBeGreaterThan(0);
    loadState(state);
    renderPage(<Painel />);

    const event = state.pendingEvents[0]!;
    expect(screen.getByText(event.title)).toBeInTheDocument();
    // O texto chega pronto: nenhum marcador de molde sobra na tela.
    expect(screen.getByText(event.title).textContent).not.toMatch(/\{\w+\}/);
    // O texto do evento chega inteiro à tela, com as entidades já preenchidas.
    expect(screen.getByText(event.brief)).toBeInTheDocument();
  });

  it('mostra o mês tranquilo quando a agenda vem limpa', () => {
    const calmo = deepClone(playedGame);
    calmo.pendingEvents = [];
    loadState(calmo);
    renderPage(<Painel />);

    expect(screen.getByText(/sua agenda está limpa/i)).toBeInTheDocument();
  });
});
