import { OUTFITS, type AvatarConfig } from '@/game';

/**
 * RETRATO OFICIAL
 *
 * Avatar vetorial montado por partes — nada de foto realista. Um retrato
 * estilizado combina com a linguagem do painel e evita o vale da estranheza de
 * um rosto quase-real que muda de expressão sozinho.
 *
 * Cada parte é uma função pura da configuração, então o mesmo objeto sempre
 * desenha exatamente o mesmo rosto: o retrato do presidente é estável do
 * primeiro ao último mês do mandato.
 */
export function Avatar({
  config,
  size = 96,
  className,
  frame = true,
}: {
  config: AvatarConfig;
  size?: number;
  className?: string;
  frame?: boolean;
}) {
  const outfit = OUTFITS.find((entry) => entry.id === config.outfit) ?? OUTFITS[0]!;
  const hasGlasses = config.accessory === 'oculos' || config.accessory === 'oculos_brinco';
  const hasEarring = config.accessory === 'brinco' || config.accessory === 'oculos_brinco';

  // Tom de sombra derivado da própria pele, para o queixo e o pescoço.
  const shade = shadeOf(config.skin, -18);

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Retrato do presidente"
      style={frame ? { border: '1px solid #2a2f38' } : undefined}
    >
      <rect width="120" height="120" fill={config.background} />

      {/* Ombros e traje */}
      <path d="M18 120c0-20 16-30 42-30s42 10 42 30z" fill={outfit.jacket} />
      <path d="M50 92l10 14 10-14 -6-4h-8z" fill={outfit.shirt} />
      {outfit.tie !== 'none' && <path d="M60 100l5 6-5 14-5-14z" fill={outfit.tie} />}

      {/* Pescoço */}
      <path d="M50 74h20v16c0 4-20 4-20 0z" fill={shade} />

      {/* Cabeça */}
      <ellipse cx="60" cy="52" rx="24" ry="27" fill={config.skin} />
      <path d="M36 56c0 14 11 25 24 25s24-11 24-25c0 0-6 12-24 12S36 56 36 56z" fill={shade} opacity="0.25" />

      {/* Orelhas */}
      <ellipse cx="36" cy="54" rx="4" ry="6" fill={config.skin} />
      <ellipse cx="84" cy="54" rx="4" ry="6" fill={config.skin} />
      {hasEarring && <circle cx="36" cy="60" r="2" fill="#d4af37" />}

      {/* Cabelo */}
      <Hair style={config.hairStyle} color={config.hair} />

      {/* Sobrancelhas */}
      <rect x="46" y="45" width="11" height="2.5" rx="1.25" fill={shadeOf(config.hair, -20)} />
      <rect x="63" y="45" width="11" height="2.5" rx="1.25" fill={shadeOf(config.hair, -20)} />

      {/* Olhos */}
      <ellipse cx="51.5" cy="53" rx="3.6" ry="2.9" fill="#f6f6f4" />
      <ellipse cx="68.5" cy="53" rx="3.6" ry="2.9" fill="#f6f6f4" />
      <circle cx="51.5" cy="53" r="1.9" fill={config.eyes} />
      <circle cx="68.5" cy="53" r="1.9" fill={config.eyes} />

      {hasGlasses && (
        <g stroke="#1a1c20" strokeWidth="1.6" fill="none" opacity="0.9">
          <rect x="45" y="48.5" width="13" height="9.5" rx="2" />
          <rect x="62" y="48.5" width="13" height="9.5" rx="2" />
          <path d="M58 53h4M45 52l-6-1M75 52l6-1" />
        </g>
      )}

      {/* Nariz e boca */}
      <path d="M60 55v6l-3 2" stroke={shade} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M53 68c3 2.5 11 2.5 14 0" stroke={shade} strokeWidth="1.8" fill="none" strokeLinecap="round" />

      {/* Barba */}
      <Beard style={config.beard} color={config.hair} />
    </svg>
  );
}

function Hair({ style, color }: { style: AvatarConfig['hairStyle']; color: string }) {
  switch (style) {
    case 'calvo':
      return <path d="M38 42c4-12 40-12 44 0-6-4-38-4-44 0z" fill={color} opacity="0.55" />;
    case 'raspado':
      return <path d="M36 48c0-16 10-24 24-24s24 8 24 24c0-8-10-12-24-12s-24 4-24 12z" fill={color} />;
    case 'topete':
      return (
        <path
          d="M35 46c0-18 12-24 25-24 12 0 24 6 24 22 0-6-4-12-14-12-6 0-8 4-16 2-6-1.5-8-6-8-6s-11 6-11 18z"
          fill={color}
        />
      );
    case 'comprido':
      return (
        <>
          <path d="M34 50c0-20 12-28 26-28s26 8 26 28v34c-4-6-6-22-6-30 0 0-8 6-20 6s-20-6-20-6c0 8-2 24-6 30z" fill={color} />
        </>
      );
    case 'cacheado':
      return (
        <g fill={color}>
          <ellipse cx="60" cy="28" rx="25" ry="16" />
          <circle cx="40" cy="36" r="8" />
          <circle cx="80" cy="36" r="8" />
          <circle cx="48" cy="26" r="8" />
          <circle cx="72" cy="26" r="8" />
        </g>
      );
    case 'preso':
      return (
        <>
          <path d="M35 48c0-19 12-26 25-26s25 7 25 26c0-9-11-14-25-14s-25 5-25 14z" fill={color} />
          <ellipse cx="60" cy="22" rx="9" ry="7" fill={color} />
        </>
      );
    default:
      return <path d="M36 48c0-18 11-26 24-26s24 8 24 26c0-9-10-14-24-14s-24 5-24 14z" fill={color} />;
  }
}

function Beard({ style, color }: { style: AvatarConfig['beard']; color: string }) {
  switch (style) {
    case 'cheia':
      return (
        <path
          d="M38 56c0 18 10 26 22 26s22-8 22-26c0 10-8 16-22 16s-22-6-22-16z"
          fill={color}
          opacity="0.92"
        />
      );
    case 'por_fazer':
      return (
        <path
          d="M40 58c0 16 9 24 20 24s20-8 20-24c0 10-9 15-20 15s-20-5-20-15z"
          fill={color}
          opacity="0.3"
        />
      );
    case 'cavanhaque':
      return (
        <>
          <ellipse cx="60" cy="74" rx="7" ry="5.5" fill={color} />
          <rect x="54" y="63" width="12" height="2.6" rx="1.3" fill={color} />
        </>
      );
    case 'bigode':
      return <rect x="53" y="63" width="14" height="3" rx="1.5" fill={color} />;
    case 'costeleta':
      return (
        <g fill={color}>
          <rect x="36" y="48" width="4" height="16" rx="2" />
          <rect x="80" y="48" width="4" height="16" rx="2" />
        </g>
      );
    default:
      return null;
  }
}

/** Escurece ou clareia um hex, para derivar sombra sem pedir mais uma cor. */
function shadeOf(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(clean.slice(offset, offset + 2), 16) + amount;
    return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}
