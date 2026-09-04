import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  DEFAULT_AVATAR,
  MINISTER_POOL,
  MINISTRY_IDS,
  Rng,
  createGame,
  createPolicy,
  deepClone,
  interpretLocally,
  newGameSchema,
  serialize,
  type GameState,
  type NewGameInput,
  type Policy,
} from '@/game';
import { useGame } from '@/state/game-store';
import { repository } from '@/state/repository';

import { MeasureFlowModal } from './MeasureFlowModal';
import { EventCard } from './EventCard';

/**
 * O FLUXO DE UMA MEDIDA, DA ASSINATURA À REPERCUSSÃO
 *
 * A tramitação acontece na hora em que o presidente assina, e o modal conduz a
 * sequência inteira. Estes testes cobrem cada fase que ele precisa mostrar —
 * negociação, resultado, sanção e reação do país — e a ligação entre decidir um
 * evento e ir escrever a medida que responde a ele.
 *
 * A apuração animada não é testada aqui: ela é sete segundos de revelação do
 * resultado que o motor já fechou, e o motor tem teste próprio em
 * `legislative.test.ts`.
 */
function buildInput(): NewGameInput {
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
    family: { hasSpouse: false, childrenCount: 0 },
    promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
    difficulty: 'normal',
    startYear: 2027,
    reelection: false,
    seed: 7171,
  });
}

const baseGame = createGame(buildInput());

/** Assina uma medida no estado e registra a partida no repositório. */
function withMeasure(text: string): { state: GameState; policy: Policy } {
  const state = deepClone(baseGame);
  const analysis = interpretLocally(text, state);
  const rng = new Rng(state.seed, state.rngCursor);
  const policy = createPolicy(analysis, text, state, rng, false);
  state.rngCursor = rng.cursor;
  state.policies.push(policy);
  return { state, policy };
}

function load(state: GameState): void {
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
}

function renderFlow(policyId: string) {
  return render(
    <MemoryRouter>
      <MeasureFlowModal policyId={policyId} onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe('fases da medida', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('abre direto na negociação da Câmara para medida que depende de voto', () => {
    const { state, policy } = withMeasure(
      'Projeto de lei ampliando o programa de creches em tempo integral.',
    );
    expect(policy.stage).toBe('negociacao_camara');

    load(state);
    renderFlow(policy.id);

    expect(screen.getByText(/câmara dos deputados/i)).toBeInTheDocument();
    expect(screen.getByText(/previsão de votação/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /encerrar negociação e votar/i })).toBeInTheDocument();
  });

  it('mostra a sanção e leva à reação do país quando a medida foi aprovada', async () => {
    const { state, policy } = withMeasure(
      'Projeto de lei ampliando o programa de creches em tempo integral.',
    );
    policy.status = 'aprovada';
    policy.stage = 'sancao';

    load(state);
    renderFlow(policy.id);

    expect(screen.getByText(/aprovada no congresso/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /ver a reação do país/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/como o país recebeu a medida/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /concluir/i })).toBeInTheDocument();
  });

  it('medida sem Congresso mostra que vale por caneta e também repercute', async () => {
    const { state, policy } = withMeasure(
      'Corto 15% dos cargos comissionados de todos os ministérios por decreto.',
    );
    expect(policy.status).toBe('assinada');

    load(state);
    renderFlow(policy.id);

    expect(screen.getByText(/vale pela sua caneta/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /ver a reação do país/i }));
    expect(screen.getByText(/como o país recebeu a medida/i)).toBeInTheDocument();
  });

  it('medida derrotada mostra a repercussão sem cobrar aprovação por ela', async () => {
    const { state, policy } = withMeasure(
      'PEC acabando com a estabilidade dos servidores públicos.',
    );
    policy.status = 'rejeitada';
    policy.stage = 'concluido';
    policy.vote = {
      chamber: 'camara',
      favor: 180,
      against: 300,
      abstentions: 33,
      required: 308,
      passed: false,
      month: state.month,
      narrative: 'Derrotada em plenário por 300 votos a 180.',
    };

    const approvalBefore = state.approval.overall;
    load(state);
    renderFlow(policy.id);

    // "Rejeitada" aparece no subtítulo do modal e no aviso da derrota.
    expect(screen.getAllByText(/rejeitada/i).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /ver a repercussão/i }));

    expect(screen.getByText(/repercussão de uma derrota/i)).toBeInTheDocument();
    expect(useGame.getState().state?.approval.overall).toBe(approvalBefore);
  });

  it('reabrir a reação não cobra a aprovação duas vezes', async () => {
    const { state, policy } = withMeasure(
      'Corto 15% dos cargos comissionados de todos os ministérios por decreto.',
    );
    load(state);

    const { unmount } = renderFlow(policy.id);
    await userEvent.click(screen.getByRole('button', { name: /ver a reação do país/i }));
    const approvalAfterFirst = useGame.getState().state?.approval.overall;
    unmount();

    renderFlow(policy.id);
    await userEvent.click(screen.getByRole('button', { name: /ver a reação do país/i }));
    expect(useGame.getState().state?.approval.overall).toBe(approvalAfterFirst);
  });
});

describe('do evento para a caneta', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('avisa a tela assim que a decisão do evento é registrada', async () => {
    const state = deepClone(baseGame);
    const event = state.pendingEvents[0] ?? {
      id: 'evt_test',
      definitionId: 'teste',
      month: state.month,
      title: 'Greve nas refinarias',
      brief: 'Os petroleiros pararam.',
      category: 'economico' as const,
      severity: 'grave' as const,
      options: [
        {
          id: 'opt_test',
          label: 'Negociar reajuste',
          description: 'Sentar com o sindicato.',
          warning: 'O mercado vai ler como recuo.',
          cost: 0,
          impacts: {},
          groupImpacts: [],
          approvalDelta: 0.5,
          congressDelta: 0,
          stressDelta: 2,
        },
      ],
    };
    if (state.pendingEvents.length === 0) state.pendingEvents.push(event);

    load(state);
    const onDecided = vi.fn();
    render(
      <MemoryRouter>
        <EventCard event={event} onDecided={onDecided} />
      </MemoryRouter>,
    );

    const option = event.options[0]!;
    await userEvent.click(screen.getByRole('button', { name: new RegExp(option.label, 'i') }));
    expect(onDecided).toHaveBeenCalledTimes(1);
  });
});
