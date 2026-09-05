import type { DynamicEventDefinition } from '../../types/index';
import {
  fill,
  randomJournalist,
  randomOutlet,
  randomParliamentarian,
  recentMeasure,
} from '../../engines/event-actors';

/**
 * A OPOSIÇÃO E A IMPRENSA
 *
 * Os dois sistemas que transformam decisão em consequência pública. A oposição
 * reage ao que o presidente FEZ — e por isso estes eventos consultam a medida
 * mais recente do governo em vez de falar em "o pacote do governo".
 *
 * A imprensa é o outro lado: ela também elogia. Um governo que entrega saúde
 * recebe a manchete boa, e o tamanho do elogio sai do índice de saúde real.
 */
export const OPPOSITION_EVENTS: readonly DynamicEventDefinition[] = [
  {
    id: 'dyn_oposicao_acusa_licitacao',
    category: 'politico',
    severity: 'grave',
    weight: 15,
    tags: ['institucional'],
    cooldownMonths: 6,
    conditions: { minMonth: 3 },
    pressure: (state) =>
      1 + state.government.opposition.strength * 0.014 + Math.max(0, 50 - state.approval.overall) * 0.016,
    build: (state, rng) => {
      const leader = state.government.opposition;
      const outlet = randomOutlet(rng, 75);

      return {
        title: fill('{leader} acusa o governo de fraude em licitações', { leader: leader.leaderName }),
        brief: fill(
          '{leader} ({party}), líder da oposição, acusou o seu governo de fraude em licitações públicas no horário nobre da {outlet}. Não apresentou documento, apresentou planilha — e planilha na TV vale mais que documento no processo. O Congresso quer explicação até sexta.',
          { leader: leader.leaderName, party: leader.leaderParty, outlet: outlet.name },
        ),
        options: [
          {
            id: 'abrir_dados',
            label: 'Abrir todos os contratos',
            description: 'Portal com cada licitação do mandato, aberto à imprensa e ao Congresso.',
            warning: 'Desmonta a acusação em uma semana — e expõe qualquer coisa que estiver lá dentro.',
            cost: 0.4,
            impacts: { corruptionPerception: 5, primaryBalance: -0.4 },
            groupImpacts: [
              { groupId: 'classe_media', delta: 1.8, reason: 'Transparência como resposta.' },
              { groupId: 'mercado_financeiro', delta: 0.8, reason: 'Contratos abertos.' },
            ],
            approvalDelta: 0.9,
            congressDelta: 3,
            stressDelta: 5,
          },
          {
            id: 'processar',
            label: 'Processar por calúnia',
            description: 'Ação judicial contra o parlamentar e pedido de direito de resposta.',
            warning: 'Mantém a história viva por meses e dá ao adversário o papel de perseguido.',
            cost: 0,
            impacts: { corruptionPerception: -2 },
            groupImpacts: [{ groupId: 'artistas', delta: -1, reason: 'Governo processando crítico.' }],
            approvalDelta: -0.7,
            congressDelta: -3,
            stressDelta: 7,
          },
          {
            id: 'ignorar',
            label: 'Ignorar',
            description: 'Nenhuma resposta oficial: o assunto morre sozinho ou não.',
            warning: 'Às vezes morre. Quando não morre, a versão que ficou é a dele.',
            cost: 0,
            impacts: { corruptionPerception: -3 },
            groupImpacts: [{ groupId: 'classe_media', delta: -1.2, reason: 'Acusação sem resposta.' }],
            approvalDelta: -1.1,
            congressDelta: -1,
            stressDelta: 4,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_oposicao_manifestacao',
    category: 'social',
    severity: 'atencao',
    weight: 17,
    tags: ['institucional'],
    cooldownMonths: 4,
    // Só existe protesto contra alguma coisa: sem medida recente, sem evento.
    canGenerate: (state) =>
      state.policies.some(
        (policy) =>
          state.month - policy.createdMonth <= 6 &&
          (policy.status === 'vigente' || policy.status === 'tramitando' || policy.status === 'aprovada'),
      ),
    pressure: (state) => {
      const mobilization =
        state.socialGroups.reduce((total, group) => total + group.mobilization, 0) /
        Math.max(1, state.socialGroups.length);
      return 1 + mobilization * 0.02;
    },
    build: (state) => {
      const measure = recentMeasure(state);
      if (!measure) return null;

      return {
        title: fill('Oposição convoca manifestação contra {measure}', { measure: measure.title }),
        brief: fill(
          'O partido da oposição convocou manifestações em massa contra {measure} na praça central das capitais. O ato de domingo tem carro de som, artista confirmado e cobertura ao vivo — e a polícia estima algo entre trinta mil e trezentas mil pessoas, dependendo de quem faz a conta.',
          { measure: measure.title },
        ),
        options: [
          {
            id: 'defender',
            label: 'Defender a medida em rede nacional',
            description: 'Pronunciamento explicando ponto a ponto o que a medida faz.',
            warning: 'Quem já era contra continua contra. Quem estava em dúvida ouve os seus números.',
            cost: 0,
            impacts: {},
            groupImpacts: [
              { groupId: 'classe_media', delta: 0.8, reason: 'Governo explicou a medida.' },
            ],
            approvalDelta: 0.5,
            congressDelta: 1,
            stressDelta: 5,
          },
          {
            id: 'recuar',
            label: 'Recuar em parte da medida',
            description: 'Anunciar revisão dos pontos mais impopulares antes do domingo.',
            warning: 'Esvazia o ato e ensina à oposição que passeata funciona.',
            cost: 3,
            impacts: { fiscalCredibility: -3, primaryBalance: -3 },
            groupImpacts: [
              { groupId: 'trabalhadores', delta: 1.6, reason: 'Governo recuou sob pressão.' },
              { groupId: 'mercado_financeiro', delta: -2, reason: 'Governo cede à rua.' },
            ],
            approvalDelta: 0.8,
            congressDelta: -2,
            stressDelta: 6,
          },
          {
            id: 'contra_ato',
            label: 'Convocar ato a favor',
            description: 'Mobilizar a base para o mesmo domingo, em outra praça.',
            warning: 'Polariza o país num fim de semana. As duas fotos rodam o mundo.',
            cost: 0,
            impacts: { businessConfidence: -3, countryRisk: 8 },
            groupImpacts: [
              { groupId: 'trabalhadores', delta: 1.2, reason: 'Base convocada.' },
              { groupId: 'classe_media', delta: -1.4, reason: 'Presidente escolheu a briga.' },
            ],
            approvalDelta: -0.4,
            congressDelta: -2,
            stressDelta: 8,
          },
          {
            id: 'silencio',
            label: 'Não responder',
            description: 'Agenda normal no domingo, sem menção ao ato.',
            warning: 'A rua fala sozinha, e o telejornal repete a imagem a semana inteira.',
            cost: 0,
            impacts: {},
            groupImpacts: [],
            approvalDelta: -0.8,
            congressDelta: 0,
            stressDelta: 3,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_oposicao_impeachment',
    category: 'congresso',
    severity: 'critico',
    weight: 8,
    tags: ['institucional'],
    cooldownMonths: 12,
    conditions: { minMonth: 8, maxApproval: 46 },
    canGenerate: (state) => state.congress.blocs.some((bloc) => bloc.support < 15),
    pressure: (state) =>
      1 + state.congress.impeachmentRisk * 0.03 + Math.max(0, 42 - state.approval.overall) * 0.03,
    build: (state, rng) => {
      const deputy = randomParliamentarian(state, rng, 'camara', 'oposicao');
      if (!deputy) return null;

      return {
        title: fill('Deputado {name} protocola pedido de impeachment', { name: deputy.name }),
        brief: fill(
          'O deputado {name} ({party}) protocolou um pedido de impeachment baseado em pedaladas fiscais no último exercício. É o {count}º pedido do mandato, e nenhum dos anteriores andou — mas este chegou com a assinatura de juristas e com a Câmara mais irritada do que estava.',
          {
            name: deputy.name,
            party: deputy.party,
            count: state.congress.impeachmentRequests + 1,
          },
        ),
        options: [
          {
            id: 'articular',
            label: 'Articular o arquivamento',
            description: 'Reunião com o presidente da Câmara e com os líderes de nove bancadas.',
            warning: 'Resolve este pedido. O preço vem em cargo, emenda e outra reunião no mês que vem.',
            cost: 4,
            impacts: { primaryBalance: -4, corruptionPerception: -2 },
            groupImpacts: [],
            approvalDelta: -0.3,
            congressDelta: 6,
            stressDelta: 12,
          },
          {
            id: 'enfrentar',
            label: 'Enfrentar publicamente',
            description: 'Rede nacional para chamar o pedido de golpe e mostrar os números fiscais.',
            warning: 'Mobiliza a base e transforma um pedido protocolar num plebiscito sobre você.',
            cost: 0,
            impacts: { countryRisk: 12 },
            groupImpacts: [
              { groupId: 'trabalhadores', delta: 1.4, reason: 'Presidente reagiu ao pedido.' },
              { groupId: 'mercado_financeiro', delta: -1.8, reason: 'Instabilidade institucional.' },
            ],
            approvalDelta: 0.6,
            congressDelta: -4,
            stressDelta: 14,
          },
          {
            id: 'tecnico',
            label: 'Responder tecnicamente',
            description: 'Nota da AGU e do Tesouro rebatendo ponto a ponto, sem discurso.',
            warning: 'Não empolga ninguém e é o que costuma derrubar um pedido de impeachment.',
            cost: 0,
            impacts: { fiscalCredibility: 2 },
            groupImpacts: [{ groupId: 'mercado_financeiro', delta: 1, reason: 'Resposta técnica.' }],
            approvalDelta: 0.1,
            congressDelta: 2,
            stressDelta: 8,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_oposicao_cpi_familia',
    category: 'congresso',
    severity: 'grave',
    weight: 6,
    tags: ['institucional'],
    cooldownMonths: 12,
    conditions: { minMonth: 6 },
    canGenerate: (state) => state.family.length > 0 && state.congress.blocs.length > 0,
    build: (state, rng) => {
      const deputy = randomParliamentarian(state, rng, 'camara', 'oposicao');
      if (!deputy) return null;
      const assinaturas = 171 + Math.round((100 - state.approval.overall) * 1.4);

      return {
        title: 'Oposição junta assinaturas para CPI da família presidencial',
        brief: fill(
          'O deputado {name} ({party}) reuniu {assinaturas} assinaturas para instalar uma CPI sobre os negócios da família presidencial. Faltam poucas, e cada bancada que ainda não assinou já mandou dizer o que quer para não assinar.',
          { name: deputy.name, party: deputy.party, assinaturas },
        ),
        options: [
          {
            id: 'colaborar',
            label: 'Colaborar com a CPI',
            description: 'Anunciar que o governo entrega todos os documentos pedidos.',
            warning: 'Tira o ar da crise e entrega a agenda do semestre para a comissão.',
            cost: 0,
            impacts: { corruptionPerception: 4 },
            groupImpacts: [{ groupId: 'classe_media', delta: 1.6, reason: 'Governo colaborou.' }],
            approvalDelta: 0.4,
            congressDelta: 2,
            stressDelta: 10,
          },
          {
            id: 'barrar',
            label: 'Barrar a instalação',
            description: 'Trabalhar as bancadas para a CPI nunca sair do papel.',
            warning: 'Custa caro em emenda e cargo, e a imprensa conta cada assinatura comprada.',
            cost: 5,
            impacts: { primaryBalance: -5, corruptionPerception: -6 },
            groupImpacts: [
              { groupId: 'classe_media', delta: -2.2, reason: 'CPI barrada no varejo.' },
            ],
            approvalDelta: -1.4,
            congressDelta: 4,
            stressDelta: 12,
          },
        ],
      };
    },
  },

  // ---------------------------------------------------------------- MÍDIA
  {
    id: 'dyn_midia_dossie_chefe_gabinete',
    category: 'midia',
    severity: 'grave',
    weight: 12,
    tags: ['institucional'],
    cooldownMonths: 9,
    conditions: { minMonth: 4 },
    canGenerate: (state) => state.government.ministers.length > 0,
    build: (state, rng) => {
      const chief =
        state.government.ministers.find((minister) => minister.ministryId === 'casa_civil') ??
        state.government.ministers[0];
      if (!chief) return null;
      const journalist = randomJournalist(rng);

      return {
        title: fill('Dossiê expõe o passado de {chief}', { chief: chief.name }),
        brief: fill(
          'O jornalista investigativo {journalist} publicou um dossiê expondo segredos obscuros do passado de {chief}, seu chefe de gabinete: contratos antigos, uma empresa em nome de terceiros e duas viagens que ninguém sabe explicar. A reportagem tem documento, e o gabinete não tem resposta pronta.',
          { journalist: journalist.name, chief: chief.name },
        ),
        options: [
          {
            id: 'demitir',
            label: 'Demitir imediatamente',
            description: 'Exoneração no mesmo dia, antes do jornal da noite.',
            warning: 'Encerra o assunto em 48 horas e tira do seu lado quem conhece todo o governo.',
            cost: 0,
            impacts: { corruptionPerception: 4 },
            groupImpacts: [{ groupId: 'classe_media', delta: 1.6, reason: 'Resposta rápida ao dossiê.' }],
            approvalDelta: 0.5,
            congressDelta: 1,
            stressDelta: 9,
          },
          {
            id: 'apurar',
            label: 'Afastar até a apuração',
            description: 'Licença enquanto a Controladoria examina os documentos.',
            warning: 'A saída correta demora, e demora aparece como enrolação no noticiário.',
            cost: 0,
            impacts: { corruptionPerception: 2 },
            groupImpacts: [],
            approvalDelta: 0.1,
            congressDelta: 1,
            stressDelta: 6,
          },
          {
            id: 'bancar',
            label: 'Bancar o chefe de gabinete',
            description: 'Declarar confiança total e chamar a reportagem de encomenda.',
            warning: 'Se a próxima reportagem vier, ela vem com o seu nome dentro.',
            cost: 0,
            impacts: { corruptionPerception: -6 },
            groupImpacts: [{ groupId: 'classe_media', delta: -2, reason: 'Governo ignorou o dossiê.' }],
            approvalDelta: -1.5,
            congressDelta: -2,
            stressDelta: 8,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_midia_audios_vazados',
    category: 'midia',
    severity: 'critico',
    weight: 9,
    tags: ['institucional'],
    cooldownMonths: 14,
    conditions: { minMonth: 6 },
    pressure: (state) => 1 + Math.max(0, 50 - state.approval.overall) * 0.02,
    build: (state, rng) => {
      const outlet = randomOutlet(rng, 80);
      void state;

      return {
        title: fill('{outlet} divulga áudios sobre negociação de cargos', { outlet: outlet.name }),
        brief: fill(
          'A emissora {outlet} divulgou áudios vazados em que você supostamente negocia cargos no governo em troca de votos. A gravação tem ruído, cortes e nenhuma perícia — e já foi ao ar três vezes hoje. A palavra "supostamente" está no material da emissora e não está na boca de ninguém que comenta o caso.',
          { outlet: outlet.name },
        ),
        options: [
          {
            id: 'pericia',
            label: 'Pedir perícia independente',
            description: 'Entregar o áudio a peritos e transmitir o laudo, seja ele qual for.',
            warning: 'A resposta que resolve — se o áudio for editado. E se não for, você mesmo comprovou.',
            cost: 0.3,
            impacts: { corruptionPerception: 3, primaryBalance: -0.3 },
            groupImpacts: [{ groupId: 'classe_media', delta: 1.4, reason: 'Perícia aberta.' }],
            approvalDelta: 0.3,
            congressDelta: 2,
            stressDelta: 13,
          },
          {
            id: 'negar',
            label: 'Negar e seguir a agenda',
            description: 'Nota curta desmentindo, sem entrevista.',
            warning: 'O áudio continua tocando. Sua nota some do noticiário em uma hora.',
            cost: 0,
            impacts: { corruptionPerception: -4 },
            groupImpacts: [{ groupId: 'classe_media', delta: -1.6, reason: 'Desmentido sem prova.' }],
            approvalDelta: -1.8,
            congressDelta: -3,
            stressDelta: 10,
          },
          {
            id: 'processar',
            label: 'Processar a emissora',
            description: 'Ação por difamação e pedido de retirada do material do ar.',
            warning: 'Vira caso de liberdade de imprensa, e aí não é mais sobre o áudio.',
            cost: 0,
            impacts: { corruptionPerception: -3, businessConfidence: -2 },
            groupImpacts: [
              { groupId: 'artistas', delta: -2.4, reason: 'Governo processando emissora.' },
              { groupId: 'universitarios', delta: -1.8, reason: 'Ameaça à imprensa.' },
            ],
            approvalDelta: -1.2,
            congressDelta: -2,
            stressDelta: 12,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_midia_elogio_saude',
    category: 'midia',
    severity: 'rotina',
    weight: 14,
    tags: ['saude'],
    cooldownMonths: 6,
    // Elogio precisa de entrega: sem saúde melhorando, não existe matéria boa.
    canGenerate: (state) => state.nation.healthIndex >= 52,
    pressure: (state) => 1 + Math.max(0, state.nation.healthIndex - 55) * 0.05,
    build: (state, rng) => {
      const outlet = randomOutlet(rng, 40);
      // A intensidade do elogio sai do índice real: governo com saúde apenas
      // razoável ganha manchete morna, governo que entregou ganha manchete boa.
      const forca = Math.max(0.3, Math.min(2.4, (state.nation.healthIndex - 48) * 0.12));

      return {
        title: fill('{outlet} elogia a política de saúde do governo', { outlet: outlet.name }),
        brief: fill(
          'O jornal {outlet} publicou uma matéria de página inteira elogiando as suas ações na área da saúde, com dados de fila, atendimento e cobertura. O índice de saúde do país está em {index} — e a reportagem mostra exatamente isso, sem precisar inventar nada.',
          { outlet: outlet.name, index: state.nation.healthIndex.toFixed(0) },
        ),
        options: [
          {
            id: 'amplificar',
            label: 'Amplificar o resultado',
            description: 'Agenda na porta de um hospital com a equipe que fez a entrega.',
            warning: 'Capitaliza o que já foi feito. Se a fila voltar, a mesma foto volta contra você.',
            cost: 0,
            impacts: { healthIndex: 0.3 },
            groupImpacts: [
              { groupId: 'baixa_renda', delta: forca, reason: 'Saúde pública elogiada.' },
              { groupId: 'professores', delta: forca * 0.4, reason: 'Serviço público reconhecido.' },
            ],
            approvalDelta: forca,
            congressDelta: 1,
            stressDelta: 1,
          },
          {
            id: 'creditar',
            label: 'Dar o crédito à equipe',
            description: 'Nota creditando o ministério e os profissionais da rede.',
            warning: 'Rende menos manchete e compra lealdade dentro do governo.',
            cost: 0,
            impacts: {},
            groupImpacts: [
              { groupId: 'servidores', delta: forca * 0.8, reason: 'Presidente creditou a equipe.' },
              { groupId: 'baixa_renda', delta: forca * 0.5, reason: 'Saúde reconhecida.' },
            ],
            approvalDelta: forca * 0.6,
            congressDelta: 0,
            stressDelta: 0,
          },
        ],
      };
    },
  },
];
