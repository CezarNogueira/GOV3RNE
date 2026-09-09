import type { GameState, GovernmentProgram } from '../types/index';
import { normalize } from './text-direction';

/**
 * ACABAR COM UM PROGRAMA
 *
 * O presidente escreve "acabar com o Bolsa Família" e o jogo precisa entender
 * três coisas: que é uma extinção, de qual programa, e que isso não é um corte
 * de verba — é o fim do programa.
 *
 * A diferença importa. Cortar orçamento mexe num número e pode ser desfeito no
 * mês seguinte. Extinguir apaga o programa da lista: o dinheiro volta para o
 * caixa, os beneficiários deixam de receber e a conta política chega inteira,
 * de uma vez. Não fica rastro na tela porque não ficou rastro no país — o que
 * fica é a consequência.
 *
 * Este módulo só LÊ. Quem apaga é o motor, quando a medida entra em vigor.
 */

/** Verbos que significam encerrar de vez, e não reduzir. */
const EXTINCAO = [
  'acabar com',
  'acabar de vez com',
  'extinguir',
  'encerrar',
  'cancelar',
  'revogar',
  'abolir',
  'fim do',
  'fim da',
  'fim ao',
  'derrubar',
  'desativar',
  'descontinuar',
  'suspender de vez',
  'apagar',
  'eliminar',
  'exterminar',
  'zerar de vez',
  'enterrar',
];

/**
 * Palavras que transformam a frase em outra coisa.
 *
 * "Estudar o fim do programa" é estudo. "Reduzir o Bolsa Família" é corte de
 * verba, não extinção — e confundir os dois apagaria um programa que o
 * presidente só queria enxugar.
 */
const NAO_E_EXTINCAO = ['estudar', 'avaliar', 'discutir', 'debater', 'considerar', 'analisar'];
const E_CORTE = ['reduzir', 'cortar', 'enxugar', 'diminuir', 'limitar', 'revisar'];

/**
 * Encontra os programas que o texto manda extinguir.
 *
 * Compara com os programas que EXISTEM na partida, e não com um catálogo fixo:
 * programa criado pelo próprio presidente também pode ser extinto por ele, e
 * programa já apagado não é encontrado de novo.
 */
export function readProgramAbolition(text: string, state: GameState): string[] {
  const normalized = normalize(text);

  const querExtinguir = EXTINCAO.some((verbo) => normalized.includes(normalize(verbo)));
  if (!querExtinguir) return [];

  if (NAO_E_EXTINCAO.some((palavra) => normalized.includes(palavra))) return [];

  // "Reduzir o Bolsa Família e acabar com a fila" tem verbo de extinção na
  // frase, mas o que ele extingue não é o programa. Só bloqueia quando o corte
  // vem ANTES do nome do programa, que é onde o sujeito da frase mora.
  const ativos = state.programs.filter((program) => program.active);

  const encontrados = ativos.filter((program) => {
    const posicao = posicaoDoPrograma(normalized, program);
    if (posicao < 0) return false;

    const antesDoNome = normalized.slice(0, posicao);
    if (E_CORTE.some((palavra) => antesDoNome.includes(palavra))) return false;

    return EXTINCAO.some((verbo) => antesDoNome.includes(normalize(verbo)));
  });

  return encontrados.map((program) => program.id);
}

/** Onde o nome do programa aparece no texto, ou -1. */
function posicaoDoPrograma(normalized: string, program: GovernmentProgram): number {
  const alvos = [program.name, ...apelidosDe(program)];
  for (const alvo of alvos) {
    const posicao = normalized.indexOf(normalize(alvo));
    if (posicao >= 0) return posicao;
  }
  return -1;
}

/**
 * Como o jogador chama cada programa quando não escreve o nome inteiro.
 *
 * O nome oficial já é procurado; aqui entram as formas curtas que aparecem na
 * conversa real — "bolsa" para o Bolsa Família, "farmácia" para o Farmácia
 * Popular.
 */
