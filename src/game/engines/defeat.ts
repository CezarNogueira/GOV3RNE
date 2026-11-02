import { GROUP_LABEL, RESOURCE_LABEL, SERVICE_LABEL } from '../data/meta';
import { GROUP_IDS, RESOURCE_IDS, SERVICE_IDS } from '../types/common';
import type { DefeatInfo, GameState } from '../types/state';

/**
 * Condições de derrota: qualquer serviço, recurso ou grupo em 0, ou a moeda em
 * US$ 0. Cofre negativo NÃO é derrota — é crise. Verifica na ordem
 * serviço → recurso → moeda → grupo e devolve o primeiro que zerou.
 */
export function checkDefeat(state: GameState): DefeatInfo | null {
  const month = state.month;
  for (const id of SERVICE_IDS) {
    if (state.services[id] <= 0) {
      return { cause: 'servico', subject: id, label: SERVICE_LABEL[id], month };
    }
  }
  for (const id of RESOURCE_IDS) {
    if (state.resources[id] <= 0) {
      return { cause: 'recurso', subject: id, label: RESOURCE_LABEL[id], month };
    }
  }
  if (state.international.currencyCents <= 0) {
    return { cause: 'moeda', subject: 'moeda', label: 'Valor da moeda', month };
  }
  for (const id of GROUP_IDS) {
    if (state.society[id] <= 0) {
      return { cause: 'grupo', subject: id, label: GROUP_LABEL[id], month };
    }
  }
  return null;
}
