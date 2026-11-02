/**
 * Simulador de equilíbrio: joga N partidas com robôs e imprime estatísticas.
 *
 *   npx vite-node scripts/simulate.ts [partidas] [meses]
 *
 * Serve para calibrar `src/game/data/config.ts` e `rivals.ts`: depois de mexer
 * em chance de meta, escada do ranking ou ritmo da dívida, rode isto e veja se o
 * jogo continua possível sem ficar trivial.
 */
import {
  CARD_BY_ID, DEFAULT_AVATAR, GROUP_IDS, RIVALS, SERVICE_IDS, Rng,
  advanceMonth, chooseCard, createGame, type Card, type GameState,
} from '../src/game';

const GAMES = Number(process.argv[2] ?? 300);
const MAX_MONTHS = Number(process.argv[3] ?? 240);

type Policy = (s: GameState, rng: Rng) => string;

const random: Policy = (s, rng) => rng.pick(s.turn.offeredCardIds);

/** Robô atento: persegue o rival, cumpre metas, protege grupos e o cofre. */
const smart: Policy = (s) => {
  const chasing = s.international.gdpRank > 1 ? RIVALS.find((r) => r.rank === s.international.gdpRank - 1) : null;
  let best = s.turn.offeredCardIds[0]!;
  let bestScore = -Infinity;
  for (const id of s.turn.offeredCardIds) {
    const card: Card = CARD_BY_ID.get(id)!;
    const p = card.probability / 100;
    let gain = 0;
    for (const sid of SERVICE_IDS) {
      const d = card.serviceEffects[sid] ?? 0;
      if (!d) continue;
      const gap = chasing ? Math.max(0, chasing.services[sid] + 1 - s.services[sid]) : 0;
      const target = s.turn.targets[sid];
      const closesTarget = target !== null && s.services[sid] < target && s.services[sid] + d >= target;
      const key = sid === 'agricultura' || sid === 'educacao' ? 1.4 : 1;
      gain += d * (1 + Math.min(gap, 6) * 0.5) * key + (closesTarget ? 1.5 : 0);
    }
    for (const rid of Object.keys(card.resourceEffects)) gain += (card.resourceEffects as Record<string, number>)[rid]! * 0.04;
    gain += (card.internationalEffects.commerce ?? 0) * 0.08 + (card.internationalEffects.hdi ?? 0);
    let risk = 0;
    for (const g of GROUP_IDS) {
      const d = card.socialEffects[g] ?? 0;
      if (d < 0 && s.society[g] + d < 25) risk += 6 + (25 - (s.society[g] + d));
      if (d > 0 && s.society[g] < 45) gain += d * (1 + (45 - s.society[g]) * 0.08);
    }
    if (s.international.currencyCents <= 10) gain += (card.internationalEffects.commerce ?? 0) * 0.1;
    const score = p * gain - risk - (s.economy.treasury < card.implementationCost * 3 ? card.implementationCost / 400_000 : 0);
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
};

function run(policy: Policy, seed: number) {
  const rng = new Rng(seed * 7919 + 13);
  let s = createGame({ seed, president: { firstName: 'S', lastName: 'M', politicalName: 'SM', avatar: DEFAULT_AVATAR } });
  let firstRankMonth: Record<number, number> = {};
  let minTreasury = Infinity;
  while (s.phase === 'jogando' && s.month <= MAX_MONTHS) {
    s = chooseCard(s, policy(s, rng)).state;
    if (s.phase !== 'jogando') break;
    const before = s.international.gdpRank;
    s = advanceMonth(s).state;
    minTreasury = Math.min(minTreasury, s.economy.treasury);
    if (s.international.gdpRank < before) firstRankMonth[s.international.gdpRank] = s.month - 1;
  }
  return { s, firstRankMonth, minTreasury };
}

function report(name: string, policy: Policy) {
  const months: number[] = [], ranks: number[] = [], causes: Record<string, number> = {};
  let crises = 0, survivors = 0, reachedFirst = 0;
  const rankAt: Record<number, number[]> = {};
  const lastGroups: Record<string, number> = {};
  for (let seed = 1; seed <= GAMES; seed += 1) {
    const { s, firstRankMonth } = run(policy, seed);
    months.push(s.phase === 'derrota' ? s.month : MAX_MONTHS);
    ranks.push(s.international.gdpRank);
    if (s.phase === 'derrota') {
      const key = `${s.defeat!.cause}:${s.defeat!.subject}`;
      causes[key] = (causes[key] ?? 0) + 1;
    } else survivors += 1;
    if (s.economy.crisisCount > 0) crises += 1;
    if (s.flags.reachedFirst) reachedFirst += 1;
    for (const [r, m] of Object.entries(firstRankMonth)) (rankAt[Number(r)] ??= []).push(m);
    void lastGroups;
  }
  const sorted = [...months].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(1);
  console.log(`\n=== ${name} — ${GAMES} partidas, teto ${MAX_MONTHS} meses`);
  console.log(`sobrevivência (meses): p10=${q(0.1)} mediana=${q(0.5)} p90=${q(0.9)} | chegaram ao teto: ${((survivors / GAMES) * 100).toFixed(0)}%`);
  console.log(`posição final média: ${avg(ranks)}º | chegaram ao 1º: ${((reachedFirst / GAMES) * 100).toFixed(0)}% | com crise financeira: ${((crises / GAMES) * 100).toFixed(1)}%`);
  console.log('causas de derrota:', Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${((v / GAMES) * 100).toFixed(0)}%`).join('  ') || '—');
  console.log('mês médio da 1ª conquista de cada posição:', Object.entries(rankAt).sort((a, b) => Number(b[0]) - Number(a[0])).map(([r, m]) => `${r}º→m${avg(m)} (${m.length})`).join('  ') || '—');
}

report('robô ALEATÓRIO', random);
report('robô ATENTO', smart);
