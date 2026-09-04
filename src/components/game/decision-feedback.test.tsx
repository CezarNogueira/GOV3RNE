import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  DEFAULT_AVATAR,
  MINISTER_POOL,
  MINISTRY_IDS,
  createGame,
  newGameSchema,
  serialize,
  type GameState,
} from '@/game';
import { useGame } from '@/state/game-store';
import { repository } from '@/state/repository';

import { DecisionFeedback } from './DecisionFeedback';

/**
 * A RESPOSTA NA TELA
 *
 * O motor mede a consequência; este teste garante que ela CHEGA ao jogador —
 * inclusive quando a resposta honesta é que nada mudou ainda.
 */
function newGame(): GameState {
  const cabinet: Record<string, string> = {};
  MINISTRY_IDS.forEach((ministryId, index) => {
    cabinet[ministryId] = MINISTER_POOL[index % MINISTER_POOL.length]!.id;
  });

  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age: 54,
        gender: 'feminino', homeState: 'PE', homeCity: 'Recife', occupation: 'medico',
        education: 'medicina', religion: 'catolico', traits: [], habits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet,
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal', startYear: 2027, reelection: true, seed: 4242,
    }),
  );
}

function load(state: GameState): void {
  repository.importSave(serialize(state));
  useGame.setState({
    state,
    saves: [],
    evaluation: null,
    lastResult: null,
    lastDecision: null,
    lastNotes: [],
    briefing: null,
    showResult: false,
    toasts: [],
    ai: 'local',
  });
}

describe('devolutiva de qualquer decisão', () => {
  beforeEach(() => {
    localStorage.clear();
    load(newGame());
  });

  it('aparece depois de uma ação e mostra o que mudou', async () => {
    render(
      <MemoryRouter>
        <DecisionFeedback />
      </MemoryRouter>,
    );

    // Nada foi decidido ainda: nada aparece.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    useGame.getState().companyAction({ kind: 'reuniao', companyId: 'jbs' });

    const painel = await screen.findByRole('status');
    expect(painel).toHaveTextContent(/JBS/i);
    expect(painel).toHaveTextContent(/o que isso mudou no país/i);
    // Convocar a direção custa agenda, e a devolutiva diz isso em número.
    expect(painel).toHaveTextContent(/pontos de agenda/i);
  });

  it('fecha quando o presidente dispensa', async () => {
    render(
      <MemoryRouter>
        <DecisionFeedback />
      </MemoryRouter>,
    );

    useGame.getState().companyAction({ kind: 'reuniao', companyId: 'weg' });
    await screen.findByRole('status');

    await userEvent.click(screen.getByRole('button', { name: /fechar devolutiva/i }));
    expect(useGame.getState().lastDecision).toBeNull();
  });
});
