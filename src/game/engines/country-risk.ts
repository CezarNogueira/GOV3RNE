import type { GameState } from '../types/index';
import { MACRO_BASELINE } from '../data/generated/baseline';

/**
 * RISCO-PAÍS EM PORCENTAGEM
 *
 * O mercado mede risco-país em pontos-base: quantos centésimos de ponto
 * percentual o investidor cobra a mais para emprestar ao Brasil do que ao
 * Tesouro americano. É com essa escala que o motor calcula câmbio, bolsa e o
 * valor das empresas, e ela continua lá dentro.
 *
 * Para o jogador, o número é uma porcentagem: 0% é um país em que ninguém
 * duvida da dívida, 100% é o ponto em que o mercado trata o calote como
 * certo. 100% equivale a 1.000 pontos-base — patamar de crise de dívida, acima
 * do que o Brasil viveu na recessão de 2015-16 e perto do pânico de 2002.
 *
 * Chegar lá é fim de jogo: sem crédito, com dólar disparado e a economia
 * parada, o Congresso abre e aprova o impeachment.
 */
export const COUNTRY_RISK_COLLAPSE_POINTS = 1_000;

/** Converte pontos-base em pontos percentuais da escala do jogo, sem limite. */
export function riskPointsToPercent(points: number): number {
  return (points / COUNTRY_RISK_COLLAPSE_POINTS) * 100;
}

/** Risco-país do jogo, de 0% a 100%. */
export function countryRiskPercent(points: number): number {
  return Math.min(100, Math.max(0, riskPointsToPercent(points)));
}

/** O risco chegou a 100%: o país perdeu o crédito. */
export function countryRiskCollapsed(state: GameState): boolean {
  return state.economy.countryRisk >= COUNTRY_RISK_COLLAPSE_POINTS;
}

function numero(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

/**
 * Por que o risco chegou a 100%, em frases curtas e na ordem do que mais pesou.
 *
 * É o que a tela de fim de jogo mostra: o jogador precisa reconhecer as próprias
 * decisões na explicação, e não receber um número que subiu sozinho.
 */
export function collapseReasons(state: GameState): string[] {
  const eco = state.economy;
  const motivos: { peso: number; texto: string }[] = [];

  const dividaInicial = MACRO_BASELINE.debtToGdp.value;
  if (eco.debtToGdp > dividaInicial + 3) {
    motivos.push({
      peso: eco.debtToGdp - dividaInicial,
      texto:
        'A dívida subiu de ' +
        numero(dividaInicial) +
        '% para ' +
        numero(eco.debtToGdp) +
        '% do PIB, e ficou mais difícil acreditar que ela seria paga.',
    });
  }

  if (eco.fiscalCredibility < 45) {
    motivos.push({
      peso: (45 - eco.fiscalCredibility) * 0.8,
      texto:
        'A credibilidade fiscal caiu para ' +
        Math.round(eco.fiscalCredibility) +
        ' de 100: o mercado deixou de acreditar nas contas do governo.',
    });
  }

  if (eco.primaryBalance < 0) {
    motivos.push({
      peso: Math.min(40, -eco.primaryBalance / 10),
      texto:
        'O governo gastava mais do que arrecadava: déficit de R$ ' +
        Math.round(-eco.primaryBalance).toLocaleString('pt-BR') +
        ' bi em 12 meses.',
    });
  }

  if (state.diplomacy.isolation > 55) {
    motivos.push({
      peso: state.diplomacy.isolation - 55,
      texto:
        'O Brasil ficou isolado no mundo (isolamento de ' +
        Math.round(state.diplomacy.isolation) +
        ' de 100), e o crédito externo secou.',
    });
  }

  if (state.regime.regime !== 'democracia') {
    motivos.push({
      peso: 35,
      texto: 'O país deixou de ser uma democracia, e o investidor estrangeiro foi embora.',
    });
  }

  if (state.war.status === 'guerra') {
    motivos.push({
      peso: 30,
      texto: 'O país entrou em guerra — e guerra custa caro e assusta quem empresta.',
    });
  }

  if (eco.inflation > 8) {
    motivos.push({
      peso: eco.inflation - 3,
      texto: 'A inflação chegou a ' + numero(eco.inflation) + '% ao ano, corroendo a moeda.',
    });
  }

  if (motivos.length === 0) {
    return [
      'Uma sequência de choques econômicos e políticos empurrou o risco para cima mês após mês, até o mercado deixar de emprestar ao país.',
    ];
  }

  return motivos
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 4)
    .map((motivo) => motivo.texto);
}
