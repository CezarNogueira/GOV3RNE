/**
 * ONDE O PRESIDENTE GASTA O PRÓPRIO DINHEIRO
 *
 * Tudo aqui sai da conta pessoal, e não do Tesouro. São quatro prateleiras:
 *
 *   restaurante e lazer — gasto de uma vez, repetível uma vez por mês, que tira
 *   estresse e melhora o humor;
 *   carro e imóvel — bem que fica no nome do presidente, cobra manutenção todo
 *   mês e pode ser vendido depois.
 *
 * Cada item tem uma LEITURA PÚBLICA (`tier`): de gesto popular a ostentação. É
 * ela que decide se a compra passa em silêncio, sai numa nota de coluna ou vira
 * manchete e custa aprovação.
 *
 * Preços de referência de 2026, arredondados: tabela das montadoras para carro
 * zero, anúncio médio do bairro para imóvel e conta típica para restaurante.
 */

export type PersonalShopCategory = 'restaurante' | 'lazer' | 'carro' | 'imovel';

/** Como o país lê o gasto. */
export type PersonalSpendingTier = 'popular' | 'discreto' | 'confortavel' | 'luxo' | 'ostentacao';

export type PersonalCarBrand =
  | 'Fiat'
  | 'Ford'
  | 'Chevrolet'
  | 'Volkswagen'
  | 'BMW'
  | 'Mercedes-Benz'
  | 'Ferrari';

export type PersonalPropertyKind = 'apartamento' | 'casa' | 'triplex' | 'rural';

export const PERSONAL_CAR_BRANDS: readonly PersonalCarBrand[] = [
  'Fiat',
  'Ford',
  'Chevrolet',
  'Volkswagen',
  'BMW',
  'Mercedes-Benz',
  'Ferrari',
];

export const PERSONAL_PROPERTY_KINDS: readonly { id: PersonalPropertyKind; label: string }[] = [
  { id: 'apartamento', label: 'Apartamentos' },
  { id: 'casa', label: 'Casas' },
  { id: 'triplex', label: 'Triplex e coberturas' },
  { id: 'rural', label: 'Sítios e fazendas' },
];

interface PersonalShopItemBase {
  id: string;
  name: string;
  /** Linha técnica: motor e potência, metragem e quartos, endereço. */
  detail: string;
  price: number;
  tier: PersonalSpendingTier;
  /** A frase do cartão. */
  blurb: string;
  /** Grupos que gostam da compra apesar do preço — o agro com a picape, por exemplo. */
  groupBonus?: Record<string, number>;
}

export interface PersonalExperienceItem extends PersonalShopItemBase {
  category: 'restaurante' | 'lazer';
  effects: {
    stress: number;
    mood: number;
    energy?: number;
    health?: number;
    /** Alívio para quem mora com o presidente, quando há cônjuge. */
    spouseStress?: number;
  };
}

export interface PersonalCarItem extends PersonalShopItemBase {
  category: 'carro';
  brand: PersonalCarBrand;
  /** IPVA, seguro e revisão, por mês. */
  monthlyCost: number;
  /** O gosto de ter o carro na garagem, por mês. */
  monthlyMood: number;
  /** Carro antigo de coleção: não desvaloriza, valoriza. */
  collectible?: boolean;
}

export interface PersonalPropertyItem extends PersonalShopItemBase {
  category: 'imovel';
  kind: PersonalPropertyKind;
  city: string;
  /** Condomínio, IPTU e caseiro, por mês. */
  monthlyCost: number;
  /** Negativo alivia: casa de praia, de campo e sítio são refúgio. */
  monthlyStress: number;
  /** Compra que a política brasileira não deixa passar sem lembrar de alguma coisa. */
  politicalMemory?: string;
}

export type PersonalShopItem = PersonalExperienceItem | PersonalCarItem | PersonalPropertyItem;

