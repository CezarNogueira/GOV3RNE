import type {
  ActiveEvent,
  BillDecision,
  BillDecisionKind,
  BillOrigin,
  Consequence,
  EventOption,
  GameState,
  GroupImpact,
  PartyBloc,
  PolicyCategory,
  PolicyImpact,
} from '../types/index';
import { BILL_BY_ID, BILL_CATALOG, type BillTemplate } from '../data/bills';
import { FIRST_NAMES, LAST_NAMES } from '../data/people';
import { PARTY_BY_ID, TOTAL_CHAMBER_SEATS, TOTAL_SENATE_SEATS } from '../data/parties';
import { looksFeminine } from '../data/portraits';
import { applyImpacts } from './policy';
import { nudgeGroup } from './social';
import { nudgeApproval } from './approval';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { makeId } from '../utils/id';

/**
 * SANÇÃO E VETO
 *
 * A maior parte do que chega à mesa de um presidente não é crise: é o que o
 * Congresso aprovou. Projeto de deputado, de senador, de comissão, de tribunal
 * ou de iniciativa popular, votado nas duas Casas e mandado para sanção. O rito
 * é o do art. 66 da Constituição, e o jogo o segue:
 *
 *   sancionar          vira lei com a assinatura do presidente;
 *   deixar o prazo     15 dias úteis de silêncio valem sanção (tácita);
 *   vetar em parte     o resto vira lei, e o trecho vetado volta ao Congresso;
 *   vetar tudo         nada vira lei — até o Congresso analisar o veto.
 *
 * O veto não é a última palavra. O Congresso tem 30 dias para analisá-lo em
 * sessão conjunta e o derruba com maioria absoluta das duas Casas: 257
 * deputados e 41 senadores. Projeto aprovado por placar folgado, contra um
 * governo de base fraca e impopular, costuma ter o veto derrubado — e aí vira
 * lei do mesmo jeito, com a derrota política na conta do presidente.
 */

/** Fração dos meses com agenda em que o assunto é um projeto de lei. */
export const BILL_SHARE = 0.65;

/** Meses até o mesmo tipo de projeto voltar a ser aprovado. */
const BILL_COOLDOWN_MONTHS = 30;

const MAIORIA_ABSOLUTA_CAMARA = Math.floor(TOTAL_CHAMBER_SEATS / 2) + 1;
const MAIORIA_ABSOLUTA_SENADO = Math.floor(TOTAL_SENATE_SEATS / 2) + 1;

/** Quem apresenta projeto de lei no Brasil, e com que frequência. */
const PESO_ORIGEM: Record<BillOrigin, number> = {
  deputado: 0.56,
  senador: 0.26,
  comissao: 0.08,
  popular: 0.05,
  judiciario: 0.05,
};

const COMISSAO: Record<PolicyCategory, string> = {
  economia: 'da Comissão de Finanças e Tributação da Câmara',
  saude: 'da Comissão de Saúde da Câmara',
  educacao: 'da Comissão de Educação do Senado',
  seguranca: 'da Comissão de Segurança Pública da Câmara',
  infraestrutura: 'da Comissão de Infraestrutura do Senado',
  social: 'da Comissão de Assuntos Sociais do Senado',
  meio_ambiente: 'da Comissão de Meio Ambiente do Senado',
  institucional: 'da Comissão de Constituição e Justiça do Senado',
  diplomacia: 'da Comissão de Relações Exteriores do Senado',
  agricultura: 'da Comissão de Agricultura da Câmara',
  trabalho: 'da Comissão de Trabalho da Câmara',
  cultura: 'da Comissão de Cultura da Câmara',
};

const JUDICIARIO: readonly string[] = [
  'do Superior Tribunal de Justiça',
  'do Conselho da Justiça Federal',
  'do Tribunal Superior do Trabalho',
  'da Procuradoria-Geral da República',
];

/** Quanto o partido do autor muda de humor com cada decisão. */
const REACAO_DO_AUTOR: Record<BillDecisionKind, number> = {
  sancao: 4,
  sancao_tacita: 1.5,
  veto_parcial: -2,
  veto_total: -6,
};

function congressoFunciona(state: GameState): boolean {
  return state.regime?.congressStatus !== 'suspenso';
}

function definitionId(template: BillTemplate): string {
  return 'pl_' + template.id;
}

