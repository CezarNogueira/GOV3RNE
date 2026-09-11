import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_AVATAR,
  MINISTRY_IDS,
  createGame,
  defaultCabinet,
  interpretLocally,
  newGameSchema,
  serialize,
  type DecisionEntry,
  type GameState,
} from '@/game';
import { useGame } from './game-store';
import { repository } from './repository';

/**
 * MEDIDA NO CONGRESSO NÃO DÁ SPOILER
 *
 * Assinar, votar, seguir para o Senado e ver a reação do país acontecem dentro
 * do modal da medida. Nenhum desses passos abre a devolutiva na tela: ela
 * entregaria o resultado antes da hora. Um aviso antigo que estivesse aberto
 * também some, para não ficar por cima do modal.
 */
function newGame(): GameState {
  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age: 54,
        gender: 'feminino', homeState: 'PE', occupation: 'medico',
        religion: 'catolico', traits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet: defaultCabinet(MINISTRY_IDS),
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      startYear: 2027, reelection: false, seed: 7171,
    }),
  );
}

const AVISO_ANTIGO = { id: 'aviso-antigo' } as unknown as DecisionEntry;

function load(state: GameState): void {
  repository.importSave(serialize(state));
  useGame.setState({
    state,
    saves: [],
    evaluation: null,
    lastResult: null,
    lastDecision: AVISO_ANTIGO,
    lastNotes: [],
    briefing: null,
    showResult: false,
    toasts: [],
    ai: 'local',
  });
}

describe('medida enviada ao Congresso', () => {
  beforeEach(() => localStorage.clear());

  it('assinar, votar e ver a reação não abrem nenhuma devolutiva', () => {
    const state = newGame();
    load(state);

    const text = 'Projeto de lei ampliando o programa de creches em tempo integral.';
    const policyId = useGame.getState().signPolicy(interpretLocally(text, state), text);
    expect(policyId).toBeTruthy();
    expect(useGame.getState().lastDecision).toBeNull();

    const policy = () => useGame.getState().state!.policies.find((entry) => entry.id === policyId)!;
    expect(policy().stage).toBe('negociacao_camara');

    for (let passo = 0; passo < 4; passo += 1) {
      const atual = policy();
      if (atual.stage === 'negociacao_camara' || atual.stage === 'negociacao_senado') {
        useGame.getState().castMeasureVote(policyId!);
      } else if (atual.stage === 'transicao_senado') {
        useGame.getState().advanceMeasureToSenate(policyId!);
      } else {
        break;
      }
      expect(useGame.getState().lastDecision).toBeNull();
    }

    useGame.getState().revealReaction(policyId!);
    expect(policy().publicReaction?.length ?? 0).toBeGreaterThan(0);
    expect(useGame.getState().lastDecision).toBeNull();
    expect(useGame.getState().toasts).toHaveLength(0);
  });
});
