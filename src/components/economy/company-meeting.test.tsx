import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_AVATAR,
  MINISTER_POOL,
  MINISTRY_IDS,
  Rng,
  createGame,
  newGameSchema,
  openCompanyMeeting,
  serialize,
  type CompanyMeeting,
  type GameState,
} from '@/game';
import { useGame } from '@/state/game-store';
import { repository } from '@/state/repository';

import { CompanyMeetingModal } from './CompanyMeetingModal';

/**
 * A AUDIÊNCIA NA TELA
 *
 * O motor tem teste próprio para a consequência de cada resposta. O que se
 * verifica aqui é o outro lado: que a tela ACOMPANHA a decisão. Um item
 * respondido tem de sair da pauta na hora, com o que mudou na empresa ao lado —
 * senão o presidente responde duas vezes o mesmo pedido achando que o primeiro
 * clique não pegou.
 *
 * Este teste monta a mesma ligação que o painel de empresas faz: a reunião e o
 * estado vêm do store a cada renderização. É por isso que ele pega o caso em que
 * a decisão é calculada e gravada, mas a interface continua mostrando a versão
 * anterior.
 */
function newGame(seed = 31): GameState {
  const cabinet: Record<string, string> = {};
  MINISTRY_IDS.forEach((ministryId, index) => {
    cabinet[ministryId] = MINISTER_POOL[index % MINISTER_POOL.length]!.id;
  });

  return createGame(
    newGameSchema.parse({
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
        traits: [],
        habits: [],
        avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB',
      customParty: null,
      viceId: 'vp_almeida',
      cabinet,
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal',
      startYear: 2027,
      reelection: false,
      seed,
    }),
  );
}

/** Abre a audiência no motor e carrega a partida no store, como no jogo. */
function withMeeting(companyId: string): CompanyMeeting {
  const state = newGame();
  const rng = new Rng(state.seed, state.rngCursor);
  const meeting = openCompanyMeeting(state, companyId, rng).meeting!;
  state.rngCursor = rng.cursor;

  repository.importSave(serialize(state));
  useGame.setState({
    state,
    saves: [],
    evaluation: null,
    lastResult: null,
    lastNotes: [],
    briefing: null,
    showResult: false,
    toasts: [],
    ai: 'local',
  });

  return meeting;
}

/** A mesma ligação do painel: reunião e estado saem do store a cada render. */
function Harness({ meetingId }: { meetingId: string }) {
  const state = useGame((store) => store.state);
  if (!state) return null;
  const meeting = state.companies.meetings.find((entry) => entry.id === meetingId);
  if (!meeting) return null;
  return <CompanyMeetingModal meeting={meeting} state={state} open onClose={() => {}} />;
}

describe('audiência com a direção da empresa', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tira o item da pauta assim que o presidente responde', async () => {
    const meeting = withMeeting('jbs');
    render(<Harness meetingId={meeting.id} />);

    const dialog = screen.getByRole('dialog');
    const recusasAntes = within(dialog).getAllByRole('button', { name: 'Recusar' });
    expect(recusasAntes.length).toBeGreaterThan(1);

    await userEvent.click(recusasAntes[0]!);

    // O item respondido saiu da negociação e virou registro.
    expect(within(dialog).getAllByRole('button', { name: 'Recusar' })).toHaveLength(
      recusasAntes.length - 1,
    );
    expect(within(dialog).getByText(/já decidido e computado/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/o governo disse não/i)).toBeInTheDocument();
  });

  it('mostra ao lado do item o que a resposta fez com a empresa', async () => {
    const meeting = withMeeting('jbs');
    render(<Harness meetingId={meeting.id} />);

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Recusar' })[0]!);

    expect(within(dialog).getByText(/relação com o governo:/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/investimento anual:/i)).toBeInTheDocument();
  });

  it('avisa quando a pauta inteira foi respondida', async () => {
    const meeting = withMeeting('jbs');
    render(<Harness meetingId={meeting.id} />);

    const dialog = screen.getByRole('dialog');
    let restantes = within(dialog).queryAllByRole('button', { name: 'Recusar' });
    while (restantes.length > 0) {
      await userEvent.click(restantes[0]!);
      restantes = within(dialog).queryAllByRole('button', { name: 'Recusar' });
    }

    expect(within(dialog).getByText(/todos os itens da pauta já foram decididos/i)).toBeInTheDocument();
  });
});
