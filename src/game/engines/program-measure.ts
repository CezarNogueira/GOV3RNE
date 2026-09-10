import type {
  GameState,
  GovernmentProgram,
  GroupImpact,
  PolicyImpact,
  ProposalAnalysis,
} from '../types/index';
import { rulesForProgram, stepsFromBaseline, type ProgramRule } from '../data/program-rules';
import { estimateSupport } from './fallback-interpreter';
import { analyzeProgramAbolition } from './program-text';
import { clamp, round } from '../utils/math';

/**
 * MEXER NUM PROGRAMA, COM OS NÚMEROS DO PROGRAMA
 *
 * O painel de programa escrevia uma frase em português e mandava o
 * interpretador genérico lê-la de volta. Para "acabar com o Bolsa Família" isso
 * funciona — o leitor de extinção reconhece a frase. Para todo o resto, não:
 *
 *   "Reduzir o orçamento do Bolsa Família em R$ 10 bilhões por ano."
 *
 * O interpretador via o nome do programa, encontrava a alavanca "benefício de
 * transferência de renda" — que é medida em REAIS POR FAMÍLIA POR MÊS, R$ 664 —
 * e subtraía dez bilhões dela. O jogador via na tela um benefício de
 * R$ -9.999.999.336, uma variação de -1.506.024.096,4% e uma medida de R$ 1,5
 * trilhão. Pior: a mesma frase era colada em opções que não têm nada a ver com
 * dinheiro, e "alterar os critérios de elegibilidade em R$ 10 bilhões por ano"
 * também virava conta.
 *
 * A causa não é um número errado, é uma ida e volta desnecessária. O painel JÁ
 * SABE qual programa é, qual operação é e qual número o jogador escolheu. Passar
 * isso por uma frase e tentar readivinhar tudo do outro lado só podia perder
 * informação.
 *
 * Aqui a medida é montada direto do programa: o custo sai do custeio real, o
 * público sai dos beneficiários reais, e quem ganha e quem perde sai dos
 * `groupImpacts` que o próprio programa carrega. A frase continua existindo,
 * porque é ela que aparece na ficha e no noticiário — mas ela é a SAÍDA, e não
 * mais a entrada do cálculo.
 *
 * NÃO É UM MOTOR PARALELO: o que sai daqui é o mesmo `ProposalAnalysis` de
 * sempre, que segue para `createPolicy`, tramitação, votação e `tickMonth` como
 * qualquer outra medida. É o mesmo caminho que `analyzeProgramAbolition` já
 * fazia para a extinção — este arquivo só estende o mesmo tratamento às outras
 * oito operações.
 */

export interface ProgramMeasureRequest {
  program: GovernmentProgram;
  optionIds: string[];
  /** R$ bilhões por ano no controle de quantia, quando a opção usa um. */
  amount?: number;
  /** Valor escolhido em cada régua de regra de entrada. */
  ruleValues?: Record<string, number>;
}

/** Um programa custa isto por ano, em R$ bilhões. */
function custoAnual(program: GovernmentProgram): number {
  return program.monthlyCost * 12;
}

/**
 * O QUE CADA OPERAÇÃO FAZ COM O PROGRAMA
 *
 * Cada entrada devolve o efeito macro, o efeito nos grupos e a frase — sempre
 * proporcional ao tamanho do programa e ao tamanho da mudança. Um corte de
 * R$ 10 bi no Bolsa Família (R$ 170 bi/ano) e o mesmo corte no Floresta Viva
 * (R$ 21 bi/ano) não podem valer a mesma coisa, e aqui não valem.
 */
interface Operacao {
  clause: (program: GovernmentProgram, amount: number) => string;
  title: (program: GovernmentProgram) => string;
  headline: (program: GovernmentProgram, amount: number) => string;
  /** Quanto entra ou sai do caixa por ano, R$ bilhões. Negativo = despesa. */
  fiscal: (program: GovernmentProgram, amount: number) => number;
  impacts: (program: GovernmentProgram, amount: number) => PolicyImpact;
  groups: (program: GovernmentProgram, amount: number) => GroupImpact[];
  months: number;
  instrument: ProposalAnalysis['instrument'];
  legalRisk: number;
  usesAmount: boolean;
}

/**
 * A intensidade de uma mudança de orçamento é RELATIVA ao programa.
 *
 * Devolve a fração do custeio anual que a medida mexe, limitada a 1: cortar
 * mais do que o programa inteiro custa é extingui-lo, e para isso existe outra
 * opção.
 */
