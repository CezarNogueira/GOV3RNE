import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Dices, Play } from 'lucide-react';
import {
  ACCESSORIES,
  BACKGROUND_COLORS,
  BEARD_STYLES,
  DEFAULT_AVATAR,
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFITS,
  SKIN_TONES,
  presidentSchema,
  type AvatarConfig,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Avatar } from '@/components/game/Avatar';
import { cx } from '@/components/ui/primitives';

function Swatches({ label, values, selected, onSelect }: { label: string; values: readonly string[]; selected: string; onSelect: (v: string) => void }) {
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
            className={cx('h-6 w-6 border-2 transition-transform', selected === value ? 'scale-110 border-gov-500' : 'border-ink-700 hover:border-ink-500')}
            style={{ backgroundColor: value }}
            onClick={() => onSelect(value)}
          />
        ))}
      </div>
    </div>
  );
}

function ChipRow({ label, options, selected, onSelect }: { label: string; options: readonly { id: string; label: string }[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <p className="label mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected === option.id}
            className={cx('border px-2 py-1 text-[11px] transition-colors', selected === option.id ? 'border-gov-600 bg-gov-900/30 text-gov-400' : 'border-ink-700 text-neutral-500 hover:border-ink-500')}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;

/** Criação do mandato: o presidente é só nome e retrato. */
export function Setup() {
  const navigate = useNavigate();
  const newGame = useGame((s) => s.newGame);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [politicalName, setPoliticalName] = useState('');
  const [avatar, setAvatar] = useState<AvatarConfig>({ ...DEFAULT_AVATAR });
  const [touched, setTouched] = useState(false);

  const result = useMemo(
    () => presidentSchema.safeParse({ firstName, lastName, politicalName: politicalName || `${firstName} ${lastName}`.trim(), avatar }),
    [firstName, lastName, politicalName, avatar],
  );
  const errors = !result.success ? result.error.issues.map((issue) => issue.message) : [];

  const set = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) => setAvatar((a) => ({ ...a, [key]: value }));

  const randomize = () =>
    setAvatar({
      skin: pick(SKIN_TONES),
      hair: pick(HAIR_COLORS),
      hairStyle: pick(HAIR_STYLES).id,
      beard: pick(BEARD_STYLES).id,
      eyes: pick(EYE_COLORS),
      outfit: pick(OUTFITS).id,
      accessory: pick(ACCESSORIES).id,
      background: pick(BACKGROUND_COLORS),
    });

  const start = () => {
    setTouched(true);
    if (!result.success) return;
    newGame({ president: result.data });
    navigate('/painel');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <button type="button" className="btn-ghost btn-sm mb-4" onClick={() => navigate('/')}>
        <ArrowLeft size={12} aria-hidden /> Início
      </button>
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-neutral-50">Novo mandato</h1>
      <p className="mt-1 text-[13px] text-neutral-400">Quem vai governar? Nome e retrato: o resto é decidido carta a carta.</p>

      <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <Avatar config={avatar} size={180} />
          <button type="button" className="btn-ghost btn-sm" onClick={randomize}>
            <Dices size={13} aria-hidden /> Sortear retrato
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Nome</span>
              <input className="field mt-1 w-full" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={40} autoComplete="off" />
            </label>
            <label className="block">
              <span className="label">Sobrenome</span>
              <input className="field mt-1 w-full" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} autoComplete="off" />
            </label>
          </div>
          <label className="block">
            <span className="label">Nome político (opcional)</span>
            <input className="field mt-1 w-full" value={politicalName} placeholder={`${firstName} ${lastName}`.trim() || 'Como será chamado(a)'} onChange={(e) => setPoliticalName(e.target.value)} maxLength={40} autoComplete="off" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Swatches label="Pele" values={SKIN_TONES} selected={avatar.skin} onSelect={(v) => set('skin', v)} />
            <Swatches label="Cabelo" values={HAIR_COLORS} selected={avatar.hair} onSelect={(v) => set('hair', v)} />
            <Swatches label="Olhos" values={EYE_COLORS} selected={avatar.eyes} onSelect={(v) => set('eyes', v)} />
            <Swatches label="Fundo" values={BACKGROUND_COLORS} selected={avatar.background} onSelect={(v) => set('background', v)} />
          </div>
          <ChipRow label="Cabelo" options={HAIR_STYLES} selected={avatar.hairStyle} onSelect={(v) => set('hairStyle', v as AvatarConfig['hairStyle'])} />
          <ChipRow label="Barba" options={BEARD_STYLES} selected={avatar.beard} onSelect={(v) => set('beard', v as AvatarConfig['beard'])} />
          <ChipRow label="Traje" options={OUTFITS} selected={avatar.outfit} onSelect={(v) => set('outfit', v as AvatarConfig['outfit'])} />
          <ChipRow label="Acessório" options={ACCESSORIES} selected={avatar.accessory} onSelect={(v) => set('accessory', v as AvatarConfig['accessory'])} />

          {touched && errors.length > 0 && (
            <ul className="space-y-0.5 text-[12.5px] text-danger-400" role="alert">
              {errors.map((message) => <li key={message}>{message}</li>)}
            </ul>
          )}

          <button type="button" className="btn-primary" onClick={start}>
            <Play size={14} aria-hidden /> Assumir o governo
          </button>
        </div>
      </div>
    </div>
  );
}
