import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  DEFAULT_AVATAR,
  MINISTER_POOL,
  MINISTRY_IDS,
  createGame,
  newGameSchema,
  serialize,
  type GameState,
} from '@/game';
import { useGame } from '@/state/game-store';
import { repository } from '@/state/repository';

import { ProposalEditor } from './ProposalEditor';

/**
 * ESCREVER E SER ENTENDIDO
 *
 * O motor de interpretação tem teste próprio. O que se verifica aqui é a outra
 * metade da promessa: que o jogador VÊ o sistema entendendo enquanto escreve, e
 * que a leitura abre o caminho certo — painel de orçamento, construtor de
 * reforma, processo de privatização da empresa citada.
 */
function newGame(): GameState {
  const cabinet: Record<string, string> = {};
  MINISTRY_IDS.forEach((ministryId, index) => {
    cabinet[ministryId] = MINISTER_POOL[index % MINISTER_POOL.length]!.id;
  });

  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age: 54,
        gender: 'feminino', homeState: 'PE', homeCity: 'Recife', occupation: 'medico',
        education: 'medicina', religion: 'catolico', traits: [], habits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet,
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal', startYear: 2027, reelection: true, seed: 4242,
    }),
  );
}

function load(state: GameState): void {
  repository.importSave(serialize(state));
  useGame.setState({
    state,
    saves: [],
    evaluation: null,
    lastResult: null,
    lastNotes: [],
    briefing: null,
    showResult: false,
    toasts: [],
    ai: 'local',
  });
}

async function escrever(texto: string) {
  render(
    <MemoryRouter>
      <ProposalEditor />
    </MemoryRouter>,
  );
  const campo = screen.getByLabelText(/o que você vai assinar/i);
  await userEvent.click(campo);
  await userEvent.paste(texto);
  return campo as HTMLTextAreaElement;
}

describe('o sistema entendendo o que o jogador escreve', () => {
  beforeEach(() => {
    localStorage.clear();
    load(newGame());
  });

  it('mostra a leitura enquanto o presidente digita', async () => {
    await escrever('Privatizar os Correios');

    expect(screen.getByText(/leitura do sistema/i)).toBeInTheDocument();
    expect(screen.getByText(/privatizar empresa estatal/i)).toBeInTheDocument();
    expect(screen.getByText(/empresa: Correios/i)).toBeInTheDocument();
    expect(screen.getByText(/% de confiança/)).toBeInTheDocument();
  });

  it('abre o processo de privatização da empresa citada, sem perguntar qual', async () => {
    await escrever('Privatizar os Correios');
    await userEvent.click(screen.getByRole('button', { name: /montar a medida/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/correios/i)).toBeInTheDocument();
  });

  it('não age quando a frase está na negativa', async () => {
    await escrever('Não quero privatizar os Correios');

    expect(screen.getByText(/na negativa/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /montar a medida/i })).not.toBeInTheDocument();
  });
});

describe('construtor de orçamento', () => {
  beforeEach(() => {
    localStorage.clear();
    load(newGame());
  });

  it('abre as dez pastas com a dotação real de cada uma', async () => {
    await escrever('Cortar gastos');
    await userEvent.click(screen.getByRole('button', { name: /montar a medida/i }));

    const dialog = screen.getByRole('dialog');
    for (const pasta of ['Saúde', 'Educação', 'Defesa', 'Infraestrutura', 'Casa Civil']) {
      expect(within(dialog).getByText(new RegExp(pasta, 'i'))).toBeInTheDocument();
    }
    expect(within(dialog).getByText(/de onde sai o dinheiro/i)).toBeInTheDocument();
  });

  it('já vem com a pasta citada na frase marcada', async () => {
    await escrever('cortar gastos da saúde');
    await userEvent.click(screen.getByRole('button', { name: /montar a medida/i }));

    const dialog = screen.getByRole('dialog');
    // Pasta marcada mostra o controle de quanto cortar.
    expect(within(dialog).getByLabelText(/quanto cortar em saúde/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/como a medida vai ficar/i)).toBeInTheDocument();
  });

  it('escreve a medida no editor quando o painel é confirmado', async () => {
    const campo = await escrever('cortar gastos da saúde');
    await userEvent.click(screen.getByRole('button', { name: /montar a medida/i }));

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /analisar a medida/i }));

    expect(campo.value).toContain('orçamento da Saúde');
    expect(campo.value).toContain('reduzir');
  });
});

describe('construtor de reforma tributária', () => {
  beforeEach(() => {
    localStorage.clear();
    load(newGame());
  });

  it('mostra as alíquotas vigentes e monta um pacote só', async () => {
    const campo = await escrever('fazer reforma tributaria');
    await userEvent.click(screen.getByRole('button', { name: /montar a medida/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText(/monte a sua reforma/i).length).toBeGreaterThan(0);

    // Arrastar um range não é gesto que o userEvent reproduza: o valor é
    // definido direto, como o navegador faria ao soltar o controle.
    const controle = within(dialog).getByLabelText(/alíquota de imposto de renda$/i);
    fireEvent.change(controle, { target: { value: '22' } });

    await userEvent.click(within(dialog).getByRole('button', { name: /analisar a medida/i }));
    expect(campo.value.toLowerCase()).toContain('imposto de renda');
  });
});

describe('do painel para a assinatura', () => {
  beforeEach(() => {
    localStorage.clear();
    load(newGame());
  });

  it('abre a ficha técnica direto, com o pacote inteiro dentro de uma medida', async () => {
    await escrever('cortar gastos');
    await userEvent.click(screen.getByRole('button', { name: /montar a medida/i }));

    const painel = screen.getByRole('dialog');
    await userEvent.click(within(painel).getByRole('button', { name: /■|□.*saúde/i }));
    await userEvent.click(within(painel).getByRole('button', { name: /□.*educação/i }));
    await userEvent.click(within(painel).getByRole('button', { name: /analisar a medida/i }));

    // A ficha técnica aparece sem precisar reanalisar o texto.
    const ficha = await screen.findByRole('dialog');
    expect(within(ficha).getByText(/corte de gastos/i)).toBeInTheDocument();
  });
});

describe('quando a frase não diz qual empresa', () => {
  beforeEach(() => {
    localStorage.clear();
    load(newGame());
  });

  it('oferece a lista de estatais em vez de recusar a medida', async () => {
    await escrever('quero vender uma estatal');
    await userEvent.click(screen.getByRole('button', { name: /montar a medida/i }));

    const painel = screen.getByRole('dialog');
    expect(within(painel).getByText(/qual estatal entra no programa/i)).toBeInTheDocument();
    expect(within(painel).getByRole('button', { name: /correios/i })).toBeInTheDocument();

    await userEvent.click(within(painel).getByRole('button', { name: /correios/i }));

    // Escolhida a empresa, o processo societário de verdade abre.
    const processo = await screen.findByRole('dialog');
    expect(within(processo).getAllByText(/correios/i).length).toBeGreaterThan(0);
  });
});
