import { describe, expect, it } from 'vitest';
import { AGENDA_ACTIONS } from './agenda';
import { agendaActionSchema } from '../schemas/setup';

/**
 * TODA AÇÃO DECLARADA PRECISA EXISTIR NO CATÁLOGO
 *
 * O motor busca a ação pelo id e desiste com "Ação desconhecida" quando não
 * acha. Isso torna o defeito invisível: o botão continua na tela, o jogador
 * clica, e nada acontece — sem erro, sem log, sem teste vermelho.
 *
 * Foi o que aconteceu com cinco ações de uma vez. `noite_com_conjuge` tinha
 * implementação no motor e botão na Vida Pessoal, mas nenhuma entrada aqui: a
 * mecânica inteira do estresse do cônjuge estava morta na prática. As reuniões
 * com ministro, governador e líderes, e o "receber quem está na rua", idem. E
 * `divorciar` chegou a sumir do catálogo numa edição solta, o que teria matado
 * o botão de divórcio do mesmo jeito.
 *
 * Este teste é a trava: id declarado sem entrada no catálogo quebra a suíte.
 */
describe('o catálogo da agenda cobre tudo o que o jogo oferece', () => {
  const catalogados = new Set(AGENDA_ACTIONS.map((acao) => acao.id));
  const declarados = agendaActionSchema.shape.actionId.options;

  it('nenhum id declarado fica sem entrada', () => {
    const faltando = declarados.filter((id) => !catalogados.has(id));
    expect(faltando, `sem entrada no catálogo: ${faltando.join(', ')}`).toEqual([]);
  });

  it('nenhuma entrada do catálogo é de um id que não existe mais', () => {
    const orfas = AGENDA_ACTIONS.filter((acao) => !declarados.includes(acao.id));
    expect(orfas.map((acao) => acao.id)).toEqual([]);
  });

  it('nenhum id aparece duas vezes', () => {
    expect(catalogados.size).toBe(AGENDA_ACTIONS.length);
  });

  it('toda ação tem custo, texto e consequência para a tela mostrar', () => {
    for (const acao of AGENDA_ACTIONS) {
      expect(acao.label.length, acao.id).toBeGreaterThan(0);
      expect(acao.description.length, acao.id).toBeGreaterThan(10);
      expect(acao.consequence.length, acao.id).toBeGreaterThan(10);
      expect(acao.cost, acao.id).toBeGreaterThanOrEqual(0);
      // Custo de energia negativo e proposital: descansar DEVOLVE energia.
      expect(Number.isFinite(acao.energyCost), acao.id).toBe(true);
    }
  });

  it('a noite com o cônjuge custa os 2 pontos que a regra promete', () => {
    const noite = AGENDA_ACTIONS.find((acao) => acao.id === 'noite_com_conjuge');
    expect(noite?.cost).toBe(2);
  });
});