// ---------------------------------------------------------------------------
// Restaurantes e lazer
// ---------------------------------------------------------------------------
function experiencia(
  category: PersonalExperienceItem['category'],
  id: string,
  name: string,
  detail: string,
  price: number,
  tier: PersonalSpendingTier,
  blurb: string,
  effects: PersonalExperienceItem['effects'],
): PersonalExperienceItem {
  return { category, id, name, detail, price, tier, blurb, effects };
}

const RESTAURANTES: PersonalExperienceItem[] = [
  experiencia('restaurante', 'restaurante_pastel', 'Pastel e caldo de cana na feira', 'Feira da Torre de TV, Brasília (DF)', 60, 'popular',
    'Guardanapo engordurado e foto espontânea com o pasteleiro. Presidente de feira ainda é notícia boa.',
    { stress: -2, mood: 3 }),
  experiencia('restaurante', 'restaurante_nordestino', 'Carne de sol e baião de dois', 'Restaurante nordestino na Ceilândia (DF)', 180, 'popular',
    'Macaxeira, manteiga de garrafa e fila na porta. A periferia viu o presidente sentar na mesma mesa.',
    { stress: -3, mood: 4 }),
  experiencia('restaurante', 'restaurante_boteco', 'Chope e bolinho de bacalhau no boteco', 'Asa Norte, Brasília (DF)', 240, 'discreto',
    'Mesa de canto, garçom antigo e uma conversa que, por duas horas, não é sobre governo.',
    { stress: -4, mood: 4 }),
  experiencia('restaurante', 'restaurante_churrascaria', 'Rodízio na churrascaria com a família', 'Setor de Clubes Sul, Brasília (DF)', 780, 'discreto',
    'Picanha, costela e filho pedindo sobremesa. Uma noite comum — que no cargo não é pouca coisa.',
    { stress: -4, mood: 5, health: -0.2, spouseStress: -3 }),
  experiencia('restaurante', 'restaurante_omakase', 'Omakase de doze tempos', 'Balcão de oito lugares no Lago Sul (DF)', 2_400, 'confortavel',
    'Peixe que chegou de avião pela manhã e um sushiman que não pergunta nada sobre a reforma tributária.',
    { stress: -5, mood: 6 }),
  experiencia('restaurante', 'restaurante_fasano', 'Jantar no Fasano', 'Jardins, São Paulo (SP)', 4_800, 'luxo',
    'Garçom de smoking, carta de vinhos de quarenta páginas e um fotógrafo esperando na calçada.',
    { stress: -6, mood: 8, energy: -3 }),
  experiencia('restaurante', 'restaurante_dom', 'Menu degustação no D.O.M.', 'Jardins, São Paulo (SP)', 8_500, 'luxo',
    'Formiga amazônica, priprioca e uma conta que vai sair na coluna de amanhã.',
    { stress: -6, mood: 10, energy: -3 }),
];

const LAZER: PersonalExperienceItem[] = [
  experiencia('lazer', 'lazer_cinema', 'Cinema com a família no shopping', 'Sessão das oito, Brasília (DF)', 280, 'discreto',
    'Pipoca grande, sala escura e três seguranças na fileira de trás.',
    { stress: -3, mood: 4, spouseStress: -3 }),
  experiencia('lazer', 'lazer_terapia', 'Um mês de terapia', 'Duas sessões por semana no Alvorada', 2_400, 'discreto',
    'Ninguém fica sabendo — e é exatamente por isso que funciona.',
    { stress: -10, mood: 3 }),
  experiencia('lazer', 'lazer_futebol', 'Clássico no Mané Garrincha, de camarote', 'Estádio Nacional, Brasília (DF)', 3_200, 'confortavel',
    'Camisa do time por baixo do terno e o telão mostrando você no intervalo. Vaia e aplauso na mesma medida.',
    { stress: -5, mood: 7 }),
  experiencia('lazer', 'lazer_personal', 'Personal trainer por um mês', 'Treino às 6h em volta do espelho d’água', 4_000, 'discreto',
    'Acordar antes da agenda para suar antes de apanhar do Congresso.',
    { stress: -3, mood: 2, energy: 6, health: 0.8 }),
  experiencia('lazer', 'lazer_pirenopolis', 'Fim de semana em Pirenópolis', 'Pousada de pedra em Pirenópolis (GO)', 6_500, 'confortavel',
    'Cachoeira e celular sem sinal — o que a Casa Civil chama de crise.',
    { stress: -9, mood: 7, energy: 6, spouseStress: -6 }),
  experiencia('lazer', 'lazer_noronha', 'Cinco dias em Fernando de Noronha', 'Pousada pé na areia, Fernando de Noronha (PE)', 38_000, 'luxo',
    'Mergulho, pôr do sol no Boldró e a foto da comitiva na praia rodando no grupo da oposição.',
    { stress: -15, mood: 12, energy: 10, spouseStress: -10 }),
  experiencia('lazer', 'lazer_portugal', 'Dez dias de férias em Portugal', 'Lisboa e Algarve', 95_000, 'ostentacao',
    'O vice assume, a oposição conta os dias e o país vê uma foto sua de chapéu em Cascais.',
    { stress: -20, mood: 14, energy: 14, spouseStress: -12 }),
];

