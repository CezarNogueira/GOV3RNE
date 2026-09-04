import type { EntityRecord, GameState, RecognizedEntity } from '../../types/index';
import { COMPANY_ALIASES, COMPANY_BLUEPRINTS } from '../../data/companies/index';
import { MINISTRIES } from '../../data/ministries';
import { SOCIAL_GROUPS } from '../../data/social-groups';
import { NUMERIC_TARGETS } from '../../data/numeric-targets';
import { canonical, ngrams } from './text';
import { similarity } from './fuzzy';

/**
 * BANCO DE ENTIDADES
 *
 * Tudo que o jogador pode citar numa frase e que o jogo conhece: empresa,
 * pasta, área do orçamento, tributo, setor, grupo social, alvo numérico.
 *
 * A regra que sustenta este arquivo é uma só: NADA é cadastrado duas vezes. As
 * empresas vêm do banco de empresas, as pastas vêm do banco de ministérios, os
 * tributos e os orçamentos vêm do registro de alvos numéricos. Se uma empresa
 * nova entrar no jogo amanhã, ela passa a ser reconhecida no texto sem ninguém
 * tocar aqui — o que mora neste arquivo são os APELIDOS, que são informação de
 * linguagem e não existiriam em nenhum dos outros bancos.
 */

/** Apelidos que as pessoas usam e que nenhum banco de dados teria. */
const EXTRA_COMPANY_ALIASES: Record<string, string[]> = {
  petrobras: ['petro', 'petroleira', 'estatal do petroleo', 'empresa de petroleo'],
  correios: ['correio', 'empresa dos correios', 'estatal dos correios', 'empresa de correios'],
  banco_brasil: ['banco do brasil', 'bb'],
  caixa: ['caixa', 'caixa economica federal'],
  bndes: ['banco de desenvolvimento', 'banco nacional de desenvolvimento'],
  vale: ['vale', 'mineradora'],
  embrapa: ['pesquisa agropecuaria'],
  infraero: ['aeroportos', 'estatal dos aeroportos'],
  conab: ['companhia de abastecimento', 'estoques reguladores'],
  serpro: ['processamento de dados'],
  dataprev: ['dados da previdencia'],
  bradesco: ['banco bradesco'],
  santander_br: ['banco santander'],
  nubank: ['nu bank', 'banco digital'],
  mercado_livre: ['mercadolivre'],
  jbs: ['frigorifico', 'jbs friboi'],
  ambev: ['cervejaria'],
  weg: ['weg motores'],
  gerdau: ['siderurgica gerdau', 'siderurgica'],
  suzano: ['papel e celulose', 'celulose'],
  vivo: ['operadora de telefonia', 'telefonia'],
  cosan: ['grupo cosan'],
  btg: ['banco btg'],
  amazul: ['amazonia azul'],
  ceagesp: ['entreposto de sao paulo'],
  enbpar: ['empresa brasileira de participacoes'],
  embratur: ['promocao do turismo'],
};

/** Como o jogador chama cada pasta quando não usa o nome oficial. */
const MINISTRY_ALIASES: Record<string, string[]> = {
  casa_civil: ['casa civil', 'presidencia', 'palacio do planalto'],
  fazenda: ['fazenda', 'tesouro', 'receita federal', 'receita', 'ministerio da economia'],
  justica: ['justica', 'seguranca publica', 'seguranca', 'policia federal'],
  saude: ['saude', 'sus', 'hospitais publicos'],
  educacao: ['educacao', 'mec', 'escolas publicas'],
  defesa: ['defesa', 'forcas armadas', 'militares', 'exercito'],
  infraestrutura: ['infraestrutura', 'transportes', 'obras'],
  desenvolvimento_social: [
    'desenvolvimento social',
    'assistencia social',
    'programas sociais',
    'combate a pobreza',
  ],
  agricultura: ['agricultura', 'meio ambiente', 'agropecuaria'],
  relacoes_exteriores: ['relacoes exteriores', 'itamaraty', 'diplomacia', 'politica externa'],
};

