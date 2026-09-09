import type { GameState, GovernmentProgram, ProposalAnalysis } from '../types/index';
import { normalize } from './text-direction';
import { estimateSupport } from './fallback-interpreter';

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
  'extincao do',
  'extincao da',
  'extincao de',
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

  const encontrados = ativos.filter((program) =>
    // QUALQUER menção ao programa serve, e não só a primeira. O texto que chega
    // aqui costuma ser "título + o que o presidente escreveu", então o nome
    // aparece duas vezes e só uma delas tem o verbo na frente.
    posicoesDoPrograma(normalized, program).some((posicao) => {
      const antesDoNome = normalized.slice(0, posicao);
      if (E_CORTE.some((palavra) => antesDoNome.includes(palavra))) return false;
      return EXTINCAO.some((verbo) => antesDoNome.includes(normalize(verbo)));
    }),
  );

  return encontrados.map((program) => program.id);
}

/** Todas as posições em que o programa é citado no texto. */
function posicoesDoPrograma(normalized: string, program: GovernmentProgram): number[] {
  const alvos = [program.name, ...apelidosDe(program)];
  const posicoes: number[] = [];

  for (const alvo of alvos) {
    const agulha = normalize(alvo);
    let de = normalized.indexOf(agulha);
    while (de >= 0) {
      posicoes.push(de);
      de = normalized.indexOf(agulha, de + agulha.length);
    }
  }

  return posicoes;
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
  // Os `groupImpacts` declarados no programa são a gota MENSAL dele: o quanto
  // ele empurra o grupo a cada fechamento enquanto existe. Acabar com ele não
  // custa uma gota — custa o benefício inteiro, de uma vez. O peso traduz isso
  // pelas três coisas que dizem o tamanho do programa: quanto ele é querido,
  // quanta gente ele alcança e quanto ele custa.
  const peso =
    (0.6 + program.popularity / 60) *
    (1 + program.coverage / 50) *
    (1 + Math.min(program.monthlyCost, 24) / 12);

  return program.groupImpacts.map((impact) => ({
    groupId: impact.groupId,
    // Sinal invertido: o grupo que ganhava com o programa perde com o fim dele.
    delta: round(-impact.delta * peso, 2),
    reason:
      impact.delta > 0
        ? `Perdeu o ${program.name}: ${impact.reason.toLowerCase()}`
        : `${program.name} acabou, e com ele o custo que ele impunha`,
  }));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * A MEDIDA DE EXTINÇÃO, ESCRITA A PARTIR DO PROGRAMA
 *
 * Sem isto, "acabar com o Bolsa Família" era lido pelo interpretador genérico
 * como "Redução — transferência de renda": título errado, resumo errado,
 * economia de R$ 90 bi contada por fora (o motor já para de gastar quando o
 * programa some) e razões trocadas nos grupos — "baixa renda perde 4 porque o
 * benefício ficou maior".
 *
 * Aqui a medida é montada do próprio programa: o custo é o custo dele, quem
 * perde é quem ele atendia, quem ganha é quem paga a conta dele, e o tamanho de
 * tudo isso sai da popularidade e do alcance reais que ele tinha.
 *
 * REGRA DE OURO deste arquivo: nada que o motor já faz sozinho entra em
 * `impacts`. O programa sai da lista, e a partir daí o custeio para de ser
 * cobrado e o gasto social da categoria cai por conta própria. Repetir isso
 * aqui pagaria a economia duas vezes.
 */
export function analyzeProgramAbolition(
  text: string,
  state: GameState,
): ProposalAnalysis | null {
  const ids = readProgramAbolition(text, state);
  if (ids.length === 0) return null;

  const programs = ids
    .map((id) => state.programs.find((entry) => entry.id === id))
    .filter((program): program is GovernmentProgram => Boolean(program));
  if (programs.length === 0) return null;

  const custoMensal = programs.reduce((total, program) => total + program.monthlyCost, 0);
  const atendidos = programs.reduce((total, program) => total + program.beneficiaries, 0);
  const nomes = programs.map((program) => program.name).join(', ');
  const popularidade =
    programs.reduce((total, program) => total + program.popularity, 0) / programs.length;

  const groupImpacts = programs.flatMap((program) => abolitionGroupImpacts(program));

  // Quem paga a conta do programa comemora o fim dele. O ganho acompanha o
  // tamanho do gasto que deixa de existir.
  const alivioFiscal = Math.min(4, custoMensal * 0.18);
  groupImpacts.push(
    {
      groupId: 'mercado_financeiro',
      delta: round(alivioFiscal, 2),
      reason: `Despesa obrigatória de R$ ${(custoMensal * 12).toFixed(0)} bi por ano sai do orçamento`,
    },
    {
      groupId: 'empresariado',
      delta: round(alivioFiscal * 0.6, 2),
      reason: 'Gasto público permanente a menos',
    },
  );

  const cost = estimateSupport(state, groupImpacts, 0);

  return {
    instrument: 'projeto_lei',
    title: `Extinção do ${nomes}`,
    category: programs[0]!.category,
    summary:
      `A medida encerra ${programs.length > 1 ? 'os programas' : 'o programa'} ${nomes} em definitivo. ` +
      `R$ ${custoMensal.toFixed(1)} bi por mês deixam de sair do caixa e ${(atendidos / 1e6).toFixed(1)} ` +
      `milhões de pessoas deixam de ser atendidas. Aprovada, ${programs.length > 1 ? 'eles somem' : 'ele some'} ` +
      'da lista de programas: não fica inativo nem arquivado, e recriar depois exige uma medida nova, do zero.',
    headline: `Governo propõe acabar com ${nomes}`,
    // Zero de propósito: a economia não é um fluxo NOVO, é a ausência de um
    // fluxo que já existia. Ela aparece no resumo e no painel de extinção; se
    // entrasse aqui, o caixa receberia o dinheiro duas vezes.
    estimatedCost: 0,
    executionMonths: 1,
    // Idem para pobreza e desemprego: o motor social recalcula os dois a partir
    // do gasto por categoria, e o programa já não está lá para contar.
    impacts: {
      // O que NÃO é automático: a confiança de quem financia a dívida vê um
      // governo capaz de cortar gasto obrigatório, e isso é real.
      fiscalCredibility: round(Math.min(8, custoMensal * 0.35), 2),
      approval: round(-(popularidade / 22), 2),
    },
    groupImpacts,
    affectedMinistries: [...new Set(programs.map((program) => program.ministryId))],
    // Programa criado por lei se desfaz por lei. É a matéria mais cara de
    // aprovar que existe: mexe no bolso de quem recebe.
    requiresCongress: true,
    requiredQuorum: 0.5,
    estimatedSupport: cost.favor,
    estimatedOpposition: cost.against,
    legalRisk: round(38 + popularidade * 0.28, 1),
    delayedEffects: [
      {
        monthsAhead: 3,
        label: `O buraco deixado pelo fim do ${nomes} aparece na pobreza e no consumo das famílias`,
        // Sem números: quem move pobreza e consumo é o motor social, a partir
        // do gasto por categoria que o programa deixou de fazer. Isto aqui é o
        // aviso, não um segundo efeito.
        impacts: {},
      },
    ],
    rationale:
      `${nomes} custava R$ ${custoMensal.toFixed(1)} bi por mês e atendia ${(atendidos / 1e6).toFixed(1)} ` +
      'milhões de pessoas. Extinguir devolve esse dinheiro ao orçamento sem contrapartida e tira o benefício ' +
      `de quem o recebia, de uma vez. A conta política acompanha a popularidade do programa (${popularidade.toFixed(0)}/100) ` +
      'e chega no mês da assinatura.',
    warnings: [
      `${nomes} sai da lista de programas e não volta.`,
      popularidade > 60
        ? `Programa muito popular (${popularidade.toFixed(0)}/100): o custo político do fim dele chega de uma vez, no mês da assinatura.`
        : 'Programa de popularidade média: o custo político existe, mas é absorvível.',
    ],
    fallback: true,
  };
}