function fracao(program: GovernmentProgram, amount: number): number {
  const anual = custoAnual(program);
  if (anual <= 0) return 0;
  return clamp(amount / anual, 0, 1);
}

/** Peso do programa na vida real: popularidade e alcance somados. */
function peso(program: GovernmentProgram): number {
  return (program.popularity / 100) * 0.6 + (program.coverage / 100) * 0.4;
}

const OPERACOES: Record<string, Operacao> = {
  ampliar_orcamento: {
    clause: (program, amount) =>
      `ampliar o orçamento do ${program.name} em R$ ${amount.toFixed(0)} bilhões por ano`,
    title: (program) => `Ampliação do ${program.name}`,
    headline: (program, amount) =>
      `Governo põe mais R$ ${amount.toFixed(0)} bi por ano no ${program.name}`,
    fiscal: (_program, amount) => -amount,
    impacts: (program, amount) => {
      const f = fracao(program, amount);
      return {
        approval: round(f * peso(program) * 4.2, 2),
        ...escalarImpactosDoPrograma(program, f),
      };
    },
    groups: (program, amount) => gruposDoPrograma(program, fracao(program, amount), 'ampliação'),
    months: 6,
    instrument: 'projeto_lei',
    legalRisk: 8,
    usesAmount: true,
  },

  reduzir_orcamento: {
    clause: (program, amount) =>
      `reduzir o orçamento do ${program.name} em R$ ${amount.toFixed(0)} bilhões por ano`,
    title: (program) => `Corte no ${program.name}`,
    headline: (program, amount) =>
      `Governo corta R$ ${amount.toFixed(0)} bi por ano do ${program.name}`,
    fiscal: (_program, amount) => amount,
    impacts: (program, amount) => {
      const f = fracao(program, amount);
      return {
        approval: round(-f * peso(program) * 5.6, 2),
        fiscalCredibility: round(Math.min(5, f * 6), 2),
        ...escalarImpactosDoPrograma(program, -f),
      };
    },
    groups: (program, amount) => gruposDoPrograma(program, -fracao(program, amount), 'corte'),
    months: 4,
    instrument: 'projeto_lei',
    legalRisk: 16,
    usesAmount: true,
  },

  ampliar_beneficio: {
    clause: (program, amount) =>
      `aumentar o valor pago pelo ${program.name}, com R$ ${amount.toFixed(0)} bilhões a mais por ano`,
    title: (program) => `Reajuste do benefício do ${program.name}`,
    headline: (program, amount) => {
      const porPessoa = valorPorPessoa(program, amount);
      return porPessoa > 0
        ? `Benefício do ${program.name} sobe cerca de R$ ${porPessoa.toFixed(0)} por mês`
        : `Governo reforça o ${program.name} em R$ ${amount.toFixed(0)} bi por ano`;
    },
    fiscal: (_program, amount) => -amount,
    impacts: (program, amount) => {
      const f = fracao(program, amount);
      return {
        approval: round(f * peso(program) * 5.0, 2),
        averageIncome: round(f * (program.beneficiaries / 1e6) * 1.6, 1),
        poverty: round(-f * (program.beneficiaries / 1e6) * 0.024, 3),
        ...escalarImpactosDoPrograma(program, f * 0.7),
      };
    },
    groups: (program, amount) => gruposDoPrograma(program, fracao(program, amount) * 1.15, 'reajuste'),
    months: 3,
    instrument: 'medida_provisoria',
    legalRisk: 12,
    usesAmount: true,
  },

  ampliar_publico: {
    clause: (program, amount) =>
      `expandir o público atendido pelo ${program.name}, com R$ ${amount.toFixed(0)} bilhões a mais por ano`,
    title: (program) => `Expansão do ${program.name}`,
    headline: (program, amount) => {
      const novos = novosBeneficiarios(program, amount);
      return novos > 0
        ? `${program.name} passa a atender mais ${(novos / 1e6).toFixed(1)} milhão de pessoas`
        : `Governo expande o ${program.name}`;
    },
    fiscal: (_program, amount) => -amount,
    impacts: (program, amount) => {
      const f = fracao(program, amount);
      return {
        approval: round(f * peso(program) * 3.6, 2),
        poverty: round(-f * (program.beneficiaries / 1e6) * 0.02, 3),
        hdi: round(f * 0.0016, 4),
        ...escalarImpactosDoPrograma(program, f),
      };
    },
    groups: (program, amount) => gruposDoPrograma(program, fracao(program, amount), 'expansão'),
    months: 9,
    instrument: 'projeto_lei',
    legalRisk: 10,
    usesAmount: true,
  },

  restringir_publico: {
    clause: (program) => `restringir o público atendido pelo ${program.name}`,
    title: (program) => `Restrição de acesso ao ${program.name}`,
    headline: (program) => `Governo aperta o critério de entrada do ${program.name}`,
    fiscal: (program) => custoAnual(program) * 0.18,
    impacts: (program) => ({
      approval: round(-peso(program) * 3.2, 2),
      fiscalCredibility: 2.2,
      poverty: round((program.beneficiaries / 1e6) * 0.006, 3),
      ...escalarImpactosDoPrograma(program, -0.18),
    }),
    groups: (program) => gruposDoPrograma(program, -0.18, 'restrição'),
    months: 4,
    instrument: 'decreto',
    legalRisk: 34,
    usesAmount: false,
  },

  condicionalidades: {
    clause: (program) => `criar condicionalidades para o ${program.name}`,
    title: (program) => `Contrapartidas no ${program.name}`,
    headline: (program) => `${program.name} passa a exigir contrapartida de quem recebe`,
    // Focalização melhor devolve algum dinheiro, e a burocracia consome parte.
    fiscal: (program) => custoAnual(program) * 0.06,
    impacts: (program) => ({
      approval: round(-peso(program) * 0.9, 2),
      corruptionPerception: 2.4,
      educationIndex: program.category === 'social' ? 1.6 : 0,
      poverty: round((program.beneficiaries / 1e6) * 0.003, 3),
    }),
    groups: (program) => [
      { groupId: 'classe_media', delta: 2.4, reason: 'Transferência com contrapartida cobrada' },
      { groupId: 'mercado_financeiro', delta: 1.4, reason: 'Focalização melhora o gasto por real' },
      {
        groupId: 'baixa_renda',
        delta: round(-peso(program) * 3.0, 2),
        reason: 'Família que não consegue comprovar a contrapartida perde o benefício',
      },
    ],
    months: 8,
    instrument: 'decreto',
    legalRisk: 26,
    usesAmount: false,
  },

  suspender: {
    clause: (program) => `suspender temporariamente o ${program.name}`,
    title: (program) => `Suspensão do ${program.name}`,
    headline: (program) => `Governo suspende o pagamento do ${program.name}`,
    fiscal: (program) => custoAnual(program) * 0.5,
    impacts: (program) => ({
      approval: round(-peso(program) * 7.4, 2),
      fiscalCredibility: round(Math.min(6, program.monthlyCost * 0.3), 2),
      poverty: round((program.beneficiaries / 1e6) * 0.02, 3),
    }),
    groups: (program) => gruposDoPrograma(program, -0.5, 'suspensão'),
    months: 1,
    instrument: 'decreto',
    legalRisk: 58,
    usesAmount: false,
  },
};

