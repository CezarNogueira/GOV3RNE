import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { DEFAULT_AVATAR, getCard } from '@/game';
import { useGame } from '@/state/game-store';

const president = { firstName: 'Ana', lastName: 'Souza', politicalName: 'Ana Souza', avatar: DEFAULT_AVATAR };

function startAt(path: string, seed = 4) {
  localStorage.clear();
  useGame.setState({ state: null, lastResolution: null, showResolution: false, lastReport: null, showReport: false, toasts: [] });
  act(() => {
    useGame.getState().newGame({ president, seed });
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

describe('fluxo do mês na interface', () => {
  it('mostra os indicadores centrais, os cinco serviços e exatamente três cartas', async () => {
    startAt('/painel');
    const stats = await screen.findByTestId('headline-stats');
    for (const label of ['Mês e ano', 'Cofre público', 'Valor da moeda', 'Ranking de PIB', 'IDH', 'Comércio']) {
      expect(within(stats).getByText(label)).toBeInTheDocument();
    }
    expect(within(stats).getByText('R$ 10.000.000')).toBeInTheDocument();
    expect(within(stats).getByText('US$ 0,20')).toBeInTheDocument();
    expect(within(stats).getByText('10º lugar')).toBeInTheDocument();
    for (const id of ['saude', 'educacao', 'seguranca', 'agricultura', 'infraestrutura']) {
      expect(screen.getByTestId(`service-${id}`)).toBeInTheDocument();
    }
    const cards = within(screen.getByTestId('cards')).getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /^Escolher / })).toHaveLength(3);
  });

  it('cada carta traz chance, custo, consequências sociais e, quando é obra, o aviso', async () => {
    startAt('/painel');
    await screen.findByTestId('cards');
    const offered = useGame.getState().state!.turn.offeredCardIds.map(getCard);
    for (const card of offered) {
      const el = screen.getByTestId(`card-${card.id}`);
      expect(within(el).getByText(card.title)).toBeInTheDocument();
      expect(within(el).getByText(`${card.probability}%`, { exact: false })).toBeInTheDocument();
      expect(within(el).getByText('Chance de sucesso')).toBeInTheDocument();
      if (card.createsStructure) expect(within(el).getByText(/Obra:/)).toBeInTheDocument();
    }
  });

  it('escolher uma carta abre as consequências, trava as outras e libera o avanço do mês', async () => {
    const user = userEvent.setup();
    startAt('/painel');
    await screen.findByTestId('cards');
    const first = useGame.getState().state!.turn.offeredCardIds[0]!;

    await user.click(within(screen.getByTestId(`card-${first}`)).getByRole('button', { name: /^Escolher / }));

    expect(await screen.findByTestId('consequence-modal')).toBeInTheDocument();
    expect(useGame.getState().state!.turn.choice?.cardId).toBe(first);
    expect(screen.queryAllByRole('button', { name: /^Escolher / })).toHaveLength(0);
    expect(screen.getByTestId(`card-${first}`)).toHaveAttribute('data-mode', 'chosen');

    // Não existe como escolher uma segunda carta no mesmo mês.
    expect(() => useGame.getState().chooseCard(useGame.getState().state!.turn.offeredCardIds[1]!)).not.toThrow();
    expect(useGame.getState().state!.turn.choice?.cardId).toBe(first);
    expect(useGame.getState().state!.decisions).toHaveLength(1);
  });

  it('avançar o mês mostra o fechamento e começa o mês seguinte com três cartas novas', async () => {
    const user = userEvent.setup();
    startAt('/painel');
    await screen.findByTestId('cards');
    const first = useGame.getState().state!.turn.offeredCardIds[0]!;
    await user.click(within(screen.getByTestId(`card-${first}`)).getByRole('button', { name: /^Escolher / }));
    await screen.findByTestId('consequence-modal');

    await user.click(screen.getByRole('button', { name: /Avançar para o próximo mês/ }));

    expect(await screen.findByTestId('month-result', undefined, { timeout: 3000 })).toBeInTheDocument();
    await waitFor(() => expect(useGame.getState().state!.month).toBe(2));
    const next = useGame.getState().state!;
    expect(next.turn.choice).toBeNull();
    expect(new Set(next.turn.offeredCardIds).size).toBe(3);
    expect(screen.getByText(/Fechamento de Janeiro de 2027/)).toBeInTheDocument();
  });
});

describe('telas das áreas do país', () => {
  it.each([
    ['/servicos', 'Serviços'],
    ['/internacional', 'Internacional'],
    ['/recursos', 'Recursos'],
    ['/economia', 'Economia'],
    ['/sociedade', 'Sociedade'],
    ['/historico', 'Histórico'],
    ['/ajustes', 'Ajustes'],
  ])('%s monta sem erro', async (path, title) => {
    startAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('Internacional mostra o país em 10º e o rival perseguido', async () => {
    startAt('/internacional');
    expect(await screen.findByTestId('rank-mine')).toHaveTextContent('10º');
    expect(screen.getByText('Canadá', { selector: 'p' })).toBeInTheDocument();
  });

  it('Sociedade lista os cinco grupos em 50', async () => {
    startAt('/sociedade');
    for (const id of ['pobres', 'ricos', 'militares', 'indigenas', 'empresarios']) {
      expect(await screen.findByTestId(`group-${id}`)).toHaveTextContent('50');
    }
  });

  it('Recursos mostra as receitas iniciais do enunciado', async () => {
    startAt('/recursos');
    const comida = await screen.findByTestId('resource-comida');
    expect(comida).toHaveTextContent('R$ 5.120.000');
    expect(comida).toHaveTextContent('R$ 6.400');
    expect(screen.getByText('R$ 27.225.000')).toBeInTheDocument();
  });

  it('as abas removidas não existem mais', async () => {
    startAt('/painel');
    await screen.findByTestId('cards');
    for (const gone of ['Poder', 'Programas', 'Diplomacia', 'Governo', 'Nação', 'Vida pessoal']) {
      expect(screen.queryByRole('link', { name: gone })).not.toBeInTheDocument();
    }
  });
});

describe('derrota', () => {
  it('um grupo a zero leva à tela de fim de jogo', async () => {
    startAt('/painel');
    await screen.findByTestId('cards');
    act(() => {
      const s = structuredClone(useGame.getState().state!);
      s.phase = 'derrota';
      s.defeat = { cause: 'grupo', subject: 'indigenas', label: 'Indígenas', month: 1 };
      useGame.setState({ state: s });
    });
    expect(await screen.findByTestId('game-over')).toHaveTextContent('Indígenas chegou a zero');
  });
});
