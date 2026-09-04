/**
 * Sistema visual de GOV3RNE.
 *
 * A referência não é um dashboard corporativo, é um painel de sala de situação:
 * fundo quase preto, cartões de cinza muito escuro, bordas quase invisíveis e
 * a informação carregando todo o peso. Cor tem função semântica fixa:
 *
 *   verde    - institucional, indicador positivo, ação do governo
 *   vermelho - indicador negativo, crise, perda
 *   âmbar    - alerta, economia, número que exige atenção
 *   azul     - informação neutra, dado de referência
 *
 * Nada de gradiente decorativo, sombra colorida ou canto muito arredondado.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fundos, do mais profundo ao mais elevado.
        ink: {
          950: '#07080a',
          900: '#0b0c0f',
          850: '#101216',
          800: '#14161b',
          750: '#191c22',
          700: '#1f232a',
          600: '#2a2f38',
          500: '#3a404b',
        },
        // Verde institucional.
        gov: {
          50: '#e8fbef',
          200: '#a7f3c4',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#12813c',
          900: '#0a3f1f',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          900: '#4c1414',
        },
        warn: {
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          900: '#463006',
        },
        info: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          900: '#152a4d',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', '"Arial Narrow"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Escala de rótulo: pequenos, em caixa alta, com muito espaçamento.
        label: ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.12em' }],
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
        // Escala de número grande, o protagonista de cada cartão.
        metric: ['2.25rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
        'metric-lg': ['3.25rem', { lineHeight: '3.25rem', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        card: '3px',
        pill: '2px',
      },
      spacing: {
        gutter: '1.25rem',
      },
      transitionDuration: {
        snap: '120ms',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bar-grow': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 180ms ease-out both',
        'bar-grow': 'bar-grow 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'pulse-soft': 'pulse-soft 2.2s ease-in-out infinite',
        ticker: 'ticker 40s linear infinite',
      },
    },
  },
  plugins: [],
};
