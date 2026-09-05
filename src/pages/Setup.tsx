import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Dice5, Flag, Star } from 'lucide-react';
import {
  ACCESSORIES,
  BACKGROUND_COLORS,
  BEARD_STYLES,
  DEFAULT_AVATAR,
  DIFFICULTY_LIST,
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  MAX_PROMISES,
  MINISTER_POOL,
  MINISTRIES,
  MINISTRY_IDS,
  OUTFITS,
  PARTIES,
  PARTY_COLOR_OPTIONS,
  PROMISE_CATALOG,
  SKIN_TONES,
  SOCIAL_GROUPS,
  STATES,
  VICE_POOL,
  createSeed,
  formatBRL,
  newGameSchema,
  type AvatarConfig,
  type Difficulty,
  type MinistryId,
  type NewGameInput,
  type PolicyCategory,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Avatar } from '@/components/game/Avatar';
import { Badge, Bar, cx } from '@/components/ui/primitives';

/**
 * MONTAR CANDIDATURA
 *
 * Cinco etapas até a posse. Cada escolha aqui já é jogo: a origem do presidente
 * decide quem gosta dele antes do primeiro discurso, o partido decide o tamanho
 * da base, o gabinete decide se o governo entrega ou se articula, e as
 * promessas viram a régua pela qual o mandato inteiro é medido.
 *
 * O painel lateral mostra a consequência de cada escolha em tempo real — para o
 * jogador entender que está construindo um governo, não preenchendo um cadastro.
 */

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<Step, string> = {
  1: 'Identidade',
  2: 'Perfil',
  3: 'Chapa',
  4: 'Governo',
  5: 'Promessas',
};

interface Draft {
  firstName: string;
  lastName: string;
  politicalName: string;
  age: number;
  gender: 'masculino' | 'feminino' | 'nao_binario';
  homeState: string;
  homeCity: string;
  occupation: string;
  education: string;
  religion: string;
  traits: string[];
  habits: string[];
  avatar: AvatarConfig;
  partyId: string | null;
  customParty: {
    name: string;
    acronym: string;
    color: string;
    ideology: { economic: number; social: number; institutional: number };
    priorities: PolicyCategory[];
  } | null;
  viceId: string;
  cabinet: Partial<Record<MinistryId, string>>;
  hasSpouse: boolean;
  spouseName: string;
  childrenCount: number;
  promises: string[];
  difficulty: Difficulty;
}

const OCCUPATIONS = [
  { id: 'politico_carreira', label: 'Político de carreira', hint: 'Vereador, deputado, ministro. Conhece cada gaveta e cada preço.' },
  { id: 'empresario', label: 'Empresário', hint: 'O mercado te leva a sério. O sindicato, não.' },
  { id: 'sindicalista', label: 'Sindicalista', hint: 'Base organizada e desconfiança permanente do empresariado.' },
  { id: 'militar', label: 'Militar da reserva', hint: 'Caserna tranquila, universidade hostil.' },
  { id: 'magistrado', label: 'Magistrado', hint: 'Vocabulário institucional e distância do povo.' },
  { id: 'lider_religioso', label: 'Líder religioso', hint: 'Um bloco identitário inteiro começa do seu lado.' },
  { id: 'medico', label: 'Médico', hint: 'Credibilidade fácil e nenhuma máquina partidária.' },
  { id: 'professor', label: 'Professor', hint: 'Rede de educação com você desde o primeiro dia.' },
  { id: 'produtor_rural', label: 'Produtor rural', hint: 'O agro financia. O ambientalismo declara guerra.' },
  { id: 'comunicador', label: 'Comunicador', hint: 'Sabe falar com a câmera antes de aprender a governar.' },
  { id: 'servidor_publico', label: 'Servidor público', hint: 'A máquina te obedece mais rápido.' },
  { id: 'advogado', label: 'Advogado', hint: 'Segurança jurídica nas medidas, carisma limitado.' },
];

const EDUCATIONS = [
  { id: 'direito', label: 'Direito' },
  { id: 'economia', label: 'Economia' },
  { id: 'engenharia', label: 'Engenharia' },
  { id: 'medicina', label: 'Medicina' },
  { id: 'academia_militar', label: 'Academia Militar' },
  { id: 'ciencias_sociais', label: 'Ciências Sociais' },
  { id: 'administracao', label: 'Administração' },
  { id: 'sem_curso_superior', label: 'Sem curso superior' },
];

const RELIGIONS = [
  { id: 'catolico', label: 'Católico' },
  { id: 'evangelico', label: 'Evangélico' },
  { id: 'espirita', label: 'Espírita' },
  { id: 'matriz_africana', label: 'Religião de matriz africana' },
  { id: 'judeu', label: 'Judeu' },
  { id: 'sem_religiao', label: 'Sem religião' },
];

const TRAITS = [
  { id: 'carismatico', label: 'Carismático', hint: 'Ganha a plateia em qualquer sala. Pronunciamento rende mais.' },
  { id: 'negociador', label: 'Negociador', hint: 'O Congresso cobra menos por voto.' },
  { id: 'tecnico', label: 'Técnico', hint: 'Números na ponta da língua. O mercado leva a sério.' },
  { id: 'linha_dura', label: 'Linha dura', hint: 'Mão firme em segurança. A caserna gosta, a periferia não.' },
  { id: 'reputacao_ilibada', label: 'Reputação ilibada', hint: 'Escândalos grudam menos em você.' },
  { id: 'populista', label: 'Populista', hint: 'Fala direto com o povo, passando por cima de todo mundo.' },
  { id: 'estadista_global', label: 'Estadista global', hint: 'Respeitado fora do país. Viagens rendem mais.' },
  { id: 'vingativo', label: 'Vingativo', hint: 'Retaliação é mais eficaz, mas queima pontes.' },
  { id: 'austero', label: 'Austero', hint: 'Credibilidade fiscal se recupera mais rápido.' },
  { id: 'midiatico', label: 'Midiático', hint: 'Cada publicação alcança mais gente, para o bem e para o mal.' },
];

