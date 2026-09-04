import { describe, expect, it } from 'vitest';
import {
  beginSecondTerm,
  canRunForReelection,
  computeIntention,
  createGame,
  decideCandidacy,
  electionCalendar,
  migrate,
  runCampaignMove,
  tickMonth,
  type GameState,
} from './index';
import { Rng } from '../utils/rng';
import { deepClone } from '../utils/clone';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * A ELEIÇÃO E O SEGUNDO MANDATO
 *
 * O que estes testes protegem é a promessa central da reeleição: o resultado
 * sai do país que o jogador construiu. Governo bem avaliado ganha, governo mal
 * avaliado perde, e o meio vai para o segundo turno — sem sorteio decidindo.
 *
 * Protegem também a continuidade: vencer não recomeça a partida, continua a
 * mesma, com a dívida, a inflação e a cicatriz política que já estavam lá.
 */
function newGame(seed = 77, reelection = true): GameState {
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
      reelection,
      seed,
    }),
  );
}

/**
 * Coloca o país num humor conhecido.
 *
 * A aprovação nacional é recalculada todo mês a partir dos grupos sociais, então
 * mexer só no número agregado não sustenta: quem decide é a base.
 */
function setMood(state: GameState, value: number): void {
  for (const group of state.socialGroups) group.approval = value;
  state.approval.overall = value;
  state.approval.personal = value;
  state.approval.history = Array.from({ length: 12 }, () => value);
  for (const region of Object.keys(state.approval.byRegion) as (keyof typeof state.approval.byRegion)[]) {
    state.approval.byRegion[region] = value;
  }
}

/** Avança meses mantendo o humor do país fixo, para isolar a eleição. */
function advanceTo(state: GameState, month: number, mood?: number): GameState {
  let current = state;
  while (current.month < month && !current.flags.gameOver && current.phase !== 'transicao') {
    if (mood !== undefined) setMood(current, mood);
    current = tickMonth(current).state;
  }
  if (mood !== undefined) setMood(current, mood);
  return current;
}

describe('a janela eleitoral', () => {
  it('abre no quarto ano com o líder da oposição como adversário', () => {
    const inicio = newGame();
    const calendar = electionCalendar(inicio);
    expect(calendar.decisionMonth).toBe(40);
    expect(calendar.electionMonth).toBe(46);

    const state = advanceTo(inicio, calendar.decisionMonth + 1, 55);
    const election = state.election;

    expect(election).not.toBeNull();
    expect(election!.stage).toBe('definicao');
    expect(election!.candidates).toHaveLength(2);

    const adversario = election!.candidates.find((candidate) => !candidate.incumbent)!;
    expect(adversario.name).toBe(state.government.opposition.leaderName);
    expect(adversario.partyAcronym.length).toBeGreaterThan(1);
  });

  it('nunca lança um adversário do próprio partido do presidente', () => {
    const state = advanceTo(newGame(), 41, 50);
    const adversario = state.election!.candidates.find((candidate) => !candidate.incumbent)!;
    expect(adversario.partyId).not.toBe(state.party.id);
  });

  it('não existe para quem já está no segundo mandato', () => {
    const state = newGame();
    expect(canRunForReelection(state)).toBe(true);
    state.term = 2;
    expect(canRunForReelection(state)).toBe(false);
  });

  it('não abre quando a partida foi criada sem reeleição', () => {
    const state = advanceTo(newGame(77, false), 44, 60);
    expect(state.election).toBeNull();
  });
});

describe('a decisão de disputar', () => {
  it('não disputar encerra o mandato no último mês, sem urna', () => {
    let state = advanceTo(newGame(), 41, 52);
    const outcome = decideCandidacy(state, false);

    expect(outcome.ok).toBe(true);
    expect(state.election!.outcome).toBe('nao_concorreu');

    state = advanceTo(state, state.totalMonths + 1, 52);
    expect(state.flags.gameOver).toBe(true);
    expect(state.flags.gameOverReason).toBe('mandato_encerrado');
    expect(state.election!.rounds).toHaveLength(0);
  });

  it('o partido registra a candidatura se o presidente ficar calado', () => {
    const state = advanceTo(newGame(), 43, 52);
    expect(state.election!.running).toBe(true);
    expect(state.election!.stage).toBe('campanha');
    // Campanha atrasada começa atrás: o registro tardio custa intenção.
    expect(state.election!.moves.some((move) => move.moveId === 'registro_tardio')).toBe(true);
  });
});

