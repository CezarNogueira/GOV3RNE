export * from './number-parser';
export * from './numeric-policy-reader';
export * from './minimum-wage-service';
export * from './numeric-policy-engine';
export * from './reaction-generator';

/**
 * MEDIDAS NUMÉRICAS
 *
 * Ponto de entrada único. O resto do jogo só precisa de três funções:
 *
 *   analyzeNumericPolicy(text, state)  -> lê o número e calcula tudo
 *   applyNumericChange(state, change)  -> grava o valor novo quando entra em vigor
 *   revertNumericChange(state, change) -> desfaz quando a medida cai
 *
 * Toda a matemática é determinística: mesmo estado e mesmo texto produzem
 * exatamente os mesmos números. A IA pode variar a redação; o cálculo, não.
 */
