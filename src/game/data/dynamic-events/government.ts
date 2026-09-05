import type { DynamicEventDefinition } from '../../types/index';
import {
  fill,
  ministryName,
  randomGovernor,
  randomMayor,
  randomParliamentarian,
  wornMinister,
} from '../../engines/event-actors';

/**
 * O GOVERNO CONTRA SI MESMO
 *
 * Ministro que fala demais, aliado que cobra o preço do apoio, governador que
 * rompe. São os eventos que transformam a base do presidente num personagem —
 * e que fazem a governabilidade ser algo que se perde aos poucos, e não um
 * número que cai sozinho.
 *
 * Todas as pessoas aqui saem do estado da partida: o ministro é um dos seus, o
 * governador é o de um estado real do jogo, e o parlamentar vem da bancada com
 * o alinhamento certo.
 */
export const GOVERNMENT_EVENTS: readonly DynamicEventDefinition[] = [
  {
    id: 'dyn_ministro_provoca_governador',
    category: 'governamental',
    severity: 'atencao',
    weight: 18,
    tags: ['institucional'],
    cooldownMonths: 5,
    canGenerate: (state) => state.government.ministers.length > 0 && state.states.length > 0,
    pressure: (state) => {
      const wear =
        state.government.ministers.reduce((total, minister) => total + minister.wear, 0) /
        Math.max(1, state.government.ministers.length);
      return 1 + wear * 0.012;
    },
    build: (state, rng) => {
      const minister = wornMinister(state, rng);
      const governor = randomGovernor(state, rng);
      if (!minister || !governor) return null;

      return {
        title: fill('Ministro {minister} provoca o governador {governor}', {
          minister: minister.name,
          governor: governor.name,
        }),
        brief: fill(
          'O ministro {minister}, da pasta da {ministry}, provocou o governador {governor} ({party}) em entrevista, dizendo que "{state} só não anda porque quem manda lá não sabe governar". O Palácio do governo estadual respondeu em nota que vai reavaliar toda a cooperação com a União.',
          {
            minister: minister.name,
            ministry: ministryName(minister),
            governor: governor.name,
            party: governor.party,
            state: governor.unit.name,
          },
        ),
        followUp: { definitionId: 'dyn_governador_rompe', afterMonths: 2 },
        options: [
          {
            id: 'defender',
            label: 'Defender o ministro',
            description: 'Bancar a fala e dizer que o governador precisa ouvir a verdade.',
            warning: 'O ministro fica forte, o estado fica contra e a conta chega na próxima votação.',
            cost: 0,
            impacts: {},
            groupImpacts: [{ groupId: 'servidores', delta: -0.6, reason: 'Briga federativa em público.' }],
            approvalDelta: -0.4,
            congressDelta: -3,
            stressDelta: 5,
          },
          {
            id: 'repreender',
            label: 'Repreender em particular',
            description: 'Puxão de orelha reservado e nota protocolar de respeito à federação.',
            warning: 'Resolve com o governador sem humilhar o ministro. Ninguém sai satisfeito e ninguém rompe.',
            cost: 0,
            impacts: {},
            groupImpacts: [],
            approvalDelta: 0.1,
            congressDelta: 1,
            stressDelta: 3,
          },
          {
            id: 'desculpas',
            label: 'Pedir desculpas ao governador',
            description: 'Telefonema público do presidente e agenda conjunta na semana seguinte.',
            warning: 'Recompõe a relação estadual. O ministro sai desautorizado e ele sabe disso.',
            cost: 0,
            impacts: {},
            groupImpacts: [],
            approvalDelta: 0.3,
            congressDelta: 3,
            stressDelta: 4,
          },
          {
            id: 'demitir',
            label: 'Demitir o ministro',
            description: 'Exoneração publicada no mesmo dia.',
            warning: 'Encerra o assunto com a cabeça de um ministro. O partido dele não esquece.',
            cost: 0,
            impacts: {},
            groupImpacts: [{ groupId: 'servidores', delta: -0.8, reason: 'Mais uma troca na pasta.' }],
            approvalDelta: -0.2,
            congressDelta: -2,
            stressDelta: 9,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_ministro_provoca_parlamentar',
    category: 'congresso',
    severity: 'atencao',
    weight: 16,
    tags: ['institucional'],
    cooldownMonths: 4,
    canGenerate: (state) =>
      state.government.ministers.length > 0 && state.congress.blocs.length > 0,
    pressure: (state) => 1 + Math.max(0, 50 - state.congress.goodwill) * 0.02,
    build: (state, rng) => {
      const minister = wornMinister(state, rng);
      // Câmara e Senado têm pesos diferentes, e a mesma briga custa diferente
      // em cada casa: no Senado, quem se ofende preside comissão.
      const house = rng.bool(0.6) ? 'camara' : 'senado';
      const parliamentarian = randomParliamentarian(state, rng, house);
      if (!minister || !parliamentarian) return null;

      const cargo = house === 'camara' ? 'deputado' : 'senador';
      const peso = house === 'camara' ? 1 : 1.6;

      return {
        title: fill('Ministro {minister} provoca o {cargo} {name}', {
          minister: minister.name,
          cargo,
          name: parliamentarian.name,
        }),
        brief: fill(
          'O ministro {minister} ({ministry}) chamou o {cargo} {name}, do {party}, de "fisiológico de carteirinha" em entrevista. A bancada, com {seats} parlamentares, avisou que a partir de agora vota contra tudo que vier do Planalto até haver retratação.',
          {
            minister: minister.name,
            ministry: ministryName(minister),
            cargo,
            name: parliamentarian.name,
            party: parliamentarian.party,
            seats:
              house === 'camara'
                ? parliamentarian.bloc.chamberSeats
                : parliamentarian.bloc.senateSeats,
          },
        ),
        options: [
          {
            id: 'retratacao',
            label: 'Obrigar o ministro a se retratar',
            description: 'Retratação pública no mesmo veículo, com o líder da bancada ao lado.',
            warning: 'Recompõe os votos e custa a autoridade do ministro dentro do governo.',
            cost: 0,
            impacts: {},
            groupImpacts: [],
            approvalDelta: -0.2,
            congressDelta: Math.round(4 * peso),
            stressDelta: 4,
          },
          {
            id: 'emenda',
            label: 'Resolver com emenda',
            description: 'Liberar emendas da bancada e deixar a briga morrer sozinha.',
            warning: 'Funciona sempre e ensina que ofender o governo é lucrativo.',
            cost: 2.5 * peso,
            impacts: { primaryBalance: -2.5 * peso, corruptionPerception: -2 },
            groupImpacts: [
              { groupId: 'classe_media', delta: -0.8, reason: 'Emenda liberada para apagar incêndio.' },
            ],
            approvalDelta: -0.3,
            congressDelta: Math.round(6 * peso),
            stressDelta: 3,
          },
          {
            id: 'bancar',
            label: 'Bancar o ministro',
            description: 'Declarar que o ministro falou o que muita gente pensa.',
            warning: 'A base fiel gosta. A bancada ofendida vira oposição na prática.',
            cost: 0,
            impacts: {},
            groupImpacts: [{ groupId: 'baixa_renda', delta: 0.6, reason: 'Governo bateu no Congresso.' }],
            approvalDelta: 0.5,
            congressDelta: Math.round(-6 * peso),
            stressDelta: 6,
          },
        ],
      };
    },
  },

  // --------------------------------------------------------------- ALIADOS
  {
    id: 'dyn_prefeito_exige_empreiteira',
    category: 'politico',
    severity: 'atencao',
    weight: 15,
    tags: ['infraestrutura', 'institucional'],
    cooldownMonths: 6,
    canGenerate: (state) => state.states.length > 0,
    build: (state, rng) => {
      const mayor = randomMayor(state, rng);
      if (!mayor) return null;

      return {
        title: fill('Prefeito de {city} cobra o preço do apoio', { city: mayor.city }),
        brief: fill(
          'O prefeito {name}, de {city} ({state}), declarou apoio incondicional ao seu governo — mas exige em troca que as obras federais na cidade sejam direcionadas à empreiteira de um "amigo de longa data". A conversa foi gravada por um assessor, e ninguém sabe onde esse áudio está.',
          { name: mayor.name, city: mayor.city, state: mayor.state },
        ),
        options: [
          {
            id: 'aceitar',
            label: 'Aceitar a exigência',
            description: 'A obra sai, com a empresa indicada, e o apoio está garantido.',
            warning: 'Compra apoio hoje e entrega uma bomba-relógio ao seu adversário para depois.',
            cost: 0,
            impacts: { corruptionPerception: -8, infrastructureIndex: 1.2 },
            groupImpacts: [
              { groupId: 'empresariado', delta: -1.2, reason: 'Contrato direcionado.' },
              { groupId: 'classe_media', delta: -1.8, reason: 'Obra com dono escolhido.' },
            ],
            approvalDelta: -0.5,
            congressDelta: 3,
            stressDelta: 6,
          },
          {
            id: 'recusar',
            label: 'Recusar',
            description: 'A obra sai por licitação, com quem ganhar.',
            warning: 'Você perde o prefeito e o palanque da cidade. E dorme melhor.',
            cost: 0,
            impacts: { corruptionPerception: 3 },
            groupImpacts: [{ groupId: 'classe_media', delta: 1.2, reason: 'Governo recusou o balcão.' }],
            approvalDelta: 0.3,
            congressDelta: -2,
            stressDelta: 4,
          },
          {
            id: 'investigar',
            label: 'Mandar investigar o prefeito',
            description: 'Encaminhar a conversa à Controladoria e ao Ministério Público.',
            warning: 'Vira exemplo — e avisa a todo aliado que o Planalto não é balcão. Alguns somem.',
            cost: 0,
            impacts: { corruptionPerception: 6 },
            groupImpacts: [
              { groupId: 'classe_media', delta: 2, reason: 'Governo denunciou o próprio aliado.' },
              { groupId: 'empresariado', delta: 0.6, reason: 'Sinal de regra igual para todos.' },
            ],
            approvalDelta: 0.8,
            congressDelta: -4,
            stressDelta: 8,
          },
          {
            id: 'negociar',
            label: 'Negociar outra moeda',
            description: 'Oferecer obra sem indicação de empresa, mas com corte de fita no palanque dele.',
            warning: 'Todo mundo aceita menos do que pediu quando a alternativa é não ter nada.',
            cost: 1.5,
            impacts: { infrastructureIndex: 0.8, primaryBalance: -1.5 },
            groupImpacts: [],
            approvalDelta: 0.2,
            congressDelta: 1,
            stressDelta: 3,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_senador_aliado_propina',
    category: 'congresso',
    severity: 'grave',
    weight: 12,
    tags: ['institucional'],
    cooldownMonths: 10,
    conditions: { minMonth: 5 },
    canGenerate: (state) => state.congress.blocs.some((bloc) => bloc.support > 45 && bloc.senateSeats >= 3),
    pressure: (state) => 1 + Math.max(0, 55 - state.nation.corruptionPerception) * 0.02,
    build: (state, rng) => {
      const senator = randomParliamentarian(state, rng, 'senado', 'aliado');
      if (!senator) return null;

      return {
        title: fill('Senador aliado {name} aparece recebendo propina em vídeo', {
          name: senator.name,
        }),
        brief: fill(
          'O senador {name} ({party}), da sua base, foi gravado recebendo dinheiro vivo dentro do gabinete. O vídeo tem quatro minutos e não deixa margem para dúvida. A bancada, com {seats} senadores, espera para ver o que o Planalto faz antes de decidir o que ela mesma faz.',
          { name: senator.name, party: senator.party, seats: senator.bloc.senateSeats },
        ),
        options: [
          {
            id: 'romper',
            label: 'Romper publicamente',
            description: 'Nota dura, devolução de cargos indicados por ele e apoio à cassação.',
            warning: 'O país aplaude e a sua base no Senado encolhe na semana em que você mais precisa dela.',
            cost: 0,
            impacts: { corruptionPerception: 7 },
            groupImpacts: [
              { groupId: 'classe_media', delta: 2.4, reason: 'Governo rompeu com aliado corrupto.' },
              { groupId: 'mercado_financeiro', delta: 1, reason: 'Sinal de regra igual.' },
            ],
            approvalDelta: 1.6,
            congressDelta: -8,
            stressDelta: 9,
          },
          {
            id: 'investigacao',
            label: 'Pedir investigação e esperar',
            description: 'Sem defender e sem condenar: que a Justiça faça o trabalho dela.',
            warning: 'A saída institucional. Ninguém comemora, e ninguém pode acusar você de nada.',
            cost: 0,
            impacts: { corruptionPerception: 2 },
            groupImpacts: [{ groupId: 'classe_media', delta: 0.6, reason: 'Resposta protocolar.' }],
            approvalDelta: 0.2,
            congressDelta: -2,
            stressDelta: 5,
          },
          {
            id: 'defender',
            label: 'Defender o senador',
            description: 'Falar em direito de defesa e em vídeo editado.',
            warning: 'Mantém os votos e cola o escândalo no seu nome. A imprensa vai repetir isso por meses.',
            cost: 0,
            impacts: { corruptionPerception: -9, businessConfidence: -3 },
            groupImpacts: [
              { groupId: 'classe_media', delta: -3, reason: 'Governo defendeu o indefensável.' },
              { groupId: 'mercado_financeiro', delta: -1.8, reason: 'Leniência com corrupção.' },
            ],
            approvalDelta: -2.8,
            congressDelta: 4,
            stressDelta: 8,
          },
          {
            id: 'silencio',
            label: 'Permanecer em silêncio',
            description: 'Nenhuma nota, nenhuma entrevista sobre o assunto.',
            warning: 'Cada dia calado é lido como cumplicidade por quem já desconfia de você.',
            cost: 0,
            impacts: { corruptionPerception: -4 },
            groupImpacts: [{ groupId: 'classe_media', delta: -1.6, reason: 'Silêncio do Planalto.' }],
            approvalDelta: -1.2,
            congressDelta: 0,
            stressDelta: 6,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_governador_rompe',
    category: 'politico',
    severity: 'grave',
    weight: 10,
    tags: ['institucional', 'economia'],
    cooldownMonths: 8,
    conditions: { minMonth: 4 },
    canGenerate: (state) => state.states.some((unit) => unit.governorRelation >= 50),
    pressure: (state) => 1 + Math.max(0, 45 - state.approval.overall) * 0.02,
    build: (state, rng) => {
      const governor = randomGovernor(state, rng, 'aliado');
      if (!governor) return null;

      return {
        title: fill('Governador {name} rompe com o Planalto', { name: governor.name }),
        brief: fill(
          'O governador {name} ({party}), de {state}, rompeu a aliança com você após a divisão do orçamento federal deixar o estado com menos do que foi prometido. Ele controla {seats} deputados na bancada estadual e já marcou entrevista para amanhã.',
          {
            name: governor.name,
            party: governor.party,
            state: governor.unit.name,
            seats: governor.unit.chamberSeats,
          },
        ),
        options: [
          {
            id: 'recompor',
            label: 'Recompor com dinheiro',
            description: 'Liberar repasse extraordinário para o estado e retomar a agenda conjunta.',
            warning: 'Volta a base e ensina que romper com você rende dinheiro.',
            cost: 6,
            impacts: { primaryBalance: -6 },
            groupImpacts: [],
            approvalDelta: 0.2,
            congressDelta: 4,
            stressDelta: 5,
          },
          {
            id: 'ignorar',
            label: 'Deixar romper',
            description: 'Nenhuma concessão: quem quiser sair, sai.',
            warning: 'Preserva o caixa e o resto da federação assiste ao que acontece com quem rompe.',
            cost: 0,
            impacts: {},
            groupImpacts: [{ groupId: 'servidores', delta: -0.6, reason: 'Briga federativa aberta.' }],
            approvalDelta: -0.6,
            congressDelta: -5,
            stressDelta: 6,
          },
          {
            id: 'isolar',
            label: 'Isolar politicamente',
            description: 'Repasses só por convênio direto com as prefeituras do estado.',
            warning: 'Enfraquece o governador e vira guerra aberta. O estado inteiro assiste.',
            cost: 2,
            impacts: { primaryBalance: -2 },
            groupImpacts: [
              { groupId: 'baixa_renda', delta: 0.8, reason: 'Verba chegou direto na prefeitura.' },
              { groupId: 'classe_media', delta: -0.8, reason: 'Governo usou repasse como arma.' },
            ],
            approvalDelta: -0.3,
            congressDelta: -3,
            stressDelta: 8,
          },
        ],
      };
    },
  },
];