/** Grupos sociais como o jogador os chama, e não como o jogo os cadastra. */
const SOCIAL_ALIASES: Record<string, string[]> = {
  baixa_renda: ['pobres', 'mais pobres', 'populacao pobre', 'baixa renda', 'familias pobres'],
  classe_media: ['classe media'],
  trabalhadores: ['trabalhadores', 'operarios', 'assalariados', 'classe trabalhadora'],
  servidores: ['servidores', 'funcionalismo', 'servidores publicos', 'funcionarios publicos'],
  empresariado: ['empresarios', 'setor privado', 'iniciativa privada', 'patroes'],
  mercado_financeiro: ['mercado financeiro', 'bancos', 'investidores'],
  agronegocio: ['agricultores', 'produtores rurais', 'agronegocio', 'fazendeiros', 'agro'],
  evangelicos: ['evangelicos', 'igrejas evangelicas'],
  catolicos: ['catolicos', 'igreja catolica'],
  policiais: ['policiais', 'policia'],
  militares: ['militares'],
  universitarios: ['universitarios', 'estudantes', 'jovens', 'juventude'],
  professores: ['professores', 'docentes'],
  caminhoneiros: ['caminhoneiros', 'motoristas de caminhao'],
  ambientalistas: ['ambientalistas', 'ecologistas'],
  artistas: ['artistas', 'classe artistica'],
  indigenas: ['indigenas', 'povos originarios'],
};

/**
 * Alvos que não são grupo do jogo nem empresa, mas que aparecem em toda frase
 * sobre política pública.
 */
const CONCEPT_ENTITIES: readonly EntityRecord[] = [
  {
    kind: 'SOCIAL_GROUP',
    id: 'pequenas_empresas',
    name: 'Pequenas empresas',
    aliases: [
      'pequenas empresas',
      'pequena empresa',
      'empresas pequenas',
      'pequenos negocios',
      'pequeno negocio',
      'microempresas',
      'microempresa',
      'mei',
      'simples nacional',
      'pequenos empresarios',
      'empreendedores',
    ],
  },
  {
    kind: 'SOCIAL_GROUP',
    id: 'grandes_empresas',
    name: 'Grandes empresas',
    aliases: ['grandes empresas', 'grandes corporacoes', 'multinacionais'],
  },
  {
    kind: 'SOCIAL_GROUP',
    id: 'aposentados',
    name: 'Aposentados',
    aliases: ['aposentados', 'idosos', 'terceira idade', 'pensionistas'],
  },
  {
    kind: 'SOCIAL_GROUP',
    id: 'desempregados',
    name: 'Desempregados',
    aliases: ['desempregados', 'sem emprego', 'sem trabalho'],
  },
  {
    kind: 'SECTOR',
    id: 'industria',
    name: 'Indústria',
    aliases: ['industria', 'setor industrial', 'fabricas'],
  },
  {
    kind: 'SECTOR',
    id: 'tecnologia',
    name: 'Tecnologia',
    aliases: ['tecnologia', 'setor de tecnologia', 'inovacao', 'startups'],
  },
  {
    kind: 'SECTOR',
    id: 'energia',
    name: 'Energia',
    aliases: ['energia', 'setor eletrico', 'geracao de energia'],
  },
  {
    kind: 'SECTOR',
    id: 'comercio',
    name: 'Comércio e serviços',
    aliases: ['comercio', 'servicos', 'varejo'],
  },
];

/** Alvos numéricos que são tributo. O resto é piso, dotação ou efetivo. */
const TAX_TARGETS = new Set([
  'irpf',
  'irpj',
  'consumoTax',
  'iof',
  'importTariff',
  'dividendTax',
  'fuelTax',
  'inssPatronal',
  'fgts',
]);

