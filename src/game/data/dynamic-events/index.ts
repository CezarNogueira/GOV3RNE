import { registerAgendaEvents } from './registry';
import { FAMILY_EVENTS } from './family';
import { GOVERNMENT_EVENTS } from './government';
import { OPPOSITION_EVENTS } from './opposition';
import { ECONOMY_EVENTS } from './economy';
import { INTERNATIONAL_EVENTS } from './international';

/**
 * A AGENDA DINÂMICA
 *
 * Cinco famílias de acontecimentos, todas montadas a partir do estado da
 * partida. Este arquivo só junta as peças: quem decide se um evento pode
 * acontecer é a própria definição, e quem escolhe os eventos do mês é o motor.
 *
 * Para acrescentar um evento novo, basta chamar `registerAgendaEvent` com a
 * definição — de qualquer lugar, inclusive de um arquivo novo importado aqui.
 */
registerAgendaEvents([
  ...FAMILY_EVENTS,
  ...GOVERNMENT_EVENTS,
  ...OPPOSITION_EVENTS,
  ...ECONOMY_EVENTS,
  ...INTERNATIONAL_EVENTS,
]);

export * from './registry';
export { FAMILY_EVENTS, GOVERNMENT_EVENTS, OPPOSITION_EVENTS, ECONOMY_EVENTS, INTERNATIONAL_EVENTS };
