import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '../data/avatar';
import { LAW_CARD_IDS, PLAYER_ID, SEATS, STF_SEATS } from '../data/politics';
import { SERVICE_IDS } from '../types/common';
import type { GameState } from '../types/state';
import { Rng } from '../utils/rng';
import { advanceMonth } from './month';
import {
  appointMinister,
  castElectionVotes,
  investigableMinisters,
  isPlayerPresident,
  lawOptions,
  openCongress,
  pendingDuels,
  postOf,
  proposeLaw,
  requestInvestigation,
  voteDuel,
} from './politics';
import { deserialize, serialize } from './save';
import { createGame } from './setup';
import { chooseCard } from './turn';

const player = { firstName: 'Ana', lastName: 'Souza', politicalName: 'Ana Souza', avatar: DEFAULT_AVATAR };

/** Nenhuma pessoa em dois cargos, nenhuma cadeira acima do limite. */
function checkOffices(s: GameState) {
  const o = s.politics.offices;
  const holders = [o.president, ...o.deputies, ...o.senators, ...SERVICE_IDS.map((id) => o.ministers[id]), ...o.stf.map((x) => x.id)].filter(Boolean);
  expect(new Set(holders).size).toBe(holders.length);
  expect(o.deputies.length).toBeLessThanOrEqual(SEATS.deputado);
  expect(o.senators.length).toBeLessThanOrEqual(SEATS.senador);
  expect(o.stf.length).toBeLessThanOrEqual(STF_SEATS);
  for (const id of SERVICE_IDS) expect(s.politics.admin[id].fund).toBeGreaterThanOrEqual(0);
  expect(Number.isInteger(s.economy.treasury)).toBe(true);
}