function disponiveis(state: GameState): BillTemplate[] {
  const cooldowns = state.flags.eventCooldowns ?? {};
  return BILL_CATALOG.filter((template) => {
    const id = definitionId(template);
    if (state.pendingEvents.some((event) => event.definitionId === id)) return false;
    const ultimo = cooldowns[id];
    return ultimo === undefined || state.month - ultimo >= BILL_COOLDOWN_MONTHS;
  });
}

/** Posição do partido no eixo esquerda (-100) — direita (+100). */
function posicao(partyId: string): number {
  const party = PARTY_BY_ID[partyId];
  if (!party) return 0;
  return (party.ideology.economic + party.ideology.social) / 2;
}

/**
 * Quanto um partido tende a assinar um projeto daquele lado do espectro.
 * Suprapartidário vem de qualquer um, com mais frequência do centro que
 * controla a pauta.
 */
function afinidade(bloc: PartyBloc, espectro: BillTemplate['espectro']): number {
  if (espectro === 0) return PARTY_BY_ID[bloc.partyId]?.centrao ? 1.6 : 1;
  const mesmoLado = espectro * posicao(bloc.partyId);
  return clamp(0.15 + Math.max(0, mesmoLado) / 45, 0.15, 3);
}

function escolherBloco(
  state: GameState,
  rng: Rng,
  casa: 'camara' | 'senado',
  espectro: BillTemplate['espectro'],
): PartyBloc | null {
  const assentos = (bloc: PartyBloc) => (casa === 'camara' ? bloc.chamberSeats : bloc.senateSeats);
  const pool = state.congress.blocs.filter((bloc) => assentos(bloc) >= (casa === 'camara' ? 3 : 1));
  if (pool.length === 0) return null;
  return rng.weighted(pool, (bloc) => assentos(bloc) * afinidade(bloc, espectro));
}

interface Autoria {
  frase: string;
  origem: BillOrigin;
  partyId: string | null;
  nome: string;
}

function montarAutoria(state: GameState, rng: Rng, template: BillTemplate): Autoria | null {
  const origem = rng.weighted(template.origens, (entry) => PESO_ORIGEM[entry]);

  if (origem === 'deputado' || origem === 'senador') {
    const bloco = escolherBloco(state, rng, origem === 'deputado' ? 'camara' : 'senado', template.espectro);
    if (!bloco) return null;
    const nome = rng.pick(FIRST_NAMES) + ' ' + rng.pick(LAST_NAMES);
    const uf =
      state.states.length > 0
        ? rng.weighted(state.states, (unit) => Math.max(1, unit.chamberSeats)).id
        : 'DF';
    const sigla = PARTY_BY_ID[bloco.partyId]?.acronym ?? bloco.partyId;
    const feminino = looksFeminine(nome);
    const cargo =
      origem === 'deputado' ? (feminino ? 'da deputada' : 'do deputado') : feminino ? 'da senadora' : 'do senador';
    return {
      frase: 'de autoria ' + cargo + ' ' + nome + ' (' + sigla + '-' + uf + ')',
      origem,
      partyId: bloco.partyId,
      nome,
    };
  }

  if (origem === 'comissao') {
    return { frase: 'de autoria ' + COMISSAO[template.tema], origem, partyId: null, nome: '' };
  }

  if (origem === 'popular') {
    // Iniciativa popular exige 1% do eleitorado, espalhado por pelo menos
    // cinco estados (Constituição, art. 61, § 2º).
    const milhoes = round(rng.range(1.6, 3.6), 1);
    const estados = rng.int(5, 27);
    return {
      frase:
        'de iniciativa popular, com ' +
        milhoes.toLocaleString('pt-BR') +
        ' milhões de assinaturas recolhidas em ' +
        estados +
        ' estados',
      origem,
      partyId: null,
      nome: '',
    };
  }

  return { frase: 'de autoria ' + rng.pick(JUDICIARIO), origem, partyId: null, nome: '' };
}

/** Placar de uma votação que passou: sempre com mais "sim" que "não". */
function placar(rng: Rng, apoio: number, casa: 'camara' | 'senado'): { sim: number; nao: number } {
  const presentes = casa === 'camara' ? rng.int(418, 489) : rng.int(66, 79);
  const sim = Math.round(presentes * clamp(apoio / 100 + rng.noise(0.04), 0.52, 0.99));
  const abstencoes = casa === 'camara' ? rng.int(0, 6) : rng.int(0, 2);
  return { sim, nao: Math.max(0, presentes - sim - abstencoes) };
}

