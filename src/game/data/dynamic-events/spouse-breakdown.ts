import type { DynamicEventDefinition } from '../../types/index';
import { fill, randomOutlet, spouseOf } from '../../engines/event-actors';

/**
 * QUANDO A CONTA CHEGA A 100
 *
 * Estes eventos NÃO entram no sorteio mensal. Eles sao disparados por uma coisa
 * só: o medidor de estresse de quem mora com o presidente bateu no teto. É por
 * isso que ficam fora do registro de eventos dinâmicos e são construídos
 * diretamente pelo motor de vida pessoal.
 *
 * A regra de escrita é a mesma do resto da família: a pessoa não é vilã, é
 * alguém que não aguentou. O que o jogo cobra do presidente não é o que ela fez
 * — é o que ele faz depois, e cada saída custa uma coisa diferente. Nenhuma
 * delas é limpa, porque a essa altura não existe saída limpa.
 */
export const SPOUSE_BREAKDOWN_EVENTS: readonly DynamicEventDefinition[] = [
  {
    id: 'dyn_conjuge_explode_ao_vivo',
    category: 'pessoal',
    severity: 'grave',
    weight: 0,
    tags: ['institucional'],
    build: (state, rng) => {
      const spouse = spouseOf(state);
      const outlet = randomOutlet(rng);
      if (!spouse) return null;

      return {
        title: fill('{article} {title} desabou ao vivo e disse o que pensa do governo', {
          article: spouse.article,
          title: spouse.title,
        }),
        brief: fill(
          '{name} entrou sem aviso num programa {outlet} e falou por onze minutos. Disse que não pediu para morar onde mora, que o casamento virou "uma agenda com dois nomes" e que o país cobra de casa uma paciência que ninguém cobra de quem foi eleito. Chorou no fim. O trecho já é o vídeo mais visto do dia, e metade do país ficou do lado de quem falou — contra você.',
          { name: spouse.member.name, outlet: outlet ? `da ${outlet.name}` : 'de entrevistas' },
        ),
        options: [
          {
            id: 'assumir',
            label: 'Assumir em público que a culpa é sua',
            description: 'Entrevista curta, sem assessor: reconhecer a ausência e prometer mudar a agenda.',
            warning: 'Humaniza e desarma a manchete, mas confirma um presidente que não dá conta de tudo.',
            cost: 0,
            impacts: {},
            groupImpacts: [
              { groupId: 'mulheres', delta: 2.2, reason: 'O presidente assumiu a própria ausência.' },
              { groupId: 'evangelicos', delta: -1.4, reason: 'Casamento presidencial exposto em rede nacional.' },
            ],
            approvalDelta: -0.6,
            congressDelta: -1,
            stressDelta: 6,
            family: { spouseStressDelta: -28 },
          },
          {
            id: 'blindar',
            label: 'Blindar a família e não comentar',
            description: 'Nota do Planalto pedindo respeito à vida privada e nenhuma palavra a mais.',
            warning: 'Fecha o assunto no oficial e deixa a interpretação para quem quiser fazer.',
            cost: 0,
            impacts: {},
            groupImpacts: [
              { groupId: 'imprensa', delta: -2.4, reason: 'Planalto se recusou a responder.' },
            ],
            approvalDelta: -1.6,
            congressDelta: 0,
            stressDelta: 4,
            family: { spouseStressDelta: -6 },
          },
          {
            id: 'afastar',
            label: 'Tirar a família da vida pública de vez',
            description: 'Fim das agendas oficiais com a família e mudança de residência para fora do Palácio.',
            warning: 'Resolve a exposição e alimenta um mês de especulação sobre separação.',
            cost: 0,
            impacts: {},
            groupImpacts: [
              { groupId: 'imprensa', delta: -1.8, reason: 'A família saiu de cena e a pauta continuou.' },
            ],
            approvalDelta: -2.4,
            congressDelta: -1,
            stressDelta: 3,
            family: { spouseStressDelta: -40, exposureDelta: -35, stance: 'fora_dos_holofotes' },
          },
        ],
      };
    },
  },
  {
    id: 'dyn_conjuge_some',
    category: 'pessoal',
    severity: 'grave',
    weight: 0,
    tags: ['institucional'],
    build: (state) => {
      const spouse = spouseOf(state);
      if (!spouse) return null;

      return {
        title: fill('{article} {title} saiu do Palácio sem avisar ninguém', {
          article: spouse.article,
          title: spouse.title,
        }),
        brief: fill(
          '{name} pegou um carro particular na madrugada, dispensou a segurança na saída e não disse para onde ia. O GSI localizou o carro seis horas depois, em outro estado. Não há crime, não há risco — há uma pessoa que foi embora de casa e uma imprensa que já sabe. A pergunta de todo mundo é a mesma: o que está acontecendo dentro do Alvorada?',
          { name: spouse.member.name },
        ),
        options: [
          {
            id: 'buscar',
            label: 'Largar a agenda e ir atrás',
            description: 'Cancelar tudo do dia, ir pessoalmente e voltar com ela — ou sem ela.',
            warning: 'Custa um dia inteiro de governo e é impossível fazer isso escondido.',
            cost: 0,
            impacts: {},
            groupImpacts: [
              { groupId: 'mulheres', delta: 1.8, reason: 'O presidente largou a agenda pela família.' },
              { groupId: 'empresariado', delta: -1.2, reason: 'Um dia de governo parado.' },
            ],
            approvalDelta: -0.4,
            congressDelta: -2,
            stressDelta: 8,
            family: { spouseStressDelta: -34 },
          },
          {
            id: 'silencio',
            label: 'Manter a agenda e tratar como assunto privado',
            description: 'Nenhum cancelamento, nenhuma declaração, nenhuma confirmação.',
            warning: 'O governo segue e a especulação também — por semanas.',
            cost: 0,
            impacts: {},
            groupImpacts: [
              { groupId: 'imprensa', delta: -2.2, reason: 'Planalto tratou o sumiço como não-assunto.' },
            ],
            approvalDelta: -2.2,
            congressDelta: 0,
            stressDelta: 10,
            family: { spouseStressDelta: -10 },
          },
          {
            id: 'separacao',
            label: 'Anunciar a separação',
            description: 'Nota conjunta, curta, pedindo privacidade — e fim da ficção de normalidade.',
            warning: 'Encerra a crise de uma vez e encerra também a relação. Não tem volta.',
            cost: 0,
            impacts: {},
            groupImpacts: [
              { groupId: 'evangelicos', delta: -3.4, reason: 'Separação anunciada durante o mandato.' },
              { groupId: 'imprensa', delta: 1.2, reason: 'O Planalto falou em vez de esconder.' },
            ],
            approvalDelta: -3.2,
            congressDelta: -1,
            stressDelta: 12,
            family: { endRelationship: true },
          },
        ],
      };
    },
  },
];

/**
 * Os ids do estouro, para o motor distinguir esta crise das outras da família.
 *
 * Existe porque um evento comum do cônjuge (uma entrevista, um programa
 * apadrinhado) não pode segurar o estouro nem ser confundido com ele: são
 * coisas diferentes com a mesma pessoa dentro.
 */
export const SPOUSE_BREAKDOWN_IDS: ReadonlySet<string> = new Set(
  SPOUSE_BREAKDOWN_EVENTS.map((definition) => definition.id),
);