// ---------------------------------------------------------------------------
// Carros
// ---------------------------------------------------------------------------
const HUMOR_DA_GARAGEM: Record<PersonalSpendingTier, number> = {
  popular: 0.2,
  discreto: 0.1,
  confortavel: 0.3,
  luxo: 0.6,
  ostentacao: 1,
};

/** A leitura pública de um carro sai do preço — e da marca, que o eleitor reconhece de longe. */
function leituraDoCarro(brand: PersonalCarBrand, price: number): PersonalSpendingTier {
  if (brand === 'Ferrari' || price >= 1_500_000) return 'ostentacao';
  if (brand === 'BMW' || brand === 'Mercedes-Benz' || price >= 450_000) return 'luxo';
  if (price >= 150_000) return 'confortavel';
  return 'discreto';
}

function carro(
  brand: PersonalCarBrand,
  id: string,
  name: string,
  detail: string,
  price: number,
  blurb: string,
  extra: { tier?: PersonalSpendingTier; collectible?: boolean; groupBonus?: Record<string, number> } = {},
): PersonalCarItem {
  const tier = extra.tier ?? leituraDoCarro(brand, price);
  return {
    category: 'carro',
    brand,
    id,
    name,
    detail,
    price,
    blurb,
    tier,
    // IPVA em torno de 4% ao ano e seguro de 2% a 3%, mais revisão.
    monthlyCost: Math.round((price * 0.0065) / 10) * 10,
    monthlyMood: HUMOR_DA_GARAGEM[tier],
    collectible: extra.collectible,
    groupBonus: extra.groupBonus,
  };
}

const AGRO = { agronegocio: 0.5 };