/** R$ a mais por pessoa por mês, quando o dinheiro vira valor de benefício. */
function valorPorPessoa(program: GovernmentProgram, amount: number): number {
  if (program.beneficiaries <= 0) return 0;
  return (amount * 1e9) / 12 / program.beneficiaries;
}

/** Quantas pessoas a mais o dinheiro compra, ao custo médio atual por pessoa. */
function novosBeneficiarios(program: GovernmentProgram, amount: number): number {
  const custoPorPessoaAno = (custoAnual(program) * 1e9) / Math.max(1, program.beneficiaries);
  if (custoPorPessoaAno <= 0) return 0;
  return Math.round((amount * 1e9) / custoPorPessoaAno);
}

/**
 * O programa já declara o que entrega. Mexer no tamanho dele mexe na entrega
 * na mesma proporção — e nada mais.
 *
 * `primaryBalance` fica de fora de propósito: quem cobra o custeio do programa
 * é o motor econômico, todo mês, a partir de `monthlyCost`. Repetir aqui seria
 * cobrar a mesma conta duas vezes.
 */
function escalarImpactosDoPrograma(program: GovernmentProgram, fator: number): PolicyImpact {
  const saida: Record<string, number> = {};
  for (const [campo, valor] of Object.entries(program.impacts as Record<string, number>)) {
    if (typeof valor !== 'number') continue;
    if (campo === 'primaryBalance' || campo === 'approval') continue;
    saida[campo] = round(valor * fator * 8, 4);
  }
  return saida as PolicyImpact;
}