function escalar(impacts: PolicyImpact, fator: number): PolicyImpact {
  const saida: Record<string, number> = {};
  for (const [campo, valor] of Object.entries(impacts as Record<string, number>)) {
    if (typeof valor === 'number') saida[campo] = round(valor * fator, 4);
  }
  return saida as PolicyImpact;
}

function escalarGrupos(grupos: GroupImpact[], fator: number): GroupImpact[] {
  return grupos.map((grupo) => ({ ...grupo, delta: round(grupo.delta * fator, 2) }));
}

function textoFiscal(impacts: PolicyImpact): string {
  const anual = impacts.primaryBalance ?? 0;
  if (anual < 0) return 'Custa cerca de R$ ' + Math.abs(anual).toLocaleString('pt-BR') + ' bi por ano ao Tesouro. ';
  if (anual > 0) return 'Rende cerca de R$ ' + anual.toLocaleString('pt-BR') + ' bi por ano ao Tesouro. ';
  return '';
}

function montarOpcoes(
  template: BillTemplate,
  base: Omit<BillDecision, 'kind' | 'vetoedShare'>,
): EventOption[] {
  const apoioMedio = (template.apoioCamara + template.apoioSenado) / 2;
  const vencedores = template.grupos.filter((grupo) => grupo.delta > 0);
  const perdedores = template.grupos.filter((grupo) => grupo.delta < 0);
  const risco =
    template.riscoConstitucional >= 50 ? 'A AGU avisa que a lei tende a ser suspensa no Supremo. ' : '';

  return [
    {
      id: 'sancionar',
      label: 'Sancionar',
      description: 'Assinar a lei como veio do Congresso.',
      warning: textoFiscal(template.impacts) + risco + 'O autor e o Congresso dividem a vitória com você.',
      cost: 0,
      impacts: template.impacts,
      groupImpacts: template.grupos,
      approvalDelta: round(template.apeloPopular * 0.25, 2),
      congressDelta: 2,
      stressDelta: 3,
      bill: { ...base, kind: 'sancao', vetoedShare: 0 },
    },
    {
      id: 'vetar_parcial',
      label: 'Vetar em parte',
      description: 'Sancionar o texto e vetar ' + template.vetoParcial + '.',
      warning:
        'Metade do efeito vira lei agora. O Congresso tem 30 dias para analisar o veto e pode derrubá-lo com 257 deputados e 41 senadores.',
      cost: 0,
      impacts: escalar(template.impacts, 0.5),
      groupImpacts: escalarGrupos(template.grupos, 0.5),
      approvalDelta: round(template.apeloPopular * 0.08 - 0.2, 2),
      congressDelta: -round(1 + apoioMedio * 0.03, 1),
      stressDelta: 5,
      bill: { ...base, kind: 'veto_parcial', vetoedShare: 0.5 },
    },
    {
      id: 'vetar_total',
      label: 'Vetar integralmente',
      description: 'Vetar o projeto inteiro, por inconstitucionalidade ou contrariedade ao interesse público.',
      warning:
        'Aprovado por ' +
        base.chamberYes +
        ' deputados e ' +
        base.senateYes +
        ' senadores, o projeto volta ao Congresso, que pode derrubar o veto e fazer a lei valer mesmo assim.',
      cost: 0,
      impacts: {},
      groupImpacts: [
        ...vencedores.map((grupo) => ({
          groupId: grupo.groupId,
          delta: -round(grupo.delta * 0.5, 2),
          reason: 'Veto ao ' + template.apelido,
        })),
        ...perdedores.map((grupo) => ({
          groupId: grupo.groupId,
          delta: round(Math.abs(grupo.delta) * 0.4, 2),
          reason: 'Veto segurou o ' + template.apelido,
        })),
      ],
      approvalDelta: -round(template.apeloPopular * 0.2, 2),
      congressDelta: -round(2 + apoioMedio * 0.06, 1),
      stressDelta: 7,
      bill: { ...base, kind: 'veto_total', vetoedShare: 1 },
    },
    {
      id: 'deixar_prazo',
      label: 'Deixar o prazo correr',
      description: 'Não sancionar nem vetar: depois de 15 dias úteis, a lei é sancionada tacitamente.',
      warning:
        'A lei entra em vigor do mesmo jeito, promulgada pelo presidente do Congresso. Você evita a foto da assinatura, mas não a conta.',
      cost: 0,
      impacts: template.impacts,
      groupImpacts: template.grupos,
      approvalDelta: round(template.apeloPopular * 0.08, 2),
      congressDelta: 0.5,
      stressDelta: 1,
      bill: { ...base, kind: 'sancao_tacita', vetoedShare: 0 },
    },
  ];
}

