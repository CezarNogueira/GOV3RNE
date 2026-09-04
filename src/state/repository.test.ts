import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_AVATAR,
  MINISTER_POOL,
  MINISTRY_IDS,
  newGameSchema,
  type NewGameInput,
} from '@/game';

import { repository } from './repository';

/**
 * O REPOSITÓRIO E A TELA
 *
 * O motor altera o estado no lugar — é assim que ele é rápido e testável. A
 * interface, do outro lado, redesenha quando a REFERÊNCIA do estado muda. Se o
 * repositório devolvesse o mesmo objeto que já estava na tela, a decisão seria
 * calculada e gravada no save enquanto a tela continuava mostrando a versão
 * anterior — que foi exatamente o que acontecia nas audiências com empresas.
 *
 * Este teste guarda a fronteira entre as duas coisas.
 */
function buildInput(seed = 4242): NewGameInput {
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
  });
}

describe('cada ação devolve um estado novo para a interface', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('não devolve o mesmo objeto que a tela já tem na mão', () => {
    const created = repository.create(buildInput());
    const anterior = repository.load(created.id);

    const outcome = repository.companyAction(created.id, { kind: 'reuniao', companyId: 'jbs' });

    // Referência nova: é isso que faz o React redesenhar a audiência.
    expect(outcome.state).not.toBe(anterior);
    expect(outcome.state.companies.meetings).toHaveLength(1);
    // A versão anterior fica intacta, sem a reunião que acabou de ser aberta.
    expect(anterior.companies.meetings).toHaveLength(0);
    // E a memória do repositório passa a apontar para a versão nova.
    expect(repository.load(created.id).companies.meetings).toHaveLength(1);
  });

  it('mantém a sequência de decisões coerente entre uma ação e a seguinte', () => {
    const created = repository.create(buildInput());
    const abertura = repository.companyAction(created.id, { kind: 'reuniao', companyId: 'jbs' });
    const pedido = abertura.state.companies.requests[0]!;

    const decisao = repository.companyAction(created.id, {
      kind: 'atender_demanda',
      requestId: pedido.id,
      choice: 'recusar',
    });

    expect(decisao.state).not.toBe(abertura.state);
    const decidido = decisao.state.companies.requests.find((entry) => entry.id === pedido.id)!;
    expect(decidido.status).toBe('recusada');
    expect(decidido.impact?.length).toBeGreaterThan(0);
    // A segunda tentativa sobre o mesmo pedido é recusada pelo motor.
    expect(() =>
      repository.companyAction(created.id, {
        kind: 'atender_demanda',
        requestId: pedido.id,
        choice: 'aceitar',
      }),
    ).toThrow();
  });
});