const CARROS: PersonalCarItem[] = [
  // Fiat
  carro('Fiat', 'fiat_mobi', 'Fiat Mobi Like', '1.0 Firefly flex · 75 cv · manual', 76_990,
    'O carro mais barato do Brasil. Nenhum colunista consegue fazer escândalo com ele.', { tier: 'popular' }),
  carro('Fiat', 'fiat_argo', 'Fiat Argo Drive 1.0', '1.0 Firefly flex · 75 cv · manual', 94_990,
    'Hatch de família de classe média. Discreto como deve ser.'),
  carro('Fiat', 'fiat_strada', 'Fiat Strada Volcano 1.3 CVT', '1.3 Firefly flex · 107 cv · câmbio CVT', 132_990,
    'A picape mais vendida do país. No interior, vale mais do que discurso.', { groupBonus: AGRO }),
  carro('Fiat', 'fiat_pulse_abarth', 'Fiat Pulse Abarth T270', '1.3 turbo flex · 185 cv · automático', 154_990,
    'SUV com escapamento esportivo. Barulho de menos para virar notícia.'),
  carro('Fiat', 'fiat_toro_ultra', 'Fiat Toro Ultra 2.2 Turbodiesel', '2.2 turbodiesel · 200 cv · 4x4 automático', 229_990,
    'Picape de quem tem terra para visitar no fim de semana.', { groupBonus: AGRO }),

  // Ford
  carro('Ford', 'ford_territory', 'Ford Territory Titanium', '1.5 turbo · 169 cv · automático', 219_990,
    'SUV médio de pai de família bem empregado.'),
  carro('Ford', 'ford_maverick', 'Ford Maverick Lariat Hybrid', '2.5 híbrido · 194 cv · câmbio CVT', 244_990,
    'Picape híbrida. Os ambientalistas não reclamam, os caminhoneiros acham graça.'),
  carro('Ford', 'ford_bronco_sport', 'Ford Bronco Sport Badlands', '2.0 turbo · 253 cv · 4x4', 289_990,
    'Para a estrada de terra da chácara que você ainda não comprou.'),
  carro('Ford', 'ford_ranger_v6', 'Ford Ranger Limited V6', '3.0 V6 turbodiesel · 250 cv · 4x4', 344_990,
    'A picape das feiras agropecuárias. Rende foto boa em Rio Verde.', { groupBonus: AGRO }),
  carro('Ford', 'ford_mustang', 'Ford Mustang GT Performance', '5.0 V8 · 488 cv · automático', 549_990,
    'Um V8 na garagem da Granja do Torto. Os seguranças já pediram para dar uma volta.'),

  // Chevrolet
  carro('Chevrolet', 'chevrolet_onix', 'Chevrolet Onix LT 1.0 Turbo', '1.0 turbo flex · 116 cv · automático', 104_990,
    'Um dos carros mais vendidos do país. Invisível, no melhor sentido.'),
  carro('Chevrolet', 'chevrolet_montana', 'Chevrolet Montana Premier', '1.2 turbo flex · 133 cv · automático', 159_990,
    'Picape compacta de quem carrega coisa de verdade.'),
  carro('Chevrolet', 'chevrolet_tracker', 'Chevrolet Tracker Premier', '1.2 turbo flex · 141 cv · automático', 174_990,
    'SUV compacto de estacionamento de shopping.'),
  carro('Chevrolet', 'chevrolet_s10', 'Chevrolet S10 High Country', '2.8 turbodiesel · 207 cv · 4x4', 319_990,
    'Cabine dupla, banco de couro e lama no para-lama. Agrada a base rural.', { groupBonus: AGRO }),
  carro('Chevrolet', 'chevrolet_silverado', 'Chevrolet Silverado High Country', '6.2 V8 · 426 cv · 4x4', 549_990,
    'Picape americana de quase seis metros. Não cabe na vaga nem na foto.'),

  // Volkswagen
  carro('Volkswagen', 'vw_fusca', 'Volkswagen Fusca 1300 1978 (restaurado)', '1.3 a ar · 46 cv · manual · usado', 45_000,
    'Bege, com calota original. Carro de colecionador que o país inteiro reconhece.', { tier: 'popular', collectible: true }),
  carro('Volkswagen', 'vw_polo_track', 'Volkswagen Polo Track 1.0', '1.0 flex · 84 cv · manual', 89_990,
    'Hatch de entrada. Ninguém pergunta quanto custou.'),
  carro('Volkswagen', 'vw_nivus', 'Volkswagen Nivus Highline', '1.0 turbo flex · 128 cv · automático', 159_990,
    'SUV-cupê de concessionária de bairro nobre.'),
  carro('Volkswagen', 'vw_tcross', 'Volkswagen T-Cross Highline 250 TSI', '1.4 turbo flex · 150 cv · automático', 179_990,
    'SUV de classe média alta. Discreto até a oposição pesquisar o preço.'),
  carro('Volkswagen', 'vw_jetta_gli', 'Volkswagen Jetta GLI', '2.0 turbo · 231 cv · câmbio DSG', 239_990,
    'Sedã esportivo com cara de sedã comum. Para quem gosta de acelerar escondido.'),
  carro('Volkswagen', 'vw_amarok', 'Volkswagen Amarok Extreme V6', '3.0 V6 turbodiesel · 258 cv · 4x4', 339_990,
    'A picape mais forte da categoria. A foto em cima da caçamba é boa de campanha.', { groupBonus: AGRO }),

  // BMW
  carro('BMW', 'bmw_x1', 'BMW X1 sDrive20i M Sport', '2.0 turbo · 204 cv · automático', 324_950,
    'SUV de entrada da marca. A hélice no capô, sem exagero.'),
  carro('BMW', 'bmw_320i', 'BMW 320i M Sport', '2.0 turbo flex · 184 cv · automático', 339_950,
    'Montado em Araquari (SC). O argumento da indústria nacional ajuda um pouco.'),
  carro('BMW', 'bmw_x3', 'BMW X3 30e M Sport', '2.0 híbrido plug-in · 299 cv · xDrive', 479_950,
    'Híbrido de tomada. Dá para dizer que foi pela transição energética.'),
  carro('BMW', 'bmw_x5', 'BMW X5 xDrive50e M Sport', '3.0 híbrido plug-in · 489 cv · xDrive', 749_950,
    'SUV de executivo da Faria Lima. A comparação vai aparecer.'),
  carro('BMW', 'bmw_m3', 'BMW M3 Competition', '3.0 biturbo · 510 cv · xDrive', 899_950,
    'De zero a cem em 3,5 segundos. Mais rápido que a tramitação de qualquer medida provisória.'),

  // Mercedes-Benz
  carro('Mercedes-Benz', 'mb_gla200', 'Mercedes-Benz GLA 200 Progressive', '1.3 turbo · 163 cv · automático', 329_900,
    'A estrela no capô pelo menor preço que ela custa.'),
  carro('Mercedes-Benz', 'mb_c300', 'Mercedes-Benz C 300 AMG Line', '2.0 turbo · 258 cv · automático', 419_900,
    'Sedã de desembargador. O Judiciário vai reconhecer.'),
  carro('Mercedes-Benz', 'mb_gle450', 'Mercedes-Benz GLE 450 4MATIC', '3.0 turbo híbrido leve · 381 cv · 4MATIC', 829_900,
    'SUV grande de condomínio fechado.'),
  carro('Mercedes-Benz', 'mb_g63', 'Mercedes-AMG G 63', '4.0 V8 biturbo · 585 cv · 4MATIC', 2_299_900,
    'O jipe quadrado de jogador de futebol. Foto garantida em qualquer portal.'),
  carro('Mercedes-Benz', 'mb_maybach_s680', 'Mercedes-Maybach S 680', '6.0 V12 biturbo · 612 cv · blindagem de fábrica', 4_200_000,
    'Banco traseiro com massagem e geladeira. Carro de xeque, não de presidente.'),

  // Ferrari
  carro('Ferrari', 'ferrari_roma', 'Ferrari Roma Spider', '3.9 V8 biturbo · 620 cv · conversível', 3_150_000,
    'Capota de tecido e vento no cabelo. Em Brasília, só dá para andar dentro do Palácio.'),
  carro('Ferrari', 'ferrari_296', 'Ferrari 296 GTB', '3.0 V6 híbrido · 830 cv', 3_600_000,
    'Híbrida — mas ninguém vai lembrar dessa parte.'),
  carro('Ferrari', 'ferrari_12cilindri', 'Ferrari 12Cilindri', '6.5 V12 aspirado · 830 cv', 5_200_000,
    'Doze cilindros e nenhuma desculpa possível.'),
  carro('Ferrari', 'ferrari_sf90', 'Ferrari SF90 Stradale', '4.0 V8 híbrido · 1.000 cv', 5_600_000,
    'Mil cavalos. A oposição já tem o slogan.'),
  carro('Ferrari', 'ferrari_purosangue', 'Ferrari Purosangue', '6.5 V12 · 725 cv · quatro portas', 7_500_000,
    'A Ferrari de quatro portas, para levar a família inteira ao escândalo.'),
];