/**
 * Quem ganhava com o programa ganha mais quando ele cresce, e perde quando ele
 * encolhe. O sinal do fator faz o trabalho todo.
 */
function gruposDoPrograma(
  program: GovernmentProgram,
  fator: number,
  palavra: string,
): GroupImpact[] {
  const grupos = program.groupImpacts.map((impact) => ({
    groupId: impact.groupId,
    delta: round(clamp(impact.delta * fator * 9, -8, 8), 2),
    reason:
      fator >= 0
        ? `${palavra[0]!.toUpperCase()}${palavra.slice(1)} do ${program.name}: ${impact.reason.toLowerCase()}`
        : `${palavra[0]!.toUpperCase()}${palavra.slice(1)} no ${program.name} mexe com quem dependia dele`,
  }));

  // Quem paga a conta sente o contrário de quem recebe.
  const alivio = round(clamp(-fator * program.monthlyCost * 0.5, -6, 6), 2);
  if (Math.abs(alivio) >= 0.1) {
    grupos.push({
      groupId: 'mercado_financeiro',
      delta: alivio,
      reason:
        alivio > 0
          ? 'Despesa obrigatória menor no orçamento do ano'
          : 'Mais gasto permanente sem receita correspondente',
    });
  }

  return grupos;
}

/**
 * AS REGRAS DE ENTRADA
 *
 * Esta é a operação que o painel não tinha: mudar a regra sem mudar o dinheiro.
 * O efeito vem de quanto o jogador afastou cada régua do valor que vale hoje, e
 * cada régua puxa para um lado diferente — subir a linha de renda combate
 * pobreza e custa caro, apertar a frequência escolar melhora a escola e exclui
 * família, e a Regra de Proteção decide se arrumar emprego compensa.
 *
 * O custo NÃO é digitado: sai de `coveragePerStep`, que diz quanta gente entra
 * ou sai por passo. Regra mais larga custa porque atende mais, e não porque
 * alguém escreveu que custa.
 */
function medidaDeRegras(
  program: GovernmentProgram,
  ruleValues: Record<string, number>,
): {
  impacts: PolicyImpact;
  groups: GroupImpact[];
  fiscal: number;
  coberturaDelta: number;
  eficienciaDelta: number;
  frases: string[];
  mudou: boolean;
} {
  const conjunto = rulesForProgram(program.id, program.category);
  const impacts: Record<string, number> = {};
  const groups: GroupImpact[] = [];
  const frases: string[] = [];
  let coberturaDelta = 0;
  let eficienciaDelta = 0;

  for (const rule of conjunto.rules) {
    const escolhido = ruleValues[rule.id];
    if (escolhido === undefined) continue;
    const passos = stepsFromBaseline(rule, escolhido);
    if (Math.abs(passos) < 0.001) continue;

    for (const [campo, valor] of Object.entries(rule.perStep as Record<string, number>)) {
      if (typeof valor !== 'number') continue;
      // Trava contra a conta dobrada: quem paga a mudança de regra é o custeio
      // do programa, que muda de verdade logo abaixo. Uma régua que declarasse
      // efeito fiscal por engano cobraria a mesma conta uma segunda vez.
      if (campo === 'primaryBalance') continue;
      impacts[campo] = round((impacts[campo] ?? 0) + valor * passos, 4);
    }

    for (const grupo of rule.groupsPerStep) {
      groups.push({
        groupId: grupo.groupId,
        delta: round(clamp(grupo.delta * passos, -8, 8), 2),
        reason: grupo.reason,
      });
    }

    coberturaDelta += rule.coveragePerStep * passos;
    eficienciaDelta += rule.efficiencyPerStep * passos;
    frases.push(descreverRegra(rule, escolhido, passos));
  }

  // A conta do Tesouro sai do público que entra ou sai, ao custo médio atual
  // por pessoa. Regra larga custa porque atende mais gente — não por decreto.
  const fiscal = -(coberturaDelta / 100) * custoAnual(program);

  return {
    impacts: impacts as PolicyImpact,
    groups,
    fiscal,
    coberturaDelta,
    eficienciaDelta,
    frases,
    mudou: frases.length > 0,
  };
}

function descreverRegra(rule: ProgramRule, valor: number, passos: number): string {
  const direcao = passos > 0 ? 'elevar' : 'reduzir';
  return `${direcao} ${rule.label.toLowerCase()} de ${rule.format(rule.baseline)} para ${rule.format(valor)}`;
}

