import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_AVATAR,
  MINISTER_POOL,
  MINISTRY_IDS,
  analyzeNumericPolicy,
  createGame,
  newGameSchema,
  type GameState,
} from '@/game';

import { NumericImpactPanel } from './NumericImpactPanel';

/**
 * O QUE O JOGADOR VÊ DE UMA MEDIDA NUMÉRICA
 *
 * A tela tem de responder "de quanto para quanto, quanto muda e quanto custa"
 * sem nunca mostrar multiplicador abstrato. Estes testes montam o painel de
 * verdade e conferem as duas coisas.
 */
function newGame(): GameState {
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
      reelection: false,
      seed: 909,
    }),
  );
}

describe('painel da medida numérica', () => {
  const state = newGame();

  it('mostra valor atual, novo valor, diferença e variação', () => {
    const breakdown = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 1.800', state)!;
    const { container } = render(<NumericImpactPanel breakdown={breakdown} />);
    const texto = container.textContent ?? '';

    expect(screen.getAllByText('Novo valor').length).toBeGreaterThan(0);
    expect(texto).toContain('R$ 1.620');
    expect(texto).toContain('R$ 1.800');
    expect(texto).toContain('R$ 180');
    expect(texto).toContain('11,1%');
  });

  it('nunca mostra multiplicador de intensidade', () => {
    const breakdown = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 1.700', state)!;
    const { container } = render(<NumericImpactPanel breakdown={breakdown} />);
    const texto = (container.textContent ?? '').toLowerCase();

    expect(texto).not.toMatch(/intensidade/);
    expect(texto).not.toMatch(/\d[,.]\d\s*x\b/);
  });

  it('mostra ponto percentual e variação relativa lado a lado numa alíquota', () => {
    const breakdown = analyzeNumericPolicy('Reduzir o FGTS patronal de 8% para 6%', state)!;
    const { container } = render(<NumericImpactPanel breakdown={breakdown} />);
    const texto = container.textContent ?? '';

    // De 8% para 6% são duas coisas ao mesmo tempo, e as duas aparecem:
    // 2 pontos percentuais a menos, e um corte de 25% em termos relativos.
    expect(texto).toContain('8%');
    expect(texto).toContain('6%');
    expect(texto).toContain('2 p.p.');
    expect(texto).toMatch(/25,0%/);
  });

  it('abre a conta fiscal por componente, em vez de um número solto', async () => {
    const breakdown = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 1.800', state)!;
    render(<NumericImpactPanel breakdown={breakdown} />);

    await userEvent.click(screen.getAllByText('Saldo fiscal federal')[0]!);
    expect(screen.getByText(/previdência vinculada ao piso/i)).toBeInTheDocument();
    expect(screen.getByText(/bpc e assistência social/i)).toBeInTheDocument();
    expect(screen.getByText(/tributos sobre o consumo adicional/i)).toBeInTheDocument();
  });

  it('apresenta os efeitos em faixa, sem precisão falsa', () => {
    const breakdown = analyzeNumericPolicy('Aumentar o salário mínimo para R$ 1.800', state)!;
    const { container } = render(<NumericImpactPanel breakdown={breakdown} />);

    expect(screen.getByText('Impacto econômico estimado')).toBeInTheDocument();
    // Toda estimativa aparece como intervalo "x a y".
    expect(container.textContent).toMatch(/\d\s*(p\.p\.|%|bi)\s*a\s*[+−-]/);
  });
});
