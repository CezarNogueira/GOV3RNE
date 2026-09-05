/**
 * QUEM COMPRA A ESTATAL
 *
 * Privatização sem comprador é transferência para o vácuo: o Estado sai e
 * ninguém entra, e aí a empresa continua sendo problema de quem a vendeu. Aqui
 * mora o banco de controladores que assumem o ativo no leilão.
 *
 * O perfil do comprador não é enfeite — ele decide como a empresa se comporta
 * depois. Fundo corta custo e paga dividendo; grupo estrangeiro traz capital e
 * ganha manchete xenófoba; grupo nacional é mais lento e mais político;
 * capital pulverizado não tem dono para chamar ao Planalto.
 *
 * Todos são fictícios, como o resto do elenco do jogo.
 */

export type BuyerKind = 'fundo' | 'grupo_nacional' | 'grupo_estrangeiro' | 'pulverizado';

export const BUYER_KIND_LABEL: Record<BuyerKind, string> = {
  fundo: 'Fundo de investimento',
  grupo_nacional: 'Grupo nacional',
  grupo_estrangeiro: 'Grupo estrangeiro',
  pulverizado: 'Capital pulverizado',
};

export interface BuyerProfile {
  id: string;
  name: string;
  kind: BuyerKind;
  /** Como a imprensa apresenta o novo dono na primeira manchete. */
  note: string;
  /**
   * Como o controlador conduz a empresa, 0-100 cada:
   *   costCutting   disposição de cortar quadro e investimento para achar margem;
   *   capital       fôlego para bancar prejuízo antes de encolher a operação;
   *   dividend      pressa em transformar lucro em dividendo.
   */
  costCutting: number;
  capital: number;
  dividend: number;
}

export const BUYER_POOL: readonly BuyerProfile[] = [
  {
    id: 'buyer_atlantica',
    name: 'Atlântica Capital',
    kind: 'fundo',
    note: 'fundo brasileiro conhecido por comprar empresa cansada, cortar tudo que dá e vender em cinco anos',
    costCutting: 88,
    capital: 52,
    dividend: 82,
  },
  {
    id: 'buyer_verdemar',
    name: 'Grupo Verdemar',
    kind: 'grupo_nacional',
    note: 'conglomerado familiar do interior paulista, com trânsito no Congresso e paciência para prejuízo',
    costCutting: 46,
    capital: 68,
    dividend: 44,
  },
  {
    id: 'buyer_north_ridge',
    name: 'North Ridge Holdings',
    kind: 'grupo_estrangeiro',
    note: 'holding norte-americana que já opera no setor em outros três países',
    costCutting: 71,
    capital: 86,
    dividend: 66,
  },
  {
    id: 'buyer_meridian',
    name: 'Meridian Partners',
    kind: 'fundo',
    note: 'fundo de private equity que promete profissionalizar a gestão e não promete manter emprego',
    costCutting: 82,
    capital: 61,
    dividend: 74,
  },
  {
    id: 'buyer_kaisho',
    name: 'Kaisho Industrial',
    kind: 'grupo_estrangeiro',
    note: 'grupo industrial asiático interessado na base de ativos, não no nome da empresa',
    costCutting: 58,
    capital: 90,
    dividend: 38,
  },
  {
    id: 'buyer_bandeirante',
    name: 'Holding Bandeirante',
    kind: 'grupo_nacional',
    note: 'grupo nacional que cresceu comprando concessão pública e sabe negociar com governo',
    costCutting: 62,
    capital: 57,
    dividend: 58,
  },
  {
    id: 'buyer_mercado',
    name: 'Pulverizado em bolsa',
    kind: 'pulverizado',
    note: 'sem controlador definido: o capital ficou espalhado entre fundos, estrangeiros e pessoa física',
    costCutting: 54,
    capital: 44,
    dividend: 70,
  },
];

export function buyerById(id: string): BuyerProfile | undefined {
  return BUYER_POOL.find((entry) => entry.id === id);
}