describe('política', () => {
  it('eleição de abertura: candidatos registrados, o voto do jogador conta, vagas preenchidas, sem acúmulo', () => {
    const open = createGame({ seed: 7, president: player, candidacy: 'deputado' });
    expect(open.politics.offices.president).toBeNull();
    const pending = open.politics.pendingElection!;
    expect(pending.races.map((r) => r.office)).toEqual(['presidente', 'senador', 'deputado']);
    const myPresident = pending.races[0]!.candidates[0]!;
    const s = castElectionVotes(open, { presidente: myPresident, deputado: PLAYER_ID });
    expect(s.politics.pendingElection).toBeUndefined();
    expect(s.politics.npcs).toHaveLength(40);
    expect(s.politics.offices.president).not.toBeNull();
    expect(s.politics.offices.deputies).toHaveLength(SEATS.deputado);
    expect(s.politics.offices.senators).toHaveLength(SEATS.senador);
    expect(s.politics.offices.stf).toHaveLength(STF_SEATS);
    for (const race of s.politics.elections[0]!.races) {
      expect(race.ballots).toHaveLength(40);
      expect(race.results.reduce((sum, r) => sum + r.votes, 0)).toBe(race.office === 'senador' ? 40 : 41);
    }
    expect(s.politics.elections[0]!.races[0]!.playerVote).toBe(myPresident);
    expect(s.politics.elections[0]!.races.find((r) => r.office === 'deputado')!.results.some((r) => r.id === PLAYER_ID)).toBe(true);
    checkOffices(s);
  });

  it('os NPCs são salvos no save e voltam iguais', () => {
    const s = createGame({ seed: 3, president: player, candidacy: 'senador' });
    const loaded = deserialize(serialize(s)).state!;
    expect(loaded.politics.npcs).toEqual(s.politics.npcs);
    expect(createGame({ seed: 99, president: player, candidacy: 'senador' }).politics.npcs.map((n) => [n.name, n.efficiency, n.honesty]))
      .toEqual(s.politics.npcs.map((n) => [n.name, n.efficiency, n.honesty]));
  });

  it('save antigo, sem política, é migrado com o jogador presidente', () => {
    const s = createGame({ seed: 5, president: player }) as Partial<GameState>;
    delete s.politics;
    const loaded = deserialize(JSON.stringify(s)).state!;
    expect(isPlayerPresident(loaded)).toBe(true);
    expect(SERVICE_IDS.every((id) => loaded.politics.offices.ministers[id])).toBe(true);
  });

  it('só o presidente nomeia; leis disputam em duelo no Congresso e seguem ao STF e à Presidência', () => {
    let s = castElectionVotes(createGame({ seed: 11, president: player, candidacy: null }), {});
    const free = s.politics.npcs.find((n) => postOf(s.politics, n.id) === null)!;
    expect(() => appointMinister(s, 'saude', free.id)).toThrow(/presidente/);
    const options = lawOptions(s);
    expect(options).toHaveLength(3);
    expect(lawOptions(s)).toEqual(options); // fixos durante o mês
    expect(() => proposeLaw(s, options[0]!)).toThrow(/deputados e senadores/);

    s.politics.offices.deputies[0] = PLAYER_ID;
    const outside = LAW_CARD_IDS.find((law) => !options.includes(law))!;
    expect(() => proposeLaw(s, outside)).toThrow(/disponíveis do mês/);
    // Investigação só contra ministro no painel de improdutivos.
    const minister = s.politics.offices.ministers.saude!;
    expect(() => requestInvestigation(s, 'saude')).toThrow(/improdutivos/);
    s.politics.npcs.find((n) => n.id === minister)!.productivity = 10;
    expect(investigableMinisters(s).map((m) => m.id)).toContain(minister);

    s = proposeLaw(s, options[0]!);
    expect(lawOptions(s)).toEqual(options); // o próprio projeto não some da lista
    const id = s.politics.proposals.find((x) => x.authorId === PLAYER_ID)!.id;
    expect(() => proposeLaw(s, options[1]!)).toThrow(/iniciativa/);

    // Fechamento: os NPCs completam a pauta e a lei do jogador entra num duelo.
    s = openCongress(s);
    expect(openCongress(s).politics.duels).toEqual(s.politics.duels); // um conjunto de duelos por mês
    const duel = pendingDuels(s).find((d) => d.a === id || d.b === id)!;
    s = voteDuel(s, duel.id, duel.a === id ? 'a' : 'b');
    const resolved = s.politics.duels.find((d) => d.id === duel.id)!;
    expect(resolved.ballots).toHaveLength(s.politics.offices.deputies.length + s.politics.offices.senators.length);
    expect(resolved.ballots!.find((x) => x.voterId === PLAYER_ID)!.pick).toBe(duel.a === id ? 'a' : 'b');
    expect(() => voteDuel(s, duel.id, 'a')).toThrow(/apurada/);

    const winner = s.politics.proposals.find((x) => x.id === (resolved.winner === 'a' ? duel.a : duel.b))!;
    const stages: string[] = [winner.tallies[0]!.stage];
    for (let m = 0; m < 4 && winner.id && s.phase === 'jogando'; m += 1) {
      const law = s.politics.proposals.find((x) => x.id === winner.id)!;
      if (law.status !== 'em_tramitacao') break;
      stages.push(law.stage);
      s = advanceMonth(s).state;
    }
    // Congresso → STF → Presidência, uma etapa por mês, até ser decidida ou barrada.
    expect([...new Set(stages)]).toEqual(['congresso', 'stf', 'presidente'].slice(0, new Set(stages).size));
  });

  it('dez anos de partida mantêm os cargos coerentes e fazem eleições a cada 4 anos', () => {
    for (const seed of [1, 2, 3, 4]) {
      const pick = new Rng(seed * 31);
      let s = createGame({ seed, president: player, candidacy: 'presidente' });
      for (let m = 0; m < 120 && s.phase === 'jogando'; m += 1) {
        if (isPlayerPresident(s)) s = chooseCard(s, pick.pick(s.turn.offeredCardIds)).state;
        s = advanceMonth(s).state;
        checkOffices(s);
      }
      if (s.month > 97) expect(s.politics.elections.map((e) => e.month).slice(0, 3)).toEqual([1, 49, 97]);
    }
  });
});