function apelidosDe(program: GovernmentProgram): string[] {
  const palavras = program.name.split(/\s+/).filter((palavra) => palavra.length > 4);
  // A primeira palavra significativa costuma bastar e raramente colide.
  return palavras.length > 1 ? [palavras[0] as string] : [];
}

/**
 * O QUE ACONTECE QUANDO O PROGRAMA SAI DA LISTA
 *
 * Quase tudo acontece sozinho, e é de propósito. O motor econômico cobra o
 * custeio dos programas ATIVOS todo mês, e o motor social calcula o gasto por
 * categoria a partir da mesma lista. Tirar o programa de lá já faz o dinheiro
 * parar de sair e o patamar da área começar a ceder — sem nenhuma linha a mais.
 *
 * Por isso esta função não devolve caixa nem mexe em pobreza na hora: fazer
 * isso seria cobrar duas vezes, uma no ato e outra na ausência do gasto no mês
 * seguinte. O que ela devolve é o tamanho do buraco, para a narrativa contar, e
 * o que sobra para o motor aplicar é o custo político — esse sim imediato,
 * porque a reação ao anúncio é imediata.
 */
export interface AbolitionOutcome {
  /** Programas que deixaram de existir. */
  removed: GovernmentProgram[];
  /** R$ bilhões por mês devolvidos ao caixa. */
  monthlySaving: number;
  /** Pessoas que deixaram de ser atendidas. */
  beneficiariesLost: number;
  narratives: string[];
}

/**
 * APAGA O PROGRAMA.
 *
 * Ele sai da lista — não fica inativo, não fica histórico, não fica nada. O que
 * fica é o efeito: o dinheiro que ele consumia volta para o caixa no mesmo mês,
 * e tudo o que ele segurava deixa de ser segurado.
 *
 * A conta política é proporcional ao tamanho: um programa que atende 21 milhões
 * de famílias custa mais para acabar do que um que atende cem mil, e ela chega
 * de uma vez, no mês da assinatura. É de propósito que doa: extinguir é a
 * decisão mais barata no orçamento e a mais cara no voto.
 */
export function abolishPrograms(state: GameState, programIds: readonly string[]): AbolitionOutcome {
  const removed: GovernmentProgram[] = [];
  const narratives: string[] = [];

  for (const programId of programIds) {
    const program = state.programs.find((entry) => entry.id === programId && entry.active);
    if (!program) continue;

    removed.push(program);

    // Sai da lista de verdade. `filter` e não `active = false`: é isso que faz
    // o programa sumir sem rastro da tela de programas.
    state.programs = state.programs.filter((entry) => entry.id !== programId);

    narratives.push(
      `${program.name} foi extinto. R$ ${program.monthlyCost.toFixed(1)} bi por mês deixam de sair do caixa e ${(
        program.beneficiaries / 1e6
      ).toFixed(1)} milhões de pessoas deixam de ser atendidas.`,
    );
  }

  return {
    removed,
    monthlySaving: round(removed.reduce((total, program) => total + program.monthlyCost, 0), 2),
    beneficiariesLost: removed.reduce((total, program) => total + program.beneficiaries, 0),
    narratives,
  };
}

/**
 * A reação de cada grupo social ao fim do programa.
 *
 * Quem recebia perde; quem paga a conta comemora. A intensidade acompanha a
 * popularidade do programa: acabar com algo popular custa muito mais do que
 * acabar com algo que ninguém defendia.
 */
export function abolitionGroupImpacts(
  program: GovernmentProgram,
): { groupId: string; delta: number; reason: string }[] {
  const peso = 0.6 + program.popularity / 60;

  return program.groupImpacts.map((impact) => ({
    groupId: impact.groupId,
    // Sinal invertido: o grupo que ganhava com o programa perde com o fim dele.
    delta: round(-impact.delta * peso, 2),
    reason: `${program.name} foi extinto`,
  }));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
