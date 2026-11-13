import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, FastForward, Star, Vote } from 'lucide-react';
import {
  PLAYER_ID,
  SEATS,
  attributesOf,
  castElectionVotes,
  monthLabel,
  nextElection,
  personName,
  postLabel,
  postOf,
  type ElectionRace,
  type ElectionRecord,
  type ElectiveOffice,
  type GameState,
  type PendingElection,
  type PersonId,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Bar, cx } from '@/components/ui/primitives';

/**
 * APURAÇÃO
 *
 * O motor já decidiu a eleição; esta tela revela o resultado voto a voto. Cada
 * cargo leva 5 segundos: os 40 votos entram em `COUNT_MS` e o resto do tempo
 * mostra os eleitos. Ordem: Presidente, Deputado, Senador (quando há).
 */
const RACE_MS = 5000;
const COUNT_MS = 4200;
const ORDER = ['presidente', 'deputado', 'senador'] as const;

const RACE_TITLE: Record<ElectionRace['office'], { house: string; title: string }> = {
  presidente: { house: 'Presidência da República', title: 'Presidente' },
  deputado: { house: 'Câmara dos Deputados', title: 'Deputados' },
  senador: { house: 'Senado Federal', title: 'Senadores' },
};

/**
 * Votos na ordem da apuração: o do jogador primeiro (quando votou), depois os dos
 * NPCs (`ballots[i]` é o voto de `npcs[i]`). Eleição sem cédulas salvas: intercala pelos totais.
 */
function votersOf(state: GameState, race: ElectionRace): { name: string; pick: PersonId }[] {
  const npcs = state.politics.npcs;
  const label = (i: number) => npcs[i]?.name ?? `Eleitor ${i + 1}`;
  if (race.ballots?.length) {
    const own = race.playerVote ? [{ name: 'Você', pick: race.playerVote }] : [];
    return [...own, ...race.ballots.map((pick, i) => ({ name: label(i), pick }))];
  }
  const left = new Map(race.results.map((r) => [r.id, r.votes]));
  const total = race.results.reduce((sum, r) => sum + r.votes, 0);
  const out: { name: string; pick: PersonId }[] = [];
  while (out.length < total) {
    for (const r of race.results) {
      const n = left.get(r.id) ?? 0;
      if (n > 0) {
        out.push({ name: label(out.length), pick: r.id });
        left.set(r.id, n - 1);
      }
    }
  }
  return out;
}

