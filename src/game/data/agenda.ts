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
    id: 'reuniao_lideres',
    label: 'Receber os líderes da base',
    description:
      'Chamar os líderes de bancada ao Planalto para acertar a pauta da semana. Ninguém sai de lá sem pedir alguma coisa.',
    cost: 2,
    energyCost: 8,
    category: 'articulacao',
    consequence: 'Melhora a boa vontade do Congresso e destrava a votação seguinte.',
  },
  {
    id: 'reuniao_ministro',
    label: 'Cobrar um ministro',
    description:
      'Chamar o titular de uma pasta para explicar por que a entrega não saiu. Aperta o desempenho e gasta a lealdade dele.',
    cost: 1,
    energyCost: 6,
    category: 'articulacao',
    consequence: 'A pasta rende mais no mês seguinte, e o ministro guarda a mágoa.',
  },
  {
    id: 'reuniao_governador',
    label: 'Receber um governador',
    description:
      'Sentar com um governador para acertar repasse e palanque. Sai caro, mas troca inimigo por aliado no estado.',
    cost: 1,
    energyCost: 7,
    category: 'articulacao',
    consequence: 'Melhora a relação com o estado e a aprovação na região.',
  },
  {
    id: 'tratar_com_a_rua',
    label: 'Receber quem está na rua',
    description:
      'Abrir o Planalto para o movimento mais mobilizado do momento. Desmobiliza quem entrou e irrita quem ficou de fora.',
    cost: 2,
    energyCost: 10,
    category: 'articulacao',
    consequence: 'Derruba a mobilização do grupo, e parte do país lê o gesto como fraqueza.',
  },
  {
    id: 'noite_com_conjuge',
    label: 'Passar a noite com o cônjuge',
    description:
      'Desmarcar o que der para desmarcar e dedicar a noite a quem divide a vida com você. É a única coisa que baixa o estresse dela de verdade.',
    cost: 2,
    energyCost: 4,
    category: 'pessoal',
    consequence: 'Reduz de 15% a 30% do estresse do cônjuge — e evita o que vem quando ele chega a 100%.',
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
    id: 'divorciar',
    label: 'Pedir o divórcio',
    description:
      'Encerrar o casamento por decisão sua, no mês que você escolher. Nota curta, patrimônio partido ao meio e uma semana de noticiário que não é sobre o governo.',
    cost: 1,
    energyCost: 10,
    category: 'pessoal',
    consequence: 'Custa aprovação na proporção de quanto o país gostava dela — e metade do seu patrimônio.',
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
