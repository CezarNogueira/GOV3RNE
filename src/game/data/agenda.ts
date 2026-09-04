import type { AgendaAction, AgendaActionId } from '../types/index';

/**
 * O presidente tem tempo, não onipotência. Cada mês entrega uma cota de pontos
 * de agenda e cada ação consome parte dela. Viagem internacional consome o mês.
 */
export const AGENDA_ACTIONS: readonly AgendaAction[] = [
  {
    id: 'escrever_medida',
    label: 'Escrever uma medida',
    description:
      'Mês sem crise é mês de pauta própria: você escreve o que quer aprovar antes que apareça um problema.',
    cost: 3,
    energyCost: 8,
    category: 'legislativo',
    consequence: 'A medida entra em vigor ou em tramitação já no fechamento do mês.',
  },
  {
    id: 'fazer_post',
    label: 'Falar direto com o país',
    description: 'Não gasta caixa. Recupera lealdade da base e cria briga com quem você citar.',
    cost: 1,
    energyCost: 3,
    category: 'comunicacao',
    consequence: 'Aprovação da base sobe, aprovação no centro oscila.',
  },
  {
    id: 'tratar_com_a_rua',
    label: 'Tratar com quem está na rua',
    description:
      'Receber, ceder ou mandar desobstruir. A escolha vira memória política de longo prazo.',
    cost: 2,
    energyCost: 10,
    category: 'articulacao',
    consequence: 'Reduz mobilização de um grupo social — ou multiplica.',
  },
  {
    id: 'trabalhar_os_votos',
    label: 'Trabalhar os votos',
    description:
      'Liderança por liderança, com emenda, cargo ou favor guardado. É onde a maioria se constrói.',
    cost: 3,
    energyCost: 12,
    category: 'articulacao',
    consequence: 'Sobe o apoio das bancadas trabalhadas e consome caixa em emendas.',
  },
  {
    id: 'pronunciamento',
    label: 'Pronunciamento em rede nacional',
    description: 'Cadeia de rádio e TV. Funciona uma vez por crise; a segunda já cansa.',
    cost: 2,
    energyCost: 9,
    category: 'comunicacao',
    consequence: 'Efeito grande e curto sobre a aprovação nacional.',
  },
  {
    id: 'viagem_internacional',
    label: 'Viagem de Estado',
    description:
      'Ocupa o mês inteiro. O que estiver acontecendo no Brasil vai acontecer sem você.',
    cost: 6,
    energyCost: 22,
    category: 'diplomacia',
    consequence: 'Chance de acordo, ganho diplomático e desgaste doméstico.',
  },
  {
    id: 'visita_regional',
    label: 'Visita a um estado',
    description: 'Inaugurar, apertar mão e sair na primeira página do jornal local.',
    cost: 2,
    energyCost: 10,
    category: 'comunicacao',
    consequence: 'Sobe aprovação naquele estado e na região.',
  },
  {
    id: 'descansar',
    label: 'Guardar o fim de semana',
    description: 'Recupera energia e humor. O país continua andando sem você por 48 horas.',
    cost: 1,
    energyCost: -18,
    category: 'pessoal',
    consequence: 'Reduz estresse e devolve energia para o mês seguinte.',
  },
  {
    id: 'nada',
    label: 'Não fazer nada este mês',
    description: 'O mês passa, a crise anda sozinha e a sua caneta fica guardada.',
    cost: 0,
    energyCost: -4,
    category: 'pessoal',
    consequence: 'Nada muda por decisão sua. Nem sempre é o pior resultado.',
  },
];

export const AGENDA_ACTION_BY_ID: Record<AgendaActionId, AgendaAction> = Object.fromEntries(
  AGENDA_ACTIONS.map((action) => [action.id, action]),
) as Record<AgendaActionId, AgendaAction>;

export const BASE_AGENDA_POINTS = 8;
