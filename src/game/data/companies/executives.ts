import type { CompanyControl, CompanySector } from '../../types/companies';

/**
 * QUEM DIRIGE AS EMPRESAS
 *
 * Nomes, cargos e estilos de negociação são FICTÍCIOS, como todo o elenco do
 * jogo. Nenhum executivo real do país aparece aqui, nem deve aparecer: as
 * empresas existem, as pessoas que as dirigem no jogo não.
 *
 * O perfil não é enfeite. Ele decide o que a pessoa traz para a mesa e o quanto
 * ela cede: um técnico pede previsibilidade e aceita contrapartida, um indicado
 * político pede orçamento e cobra em cargo, alguém vindo do mercado pede
 * tributo e não aceita nada em troca de nada.
 */
export type ExecutiveProfile = 'tecnico' | 'politico' | 'mercado' | 'fundador';

export const EXECUTIVE_FIRST_NAMES: readonly string[] = [
  'Adriana', 'Beatriz', 'Camila', 'Denise', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena',
  'Isabel', 'Juliana', 'Larissa', 'Mariana', 'Natália', 'Patrícia', 'Renata', 'Simone',
  'Tatiana', 'Vanessa', 'Alberto', 'Bruno', 'Caio', 'Daniel', 'Eduardo', 'Fábio',
  'Gustavo', 'Henrique', 'Ivan', 'Joaquim', 'Leandro', 'Marcelo', 'Nelson', 'Otávio',
  'Paulo', 'Rafael', 'Sérgio', 'Thiago', 'Vicente', 'Wagner',
];

export const EXECUTIVE_LAST_NAMES: readonly string[] = [
  'Albuquerque', 'Bittencourt', 'Camargo', 'Drummond', 'Esteves', 'Falcão', 'Guimarães',
  'Hollanda', 'Íntima', 'Jardim', 'Klein', 'Lacerda', 'Maranhão', 'Nogueira', 'Ourives',
  'Pontes', 'Queiroz', 'Rezende', 'Salgado', 'Tavares', 'Uchôa', 'Valadares', 'Werneck',
  'Zaluar', 'Bandeira', 'Cavalcanti', 'Dorneles', 'Farias', 'Gonçalves', 'Machado',
];

/** Como o cargo é chamado, conforme o tipo de empresa. */
export const EXECUTIVE_ROLES: Record<CompanyControl, Record<'padrao' | 'banco' | 'pesquisa', string>> = {
  federal: {
    padrao: 'presidente da estatal',
    banco: 'presidente do banco público',
    pesquisa: 'diretor-presidente',
  },
  privada: {
    padrao: 'presidente-executivo',
    banco: 'presidente do banco',
    pesquisa: 'diretor-geral',
  },
};

/**
 * Estilos de negociação por perfil. A frase aparece na ficha da reunião e
 * explica ao jogador com quem ele está falando antes de ele decidir.
 */
export const EXECUTIVE_TRAITS: Record<ExecutiveProfile, string[]> = {
  tecnico: [
    'Vem com planilha, cronograma e a mesma resposta para todo mundo.',
    'Não promete o que não cabe no orçamento da empresa.',
    'Prefere regra clara a favor pontual, e diz isso na cara do governo.',
  ],
  politico: [
    'Conhece o Congresso melhor que o balanço, e usa isso.',
    'Chega com o número de empregos da região antes do número do resultado.',
    'Nunca sai de uma sala sem ter pedido alguma coisa.',
  ],
  mercado: [
    'Fala em margem, múltiplo e acionista, nesta ordem.',
    'Compara o Brasil com o país vizinho toda vez que pede alguma coisa.',
    'Aceita contrapartida, desde que ela caiba no relatório trimestral.',
  ],
  fundador: [
    'Trata a empresa como coisa própria, porque em grande parte é.',
    'Decide na hora e cobra a mesma agilidade do governo.',
    'Tem paciência curta para reunião que não termina em decisão.',
  ],
};

/**
 * Perfil típico de quem dirige cada setor no ponto de partida. É só o ponto de
 * partida: nomear uma direção nova troca a pessoa e o perfil junto.
 */
export const SECTOR_PROFILE: Record<CompanySector, ExecutiveProfile> = {
  petroleo_gas: 'tecnico',
  energia: 'tecnico',
  mineracao: 'mercado',
  siderurgia: 'fundador',
  financeiro: 'mercado',
  alimentos: 'fundador',
  bebidas: 'mercado',
  papel_celulose: 'tecnico',
  bens_de_capital: 'fundador',
  tecnologia: 'tecnico',
  telecomunicacoes: 'mercado',
  logistica: 'politico',
  agropecuaria: 'fundador',
  pesquisa: 'tecnico',
  turismo: 'politico',
  varejo: 'mercado',
  nuclear: 'tecnico',
  abastecimento: 'politico',
};
