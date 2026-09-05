import type { DynamicEventDefinition } from '../../types/index';
import {
  economicWeight,
  fill,
  randomChild,
  randomCompany,
  randomOutlet,
  spouseOf,
} from '../../engines/event-actors';

/**
 * A FAMÍLIA DO PRESIDENTE
 *
 * Quem mora no Palácio tem vida própria, e ela vira notícia. Estes eventos só
 * existem para quem tem cônjuge ou filhos — a porta é `canGenerate`, e o
 * `build` devolve `null` se por algum motivo a pessoa não estiver mais lá.
 *
 * Regra de escrita: o presidente NUNCA é declarado culpado pelo que a família
 * faz. O que o jogo cobra é a reação — proteger, afastar, investigar — e cada
 * uma dessas saídas custa uma coisa diferente.
 */
export const FAMILY_EVENTS: readonly DynamicEventDefinition[] = [
  {
    id: 'dyn_conjuge_ataca_empresa',
    category: 'pessoal',
    severity: 'atencao',
    weight: 16,
    tags: ['economia'],
    cooldownMonths: 8,
    canGenerate: (state) => state.family.some((member) => member.kind === 'conjuge'),
    pressure: (state) => {
      const spouse = state.family.find((member) => member.kind === 'conjuge');
      // Cônjuge que já fala demais fala de novo.
      return 1 + (spouse ? spouse.exposure / 90 : 0);
    },
    build: (state, rng) => {
      const spouse = spouseOf(state);
      const company = randomCompany(state, rng);
      if (!spouse || !company) return null;

      const weight = economicWeight(state, company);
      const bruise = 2 + weight * 6;

      return {
        title: fill('{article} {title} atacou {company} em entrevista', {
          article: spouse.article,
          title: spouse.title,
          company: company.name,
        }),
        brief: fill(
          '{article} {title} {name} atacou verbalmente em uma entrevista a {company}, chamando a diretoria de "gente que lucra com o sofrimento do povo". A empresa emprega {employees} pessoas e as ações caíram na abertura. O setor empresarial quer saber se aquilo é a posição do governo.',
          {
            article: spouse.article,
            title: spouse.title,
            name: spouse.member.name,
            company: company.name,
            employees: company.employees.toLocaleString('pt-BR'),
          },
        ),
        options: [
          {
            id: 'apoiar',
            label: 'Endossar a crítica',
            description: 'Assumir a fala como posição do governo e cobrar a empresa publicamente.',
            warning: 'A base comemora, o mercado precifica risco e a empresa congela investimento.',
            cost: 0,
            impacts: { businessConfidence: -6 - bruise, countryRisk: 6 + bruise * 2 },
            groupImpacts: [
              { groupId: 'trabalhadores', delta: 1.8, reason: 'Palácio bateu no patrão.' },
              { groupId: 'empresariado', delta: -3.2, reason: 'Ataque público a uma empresa.' },
              { groupId: 'mercado_financeiro', delta: -2.6, reason: 'Governo hostil ao setor privado.' },
            ],
            approvalDelta: 0.4,
            congressDelta: -2,
            stressDelta: 3,
          },
          {
            id: 'separar',
            label: 'Dizer que é opinião pessoal',
            description: 'Nota curta separando a fala da posição oficial, sem desautorizar em público.',
            warning: 'Apaga o incêndio pela metade: ninguém fica satisfeito, mas ninguém rompe.',
            cost: 0,
            impacts: { businessConfidence: -1.5 },
            groupImpacts: [
              { groupId: 'empresariado', delta: -0.8, reason: 'Recuo morno.' },
              { groupId: 'classe_media', delta: 0.4, reason: 'Governo evitou briga.' },
            ],
            approvalDelta: -0.2,
            congressDelta: 0,
            stressDelta: 2,
          },
          {
            id: 'desculpar',
            label: 'Pedir desculpas à empresa',
            description: 'Telefonema do presidente e nota conjunta com a companhia.',
            warning: 'O empresariado agradece. A sua base chama de subserviência, e o assunto vira meme.',
            cost: 0,
            impacts: { businessConfidence: 4 },
            groupImpacts: [
              { groupId: 'empresariado', delta: 2.4, reason: 'Presidente recuou publicamente.' },
              { groupId: 'trabalhadores', delta: -1.6, reason: 'Palácio pediu desculpas ao patrão.' },
            ],
            approvalDelta: -0.6,
            congressDelta: 1,
            stressDelta: 4,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_conjuge_desvio_ong',
    category: 'pessoal',
    severity: 'grave',
    weight: 11,
    tags: ['institucional', 'social'],
    cooldownMonths: 18,
    conditions: { minMonth: 6 },
    canGenerate: (state) => state.family.some((member) => member.kind === 'conjuge'),
    pressure: (state) => 1 + Math.max(0, 55 - state.nation.corruptionPerception) * 0.02,
    build: (state, rng) => {
      const spouse = spouseOf(state);
      if (!spouse) return null;
      const outlet = randomOutlet(rng, 70);

      return {
        title: fill('Programa apadrinhado {article_lower} {title} sob suspeita de desvio', {
          article_lower: spouse.article === 'A' ? 'pela' : 'pelo',
          title: spouse.title,
        }),
        brief: fill(
          '{article} {title} {name} apadrinhou um programa de assistência voluntária e {outlet} publicou documentos que apontam desvio de dinheiro na prestação de contas. A defesa fala em erro contábil; a oposição fala em quadrilha. Ninguém provou nada ainda, e o país inteiro está assistindo.',
          {
            article: spouse.article,
            title: spouse.title,
            name: spouse.member.name,
            outlet: outlet.name,
          },
        ),
        followUp: { definitionId: 'dyn_oposicao_cpi_familia', afterMonths: 2 },
        options: [
          {
            id: 'investigar',
            label: 'Pedir investigação e afastar do programa',
            description: 'Controladoria e Polícia Federal com acesso total, e o programa sob intervenção.',
            warning: 'Custa em casa e protege o mandato: a imprensa reconhece, a família não perdoa.',
            cost: 0,
            impacts: { corruptionPerception: 3, fiscalCredibility: 1 },
            groupImpacts: [
              { groupId: 'classe_media', delta: 1.4, reason: 'Governo não protegeu a própria família.' },
              { groupId: 'servidores', delta: 1, reason: 'Controle interno funcionou.' },
            ],
            approvalDelta: -0.8,
            congressDelta: 3,
            stressDelta: 12,
          },
          {
            id: 'defender',
            label: 'Defender publicamente',
            description: 'Pronunciamento chamando a denúncia de perseguição política.',
            warning: 'Sua base fecha em volta. Todo mundo que estava em dúvida decide que é verdade.',
            cost: 0,
            impacts: { corruptionPerception: -6 },
            groupImpacts: [
              { groupId: 'baixa_renda', delta: 0.8, reason: 'Presidente defendeu a família.' },
              { groupId: 'classe_media', delta: -2.6, reason: 'Defesa sem apuração.' },
              { groupId: 'mercado_financeiro', delta: -1.4, reason: 'Sinal de leniência.' },
            ],
            approvalDelta: -2.4,
            congressDelta: -4,
            stressDelta: 9,
          },
          {
            id: 'silencio',
            label: 'Não comentar',
            description: 'Assessoria responde que é assunto pessoal e não do governo.',
            warning: 'O silêncio vira a manchete de amanhã, e depois a de depois de amanhã.',
            cost: 0,
            impacts: { corruptionPerception: -3 },
            groupImpacts: [
              { groupId: 'classe_media', delta: -1.8, reason: 'Palácio evitou explicar.' },
            ],
            approvalDelta: -1.6,
            congressDelta: -2,
            stressDelta: 7,
          },
        ],
      };
    },
  },

  // --------------------------------------------------------------- FILHOS
  {
    id: 'dyn_filho_festa_ilegal',
    category: 'pessoal',
    severity: 'atencao',
    weight: 14,
    tags: ['seguranca'],
    cooldownMonths: 10,
    canGenerate: (state) => state.family.some((member) => member.kind === 'filho'),
    build: (state, rng) => {
      const child = randomChild(state, rng);
      if (!child) return null;

      return {
        title: fill('{article} {noun} do presidente flagrad{ending} em festa ilegal', {
          article: child.article,
          noun: child.noun,
          ending: child.noun === 'filha' ? 'a' : 'o',
        }),
        brief: fill(
          '{article} {noun} {name} foi pego em uma festa ilegal e a polícia precisou intervir. A mídia já está no local, e a primeira pergunta de todo repórter é a mesma: vai ter tratamento diferente?',
          { article: child.article, noun: child.noun, name: child.member.name },
        ),
        options: [
          {
            id: 'lei_igual',
            label: 'A lei vale para todos',
            description: 'Nota dizendo que responderá como qualquer cidadão, sem interferência.',
            warning: 'Custa em casa e ganha na rua. A oposição perde o assunto em dois dias.',
            cost: 0,
            impacts: { corruptionPerception: 2 },
            groupImpacts: [
              { groupId: 'classe_media', delta: 1.2, reason: 'Presidente não protegeu o filho.' },
              { groupId: 'policiais', delta: 1.4, reason: 'Autoridade policial respeitada.' },
            ],
            approvalDelta: 0.6,
            congressDelta: 1,
            stressDelta: 8,
          },
          {
            id: 'minimizar',
            label: 'Minimizar publicamente',
            description: '"Coisa de jovem." Assessoria trata como assunto privado.',
            warning: 'Funciona com quem já gosta de você e confirma o pior para todo o resto.',
            cost: 0,
            impacts: {},
            groupImpacts: [
              { groupId: 'universitarios', delta: 0.6, reason: 'Presidente não moralizou.' },
              { groupId: 'classe_media', delta: -1.4, reason: 'Peso dois para a família do poder.' },
            ],
            approvalDelta: -0.9,
            congressDelta: 0,
            stressDelta: 5,
          },
          {
            id: 'interferir',
            label: 'Ligar para o delegado',
            description: 'Um telefonema discreto para que o caso não vire boletim.',
            warning: 'Some hoje e volta em dobro se alguém contar. Sempre alguém conta.',
            cost: 0,
            impacts: { corruptionPerception: -7 },
            groupImpacts: [
              { groupId: 'policiais', delta: -3, reason: 'Interferência política numa ocorrência.' },
              { groupId: 'classe_media', delta: -2.2, reason: 'Privilégio explícito.' },
            ],
            approvalDelta: -1.8,
            congressDelta: -3,
            stressDelta: 11,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_filho_ong_fantasma',
    category: 'pessoal',
    severity: 'grave',
    weight: 10,
    tags: ['institucional'],
    cooldownMonths: 16,
    conditions: { minMonth: 8 },
    canGenerate: (state) => state.family.some((member) => member.kind === 'filho'),
    pressure: (state) => 1 + state.government.opposition.strength * 0.012,
    build: (state, rng) => {
      const child = randomChild(state, rng);
      if (!child) return null;

      return {
        title: fill('Doação {article_lower} {noun} do presidente a ONG fantasma', {
          article_lower: child.article === 'A' ? 'da' : 'do',
          noun: child.noun,
        }),
        brief: fill(
          '{article} {noun} {name} fez uma doação suspeita para uma ONG que existe só no papel, e a oposição está exigindo investigação. A entidade recebeu repasses de três empresas que têm contrato com o governo — o que ninguém consegue explicar é a coincidência.',
          { article: child.article, noun: child.noun, name: child.member.name },
        ),
        followUp: { definitionId: 'dyn_oposicao_cpi_familia', afterMonths: 2 },
        options: [
          {
            id: 'abrir_tudo',
            label: 'Abrir os livros e pedir apuração',
            description: 'Receita, Coaf e Polícia Federal com acesso irrestrito à contabilidade da ONG.',
            warning: 'Se não houver nada, você sai maior. Se houver, você mesmo entregou a prova.',
            cost: 0,
            impacts: { corruptionPerception: 4 },
            groupImpacts: [
              { groupId: 'classe_media', delta: 1.6, reason: 'Apuração pedida pelo próprio governo.' },
              { groupId: 'mercado_financeiro', delta: 0.8, reason: 'Previsibilidade institucional.' },
            ],
            approvalDelta: -0.4,
            congressDelta: 4,
            stressDelta: 13,
          },
          {
            id: 'advogado',
            label: 'Tratar como assunto jurídico da família',
            description: 'Advogado da família responde; o Planalto não comenta.',
            warning: 'Tira o presidente do centro da cena e deixa a suspeita de pé.',
            cost: 0,
            impacts: { corruptionPerception: -2 },
            groupImpacts: [
              { groupId: 'classe_media', delta: -1, reason: 'Silêncio institucional.' },
            ],
            approvalDelta: -1.1,
            congressDelta: -1,
            stressDelta: 8,
          },
          {
            id: 'contra_atacar',
            label: 'Acusar a oposição de perseguição',
            description: 'Pronunciamento apontando o interesse político por trás da denúncia.',
            warning: 'Polariza. Você mantém a base e entrega o mês inteiro para o assunto.',
            cost: 0,
            impacts: { corruptionPerception: -5 },
            groupImpacts: [
              { groupId: 'baixa_renda', delta: 0.9, reason: 'Presidente reagiu ao ataque.' },
              { groupId: 'empresariado', delta: -1.6, reason: 'Governo mudou de assunto sem explicar.' },
            ],
            approvalDelta: -1.4,
            congressDelta: -5,
            stressDelta: 10,
          },
        ],
      };
    },
  },
  {
    id: 'dyn_filho_direcao_alcool',
    category: 'pessoal',
    severity: 'grave',
    weight: 9,
    tags: ['seguranca'],
    cooldownMonths: 14,
    canGenerate: (state) => state.family.some((member) => member.kind === 'filho'),
    build: (state, rng) => {
      const child = randomChild(state, rng);
      if (!child) return null;

      return {
        title: fill('{article} {noun} do presidente é flagrad{ending} dirigindo bêbad{ending}', {
          article: child.article,
          noun: child.noun,
          ending: child.noun === 'filha' ? 'a' : 'o',
        }),
        brief: fill(
          '{article} {noun} {name} foi flagrad{ending} dirigindo sob efeito de álcool e desacatou a autoridade policial na abordagem. O vídeo do celular de um motorista já tem milhões de visualizações. As corporações policiais esperam uma palavra sua.',
          {
            article: child.article,
            noun: child.noun,
            name: child.member.name,
            ending: child.noun === 'filha' ? 'a' : 'o',
          },
        ),
        options: [
          {
            id: 'responsabilizar',
            label: 'Que responda pelo que fez',
            description: 'Nota apoiando a autoridade policial e recusando qualquer tratamento especial.',
            warning: 'Doloroso e correto. As polícias registram, e a imprensa também.',
            cost: 0,
            impacts: { corruptionPerception: 3, homicideRate: 0 },
            groupImpacts: [
              { groupId: 'policiais', delta: 2.6, reason: 'Presidente ficou do lado da abordagem.' },
              { groupId: 'classe_media', delta: 1.4, reason: 'Lei igual para todos.' },
            ],
            approvalDelta: 0.4,
            congressDelta: 1,
            stressDelta: 14,
          },
          {
            id: 'pedir_desculpa',
            label: 'Pedir desculpas ao policial em público',
            description: 'Presidente liga para o policial desacatado e divulga o gesto.',
            warning: 'Humaniza e resolve com a corporação. Não impede a piada de circular por semanas.',
            cost: 0,
            impacts: { corruptionPerception: 2 },
            groupImpacts: [
              { groupId: 'policiais', delta: 3.2, reason: 'Reparação pública.' },
              { groupId: 'militares', delta: 0.8, reason: 'Hierarquia respeitada.' },
            ],
            approvalDelta: 0.2,
            congressDelta: 0,
            stressDelta: 10,
          },
          {
            id: 'abafar',
            label: 'Tentar abafar o caso',
            description: 'Pressão para o registro sumir e para o vídeo ser removido.',
            warning: 'Some por 48 horas. Volta com a palavra "censura" colada no seu nome.',
            cost: 0,
            impacts: { corruptionPerception: -8, businessConfidence: -2 },
            groupImpacts: [
              { groupId: 'policiais', delta: -3.4, reason: 'Pressão sobre a corporação.' },
              { groupId: 'classe_media', delta: -2.8, reason: 'Tentativa de abafamento.' },
              { groupId: 'artistas', delta: -1.6, reason: 'Remoção de vídeo por ordem política.' },
            ],
            approvalDelta: -2.6,
            congressDelta: -4,
            stressDelta: 16,
          },
        ],
      };
    },
  },
];