// ---------------------------------------------------------------------------
// Imóveis
// ---------------------------------------------------------------------------
function imovel(
  kind: PersonalPropertyKind,
  id: string,
  name: string,
  city: string,
  detail: string,
  price: number,
  monthlyCost: number,
  monthlyStress: number,
  tier: PersonalSpendingTier,
  blurb: string,
  extra: { politicalMemory?: string; groupBonus?: Record<string, number> } = {},
): PersonalPropertyItem {
  return {
    category: 'imovel',
    kind,
    id,
    name,
    city,
    detail,
    price,
    monthlyCost,
    monthlyStress,
    tier,
    blurb,
    politicalMemory: extra.politicalMemory,
    groupBonus: extra.groupBonus,
  };
}

const IMOVEIS: PersonalPropertyItem[] = [
  // Apartamentos
  imovel('apartamento', 'ap_guara_kitnet', 'Kitnet no Guará', 'Guará II, Brasília (DF)', '32 m² · 1 quarto · sem vaga',
    230_000, 450, 0, 'popular', 'Imóvel para alugar e juntar renda. Ninguém acredita que é do presidente.'),
  imovel('apartamento', 'ap_taguatinga', 'Apartamento de 2 quartos em Taguatinga', 'Taguatinga Norte, Brasília (DF)', '62 m² · 2 quartos · 1 vaga',
    420_000, 780, 0, 'discreto', 'O apartamento de uma família de servidor. Faz sentido na declaração de bens.'),
  imovel('apartamento', 'ap_asa_sul', 'Apartamento na Asa Sul', 'SQS 308, Brasília (DF)', '118 m² · 3 quartos · 2 vagas · pilotis',
    1_450_000, 2_100, -0.3, 'confortavel', 'Superquadra tombada, com ipê na janela. Endereço de quem já foi do governo.'),
  imovel('apartamento', 'ap_boa_viagem', 'Apartamento frente-mar em Boa Viagem', 'Boa Viagem, Recife (PE)', '180 m² · 4 quartos · 3 vagas',
    2_300_000, 3_100, -0.6, 'confortavel', 'Varanda para o mar e placa de aviso de tubarão na praia em frente.'),
  imovel('apartamento', 'ap_pinheiros', 'Apartamento de 3 suítes em Pinheiros', 'Pinheiros, São Paulo (SP)', '165 m² · 3 suítes · 2 vagas',
    2_900_000, 4_200, 0, 'luxo', 'Prédio novo com academia, coworking e vizinho que vota contra você.'),
  imovel('apartamento', 'ap_vieira_souto', 'Apartamento na Vieira Souto', 'Ipanema, Rio de Janeiro (RJ)', '290 m² · 4 suítes · vista para o mar',
    13_500_000, 12_800, -0.6, 'ostentacao', 'O endereço mais caro do Brasil. Vista para o Arpoador e para a manchete.'),

  // Casas
  imovel('casa', 'casa_ceilandia', 'Casa de 3 quartos na Ceilândia', 'Ceilândia, Brasília (DF)', '140 m² · 3 quartos · quintal com churrasqueira',
    380_000, 260, -0.2, 'popular', 'Casa de laje com churrasqueira no quintal. A maior cidade do DF ganha o presidente como vizinho.'),
  imovel('casa', 'casa_jardim_botanico', 'Casa em condomínio no Jardim Botânico', 'Jardim Botânico, Brasília (DF)', '320 m² · 4 suítes · piscina',
    1_900_000, 2_300, -0.5, 'confortavel', 'Guarita, piscina e cerrado nos fundos. Classe média alta de Brasília.'),
  imovel('casa', 'casa_porto_galinhas', 'Casa de praia em Porto de Galinhas', 'Ipojuca (PE)', '250 m² · 4 suítes · pé na areia',
    2_600_000, 2_400, -1.5, 'luxo', 'Piscina natural na maré baixa. O estresse do mês sai com o sal.'),
  imovel('casa', 'casa_campos_jordao', 'Chalé em Campos do Jordão', 'Campos do Jordão (SP)', '280 m² · lareira · 5 mil m² de mata',
    3_400_000, 2_900, -1.4, 'luxo', 'Fondue em julho e araucária na janela. Refúgio de paulistano rico.'),
  imovel('casa', 'casa_lago_sul', 'Casa no Lago Sul com píer', 'Lago Sul, Brasília (DF)', '850 m² · 6 suítes · píer e lancha',
    9_800_000, 9_500, -1, 'ostentacao', 'A dez minutos do Palácio e a um mundo de distância de quem mora na Estrutural.'),
  imovel('casa', 'casa_alphaville', 'Mansão em Alphaville', 'Barueri (SP)', '1.200 m² · 7 suítes · cinema · heliponto',
    16_000_000, 18_000, -0.8, 'ostentacao', 'Heliponto no jardim. Não tem como explicar isso em entrevista.'),

  // Triplex e coberturas
  imovel('triplex', 'triplex_aguas_claras', 'Triplex em Águas Claras', 'Águas Claras, Brasília (DF)', '190 m² · 3 suítes · terraço com churrasqueira',
    1_650_000, 2_200, -0.4, 'confortavel', 'Triplex de prédio novo. Nome forte, preço de apartamento.'),
  imovel('triplex', 'triplex_guaruja', 'Triplex no Guarujá', 'Praia das Astúrias, Guarujá (SP)', '215 m² · 3 suítes · elevador privativo',
    2_500_000, 3_300, -0.8, 'luxo', 'Vista para o mar e uma palavra que a política brasileira não esquece.',
    { politicalMemory: 'Triplex no Guarujá tem história em Brasília. A oposição não precisou nem escrever a nota: bastou a foto da escritura.' }),
  imovel('triplex', 'cobertura_barra', 'Cobertura triplex na Barra da Tijuca', 'Barra da Tijuca, Rio de Janeiro (RJ)', '520 m² · 5 suítes · piscina na laje',
    9_200_000, 11_500, -0.8, 'ostentacao', 'Três andares, borda infinita e a Pedra da Gávea de fundo.'),
  imovel('triplex', 'cobertura_balneario', 'Cobertura frente-mar em Balneário Camboriú', 'Balneário Camboriú (SC)', '610 m² · 5 suítes · 70º andar',
    21_000_000, 19_000, -0.6, 'ostentacao', 'Num dos prédios mais altos do país. A sombra na praia chega antes da crítica.'),

  // Sítios e fazendas
  imovel('rural', 'chacara_pirenopolis', 'Chácara em Pirenópolis', 'Pirenópolis (GO)', '2 hectares · cachoeira · pomar',
    950_000, 800, -1.6, 'discreto', 'Cachoeira particular e pé de jabuticaba. Fim de semana que descansa de verdade.'),
  imovel('rural', 'sitio_atibaia', 'Sítio em Atibaia', 'Atibaia (SP)', '17 mil m² · lago · casa de 4 quartos',
    1_300_000, 1_100, -1.8, 'confortavel', 'Lago com pedalinho e cozinha caipira.',
    { politicalMemory: 'Sítio em Atibaia também tem história em Brasília. Metade do Congresso riu; a outra metade pediu a escritura.' }),
  imovel('rural', 'fazenda_mato_grosso', 'Fazenda de gado no Mato Grosso', 'Barra do Garças (MT)', '1.500 hectares · 1.800 cabeças · pista de pouso',
    38_000_000, 25_000, -0.8, 'ostentacao', 'Sede com varanda, pista de pouso e o agro chamando você de “um dos nossos”.',
    { groupBonus: { agronegocio: 2 } }),
];

export const PERSONAL_SHOP: readonly PersonalShopItem[] = [...RESTAURANTES, ...LAZER, ...CARROS, ...IMOVEIS];

export const PERSONAL_SHOP_BY_ID: Readonly<Record<string, PersonalShopItem>> = Object.fromEntries(
  PERSONAL_SHOP.map((item) => [item.id, item]),
);