describe('a urna lê o país', () => {
  it('reelege quem governou bem avaliado', () => {
    let state = advanceTo(newGame(), 41, 68);
    decideCandidacy(state, true);
    state = advanceTo(state, state.totalMonths + 1, 68);

    expect(state.election!.outcome).toBe('venceu');
    const primeiro = state.election!.rounds[0]!;
    expect(primeiro.results[0]!.candidateId).toBe('incumbente');
    expect(primeiro.results[0]!.share).toBeGreaterThan(50);
  });

  it('derrota quem chega ao quarto ano rejeitado', () => {
    let state = advanceTo(newGame(), 41, 22);
    decideCandidacy(state, true);
    state = advanceTo(state, state.totalMonths + 1, 22);

    expect(state.election!.outcome).toBe('derrotado');
    expect(state.flags.gameOver).toBe(true);
    expect(state.flags.gameOverReason).toBe('derrota_eleitoral');
  });

  it('leva a segundo turno quando ninguém passa de 50%', () => {
    let state = advanceTo(newGame(), 41, 44);
    decideCandidacy(state, true);
    state = advanceTo(state, state.totalMonths + 1, 44);

    const eleicao = state.election!;
    // Com o país dividido, ou houve segundo turno, ou o primeiro foi apertado.
    if (eleicao.rounds.length === 2) {
      expect(eleicao.rounds[0]!.winnerId).toBeNull();
      expect(eleicao.rounds[1]!.round).toBe(2);
      expect(eleicao.rounds[1]!.results).toHaveLength(2);
    } else {
      expect(eleicao.rounds[0]!.results[0]!.share).toBeLessThan(60);
    }
  });

  it('converte aprovação em intenção de voto, e não o contrário', () => {
    const alto = advanceTo(newGame(), 41, 70);
    const baixo = advanceTo(newGame(), 41, 30);

    const intencaoAlta = computeIntention(alto).incumbent;
    const intencaoBaixa = computeIntention(baixo).incumbent;

    expect(intencaoAlta).toBeGreaterThan(intencaoBaixa + 20);
    expect(computeIntention(alto).challenger).toBeLessThan(intencaoAlta);
  });

  it('publica pesquisa com margem de erro, e a apuração usa o número real', () => {
    let state = advanceTo(newGame(), 41, 58);
    decideCandidacy(state, true);
    state = advanceTo(state, 45, 58);

    const eleicao = state.election!;
    expect(eleicao.polls.length).toBeGreaterThan(0);

    const pesquisa = eleicao.polls[0]!;
    const real = computeIntention(state).incumbent;
    const publicado = pesquisa.byCandidate.incumbente ?? 0;
    expect(Math.abs(publicado - real)).toBeLessThanOrEqual(pesquisa.margin + 0.5);
    expect(pesquisa.institute.length).toBeGreaterThan(3);
  });
});

describe('a campanha', () => {
  it('cobra agenda, muda a intenção e não pode ser repetida', () => {
    const state = advanceTo(newGame(), 41, 55);
    decideCandidacy(state, true);
    const rng = new Rng(state.seed, state.rngCursor);

    const agendaAntes = state.agenda.points;
    const primeira = runCampaignMove(state, 'caravana_interior', rng);

    expect(primeira.ok).toBe(true);
    expect(state.agenda.points).toBeLessThan(agendaAntes);
    expect(state.election!.moves).toHaveLength(1);

    const repetida = runCampaignMove(state, 'caravana_interior', rng);
    expect(repetida.ok).toBe(false);
  });

  it('faz a caravana aparecer na intenção de voto', () => {
    const base = advanceTo(newGame(), 41, 50);
    decideCandidacy(base, true);

    const semCampanha = deepClone(base);
    const comCampanha = deepClone(base);
    runCampaignMove(comCampanha, 'caravana_interior', new Rng(comCampanha.seed, comCampanha.rngCursor));

    expect(computeIntention(comCampanha).incumbent).toBeGreaterThan(
      computeIntention(semCampanha).incumbent,
    );
  });
});