const HABITS = [
  { id: 'torcedor', label: 'Torcedor fanático', hint: 'Aproxima do povo. Perder clássico estraga a semana.' },
  { id: 'frequenta_culto', label: 'Frequenta culto', hint: 'Evangélicos e católicos gostam de ver.' },
  { id: 'corredor', label: 'Corre todo dia', hint: 'Saúde cai mais devagar ao longo do mandato.' },
  { id: 'pescador', label: 'Pescador', hint: 'Recupera energia mais rápido nos fins de semana.' },
  { id: 'vive_nas_redes', label: 'Vive nas redes', hint: 'Fala direto com jovens. E erra em público mais vezes.' },
  { id: 'leitor_voraz', label: 'Leitor voraz', hint: 'Melhora a qualidade das decisões técnicas.' },
  { id: 'churrasqueiro', label: 'Churrasqueiro', hint: 'Bom de bastidor. Negociação em casa rende mais.' },
  { id: 'motociclista', label: 'Motociclista', hint: 'Imagem de coragem. Risco de acidente.' },
];

const CATEGORY_OPTIONS: { id: PolicyCategory; label: string }[] = [
  { id: 'economia', label: 'Economia' },
  { id: 'saude', label: 'Saúde' },
  { id: 'educacao', label: 'Educação' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'infraestrutura', label: 'Infraestrutura' },
  { id: 'social', label: 'Social' },
  { id: 'meio_ambiente', label: 'Meio ambiente' },
  { id: 'institucional', label: 'Institucional' },
  { id: 'agricultura', label: 'Agricultura' },
  { id: 'trabalho', label: 'Trabalho' },
];

function emptyDraft(): Draft {
  return {
    firstName: '',
    lastName: '',
    politicalName: '',
    age: 56,
    gender: 'masculino',
    homeState: 'SP',
    homeCity: 'São Paulo',
    occupation: 'politico_carreira',
    education: 'direito',
    religion: 'catolico',
    traits: [],
    habits: [],
    avatar: { ...DEFAULT_AVATAR },
    partyId: 'PSD',
    customParty: null,
    viceId: VICE_POOL[0]!.id,
    cabinet: {},
    hasSpouse: true,
    spouseName: '',
    childrenCount: 2,
    promises: [],
    difficulty: 'normal',
  };
}