function RaceBoard({ state, race, ms }: { state: GameState; race: ElectionRace; ms: number }) {
  const ballots = votersOf(state, race);
  const counted = Math.min(ballots.length, Math.floor((ms / COUNT_MS) * ballots.length));
  const final = ms >= COUNT_MS;
  const tally = new Map<PersonId, number>(race.results.map((r) => [r.id, 0]));
  for (const { pick } of ballots.slice(0, counted)) tally.set(pick, (tally.get(pick) ?? 0) + 1);
  const finalOrder = race.results.map((r) => r.id);
  const rows = [...finalOrder].sort((a, b) => (tally.get(b) ?? 0) - (tally.get(a) ?? 0) || finalOrder.indexOf(a) - finalOrder.indexOf(b));
  const top = Math.max(1, ...race.results.map((r) => r.votes));
  const elected = new Set(race.results.filter((r) => r.elected).map((r) => r.id));
  const compact = rows.length > 6;
  const mine = race.results.find((r) => r.id === PLAYER_ID);
  const myPlace = rows.indexOf(PLAYER_ID) + 1;
  const lastSeat = race.results.filter((r) => r.elected).at(-1);
  const recent = Array.from({ length: Math.min(7, counted) }, (_, k) => counted - 1 - k);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-strong flex items-center gap-2 text-gov-400">Apuração · {RACE_TITLE[race.office].house}<span className="inline-block h-px w-10 bg-gov-700" aria-hidden /></p>
          <h2 className="mt-1 font-display text-5xl font-bold uppercase leading-none tracking-tight text-neutral-50">{RACE_TITLE[race.office].title}</h2>
          <p className="mt-1 text-[12.5px] text-neutral-500">{race.seats} {race.seats === 1 ? 'vaga' : 'vagas'} · {race.results.length} candidatos · {ballots.length} eleitores</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-4xl font-medium leading-none tabular text-neutral-50">{counted}<span className="unit">/{ballots.length}</span></p>
          <p className="label mt-1">urnas apuradas · {Math.max(0, (RACE_MS - ms) / 1000).toFixed(1)}s</p>
        </div>
      </div>
      <Bar value={counted} max={ballots.length} animate={false} className="h-1.5" />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <ol className="space-y-1.5" aria-live="polite">
          {rows.flatMap((id, i) => {
            const votes = tally.get(id) ?? 0;
            const isPlayer = id === PLAYER_ID;
            const won = final && elected.has(id);
            const cut = i === race.seats - 1 && race.seats < rows.length && (
              <li key="corte" className="flex items-center gap-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-warn-400" aria-hidden>
                <span className="h-px flex-1 bg-warn-600/60" /> linha de corte · {race.seats} {race.seats === 1 ? 'vaga' : 'vagas'} <span className="h-px flex-1 bg-warn-600/60" />
              </li>
            );
            const row = (
              <motion.li
                key={id}
                layout
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                className={cx(
                  'relative overflow-hidden rounded-card border px-3',
                  compact ? 'py-1.5' : 'py-3',
                  won ? 'border-gov-500 bg-gov-900/40' : isPlayer ? 'border-gov-700 bg-gov-900/15' : 'border-ink-700/70 bg-ink-850/80',
                  final && !won && 'opacity-50',
                )}
              >
                <div className="absolute inset-y-0 left-0 bg-gov-500/15 transition-[width] duration-150" style={{ width: `${(votes / top) * 100}%` }} aria-hidden />
                <div className="relative flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-7 shrink-0 font-mono text-[11px] text-neutral-500">{i + 1}º</span>
                    <span className={cx('truncate', compact ? 'text-[13px]' : 'font-display text-2xl font-semibold uppercase', isPlayer ? 'text-gov-400' : 'text-neutral-100')}>{personName(state, id)}</span>
                    <span className="shrink-0 text-[11px] text-neutral-600">pop. {attributesOf(state.politics, id).popularity}</span>
                    {won && (
                      <motion.span initial={{ scale: 2, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }} className="badge-gov shrink-0">
                        Eleito
                      </motion.span>
                    )}
                  </span>
                  <span className={cx('shrink-0 font-mono tabular text-neutral-100', compact ? 'text-[13px]' : 'text-2xl')}>
                    {votes}
                    <span className="unit">{counted > 0 ? Math.round((votes / counted) * 100) : 0}%</span>
                  </span>
                </div>
              </motion.li>
            );
            return cut ? [row, cut] : [row];
          })}
        </ol>

        <div className="space-y-3">
          {mine && (
            <section className={cx('card p-3', final && (mine.elected ? 'card-active' : 'card-danger'))}>
              <p className="label-strong">Sua candidatura</p>
              <p className="mt-1 font-mono text-3xl tabular text-neutral-50">{tally.get(PLAYER_ID) ?? 0}<span className="unit">votos · {myPlace}º lugar</span></p>
              <p className={cx('mt-1 text-[12.5px]', final ? (mine.elected ? 'text-gov-400' : 'text-danger-400') : myPlace <= race.seats ? 'text-gov-400' : 'text-warn-400')}>
                {final
                  ? mine.elected ? 'Eleito!' : `Não eleito: faltaram ${(lastSeat?.votes ?? 0) - mine.votes + 1} voto(s).`
                  : myPlace <= race.seats ? 'Dentro das vagas, por enquanto.' : 'Fora das vagas, por enquanto.'}
              </p>
            </section>
          )}
          <section className="card p-3">
            <p className="label-strong mb-2 flex items-center gap-1.5"><Vote size={12} aria-hidden /> Votos chegando</p>
            <ul className="space-y-1 text-[12px]">
              {recent.map((i) => (
                <motion.li key={`${race.office}-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }} className="flex justify-between gap-2">
                  <span className={cx('truncate', ballots[i]?.name === 'Você' ? 'font-semibold text-gov-400' : 'text-neutral-500')}>{ballots[i]?.name}</span>
                  <span className={cx('shrink-0 truncate', ballots[i]?.pick === PLAYER_ID ? 'text-gov-400' : 'text-neutral-200')}>→ {personName(state, ballots[i]?.pick ?? null)}</span>
                </motion.li>
              ))}
              {recent.length === 0 && <li className="text-neutral-600">Abrindo as urnas…</li>}
            </ul>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

function Summary({ state, record }: { state: GameState; record: ElectionRecord }) {
  const navigate = useNavigate();
  const p = state.politics;
  const myRace = record.races.find((r) => r.results.some((x) => x.id === PLAYER_ID));
  const mine = myRace?.results.find((x) => x.id === PLAYER_ID);
  const post = postOf(p, PLAYER_ID);
  const headline = !myRace ? 'Você não disputou esta eleição' : mine?.elected ? `Você foi eleito ${myRace.office}!` : `Você não se elegeu ${myRace.office}`;
  const detail = mine?.elected
    ? `${mine.votes} votos. Posse em ${monthLabel(record.month, state.startYear)}.`
    : p.invitations.length > 0
      ? 'Mas o presidente eleito tem um convite para você.'
      : `Próxima chance: eleição de ${monthLabel(nextElection(state.month).closingMonth, state.startYear)}.`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        {mine?.elected && (
          <div className="mb-3 flex justify-center gap-2 text-gov-400">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.1 * i, type: 'spring', stiffness: 300, damping: 12 }}>
                <Star size={28} fill="currentColor" aria-hidden />
              </motion.span>
            ))}
          </div>
        )}
        <motion.h2
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className={cx('font-display text-5xl font-bold uppercase leading-none tracking-tight sm:text-6xl', mine?.elected ? 'text-gov-400' : 'text-neutral-50')}
        >
          {headline}
        </motion.h2>
        <p className="mt-3 text-[14px] text-neutral-300">{detail}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {ORDER.flatMap((office) => record.races.filter((r) => r.office === office)).map((race) => (
          <section key={race.office} className="card p-4">
            <p className="label-strong mb-2">{RACE_TITLE[race.office].house}</p>
            <ul className="space-y-1 text-[13px]">
              {race.results.filter((r) => r.elected).map((r) => (
                <li key={r.id} className={cx('flex justify-between gap-2', r.id === PLAYER_ID && 'font-semibold text-gov-400')}>
                  <span>{personName(state, r.id)}</span>
                  <span className="font-mono tabular text-neutral-400">{r.votes}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex justify-center">
        <button type="button" className="btn-primary px-5 py-3 text-sm" onClick={() => navigate('/painel')}>
          {post ? `Ir para o painel de ${postLabel(post)}` : 'Ir para o painel'}
          <ArrowRight size={15} aria-hidden />
        </button>
      </div>
    </motion.div>
  );
}

/** Moldura comum da cédula e da apuração. */
function Frame({ month, state, children, right }: { month: number; state: GameState; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="relative min-h-full overflow-hidden select-none">
      <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6" data-testid="election">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Star size={17} className="text-gov-500" fill="currentColor" aria-hidden />
            <span className="font-display text-lg font-bold uppercase tracking-[0.12em] text-neutral-50">Eleições gerais</span>
            <span className="text-[12px] text-neutral-500">· posse em {monthLabel(month, state.startYear)}</span>
          </div>
          {right}
        </header>
        {children}
      </div>
    </div>
  );
}

/** A cédula do jogador: um voto por cargo, em qualquer candidato (inclusive em si mesmo) ou em branco. */
function Cedula({ state, pending }: { state: GameState; pending: PendingElection }) {
  const act = useGame((s) => s.act);
  const [picks, setPicks] = useState<Partial<Record<ElectiveOffice, PersonId>>>({});
  const races = ORDER.flatMap((office) => pending.races.filter((r) => r.office === office));

  return (
    <Frame month={pending.month} state={state}>
      <div className="space-y-5">
        <div>
          <p className="label-strong flex items-center gap-2 text-gov-400"><Vote size={13} aria-hidden /> Sua cédula</p>
          <h2 className="mt-1 font-display text-5xl font-bold uppercase leading-none tracking-tight text-neutral-50">Hora de votar</h2>
          <p className="mt-2 max-w-2xl text-[13px] text-neutral-400">
            Escolha um candidato para cada cargo, ou deixe em branco. Você pode votar em si mesmo. Os 40 políticos do país também votam, conforme a popularidade de cada um.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {races.map((race) => {
            const pick = picks[race.office];
            return (
              <section key={race.office} className="card space-y-2 p-3" aria-label={RACE_TITLE[race.office].house}>
                <div>
                  <p className="label-strong">{RACE_TITLE[race.office].house}</p>
                  <p className="text-[11.5px] text-neutral-500">{SEATS[race.office]} {SEATS[race.office] === 1 ? 'vaga' : 'vagas'} · {race.candidates.length} candidatos</p>
                </div>
                <ul className="space-y-1">
                  {race.candidates.map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        aria-pressed={pick === id}
                        className={cx('option flex items-center justify-between gap-2 py-1.5 text-[12.5px]', pick === id && 'option-selected')}
                        onClick={() => setPicks({ ...picks, [race.office]: pick === id ? undefined : id })}
                      >
                        <span className={cx('truncate', id === PLAYER_ID && 'font-semibold text-gov-400')}>{personName(state, id)}</span>
                        <span className="shrink-0 text-[11px] text-neutral-500">pop. {attributesOf(state.politics, id).popularity}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className={cx('text-[12px]', pick ? 'text-gov-400' : 'text-neutral-600')}>{pick ? `Seu voto: ${personName(state, pick)}` : 'Em branco'}</p>
              </section>
            );
          })}
        </div>

        <div className="flex justify-center">
          <button type="button" className="btn-primary px-5 py-3 text-sm" onClick={() => act((s) => castElectionVotes(s, picks))}>
            Confirmar voto e começar a apuração <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      </div>
    </Frame>
  );
}

function Apuracao({ state, record }: { state: GameState; record: ElectionRecord }) {
  const [elapsed, setElapsed] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const races = ORDER.flatMap((office) => record.races.filter((r) => r.office === office));
  const total = races.length * RACE_MS;

  useEffect(() => {
    if (total === 0) return;
    const start = performance.now();
    const timer = setInterval(() => {
      const now = performance.now() - start;
      setElapsed(now);
      if (now >= total) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [total]);

  if (races.length === 0) return <Navigate to="/painel" replace />;
  const shown = skipped ? total : elapsed;
  const done = shown >= total;
  const index = Math.min(races.length - 1, Math.floor(shown / RACE_MS));
  const race = races[index]!;

  return (
    <Frame
      month={record.month}
      state={state}
      right={
          <div className="flex items-center gap-2">
            <ol className="flex gap-1">
              {races.map((r, i) => (
                <li key={r.office} className={cx(done || i < index ? 'badge-gov' : i === index ? 'badge-info' : 'badge-neutral')}>{RACE_TITLE[r.office].title}</li>
              ))}
            </ol>
            {!done && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setSkipped(true)}>
                <FastForward size={12} aria-hidden /> Pular apuração
              </button>
            )}
          </div>
      }
    >
      {done ? <Summary state={state} record={record} /> : <RaceBoard key={race.office} state={state} race={race} ms={shown - index * RACE_MS} />}
    </Frame>
  );
}

/** Com eleição esperando voto, a cédula; depois, a apuração da última eleição. */
export function Eleicao() {
  const state = useGame((s) => s.state);
  if (!state) return <Navigate to="/" replace />;
  const pending = state.politics.pendingElection;
  if (pending) return <Cedula state={state} pending={pending} />;
  const record = state.politics.elections[state.politics.elections.length - 1];
  if (!record) return <Navigate to="/" replace />;
  return <Apuracao key={record.month} state={state} record={record} />;
}