/** Junta os aliases de uma fonte com os apelidos extras, sem repetir. */
function mergeAliases(base: readonly string[], extra: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const alias of [...base, ...extra]) {
    const value = canonical(alias);
    if (value.length < 2 || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

/**
 * Monta o banco de entidades a partir dos bancos que já existem no jogo.
 *
 * Recebe o estado porque as empresas, o orçamento e os tributos da PARTIDA são
 * a fonte da verdade: uma estatal já privatizada continua reconhecível, mas com
 * os dados que ela tem hoje, não com os do catálogo de origem.
 */
export function buildEntityRegistry(state: GameState): EntityRecord[] {
  const records: EntityRecord[] = [];

  // ------------------------------------------------------------- Empresas
  const companies = state.companies?.companies?.length
    ? state.companies.companies.map((company) => ({
        id: company.id,
        name: company.name,
        control: company.control,
        stateOwnership: company.ownership.stateOwnership,
      }))
    : COMPANY_BLUEPRINTS.map((blueprint) => ({
        id: blueprint.id,
        name: blueprint.name,
        control: blueprint.control,
        stateOwnership: blueprint.stateOwnership,
      }));

  for (const company of companies) {
    records.push({
      kind: 'COMPANY',
      id: company.id,
      name: company.name,
      aliases: mergeAliases(
        [company.name, ...(COMPANY_ALIASES[company.id] ?? [])],
        EXTRA_COMPANY_ALIASES[company.id],
      ),
      meta: {
        control: company.control,
        stateOwnership: company.stateOwnership,
        estatal: company.stateOwnership > 0,
      },
    });
  }

  // -------------------------------------------------- Pastas e orçamento
  for (const ministry of MINISTRIES) {
    const budget = state.budget?.find((line) => line.ministryId === ministry.id);
    records.push({
      kind: 'BUDGET_AREA',
      id: ministry.id,
      name: budget?.label ?? ministry.shortName,
      aliases: mergeAliases(
        [ministry.shortName, ministry.name],
        MINISTRY_ALIASES[ministry.id],
      ),
      meta: {
        ministryId: ministry.id,
        allocated: budget?.allocated ?? ministry.budget,
        mandatoryShare: budget?.mandatoryShare ?? 0.5,
      },
    });
  }

  // ------------------------------------------------------- Grupos sociais
  for (const group of SOCIAL_GROUPS) {
    records.push({
      kind: 'SOCIAL_GROUP',
      id: group.id,
      name: group.name,
      aliases: mergeAliases([group.name], SOCIAL_ALIASES[group.id]),
    });
  }
  records.push(...CONCEPT_ENTITIES.map((entity) => ({ ...entity, aliases: mergeAliases(entity.aliases) })));

  // -------------------------------------------------- Alvos numéricos
  // Tributo, orçamento, piso, efetivo: tudo que já tem `read`/`write` no
  // registro numérico é endereçável por nome no texto. A separação entre
  // tributo e o resto não é cosmética: é ela que impede "aumentar o salário
  // mínimo" de ser lido como aumento de imposto só porque os dois começam com
  // o mesmo verbo.
  for (const target of NUMERIC_TARGETS) {
    records.push({
      kind: TAX_TARGETS.has(target.id) ? 'TAX' : 'NUMERIC_TARGET',
      id: target.id,
      name: target.actionLabel,
      aliases: mergeAliases([target.label, ...target.keywords]),
      meta: { unit: target.unit, category: target.category },
    });
  }

  return records;
}

/**
 * Encontra no texto todas as entidades que o jogo conhece.
 *
 * Trabalha por blocos de palavras, do maior para o menor, para que "banco do
 * brasil" seja encontrado antes de "banco", e aceita casamento aproximado:
 * "correius" chega em "correios" com confiança menor, e é essa confiança que
 * depois decide se o jogo age direto ou pergunta antes.
 */
export function findEntities(
  text: string,
  registry: readonly EntityRecord[],
  threshold = 0.84,
): RecognizedEntity[] {
  const blocks = ngrams(text);
  const found = new Map<string, RecognizedEntity>();
  const consumed: { block: string; kind: string }[] = [];

  for (const block of blocks) {
    for (const record of registry) {
      // Bloco já coberto por um casamento maior DO MESMO TIPO não é analisado
      // de novo: "brasil" dentro de "banco do brasil" não vira outra empresa.
      // Tipos diferentes continuam livres, porque "gastos da saúde" cita ao
      // mesmo tempo a pasta e o alvo numérico do orçamento dela — e as duas
      // leituras são verdadeiras.
      if (consumed.some((taken) => taken.kind === record.kind && taken.block.includes(block))) {
        continue;
      }
      let best = 0;
      let matchedAlias = '';
      for (const alias of record.aliases) {
        // Alias de várias palavras só casa contra bloco de várias palavras.
        const aliasWords = alias.split(' ').length;
        const blockWords = block.split(' ').length;
        if (Math.abs(aliasWords - blockWords) > 1) continue;

        const score = similarity(block, alias);
        if (score > best) {
          best = score;
          matchedAlias = alias;
        }
      }

      if (best < threshold) continue;

      const key = `${record.kind}:${record.id}`;
      const existing = found.get(key);
      if (existing && existing.confidence >= best) continue;

      found.set(key, {
        kind: record.kind,
        id: record.id,
        name: record.name,
        confidence: Number(best.toFixed(3)),
        matchedText: matchedAlias || block,
        ...(record.meta ? { meta: record.meta } : {}),
      });
      consumed.push({ block, kind: record.kind });
    }
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Entidades de um tipo, já ordenadas pela confiança. */
export function entitiesOfKind(
  entities: readonly RecognizedEntity[],
  kind: RecognizedEntity['kind'],
): RecognizedEntity[] {
  return entities.filter((entity) => entity.kind === kind);
}