export function Setup() {
  const navigate = useNavigate();
  const newGame = useGame((store) => store.newGame);
  const toast = useGame((store) => store.toast);

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const party = draft.customParty
    ? null
    : PARTIES.find((candidate) => candidate.id === draft.partyId) ?? null;

  // ------------------------------------------------------------ validação
  const blockers = useMemo(() => {
    const issues: Partial<Record<Step, string>> = {};
    if (draft.firstName.trim().length < 2 || draft.lastName.trim().length < 2) {
      issues[1] = 'Preencha nome e sobrenome.';
    } else if (draft.politicalName.trim().length < 2) {
      issues[1] = 'Informe o nome político — é como você aparece na urna.';
    } else if (draft.homeCity.trim().length < 2) {
      issues[1] = 'Informe a cidade natal.';
    } else if (!draft.partyId && !draft.customParty) {
      issues[1] = 'Escolha um partido ou funde a sua legenda.';
    } else if (draft.customParty && draft.customParty.acronym.trim().length < 2) {
      issues[1] = 'A legenda precisa de uma sigla.';
    } else if (draft.customParty && draft.customParty.priorities.length === 0) {
      issues[1] = 'Escolha ao menos uma prioridade para a legenda.';
    }

    const filled = MINISTRY_IDS.filter((id) => draft.cabinet[id]).length;
    if (filled < MINISTRY_IDS.length) {
      issues[4] = `Faltam ${MINISTRY_IDS.length - filled} pasta(s).`;
    }

    if (draft.promises.length !== MAX_PROMISES) {
      issues[5] = `Escolha ${MAX_PROMISES} promessas (${draft.promises.length} de ${MAX_PROMISES}).`;
    }
    return issues;
  }, [draft]);

  const canAdvance = !blockers[step];

  const handleStart = () => {
    setSubmitting(true);
    const payload = {
      president: {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        politicalName: draft.politicalName.trim(),
        age: draft.age,
        gender: draft.gender,
        homeState: draft.homeState,
        homeCity: draft.homeCity.trim(),
        occupation: draft.occupation,
        education: draft.education,
        religion: draft.religion,
        traits: draft.traits,
        habits: draft.habits,
        avatar: draft.avatar,
      },
      partyId: draft.customParty ? null : draft.partyId,
      customParty: draft.customParty,
      viceId: draft.viceId,
      cabinet: draft.cabinet,
      family: {
        hasSpouse: draft.hasSpouse,
        spouseName: draft.spouseName.trim() || undefined,
        childrenCount: draft.childrenCount,
      },
      promises: draft.promises,
      difficulty: draft.difficulty,
      startYear: 2027,
      seed: createSeed(),
      reelection: true,
    };

    const parsed = newGameSchema.safeParse(payload);
    if (!parsed.success) {
      setSubmitting(false);
      toast({
        kind: 'erro',
        title: 'Candidatura incompleta',
        detail: parsed.error.issues[0]?.message ?? 'Revise os campos.',
      });
      return;
    }

    newGame(parsed.data as NewGameInput);
    navigate('/painel');
  };

  return (
    <div className="min-h-full select-none bg-ink-950">
      {/* ---------------------------------------------------- cabeçalho */}
      <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
          <Star size={18} className="shrink-0 text-gov-500" fill="currentColor" aria-hidden />
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold uppercase leading-none tracking-wide text-neutral-50">
              Montar candidatura
            </h1>
            <p className="label -mt-0.5">Posse em 1º de janeiro de 2027</p>
          </div>
          <div className="flex-1" />
          <button type="button" className="btn-ghost btn-sm" onClick={() => navigate('/')}>
            Cancelar
          </button>
        </div>

        <ol className="mx-auto flex max-w-[1400px] gap-1 px-4 sm:px-6" aria-label="Etapas">
          {([1, 2, 3, 4, 5] as Step[]).map((current) => (
            <li key={current} className="flex-1">
              <button
                type="button"
                onClick={() => setStep(current)}
                className={cx(
                  'w-full border-b-2 pb-2 pt-1 text-left text-[11px] font-semibold uppercase tracking-wider transition-colors',
                  step === current
                    ? 'border-gov-500 text-neutral-50'
                    : current < step
                      ? 'border-gov-800 text-neutral-500 hover:text-neutral-300'
                      : 'border-ink-700 text-neutral-700',
                )}
              >
                <span className="font-mono">{current}</span> {STEP_LABELS[current]}
              </button>
            </li>
          ))}
        </ol>
      </header>

      {/* ------------------------------------------------------ conteúdo */}
      <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_320px]">
        <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {step === 1 && <StepIdentity draft={draft} update={update} setDraft={setDraft} />}
          {step === 2 && <StepProfile draft={draft} update={update} />}
          {step === 3 && <StepTicket draft={draft} update={update} />}
          {step === 4 && <StepCabinet draft={draft} setDraft={setDraft} />}
          {step === 5 && <StepPromises draft={draft} update={update} />}
        </motion.div>

        <SidePanel draft={draft} party={party} />
      </div>

      {/* -------------------------------------------------------- rodapé */}
      <footer className="sticky bottom-0 border-t border-ink-700 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="btn-ghost"
            disabled={step === 1}
            onClick={() => setStep((current) => (current - 1) as Step)}
          >
            <ArrowLeft size={13} aria-hidden />
            Voltar
          </button>

          <p className="min-w-0 flex-1 truncate text-[12px] text-neutral-500">
            {blockers[step] ?? STEP_HINTS[step]}
          </p>

          {step < 5 ? (
            <button
              type="button"
              className="btn-primary"
              disabled={!canAdvance}
              onClick={() => setStep((current) => (current + 1) as Step)}
            >
              Continuar
              <ArrowRight size={13} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={!canAdvance || submitting}
              onClick={handleStart}
            >
              <Flag size={13} aria-hidden />
              Tomar posse
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

const STEP_HINTS: Record<Step, string> = {
  1: 'Nome, partido e família pesam no eleitorado conservador antes do primeiro discurso.',
  2: 'De onde você veio decide quem já gosta de você antes do primeiro discurso.',
  3: 'O vice é o único da lista que ganha se você cair.',
  4: 'Pasta é moeda. As dez precisam de nome antes da posse.',
  5: 'Cinco promessas. São elas que a imprensa vai cobrar no último mês, uma por uma.',
};

// ===========================================================================
// Etapa 1 — Identidade
// ===========================================================================
function StepIdentity({
  draft,
  update,
  setDraft,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const [founding, setFounding] = useState(draft.customParty !== null);

  const randomizeAvatar = () => {
    const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;
    update('avatar', {
      skin: pick(SKIN_TONES),
      hair: pick(HAIR_COLORS),
      hairStyle: pick(HAIR_STYLES).id,
      beard: pick(BEARD_STYLES).id,
      eyes: pick(EYE_COLORS),
      outfit: pick(OUTFITS).id,
      accessory: pick(ACCESSORIES).id,
      background: pick(BACKGROUND_COLORS),
    });
  };

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="label-strong mb-3">Quem é você</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" htmlFor="cand-nome">
            <input
              id="cand-nome"
              className="field"
              value={draft.firstName}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({
                  ...current,
                  firstName: value,
                  // O nome político acompanha até o jogador editá-lo à mão.
                  politicalName:
                    current.politicalName === current.firstName ? value : current.politicalName,
                }));
              }}
              placeholder="Como está na certidão"
              maxLength={40}
            />
          </Field>
          <Field label="Sobrenome" htmlFor="cand-sobrenome">
            <input
              id="cand-sobrenome"
              className="field"
              value={draft.lastName}
              onChange={(event) => update('lastName', event.target.value)}
              maxLength={60}
            />
          </Field>
          <Field label="Nome político" htmlFor="cand-nome-politico" hint="Como você quer ser chamado na urna e no telejornal">
            <input
              id="cand-nome-politico"
              className="field"
              value={draft.politicalName}
              onChange={(event) => update('politicalName', event.target.value)}
              maxLength={40}
            />
          </Field>
          <Field label="Gênero">
            <div className="grid grid-cols-3 gap-1">
              {(['masculino', 'feminino', 'nao_binario'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cx('option py-1.5 text-center text-[12px]', draft.gender === option && 'option-selected')}
                  onClick={() => update('gender', option)}
                >
                  {option === 'nao_binario' ? 'Não-binário' : option === 'masculino' ? 'Homem' : 'Mulher'}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label={`Idade: ${draft.age} anos`} hint="Nada de mais para os dois lados.">
            <input
              type="range"
              min={35}
              max={85}
              value={draft.age}
              onChange={(event) => update('age', Number(event.target.value))}
              className="w-full accent-gov-500"
            />
          </Field>
          <Field label="Estado natal" htmlFor="cand-estado">
            <select
              id="cand-estado"
              className="field"
              value={draft.homeState}
              onChange={(event) => {
                const id = event.target.value;
                const found = STATES.find((state) => state.id === id);
                setDraft((current) => ({
                  ...current,
                  homeState: id,
                  homeCity: found?.capital ?? current.homeCity,
                }));
              }}
            >
              {STATES.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cidade natal" htmlFor="cand-cidade">
            <input
              id="cand-cidade"
              className="field"
              value={draft.homeCity}
              onChange={(event) => update('homeCity', event.target.value)}
              maxLength={60}
            />
          </Field>
        </div>
      </section>

      {/* ------------------------------------------------------ partido */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="label-strong">Partido</h2>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              const next = !founding;
              setFounding(next);
              setDraft((current) => ({
                ...current,
                partyId: next ? null : 'PSD',
                customParty: next
                  ? {
                      name: '',
                      acronym: '',
                      color: PARTY_COLOR_OPTIONS[0]!,
                      ideology: { economic: 0, social: 0, institutional: 50 },
                      priorities: [],
                    }
                  : null,
              }));
            }}
          >
            {founding ? 'Escolher partido existente' : 'Fundar meu próprio partido'}
          </button>
        </div>

        {founding && draft.customParty ? (
          <CustomPartyForm
            value={draft.customParty}
            onChange={(value) => update('customParty', value)}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {PARTIES.filter((entry) => entry.chamberSeats > 0).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={cx('option', draft.partyId === entry.id && 'option-selected')}
                  onClick={() => update('partyId', entry.id)}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0"
                      style={{ backgroundColor: entry.color }}
                      aria-hidden
                    />
                    <span className="truncate text-[12px] font-semibold text-neutral-100">
                      {entry.acronym}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
                    {entry.chamberSeats} dep.
                  </p>
                </button>
              ))}
            </div>

            {draft.partyId && (
              <p className="mt-2.5 border-l-2 border-l-ink-600 pl-2.5 text-[12px] leading-relaxed text-neutral-500">
                {PARTIES.find((entry) => entry.id === draft.partyId)?.description}
              </p>
            )}
          </>
        )}
      </section>

      {/* ------------------------------------------------------- família */}
      <section className="card p-4">
        <h2 className="label-strong mb-3">Família</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              className={cx('option py-2 text-center text-[12px]', draft.hasSpouse && 'option-selected')}
              onClick={() => update('hasSpouse', true)}
            >
              Casado
              <span className="block text-[10px] text-neutral-600">+ conservadores</span>
            </button>
            <button
              type="button"
              className={cx('option py-2 text-center text-[12px]', !draft.hasSpouse && 'option-selected')}
              onClick={() => update('hasSpouse', false)}
            >
              Solteiro
              <span className="block text-[10px] text-neutral-600">+ evangélicos, + urbanos</span>
            </button>
          </div>

          {draft.hasSpouse && (
            <Field label="Nome do primeiro-cônjuge (opcional)" htmlFor="cand-conjuge">
              <input
                id="cand-conjuge"
                className="field"
                value={draft.spouseName}
                onChange={(event) => update('spouseName', event.target.value)}
                maxLength={80}
              />
            </Field>
          )}
        </div>

        <Field
          label={`Filhos: ${draft.childrenCount}`}
          hint="Filho de presidente com holofote em cima aponta. Cada um é uma manchete esperando para acontecer."
          className="mt-3"
        >
          <input
            type="range"
            min={0}
            max={6}
            value={draft.childrenCount}
            onChange={(event) => update('childrenCount', Number(event.target.value))}
            className="w-full max-w-sm accent-gov-500"
          />
        </Field>
      </section>

      {/* -------------------------------------------------------- avatar */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="label-strong">Como você é</h2>
          <button type="button" className="btn-ghost btn-sm" onClick={randomizeAvatar}>
            <Dice5 size={12} aria-hidden />
            Sortear
          </button>
        </div>

        <div className="flex flex-wrap gap-5">
          <div className="shrink-0 text-center">
            <Avatar config={draft.avatar} size={120} />
            <p className="label mt-1.5">Retrato oficial</p>
          </div>

          <div className="min-w-[260px] flex-1 space-y-3">
            <Swatches
              label="Tom de pele"
              values={SKIN_TONES}
              selected={draft.avatar.skin}
              onSelect={(skin) => update('avatar', { ...draft.avatar, skin })}
            />
            <Swatches
              label="Cabelo"
              values={HAIR_COLORS}
              selected={draft.avatar.hair}
              onSelect={(hair) => update('avatar', { ...draft.avatar, hair })}
            />
            <Swatches
              label="Olhos"
              values={EYE_COLORS}
              selected={draft.avatar.eyes}
              onSelect={(eyes) => update('avatar', { ...draft.avatar, eyes })}
            />
            <Swatches
              label="Fundo do retrato"
              values={BACKGROUND_COLORS}
              selected={draft.avatar.background}
              onSelect={(background) => update('avatar', { ...draft.avatar, background })}
            />

            <ChipRow
              label="Corte"
              options={HAIR_STYLES.map((style) => ({ id: style.id, label: style.label }))}
              selected={draft.avatar.hairStyle}
              onSelect={(hairStyle) => update('avatar', { ...draft.avatar, hairStyle: hairStyle as AvatarConfig['hairStyle'] })}
            />
            <ChipRow
              label="Barba"
              options={BEARD_STYLES.map((style) => ({ id: style.id, label: style.label }))}
              selected={draft.avatar.beard}
              onSelect={(beard) => update('avatar', { ...draft.avatar, beard: beard as AvatarConfig['beard'] })}
            />
            <ChipRow
              label="Traje"
              options={OUTFITS.map((outfit) => ({ id: outfit.id, label: outfit.label }))}
              selected={draft.avatar.outfit}
              onSelect={(outfit) => update('avatar', { ...draft.avatar, outfit: outfit as AvatarConfig['outfit'] })}
            />
            <ChipRow
              label="Acessórios"
              options={ACCESSORIES.map((entry) => ({ id: entry.id, label: entry.label }))}
              selected={draft.avatar.accessory}
              onSelect={(accessory) => update('avatar', { ...draft.avatar, accessory: accessory as AvatarConfig['accessory'] })}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function CustomPartyForm({
  value,
  onChange,
}: {
  value: NonNullable<Draft['customParty']>;
  onChange: (value: NonNullable<Draft['customParty']>) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="border-l-2 border-l-warn-500 bg-warn-900/15 p-2 text-[12px] leading-snug text-warn-400">
        Legenda nova nasce com 8 deputados e nenhum cacique cobrando pasta. Ninguém te deve nada — e
        ninguém te deve obediência. É o caminho difícil.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do partido" htmlFor="party-nome">
          <input
            id="party-nome"
            className="field"
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
            placeholder="Movimento Brasil Novo"
            maxLength={60}
          />
        </Field>
        <Field label="Sigla" htmlFor="party-sigla" hint="Só letras maiúsculas e números">
          <input
            id="party-sigla"
            className="field font-mono uppercase"
            value={value.acronym}
            onChange={(event) =>
              onChange({ ...value, acronym: event.target.value.toUpperCase().slice(0, 14) })
            }
            placeholder="MBN"
          />
        </Field>
      </div>

      <Swatches
        label="Cor da legenda"
        values={PARTY_COLOR_OPTIONS}
        selected={value.color}
        onSelect={(color) => onChange({ ...value, color })}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <AxisSlider
          label="Economia"
          left="Estatizante"
          right="Liberal"
          value={value.ideology.economic}
          onChange={(economic) => onChange({ ...value, ideology: { ...value.ideology, economic } })}
        />
        <AxisSlider
          label="Costumes"
          left="Progressista"
          right="Conservador"
          value={value.ideology.social}
          onChange={(social) => onChange({ ...value, ideology: { ...value.ideology, social } })}
        />
        <AxisSlider
          label="Institucional"
          left="Rupturista"
          right="Legalista"
          value={value.ideology.institutional}
          onChange={(institutional) =>
            onChange({ ...value, ideology: { ...value.ideology, institutional } })
          }
        />
      </div>

      <Field label={`Prioridades (até 3) — ${value.priorities.length} escolhida(s)`}>
        <div className="flex flex-wrap gap-1">
          {CATEGORY_OPTIONS.map((option) => {
            const active = value.priorities.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                className={cx(
                  'border px-2 py-1 text-[11px] transition-colors',
                  active
                    ? 'border-gov-600 bg-gov-900/30 text-gov-400'
                    : 'border-ink-700 text-neutral-500 hover:border-ink-500',
                )}
                onClick={() =>
                  onChange({
                    ...value,
                    priorities: active
                      ? value.priorities.filter((id) => id !== option.id)
                      : value.priorities.length < 3
                        ? [...value.priorities, option.id]
                        : value.priorities,
                  })
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

// ===========================================================================
// Etapa 2 — Perfil
// ===========================================================================
function StepProfile({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  const toggle = (list: string[], id: string, max: number) =>
    list.includes(id) ? list.filter((entry) => entry !== id) : list.length < max ? [...list, id] : list;

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="label-strong mb-3">De onde você veio</h2>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {OCCUPATIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cx('option', draft.occupation === option.id && 'option-selected')}
              onClick={() => update('occupation', option.id)}
            >
              <p className="text-[12px] font-semibold text-neutral-100">{option.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{option.hint}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card p-4">
          <h2 className="label-strong mb-3">Formação</h2>
          <div className="grid grid-cols-2 gap-1.5">
            {EDUCATIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cx('option py-2 text-[12px]', draft.education === option.id && 'option-selected')}
                onClick={() => update('education', option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="label-strong mb-3">Religião</h2>
          <div className="grid grid-cols-2 gap-1.5">
            {RELIGIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cx('option py-2 text-[12px]', draft.religion === option.id && 'option-selected')}
                onClick={() => update('religion', option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="card p-4">
        <h2 className="label-strong mb-3">
          Traços — escolha até 2 ({draft.traits.length}/2)
        </h2>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {TRAITS.map((trait) => (
            <button
              key={trait.id}
              type="button"
              className={cx('option', draft.traits.includes(trait.id) && 'option-selected')}
              onClick={() => update('traits', toggle(draft.traits, trait.id, 2))}
            >
              <p className="text-[12px] font-semibold text-neutral-100">{trait.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{trait.hint}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="label-strong mb-3">
          Hábitos — escolha até 2 ({draft.habits.length}/2)
        </h2>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {HABITS.map((habit) => (
            <button
              key={habit.id}
              type="button"
              className={cx('option', draft.habits.includes(habit.id) && 'option-selected')}
              onClick={() => update('habits', toggle(draft.habits, habit.id, 2))}
            >
              <p className="text-[12px] font-semibold text-neutral-100">{habit.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{habit.hint}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ===========================================================================
// Etapa 3 — Chapa
// ===========================================================================
function StepTicket({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <section className="card p-4">
      <h2 className="label-strong">Quem vai com você na chapa</h2>
      <p className="mt-1 text-[12px] text-neutral-500">
        O vice é o único da lista que ganha se você cair. Um nome com bancada compra base antes da
        posse; um nome popular compra aprovação; um nome ambicioso compra as duas coisas e cobra em
        2030.
      </p>

      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {VICE_POOL.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={cx('option', draft.viceId === candidate.id && 'option-selected')}
            onClick={() => update('viceId', candidate.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-neutral-100">
                  {candidate.name}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {candidate.party} · {candidate.role}
                </p>
              </div>
              {candidate.ambitious && <Badge tone="warn">Ambicioso</Badge>}
            </div>

            <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">{candidate.bio}</p>

            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <Meter label="Competência" value={candidate.competence} />
              <Meter label="Popularidade" value={candidate.popularity} />
              <Meter label="Lealdade" value={candidate.loyalty} tone={candidate.loyalty < 55 ? 'danger' : 'gov'} />
              <Meter label="Bancada" value={Math.min(100, candidate.seatsBrought * 2.5)} tone="info" />
            </div>

            <p className="mt-1.5 text-[11px] leading-snug text-gov-400">{candidate.hook}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

// ===========================================================================
// Etapa 4 — Gabinete
// ===========================================================================
function StepCabinet({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const [open, setOpen] = useState<MinistryId | null>(null);

  const takenBy = (candidateId: string): MinistryId | undefined =>
    MINISTRY_IDS.find((id) => draft.cabinet[id] === candidateId);

  const autofill = () => {
    setDraft((current) => {
      const cabinet: Partial<Record<MinistryId, string>> = {};
      const used = new Set<string>();
      for (const ministryId of MINISTRY_IDS) {
        // Prefere quem tem afinidade com a pasta; cai para qualquer nome livre.
        const best =
          MINISTER_POOL.find(
            (candidate) => !used.has(candidate.id) && candidate.fits.includes(ministryId),
          ) ?? MINISTER_POOL.find((candidate) => !used.has(candidate.id));
        if (best) {
          cabinet[ministryId] = best.id;
          used.add(best.id);
        }
      }
      return { ...current, cabinet };
    });
  };

  const filled = MINISTRY_IDS.filter((id) => draft.cabinet[id]).length;

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="label-strong">O gabinete</h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-neutral-500">
            Dez pastas, dez decisões, e nenhuma delas dá para pular. Nome de partido sobe a relação
            com a bancada inteira dele e é o jeito mais barato de comprar base antes da primeira
            votação. Independente traz currículo e não traz um voto sequer; nome de internet traz só
            manchete.
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={autofill}>
          <Dice5 size={12} aria-hidden />
          Montar por afinidade
        </button>
      </div>

      <p className="mt-2 font-mono text-[11px] text-neutral-500">
        {filled}/{MINISTRY_IDS.length} pastas preenchidas
      </p>

      <ul className="mt-3 space-y-1.5">
        {MINISTRIES.map((ministry) => {
          const chosenId = draft.cabinet[ministry.id];
          const chosen = MINISTER_POOL.find((candidate) => candidate.id === chosenId);
          const expanded = open === ministry.id;

          return (
            <li key={ministry.id} className="border border-ink-700 bg-ink-900/40">
              <button
                type="button"
                className="flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-ink-800/50"
                onClick={() => setOpen(expanded ? null : ministry.id)}
                aria-expanded={expanded}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-neutral-100">
                    {ministry.name}
                  </p>
                  <p className="font-mono text-[11px] text-neutral-500">
                    valor {ministry.weight}/10 · {formatBRL(ministry.budget)}
                    {ministry.dirty && <span className="ml-1.5 text-warn-500">· pasta suja</span>}
                  </p>
                </div>
                {chosen ? (
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] text-neutral-200">{chosen.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-600">
                      {chosen.party ?? chosen.kind}
                    </p>
                  </div>
                ) : (
                  <Badge tone="warn">Vago</Badge>
                )}
              </button>

              {expanded && (
                <div className="border-t border-ink-700 p-2.5">
                  <p className="mb-2 text-[11px] leading-snug text-neutral-500">
                    {ministry.description}
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {MINISTER_POOL.map((candidate) => {
                      const heldBy = takenBy(candidate.id);
                      const unavailable = heldBy !== undefined && heldBy !== ministry.id;
                      const fits = candidate.fits.length === 0 || candidate.fits.includes(ministry.id);

                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          disabled={unavailable}
                          className={cx(
                            'option',
                            chosenId === candidate.id && 'option-selected',
                            unavailable && 'cursor-not-allowed opacity-35',
                          )}
                          onClick={() => {
                            setDraft((current) => ({
                              ...current,
                              cabinet: { ...current.cabinet, [ministry.id]: candidate.id },
                            }));
                            setOpen(null);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-[12px] font-semibold text-neutral-100">
                              {candidate.name}
                            </p>
                            <Badge tone={KIND_TONE[candidate.kind]}>{KIND_LABEL[candidate.kind]}</Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                            {candidate.bio}
                          </p>
                          <div className="mt-1.5 grid grid-cols-2 gap-x-3">
                            <Meter label="Competência" value={candidate.competence} />
                            <Meter label="Lealdade" value={candidate.loyalty} />
                            {candidate.seatsBrought > 0 && (
                              <Meter
                                label={`Traz ${candidate.seatsBrought} dep.`}
                                value={Math.min(100, candidate.seatsBrought * 3)}
                                tone="info"
                              />
                            )}
                            <Meter
                              label="Risco de escândalo"
                              value={candidate.scandalRisk}
                              tone={candidate.scandalRisk > 45 ? 'danger' : 'neutral'}
                            />
                          </div>
                          {!fits && (
                            <p className="mt-1 text-[10px] text-warn-500">
                              Fora da área de formação: a competência cai nesta pasta.
                            </p>
                          )}
                          {unavailable && (
                            <p className="mt-1 text-[10px] text-neutral-600">
                              Já ocupa outra pasta neste governo.
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const KIND_LABEL: Record<string, string> = {
  tecnico: 'Técnico',
  politico: 'Político',
  independente: 'Independente',
  internet: 'Internet',
};

const KIND_TONE: Record<string, 'gov' | 'info' | 'warn' | 'neutral'> = {
  tecnico: 'gov',
  politico: 'info',
  independente: 'neutral',
  internet: 'warn',
};

// ===========================================================================
// Etapa 5 — Promessas
// ===========================================================================
function StepPromises({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  const party = PARTIES.find((entry) => entry.id === draft.partyId);

  /** Uma promessa "combina" quando fala da prioridade da própria legenda. */
  const matches = (category: PolicyCategory): boolean => {
    const priorities = draft.customParty?.priorities ?? party?.priorities ?? [];
    return priorities.includes(category);
  };

  const toggle = (id: string) =>
    update(
      'promises',
      draft.promises.includes(id)
        ? draft.promises.filter((entry) => entry !== id)
        : draft.promises.length < MAX_PROMISES
          ? [...draft.promises, id]
          : draft.promises,
    );

  const ordered = useMemo(
    () => [...PROMISE_CATALOG].sort((a, b) => Number(matches(b.category)) - Number(matches(a.category))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.partyId, draft.customParty],
  );

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-bold uppercase text-neutral-50">
              O que você promete
            </h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-neutral-500">
              Escolha cinco. Elas viram a régua do seu mandato e aparecem no Painel todo mês, com o
              número atual ao lado. Nenhuma delas se cumpre sozinha.
            </p>
          </div>
          <Badge tone={draft.promises.length === MAX_PROMISES ? 'gov' : 'warn'}>
            {draft.promises.length} de {MAX_PROMISES}
          </Badge>
        </div>

        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {ordered.map((promise) => {
            const selected = draft.promises.includes(promise.id);
            const combines = matches(promise.category);
            const full = draft.promises.length >= MAX_PROMISES && !selected;

            return (
              <button
                key={promise.id}
                type="button"
                disabled={full}
                className={cx('option', selected && 'option-selected', full && 'opacity-40')}
                onClick={() => toggle(promise.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold leading-tight text-neutral-100">
                    {promise.title}
                  </p>
                  {combines && <Badge tone="info">Combina</Badge>}
                </div>

                <p className="mt-1 text-[12px] italic leading-snug text-neutral-400">
                  “{promise.quote}”
                </p>

                <p className="mt-1.5 font-mono text-[11px] text-neutral-500">
                  Meta: {promise.targetLabel}
                </p>

                <div className="mt-1.5 flex items-center gap-3">
                  <span className="flex-1">
                    <span className="label">Dificuldade</span>
                    <Bar
                      value={promise.difficulty}
                      tone={promise.difficulty > 75 ? 'danger' : promise.difficulty > 60 ? 'warn' : 'gov'}
                    />
                  </span>
                  <span className="flex-1">
                    <span className="label">Risco político</span>
                    <Bar
                      value={promise.politicalRisk}
                      tone={promise.politicalRisk > 60 ? 'danger' : 'neutral'}
                    />
                  </span>
                </div>

                {promise.harms.length > 0 && (
                  <p className="mt-1.5 text-[11px] leading-snug text-neutral-600">
                    Contraria:{' '}
                    {promise.harms
                      .map((id) => SOCIAL_GROUPS.find((group) => group.id === id)?.name ?? id)
                      .join(', ')}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="label-strong mb-1">Dificuldade</h2>
        <p className="mb-3 text-[12px] text-neutral-500">
          Nenhuma delas muda as regras. Todas mudam a sua margem de erro.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {DIFFICULTY_LIST.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={cx('option', draft.difficulty === preset.id && 'option-selected')}
              onClick={() => update('difficulty', preset.id)}
            >
              <p className="text-[13px] font-semibold text-neutral-100">{preset.label}</p>
              <p className="text-[11px] text-gov-400">{preset.tagline}</p>
              <p className="mt-1 text-[11px] leading-snug text-neutral-500">{preset.description}</p>
              <div className="mt-2 space-y-0.5 font-mono text-[10px] text-neutral-600">
                <p>Aprovação inicial · {preset.startingApproval}%</p>
                <p>Caixa inicial · R$ {preset.startingTreasury} bi</p>
                <p>Agenda · {preset.agendaPoints} pontos/mês</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ===========================================================================
// Painel lateral — consequência das escolhas em tempo real
// ===========================================================================
function SidePanel({ draft, party }: { draft: Draft; party: (typeof PARTIES)[number] | null }) {
  const preset = DIFFICULTY_LIST.find((entry) => entry.id === draft.difficulty)!;
  const vice = VICE_POOL.find((candidate) => candidate.id === draft.viceId);

  const cabinetParties = new Set(
    MINISTRY_IDS.map((id) => MINISTER_POOL.find((c) => c.id === draft.cabinet[id])?.party).filter(
      Boolean,
    ),
  );
  const baseSeats =
    (party?.chamberSeats ?? 8) +
    (vice?.seatsBrought ?? 0) +
    [...cabinetParties].reduce(
      (total, acronym) =>
        total + (PARTIES.find((entry) => entry.id === acronym)?.chamberSeats ?? 0),
      0,
    );

  /** Simpatia inicial de cada grupo, com a mesma lógica do motor. */
  const affinity = useMemo(() => {
    const map: Record<string, number> = {};
    for (const group of SOCIAL_GROUPS) {
      let score = group.approval;
      if (party?.socialBase.includes(group.id)) score += 9;
      score += ORIGIN_AFFINITY[draft.occupation]?.[group.id] ?? 0;
      if (draft.religion === 'evangelico' && group.id === 'evangelicos') score += 7;
      if (draft.religion === 'catolico' && group.id === 'catolicos') score += 7;
      map[group.id] = Math.max(0, Math.min(100, score));
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [draft.occupation, draft.religion, party]);

  const likes = affinity.slice(0, 4);
  const dislikes = affinity.slice(-4).reverse();

  return (
    <aside className="lg:sticky lg:top-[104px] lg:h-fit">
      <div className="card p-3">
        <div className="flex items-center gap-3">
          <Avatar config={draft.avatar} size={56} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold leading-tight text-neutral-50">
              {draft.politicalName.trim() || 'Sem nome'}
            </p>
            <p className="truncate text-[11px] text-neutral-500">
              {draft.age} anos ·{' '}
              {draft.customParty?.acronym || party?.acronym || '—'}-{draft.homeState}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-ink-700/60 pt-3">
          <MiniStat label="Aprovação" value={`${preset.startingApproval}%`} />
          <MiniStat label="Caixa" value={`R$ ${preset.startingTreasury} bi`} />
          <MiniStat
            label="Base"
            value={`${baseSeats}`}
            hint={`de 513 · ${baseSeats > 257 ? 'maioria' : 'minoria'}`}
            tone={baseSeats > 257 ? 'gov' : 'warn'}
          />
        </div>

        {vice && (
          <div className="mt-2.5 border-t border-ink-700/60 pt-2.5">
            <p className="label">Vice</p>
            <p className="text-[12px] text-neutral-200">{vice.name}</p>
            <p className="text-[11px] text-neutral-600">
              {vice.party} · lealdade {vice.loyalty}
            </p>
          </div>
        )}

        <div className="mt-2.5 border-t border-ink-700/60 pt-2.5">
          <p className="label mb-1.5 text-gov-500">Já gostam de você</p>
          <ul className="space-y-1">
            {likes.map(([id, value]) => (
              <AffinityRow key={id} id={id} value={value} />
            ))}
          </ul>

          <p className="label mb-1.5 mt-3 text-danger-500">Já não gostam</p>
          <ul className="space-y-1">
            {dislikes.map(([id, value]) => (
              <AffinityRow key={id} id={id} value={value} />
            ))}
          </ul>
        </div>

        {draft.promises.length > 0 && (
          <div className="mt-2.5 border-t border-ink-700/60 pt-2.5">
            <p className="label mb-1.5">Promessas</p>
            <ul className="space-y-0.5">
              {draft.promises.map((id) => (
                <li key={id} className="flex items-start gap-1.5 text-[11px] leading-snug text-neutral-400">
                  <Check size={10} className="mt-0.5 shrink-0 text-gov-500" aria-hidden />
                  {PROMISE_CATALOG.find((promise) => promise.id === id)?.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}

function AffinityRow({ id, value }: { id: string; value: number }) {
  const group = SOCIAL_GROUPS.find((entry) => entry.id === id);
  return (
    <li className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: group?.color }} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-400">{group?.name ?? id}</span>
      <span className="w-14 shrink-0">
        <Bar value={value} tone={value >= 55 ? 'gov' : value >= 45 ? 'warn' : 'danger'} animate={false} />
      </span>
      <span className="w-6 shrink-0 text-right font-mono text-[10px] text-neutral-500">
        {value.toFixed(0)}
      </span>
    </li>
  );
}

/** Mesma tabela do motor: mantê-las alinhadas evita prometer na tela o que o jogo não entrega. */
const ORIGIN_AFFINITY: Record<string, Partial<Record<string, number>>> = {
  empresario: { empresariado: 12, mercado_financeiro: 8, trabalhadores: -6, servidores: -4 },
  sindicalista: { trabalhadores: 14, servidores: 8, empresariado: -8, mercado_financeiro: -6 },
  militar: { militares: 16, policiais: 10, universitarios: -8, artistas: -6 },
  magistrado: { classe_media: 6, mercado_financeiro: 4 },
  lider_religioso: { evangelicos: 15, catolicos: 6, artistas: -8, universitarios: -5 },
  medico: { baixa_renda: 8, classe_media: 6, professores: 4 },
  professor: { professores: 15, universitarios: 10, empresariado: -3 },
  produtor_rural: { agronegocio: 16, ambientalistas: -10, indigenas: -7 },
  comunicador: { classe_media: 7, artistas: 5 },
  politico_carreira: { classe_media: -4, universitarios: -5 },
  servidor_publico: { servidores: 14, professores: 6, empresariado: -4 },
  advogado: { classe_media: 5, mercado_financeiro: 3 },
};

// ===========================================================================
// Peças de formulário
// ===========================================================================
/**
 * Rótulo de campo.
 *
 * Quando o conteúdo é UM controle (input, select), passa-se `htmlFor` e sai um
 * <label> de verdade, associado — o que faz o clique no rótulo focar o campo e
 * o leitor de tela anunciar os dois juntos. Quando o conteúdo é um grupo de
 * botões, <label> seria semanticamente errado: aí sai um grupo rotulado.
 */
function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;

  return (
    <div className={className}>
      {htmlFor ? (
        <label className="label block" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <p className="label">{label}</p>
      )}

      {htmlFor ? (
        <div className="mt-1.5">{children}</div>
      ) : (
        <div className="mt-1.5" role="group" aria-label={label}>
          {children}
        </div>
      )}

      {hint && (
        <p id={hintId} className="mt-1 text-[11px] leading-snug text-neutral-600">
          {hint}
        </p>
      )}
    </div>
  );
}

function Swatches({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div>
      <p className="label mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${label}: ${value}`}
            aria-pressed={selected === value}
            className={cx(
              'h-6 w-6 border-2 transition-transform',
              selected === value ? 'scale-110 border-gov-500' : 'border-ink-700 hover:border-ink-500',
            )}
            style={{ backgroundColor: value }}
            onClick={() => onSelect(value)}
          />
        ))}
      </div>
    </div>
  );
}

function ChipRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="label mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={cx(
              'border px-2 py-1 text-[11px] transition-colors',
              selected === option.id
                ? 'border-gov-600 bg-gov-900/30 text-gov-400'
                : 'border-ink-700 text-neutral-500 hover:border-ink-500',
            )}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AxisSlider({
  label,
  left,
  right,
  value,
  onChange,
}: {
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="label mb-1">
        {label} <span className="font-mono text-neutral-400">{value > 0 ? `+${value}` : value}</span>
      </p>
      <input
        type="range"
        min={-100}
        max={100}
        step={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-gov-500"
      />
      <div className="flex justify-between text-[10px] text-neutral-600">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function Meter({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'gov' | 'danger' | 'warn' | 'info' | 'neutral';
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-neutral-600">{label}</span>
        <span className="font-mono text-[10px] text-neutral-500">{value.toFixed(0)}</span>
      </div>
      <Bar value={value} tone={tone} animate={false} />
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone = 'flat',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'gov' | 'warn' | 'flat';
}) {
  const cls = { gov: 'text-gov-400', warn: 'text-warn-400', flat: 'text-neutral-100' }[tone];
  return (
    <div>
      <p className="label truncate">{label}</p>
      <p className={cx('font-mono text-[13px] font-medium', cls)}>{value}</p>
      {hint && <p className="text-[10px] text-neutral-600">{hint}</p>}
    </div>
  );
}