/** Há projeto aprovado esperando a mesa do presidente neste mês? */
export function billAvailable(state: GameState): boolean {
  return congressoFunciona(state) && disponiveis(state).length > 0;
}

/**
 * Monta o pedido de sanção de um projeto aprovado pelo Congresso.
 *
 * `templateId` força um projeto específico; sem ele, o projeto é sorteado
 * entre os que não foram votados nos últimos meses.
 */
export function buildBillEvent(state: GameState, rng: Rng, templateId?: string): ActiveEvent | null {
  if (!congressoFunciona(state)) return null;
  const forcado = templateId ? BILL_BY_ID[templateId] : undefined;
  const pool = forcado ? [forcado] : disponiveis(state);
  if (pool.length === 0) return null;

  const template = forcado ?? rng.pick(pool);
  const autoria = montarAutoria(state, rng, template);
  if (!autoria) return null;

  const camara = placar(rng, template.apoioCamara, 'camara');
  const senado = placar(rng, template.apoioSenado, 'senado');
  const anoAtual = state.startYear + Math.floor((Math.max(1, state.month) - 1) / 12);
  const numero = 'PL ' + rng.int(120, 5899).toLocaleString('pt-BR') + '/' + (anoAtual - rng.int(0, 2));

  const base: Omit<BillDecision, 'kind' | 'vetoedShare'> = {
    templateId: template.id,
    numero,
    apelido: template.apelido,
    authorPartyId: autoria.partyId,
    chamberYes: camara.sim,
    senateYes: senado.sim,
    riscoConstitucional: template.riscoConstitucional,
    lawImpacts: template.impacts,
    lawGroups: template.grupos,
  };

  const brief =
    'O ' +
    numero +
    ', ' +
    autoria.frase +
    ', ' +
    template.ementa +
    '. Passou na Câmara por ' +
    camara.sim +
    ' a ' +
    camara.nao +
    ' e no Senado por ' +
    senado.sim +
    ' a ' +
    senado.nao +
    '. ' +
    template.pareceres +
    ' O prazo para sancionar ou vetar é de 15 dias úteis.';

  (state.flags.eventCooldowns ??= {})[definitionId(template)] = state.month;

  return {
    id: makeId('evt', rng),
    definitionId: definitionId(template),
    month: state.month,
    title: 'Sanção ou veto: ' + template.apelido,
    brief,
    category: 'congresso',
    severity: template.severidade,
    options: montarOpcoes(template, base),
    defaultOptionId: 'deixar_prazo',
    bill: {
      numero,
      apelido: template.apelido,
      autoria: autoria.frase,
      origem: autoria.origem,
      placarCamara: camara.sim + ' a ' + camara.nao,
      placarSenado: senado.sim + ' a ' + senado.nao,
    },
  };
}

/**
 * O que a decisão sobre o projeto faz além dos efeitos da lei.
 *
 * O partido do autor cobra ou agradece, lei de constitucionalidade duvidosa
 * azeda a relação com o Supremo, e todo veto entra na fila da sessão conjunta
 * do mês seguinte.
 */
export function applyBillDecision(state: GameState, decision: BillDecision): void {
  if (decision.authorPartyId) {
    const bloco = state.congress.blocs.find((bloc) => bloc.partyId === decision.authorPartyId);
    if (bloco) bloco.support = round(clamp(bloco.support + REACAO_DO_AUTOR[decision.kind], -100, 100), 1);
  }

  if (decision.riscoConstitucional >= 50) {
    const corte = state.government.supremeCourt;
    if (decision.kind === 'sancao' || decision.kind === 'sancao_tacita') {
      corte.relation = round(clamp100(corte.relation - 2), 1);
    } else if (decision.kind === 'veto_total') {
      corte.relation = round(clamp100(corte.relation + 1.5), 1);
    }
  }

  if (decision.kind === 'veto_parcial' || decision.kind === 'veto_total') {
    (state.flags.pendingVetoes ??= []).push({
      numero: decision.numero,
      apelido: decision.apelido,
      kind: decision.kind,
      dueMonth: state.month + 1,
      chamberYes: decision.chamberYes,
      senateYes: decision.senateYes,
      authorPartyId: decision.authorPartyId,
      lawImpacts: decision.lawImpacts,
      lawGroups: decision.lawGroups,
      vetoedShare: decision.vetoedShare,
    });
  }
}