/**
 * A ficha completa da medida de programa.
 *
 * Devolve null quando a operação pedida não é deste motor (extinção, que tem o
 * seu) ou quando nada de fato mudou.
 */
export function analyzeProgramMeasure(
  request: ProgramMeasureRequest,
  state: GameState,
): { analysis: ProposalAnalysis; text: string } | null {
  const { program, optionIds } = request;
  const amount = Math.max(0, request.amount ?? 0);
  const ruleValues = request.ruleValues ?? {};

  // Extinção continua com o motor dela: apagar o programa da lista tem
  // consequências que nenhuma das operações daqui tem.
  if (optionIds.includes('encerrar')) {
    const texto = `Acabar com o ${program.name}.`;
    const analysis = analyzeProgramAbolition(texto, state);
    return analysis ? { analysis, text: texto } : null;
  }

  const impacts: Record<string, number> = {};
  const groups: GroupImpact[] = [];
  const clauses: string[] = [];
  const warnings: string[] = [];
  let fiscal = 0;
  let months = 1;
  let legalRisk = 8;
  let instrument: ProposalAnalysis['instrument'] = 'projeto_lei';
  let titulo = `Mudança no ${program.name}`;
  let manchete = `Governo altera o ${program.name}`;
  let coberturaDelta = 0;
  let eficienciaDelta = 0;

  for (const optionId of optionIds) {
    if (optionId === 'alterar_regras') {
      const regras = medidaDeRegras(program, ruleValues);
      if (!regras.mudou) {
        warnings.push(
          'Nenhuma régua saiu do valor que vale hoje: a medida mudaria as regras para exatamente o que elas já são.',
        );
        continue;
      }
      for (const [campo, valor] of Object.entries(regras.impacts as Record<string, number>)) {
        impacts[campo] = round((impacts[campo] ?? 0) + valor, 4);
      }
      groups.push(...regras.groups);
      fiscal += regras.fiscal;
      coberturaDelta += regras.coberturaDelta;
      eficienciaDelta += regras.eficienciaDelta;
      clauses.push(...regras.frases);
      months = Math.max(months, 6);
      legalRisk = Math.max(legalRisk, 22);
      titulo = `Novas regras do ${program.name}`;
      manchete = `Governo muda a regra de entrada do ${program.name}`;
      continue;
    }

    const operacao = OPERACOES[optionId];
    if (!operacao) continue;

    const quanto = operacao.usesAmount ? amount : 0;
    if (operacao.usesAmount && quanto <= 0) {
      warnings.push('A medida não move dinheiro nenhum: escolha um valor maior que zero.');
      continue;
    }

    for (const [campo, valor] of Object.entries(
      operacao.impacts(program, quanto) as Record<string, number>,
    )) {
      if (typeof valor !== 'number' || valor === 0) continue;
      impacts[campo] = round((impacts[campo] ?? 0) + valor, 4);
    }
    groups.push(...operacao.groups(program, quanto));
    fiscal += operacao.fiscal(program, quanto);
    clauses.push(operacao.clause(program, quanto));
    months = Math.max(months, operacao.months);
    legalRisk = Math.max(legalRisk, operacao.legalRisk);
    if (operacao.instrument === 'decreto' || instrument === 'projeto_lei') {
      instrument = operacao.instrument;
    }
    titulo = operacao.title(program);
    manchete = operacao.headline(program, quanto);
  }

  if (clauses.length === 0) return null;

  const groupImpacts = somarGrupos(groups);
  const apoio = estimateSupport(state, groupImpacts, Math.max(0, -fiscal));
  const text = `${maiuscula(clauses.join(', '))}.`;

  if (coberturaDelta !== 0) {
    const pessoas = (program.beneficiaries * coberturaDelta) / 100;
    warnings.push(
      pessoas >= 0
        ? `Cerca de ${formatarPessoas(pessoas)} pessoas passam a ter direito ao ${program.name}.`
        : `Cerca de ${formatarPessoas(-pessoas)} pessoas perdem o direito ao ${program.name}.`,
    );
  }
  if (fiscal < 0) {
    warnings.push(`Despesa nova de R$ ${Math.abs(fiscal).toFixed(1)} bi por ano, permanente.`);
  }

  return {
    text,
    analysis: {
      instrument,
      title: titulo.slice(0, 120),
      category: program.category,
      summary: montarResumo(program, clauses, fiscal, coberturaDelta, eficienciaDelta),
      headline: manchete.slice(0, 160),
      estimatedCost: Math.round(clamp(-fiscal * 1e9, -1.5e12, 1.5e12)),
      executionMonths: months,
      impacts: impacts as PolicyImpact,
      groupImpacts,
      affectedMinistries: [program.ministryId],
      requiresCongress: instrument !== 'decreto',
      requiredQuorum: instrument === 'pec' ? 0.6 : 0.5,
      estimatedSupport: apoio.favor,
      estimatedOpposition: apoio.against,
      legalRisk,
      delayedEffects: [],
      rationale: montarRazao(program, fiscal, coberturaDelta, eficienciaDelta),
      warnings: warnings.slice(0, 6),
      programChange: {
        programId: program.id,
        coverageDelta: round(coberturaDelta, 2),
        efficiencyDelta: round(eficienciaDelta, 2),
        monthlyCostDelta: round(-fiscal / 12, 4),
        ruleValues,
      },
      fallback: true,
    },
  };
}

