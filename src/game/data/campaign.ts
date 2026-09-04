import type { CampaignMove } from '../types/index';

/**
 * O QUE UM PRESIDENTE FAZ QUANDO ESTÁ EM CAMPANHA
 *
 * Campanha não é um botão de "ganhar mais voto": é o tempo do presidente sendo
 * gasto em outra coisa. Cada movimento custa agenda — que deixa de ser usada
 * para governar — e cobra o preço de escolher um lado, porque quem agrada o
 * caminhoneiro na estrada aparece na foto que o ambientalista vai ver.
 *
 * Cada movimento vale uma vez por eleição. Repetir palanque não dobra voto, e o
 * jogo não vira um clicador.
 */
export const CAMPAIGN_MOVES: readonly CampaignMove[] = [
  {
    id: 'palanque_governadores',
    label: 'Palanque com governadores',
    pitch:
      'Subir no palanque com quem manda no estado. Governador entrega estrutura, tempo de TV e cabo eleitoral — e cobra em emenda e cargo depois da posse.',
    agendaCost: 2,
    energyCost: 8,
    intention: 2.6,
    ownRejection: 0.4,
    rivalIntention: -0.8,
    pleases: [
      { groupId: 'classe_media', delta: 1.2 },
      { groupId: 'empresariado', delta: 1 },
    ],
    angers: [{ groupId: 'universitarios', delta: -0.8 }],
    volatility: 20,
    warning: 'A conta chega depois: quem sobe no palanque cobra ministério.',
  },
  {
    id: 'caravana_interior',
    label: 'Caravana pelo interior',
    pitch:
      'Trinta cidades pequenas em três semanas, sem imprensa nacional. É onde a obra entregue vira voto e onde o adversário não vai.',
    agendaCost: 2,
    energyCost: 14,
    intention: 2.2,
    ownRejection: -0.6,
    rivalIntention: -0.5,
    pleases: [
      { groupId: 'baixa_renda', delta: 2 },
      { groupId: 'trabalhadores', delta: 1.4 },
    ],
    angers: [{ groupId: 'mercado_financeiro', delta: -0.6 }],
    volatility: 15,
    warning: 'Três semanas de estrada cobram caro da sua energia.',
  },
  {
    id: 'debate_nacional',
    label: 'Debate na TV',
    pitch:
      'Duas horas ao vivo, sem edição, com o adversário do outro lado do púlpito. É a única noite em que a eleição inteira pode virar.',
    agendaCost: 1,
    energyCost: 12,
    intention: 3.4,
    ownRejection: -1.2,
    rivalIntention: -1.6,
    pleases: [
      { groupId: 'classe_media', delta: 1 },
      { groupId: 'universitarios', delta: 1 },
    ],
    angers: [],
    volatility: 70,
    warning: 'Debate é a jogada de maior risco da campanha: pode render quatro pontos ou custar dois.',
  },
  {
    id: 'defesa_legado',
    label: 'Rede nacional sobre o legado',
    pitch:
      'Dez minutos em cadeia nacional para contar o que foi feito, com número e obra no vídeo. Funciona quando existe entrega para mostrar.',
    agendaCost: 1,
    energyCost: 5,
    intention: 1.8,
    ownRejection: -0.8,
    rivalIntention: 0,
    pleases: [{ groupId: 'servidores', delta: 1 }],
    angers: [{ groupId: 'empresariado', delta: -0.4 }],
    volatility: 25,
    warning: 'Cadeia nacional em governo mal avaliado costuma virar panelaço.',
  },
  {
    id: 'ataque_adversario',
    label: 'Campanha contra o adversário',
    pitch:
      'Parar de falar de si e falar do outro: passado, contradição, o que ele fez quando teve poder. Derruba o adversário e suja os dois.',
    agendaCost: 1,
    energyCost: 6,
    intention: 0.4,
    ownRejection: 3.2,
    rivalIntention: -3.4,
    pleases: [],
    angers: [
      { groupId: 'catolicos', delta: -0.8 },
      { groupId: 'classe_media', delta: -0.6 },
    ],
    volatility: 40,
    warning: 'Ataque sobe a sua rejeição junto com a dele — e rejeição decide segundo turno.',
  },
  {
    id: 'alianca_centro',
    label: 'Aliança com o centro',
    pitch:
      'Costurar apoio com as legendas do meio: elas não têm voto próprio, têm tempo de TV, bancada e a promessa de governabilidade no mandato seguinte.',
    agendaCost: 2,
    energyCost: 6,
    intention: 2,
    ownRejection: -1.4,
    rivalIntention: -1,
    pleases: [{ groupId: 'empresariado', delta: 1 }],
    angers: [
      { groupId: 'universitarios', delta: -1.2 },
      { groupId: 'professores', delta: -0.8 },
    ],
    volatility: 10,
    warning: 'A base fiel vai chamar de traição. O Congresso do próximo mandato agradece.',
  },
];

export const CAMPAIGN_MOVE_BY_ID: Record<string, CampaignMove> = Object.fromEntries(
  CAMPAIGN_MOVES.map((move) => [move.id, move]),
);
