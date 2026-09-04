import { conditionLabel, formatMoney, physicalMultiplier, momentumLabel } from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/game/Avatar';
import { Bar, Badge, Empty, Section, StatRow, cx } from '@/components/ui/primitives';

/**
 * VIDA PESSOAL
 *
 * O corpo do presidente é uma variável de governo: saúde, energia e humor
 * multiplicam TODA votação em plenário. Presidente exausto perde voto que já
 * era dele.
 *
 * A família existe aqui para ter consequência política, não para ser vigiada.
 * Nada nesta página é íntimo — é sempre sobre exposição pública e atrito.
 */
export function VidaPessoal() {
  const state = useGame((store) => store.state);
  const runAction = useGame((store) => store.runAction);
  if (!state) return null;

  const { president } = state;
  const spouse = state.family.find((member) => member.kind === 'conjuge');
  const children = state.family.filter((member) => member.kind === 'filho');
  const multiplier = physicalMultiplier(state);

  return (
    <>
      <PageHeader
        place="Palácio da Alvorada · Residência oficial"
        title="Vida pessoal"
        subtitle="Seu corpo, sua casa e a memória de tudo o que você já fez neste mandato."
        badge={{
          label: `Estresse ${president.stress.toFixed(0)}%`,
          tone: president.stress > 70 ? 'danger' : president.stress > 45 ? 'warn' : 'gov',
        }}
        tint="slate"
      />

      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* ------------------------------------------------ o presidente */}
          <aside className="space-y-4">
            <Section title="O presidente">
              <div className="flex items-center gap-3">
                <Avatar config={president.avatar} size={72} />
                <div className="min-w-0">
                  <p className="truncate font-display text-xl font-semibold text-neutral-50">
                    {president.politicalName}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {president.age} anos · {state.party.acronym}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2 rule pt-3">
                <Condition label="Saúde" value={president.health} kind="saude" tone="gov" />
                <Condition label="Energia" value={president.energy} kind="energia" tone="info" />
                <Condition label="Humor" value={president.mood} kind="humor" tone="warn" />
                <Condition
                  label="Estresse"
                  value={president.stress}
                  kind="estresse"
                  tone="danger"
                  inverted
                />
                <Condition
                  label="Aprovação pessoal"
                  value={president.personalApproval}
                  kind="humor"
                  tone="gov"
                  hideLabel
                />
              </div>

              {/* O número que liga a vida pessoal à mecânica do jogo. */}
              <div className="mt-3 border border-ink-600 bg-ink-900/60 p-2.5 text-center">
                <p className="label">Multiplicador em plenário</p>
                <p
                  className={cx(
                    'font-mono text-2xl',
                    multiplier >= 1.05 ? 'text-gov-400' : multiplier >= 0.9 ? 'text-neutral-100' : 'text-danger-400',
                  )}
                >
                  ×{multiplier.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                  Sua condição física multiplica toda votação. Presidente exausto perde voto que já
                  era seu.
                </p>
              </div>

              <button
                type="button"
                className="btn-ghost mt-3 w-full"
                onClick={() => runAction('descansar')}
                disabled={state.agenda.points < 1 || state.flags.gameOver}
              >
                Guardar o fim de semana · 1 pt
              </button>
            </Section>

            <Section title="Conta pessoal">
              <p className="metric text-gov-400">{formatMoney(president.personalWealth)}</p>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                Salário de {formatMoney(president.monthlySalary)} cai todo mês. É daqui que sai
                jantar, terapia e amizade — não confunda com o caixa do Tesouro.
              </p>
            </Section>

            <Section title="Embalo do governo">
              <p
                className={cx(
                  'text-center font-display text-lg uppercase',
                  state.approval.momentum > 12
                    ? 'text-gov-400'
                    : state.approval.momentum > -12
                      ? 'text-neutral-400'
                      : 'text-danger-400',
                )}
              >
                {momentumLabel(state.approval.momentum)}
              </p>
              <div className="mt-2 flex h-1.5 overflow-hidden bg-ink-750">
                <div className="flex-1 bg-gradient-to-r from-danger-600 to-ink-750" />
                <div className="flex-1 bg-gradient-to-r from-ink-750 to-gov-600" />
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-neutral-600">
                {state.approval.momentum < -30
                  ? 'Ninguém quer ser fotografado com você. Cada voto custa o dobro.'
                  : state.approval.momentum > 30
                    ? 'Todo mundo quer aparecer ao seu lado. Aproveite: não dura.'
                    : 'Governo sem vento a favor nem contra.'}
              </p>
            </Section>

            <Section title="Seus hábitos" dense>
              <div className="flex flex-wrap gap-1 py-2">
                {president.habits.length === 0 ? (
                  <span className="text-[12px] text-neutral-600">Nenhum hábito declarado.</span>
                ) : (
                  president.habits.map((habit) => (
                    <Badge key={habit} tone="neutral">
                      {HABIT_LABEL[habit] ?? habit}
                    </Badge>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-1 border-t border-ink-800 py-2">
                {president.traits.map((trait) => (
                  <Badge key={trait} tone="gov">
                    {TRAIT_LABEL[trait] ?? trait}
                  </Badge>
                ))}
              </div>
            </Section>
          </aside>

          {/* -------------------------------------------------- a casa */}
          <div className="space-y-4">
            <Section title="Primeiro-cônjuge">
              {!spouse ? (
                <Empty>
                  Você entrou solteiro no Planalto. Uma manchete a menos e um palanque a menos.
                </Empty>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-xl font-semibold text-neutral-50">
                        {spouse.name}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {spouse.age} anos · {spouse.occupation}
                      </p>
                    </div>
                    <Badge tone={spouse.friction > 60 ? 'danger' : spouse.friction > 35 ? 'warn' : 'gov'}>
                      {STANCE_LABEL[spouse.stance ?? 'fora_dos_holofotes']}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Gauge label="Aprovação" value={spouse.approval} tone="gov" />
                    <Gauge label="Influência" value={spouse.influence} tone="info" />
                    <Gauge label="Atrito" value={spouse.friction} tone="danger" />
                  </div>

                  <p className="mt-3 border-l-2 border-l-ink-600 pl-2.5 text-[12px] leading-relaxed text-neutral-500">
                    {STANCE_TEXT[spouse.stance ?? 'fora_dos_holofotes']}
                  </p>

                  {spouse.friction > 60 && (
                    <p className="mt-2 border-l-2 border-l-warn-500 bg-warn-900/15 p-2 text-[12px] leading-snug text-warn-400">
                      O atrito em casa passou de 60. Isso já está aparecendo no seu estresse todo
                      mês — e estresse alto derruba votação em plenário.
                    </p>
                  )}
                </>
              )}
            </Section>

            <Section title="Filhos">
              {children.length === 0 ? (
                <Empty>Sem filhos. Ninguém para virar manchete no seu lugar.</Empty>
              ) : (
                <ul className="space-y-1.5">
                  {children.map((child) => (
                    <li
                      key={child.id}
                      className="flex flex-wrap items-center gap-3 border-b border-ink-800 py-2 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-neutral-200">{child.name}</p>
                        <p className="text-[11px] text-neutral-600">{child.age} anos</p>
                      </div>
                      <div className="w-32 shrink-0">
                        <div className="flex items-baseline justify-between">
                          <span className="label">Exposição pública</span>
                          <span className="font-mono text-[11px] text-neutral-500">
                            {child.exposure.toFixed(0)}
                          </span>
                        </div>
                        <Bar
                          value={child.exposure}
                          tone={child.exposure > 55 ? 'warn' : 'neutral'}
                          animate={false}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] leading-snug text-neutral-600">
                Exposição alta aumenta a chance de um familiar virar assunto — o que sempre custa
                mais tempo do que vale.
              </p>
            </Section>

            <Section title="Diário do mandato">
              {state.timeline.filter((entry) => entry.kind === 'pessoal').length === 0 ? (
                <Empty>Nada de pessoal registrado ainda.</Empty>
              ) : (
                <ul className="space-y-2">
                  {state.timeline
                    .filter((entry) => entry.kind === 'pessoal')
                    .slice(0, 10)
                    .map((entry) => (
                      <li key={entry.id} className="border-l-2 border-l-ink-600 pl-2.5">
                        <p className="label">{entry.monthLabel}</p>
                        <p className="text-[13px] text-neutral-200">{entry.title}</p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-500">
                          {entry.detail}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </Section>

            <Section title="Como está o corpo">
              <StatRow
                label="Saúde"
                value={`${president.health.toFixed(0)} · ${conditionLabel(president.health, 'saude')}`}
                tone={president.health > 70 ? 'pos' : president.health > 45 ? 'flat' : 'neg'}
                tip="Cai devagar e quase nunca sobe. É a única variável do jogo que é praticamente irreversível."
              />
              <StatRow
                label="Energia"
                value={`${president.energy.toFixed(0)} · ${conditionLabel(president.energy, 'energia')}`}
                tone={president.energy > 65 ? 'pos' : president.energy > 40 ? 'flat' : 'neg'}
                tip="Define quantos pontos de agenda você recebe no mês seguinte."
              />
              <StatRow
                label="Humor"
                value={`${president.mood.toFixed(0)} · ${conditionLabel(president.mood, 'humor')}`}
              />
              <StatRow
                label="Estresse"
                value={`${president.stress.toFixed(0)} · ${conditionLabel(president.stress, 'estresse')}`}
                tone={president.stress < 40 ? 'pos' : president.stress < 70 ? 'flat' : 'neg'}
              />
            </Section>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function Condition({
  label,
  value,
  kind,
  tone,
  inverted = false,
  hideLabel = false,
}: {
  label: string;
  value: number;
  kind: 'saude' | 'energia' | 'humor' | 'estresse';
  tone: 'gov' | 'info' | 'warn' | 'danger';
  inverted?: boolean;
  hideLabel?: boolean;
}) {
  const good = inverted ? value < 45 : value > 60;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-neutral-300">
          {label}
          {!hideLabel && (
            <span className="ml-1 text-[11px] text-neutral-600">
              {conditionLabel(value, kind)}
            </span>
          )}
        </span>
        <span className={cx('font-mono text-[13px]', good ? 'text-neutral-100' : 'text-warn-400')}>
          {value.toFixed(0)}
        </span>
      </div>
      <Bar value={value} tone={tone} animate={false} />
    </div>
  );
}

function Gauge({ label, value, tone }: { label: string; value: number; tone: 'gov' | 'info' | 'danger' }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="font-mono text-[13px] text-neutral-200">{value.toFixed(0)}</span>
      </div>
      <Bar value={value} tone={tone} animate={false} />
    </div>
  );
}

const STANCE_LABEL: Record<string, string> = {
  fora_dos_holofotes: 'Fora dos holofotes',
  palanque_permanente: 'Palanque permanente',
  programa_proprio: 'Programa próprio',
  conselheira_de_fato: 'Conselheiro de fato',
};

const STANCE_TEXT: Record<string, string> = {
  fora_dos_holofotes:
    'Sem agenda, sem entrevista, sem foto. Não rende voto nenhum, e é o único arranjo em que o casamento sai inteiro do mandato.',
  palanque_permanente:
    'Viaja o país no seu lugar, inaugura o que você não tem tempo de inaugurar e fala melhor do que você em palco pequeno. Cansa — e o cansaço em casa cobra depois.',
  programa_proprio:
    'Assume um programa com estrutura, equipe e agenda no interior. Rende aprovação onde o governo não chega, e vira alvo de CPI se algo der errado.',
  conselheira_de_fato:
    'Está em toda reunião importante sem ter cargo nenhum. Os ministros aprendem a ligar para ele antes de ligar para você, o que é útil e é perigoso.',
};

const HABIT_LABEL: Record<string, string> = {
  torcedor: 'Torcedor fanático',
  frequenta_culto: 'Frequenta culto',
  corredor: 'Corre todo dia',
  pescador: 'Pescador',
  vive_nas_redes: 'Vive nas redes',
  leitor_voraz: 'Leitor voraz',
  churrasqueiro: 'Churrasqueiro',
  motociclista: 'Motociclista',
};

const TRAIT_LABEL: Record<string, string> = {
  carismatico: 'Carismático',
  negociador: 'Negociador',
  tecnico: 'Técnico',
  linha_dura: 'Linha dura',
  reputacao_ilibada: 'Reputação ilibada',
  populista: 'Populista',
  estadista_global: 'Estadista global',
  vingativo: 'Vingativo',
  austero: 'Austero',
  midiatico: 'Midiático',
};