describe('o segundo mandato', () => {
  function reelected(seed = 77): GameState {
    let state = advanceTo(newGame(seed), 41, 68);
    decideCandidacy(state, true);
    state = advanceTo(state, state.totalMonths + 1, 68);
    return state;
  }

  it('para o relógio na transição até o presidente assumir', () => {
    const state = reelected();
    expect(state.election!.outcome).toBe('venceu');
    expect(state.phase).toBe('transicao');
    expect(state.flags.gameOver).toBe(false);

    const parado = tickMonth(state);
    expect(parado.state.month).toBe(state.month);
    expect(parado.gameOver).toBe(false);
  });

  it('dá mais 48 meses, com o país exatamente como ficou', () => {
    const state = reelected();
    const dividaAntes = state.economy.debtToGdp;
    const rng = new Rng(state.seed, state.rngCursor);

    const outcome = beginSecondTerm(
      state,
      ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      rng,
    );

    expect(outcome.ok).toBe(true);
    expect(state.term).toBe(2);
    expect(state.totalMonths).toBe(96);
    expect(state.month).toBe(49);
    expect(state.phase).toBe('mandato');
    // A herança é a do próprio governo: nada é zerado.
    expect(state.economy.debtToGdp).toBe(dividaAntes);
  });

  it('renova o Congresso na mesma urna, sem inventar cadeira', () => {
    const state = reelected();
    const senadoAntes = state.congress.blocs.reduce((total, bloc) => total + bloc.senateSeats, 0);
    beginSecondTerm(state, [], new Rng(state.seed, state.rngCursor));

    const camara = state.congress.blocs.reduce((total, bloc) => total + bloc.chamberSeats, 0);
    const senado = state.congress.blocs.reduce((total, bloc) => total + bloc.senateSeats, 0);
    expect(camara).toBe(513);
    expect(senado).toBe(senadoAntes);
    // A base do governo é recontada a partir das bancadas novas, pela mesma
    // régua que o jogo usa todo mês.
    expect(state.congress.governmentSeatsChamber).toBe(
      state.congress.blocs
        .filter((bloc) => bloc.support > 45)
        .reduce((total, bloc) => total + bloc.chamberSeats, 0),
    );
  });

  it('faz a vitória folgada puxar bancada, e a apertada quase nada', () => {
    const folgada = reelected();
    const baseAntes = folgada.congress.governmentSeatsChamber;
    beginSecondTerm(folgada, [], new Rng(folgada.seed, folgada.rngCursor));

    // Vitória grande atrai o meio do Congresso: deputado eleito quer estar do
    // lado de quem vai governar os próximos quatro anos.
    expect(folgada.congress.governmentSeatsChamber).toBeGreaterThan(baseAntes);

    // E a base nova sobrevive ao mês seguinte, porque o que mudou foi o apoio
    // dos partidos, não um número escrito na tela.
    const depois = tickMonth(folgada).state;
    expect(depois.congress.governmentSeatsChamber).toBeGreaterThan(baseAntes);
  });

  it('recomeça a régua das promessas', () => {
    const state = reelected();
    beginSecondTerm(
      state,
      ['imposto_menor', 'homicidios', 'educacao_forte', 'saneamento', 'primario_positivo'],
      new Rng(state.seed, state.rngCursor),
    );

    expect(state.promises.map((promise) => promise.id)).toContain('saneamento');
    expect(state.promises.every((promise) => promise.status === 'pendente')).toBe(true);
    expect(state.promises.every((promise) => promise.progress === 0)).toBe(true);
  });

  it('exige as cinco promessas quando o presidente escolhe um programa novo', () => {
    const state = reelected();
    const outcome = beginSecondTerm(state, ['saneamento'], new Rng(state.seed, state.rngCursor));
    expect(outcome.ok).toBe(false);
    expect(state.term).toBe(1);
  });

  it('não permite um terceiro mandato', () => {
    let state = reelected();
    beginSecondTerm(state, [], new Rng(state.seed, state.rngCursor));

    state = advanceTo(state, state.totalMonths + 1, 70);

    expect(state.flags.gameOver).toBe(true);
    expect(state.term).toBe(2);
    // A janela do quarto ano do segundo mandato não abre outra eleição.
    expect(state.election!.termAtStake).toBe(2);
  });
});

describe('saves antigos', () => {
  it('ganham a reeleição sem perder a partida', () => {
    const antigo = newGame() as GameState & { term?: number; election?: unknown };
    delete antigo.term;
    delete antigo.election;
    antigo.settings = { ...antigo.settings, reelection: false as unknown as boolean };
    delete (antigo.settings as { reelection?: boolean }).reelection;

    const migrado = migrate(antigo as GameState);
    expect(migrado.term).toBe(1);
    expect(migrado.election).toBeNull();
    expect(migrado.settings.reelection).toBe(true);
  });
});
