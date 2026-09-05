import type { DynamicEventDefinition } from '../../types/index';

/**
 * REGISTRO DE EVENTOS DE AGENDA
 *
 * Um lugar só para todos os eventos dinâmicos, com uma porta aberta para os
 * próximos. Acrescentar um evento ao jogo é chamar `registerAgendaEvent` com a
 * definição — nada mais precisa ser tocado: o motor de eventos lê deste
 * registro, e o resto do jogo (interface, decisão, fechamento do mês) já sabe
 * lidar com o que sai dele.
 */
const REGISTRY = new Map<string, DynamicEventDefinition>();

export function registerAgendaEvent(definition: DynamicEventDefinition): void {
  if (REGISTRY.has(definition.id)) {
    // Id repetido é quase sempre copiar-e-colar esquecido. Falhar alto na
    // montagem é melhor do que um evento silenciosamente substituindo o outro.
    throw new Error(`Evento de agenda duplicado: ${definition.id}`);
  }
  REGISTRY.set(definition.id, definition);
}

export function registerAgendaEvents(definitions: readonly DynamicEventDefinition[]): void {
  for (const definition of definitions) registerAgendaEvent(definition);
}

/** Todos os eventos dinâmicos conhecidos. */
export function agendaEvents(): readonly DynamicEventDefinition[] {
  return [...REGISTRY.values()];
}

export function agendaEventById(id: string): DynamicEventDefinition | undefined {
  return REGISTRY.get(id);
}