/**
 * A SESSÃO CONJUNTA
 *
 * Quem votou "sim" no projeto é o ponto de partida da derrubada. Uma parte
 * volta atrás por lealdade ao governo, e essa parte é maior quando a base é
 * grande, a boa vontade com o Planalto é alta e o presidente está popular. O
 * resto vota de novo como votou. Se isso passar de 257 deputados e 41
 * senadores, o veto cai.
 */
export function processVetoes(state: GameState, rng: Rng): { notes: string[]; consequences: Consequence[] } {
  const pendentes = state.flags.pendingVetoes ?? [];
  const vencidos = pendentes.filter((veto) => veto.dueMonth <= state.month);
  if (vencidos.length === 0) return { notes: [], consequences: [] };
  state.flags.pendingVetoes = pendentes.filter((veto) => veto.dueMonth > state.month);

  const notes: string[] = [];
  const consequences: Consequence[] = [];

  for (const veto of vencidos) {
    if (!congressoFunciona(state)) {
      notes.push('Sem Congresso funcionando, o veto ao ' + veto.apelido + ' não foi analisado e ficou mantido.');
      continue;
    }

    const base = clamp(state.congress.governmentSeatsChamber / TOTAL_CHAMBER_SEATS, 0, 1);
    const pressao =
      0.8 +
      (55 - state.congress.goodwill) * 0.004 +
      (50 - state.approval.overall) * 0.003 -
      base * 0.2;
    const deputados = Math.round(veto.chamberYes * clamp(pressao + rng.noise(0.05), 0.3, 1.08));
    const senadores = Math.round(veto.senateYes * clamp(pressao + rng.noise(0.05), 0.3, 1.08));
    const derrubado = deputados >= MAIORIA_ABSOLUTA_CAMARA && senadores >= MAIORIA_ABSOLUTA_SENADO;

    if (derrubado) {
      applyImpacts(state, veto.lawImpacts, veto.vetoedShare);
      for (const grupo of veto.lawGroups) {
        nudgeGroup(state.socialGroups, grupo.groupId, grupo.delta * veto.vetoedShare);
      }
      nudgeApproval(state, -1.2);
      state.congress.goodwill = round(clamp100(state.congress.goodwill - 3), 1);
      if (veto.authorPartyId) {
        const bloco = state.congress.blocs.find((bloc) => bloc.partyId === veto.authorPartyId);
        if (bloco) bloco.support = round(clamp(bloco.support - 2, -100, 100), 1);
      }
    } else {
      state.congress.goodwill = round(clamp100(state.congress.goodwill - 1), 1);
    }

    const titulo = derrubado
      ? 'Congresso derruba o veto: ' + veto.apelido
      : 'Veto mantido: ' + veto.apelido;
    const corpo = derrubado
      ? 'Em sessão conjunta, ' +
        deputados +
        ' deputados e ' +
        senadores +
        ' senadores votaram pela derrubada, acima dos ' +
        MAIORIA_ABSOLUTA_CAMARA +
        ' e ' +
        MAIORIA_ABSOLUTA_SENADO +
        ' necessários. ' +
        (veto.kind === 'veto_total' ? 'O projeto inteiro vira lei.' : 'O trecho vetado volta a valer.') +
        ' A derrota fica na conta do Planalto.'
      : 'A derrubada teve ' +
        deputados +
        ' votos na Câmara e ' +
        senadores +
        ' no Senado, abaixo da maioria absoluta exigida (' +
        MAIORIA_ABSOLUTA_CAMARA +
        ' e ' +
        MAIORIA_ABSOLUTA_SENADO +
        '). O veto fica de pé.';

    notes.push(titulo + '.');
    consequences.push({
      id: makeId('cons', rng),
      sourceId: 'veto_' + veto.numero,
      sourceLabel: veto.numero,
      title: titulo,
      body: corpo,
      month: state.month,
      kind: derrubado ? 'cobranca' : 'colheita',
      impacts: {},
      // Os efeitos já foram aplicados acima; a consequência é o registro.
      approvalDelta: 0,
    });
  }

  return { notes, consequences };
}