function somarGrupos(groups: GroupImpact[]): GroupImpact[] {
  const porGrupo = new Map<string, GroupImpact>();
  for (const grupo of groups) {
    const atual = porGrupo.get(grupo.groupId);
    if (!atual) {
      porGrupo.set(grupo.groupId, { ...grupo, delta: round(clamp(grupo.delta, -8, 8), 2) });
      continue;
    }
    atual.delta = round(clamp(atual.delta + grupo.delta, -8, 8), 2);
  }
  return [...porGrupo.values()].filter((grupo) => Math.abs(grupo.delta) >= 0.05).slice(0, 12);
}

function montarResumo(
  program: GovernmentProgram,
  clauses: string[],
  fiscal: number,
  cobertura: number,
  eficiencia: number,
): string {
  const partes: string[] = [
    `A medida ${clauses.join(', ')}. Hoje o ${program.name} custa R$ ${program.monthlyCost.toFixed(1)} bi por mês e atende ${formatarPessoas(program.beneficiaries)} pessoas.`,
  ];

  if (fiscal < 0) {
    partes.push(`A conta cresce em R$ ${Math.abs(fiscal).toFixed(1)} bi por ano.`);
  } else if (fiscal > 0) {
    partes.push(`O Tesouro economiza R$ ${fiscal.toFixed(1)} bi por ano.`);
  }

  if (cobertura > 0) {
    partes.push(`O público atendido cresce cerca de ${cobertura.toFixed(1)}%.`);
  } else if (cobertura < 0) {
    partes.push(`O público atendido encolhe cerca de ${Math.abs(cobertura).toFixed(1)}%.`);
  }

  if (eficiencia > 0) {
    partes.push('A focalização melhora: o benefício passa a chegar mais em quem precisa dele.');
  } else if (eficiencia < 0) {
    partes.push('A focalização piora: parte do dinheiro passa a chegar em quem precisa menos.');
  }

  return partes.join(' ').slice(0, 900);
}

function montarRazao(
  program: GovernmentProgram,
  fiscal: number,
  cobertura: number,
  eficiencia: number,
): string {
  const base =
    `O ${program.name} tem popularidade ${program.popularity}/100 e alcance ${program.coverage}/100, ` +
    'e é desses dois números que sai o tamanho da reação — para os dois lados.';

  if (cobertura > 0 && fiscal < 0) {
    return `${base} Abrir a regra atende mais gente e cobra a conta no primário, todo mês, para sempre.`;
  }
  if (cobertura < 0 && fiscal > 0) {
    return `${base} Apertar a regra devolve dinheiro ao caixa tirando o benefício de quem hoje recebe — e essa conta chega no mês da assinatura.`;
  }
  if (eficiencia > 0) {
    return `${base} A mudança melhora a focalização sem ampliar o gasto, que é a única forma de o programa entregar mais com o mesmo dinheiro.`;
  }
  return `${base} A mudança altera o desenho do programa sem mexer no tamanho dele.`;
}

function formatarPessoas(quantidade: number): string {
  const valor = Math.abs(quantidade);
  if (valor >= 1e6) return `${(valor / 1e6).toFixed(1)} milhões de`;
  if (valor >= 1e3) return `${(valor / 1e3).toFixed(0)} mil`;
  return valor.toFixed(0);
}

function maiuscula(texto: string): string {
  return texto.length > 0 ? `${texto[0]!.toUpperCase()}${texto.slice(1)}` : texto;
}
