import type { TreatyCategoryId } from '../types/index';
import type { SourcedNumber } from './generated/baseline';

/**
 * O BRASIL NO DIA EM QUE A PARTIDA COMEÇA
 *
 * Toda partida parte do país como ele está de verdade. Não existe mais escolha
 * de dificuldade: o que decide se o mandato é fácil ou difícil é o Brasil que o
 * presidente recebe — Selic de 14%, déficit primário, dívida acima de 80% do
 * PIB, tarifa americana, relação rompida com a Argentina.
 *
 * Os números que têm série oficial com API (Selic, IPCA, câmbio, dívida,
 * reservas, primário, desemprego, salário mínimo, PIB de 12 meses, população,
 * desemprego e renda por estado) são baixados por `scripts/fetch-official-data.mjs`
 * e ficam em `generated/baseline.ts`.
 *
 * Os daqui não têm API pública estável — saem de publicação anual, pesquisa
 * temática ou fechamento de mercado — e foram levantados à mão, cada um com a
 * fonte e o período a que se refere. O período nem sempre é o mês corrente:
 * pobreza e Gini só são medidos uma vez por ano, com defasagem. É o dado mais
 * recente publicado até a data abaixo.
 *
 * Do primeiro mês jogado em diante, o motor assume e nenhum número aqui
 * corresponde mais à realidade.
 */
export const SNAPSHOT_DATE = '10/09/2026';

const s = (value: number, source: string, reference: string): SourcedNumber => ({
  value,
  source,
  reference,
});

export const BRASIL_HOJE = {
  gdpGrowth: s(2.0, 'IBGE/Contas Nacionais Trimestrais', '2º tri 2026 contra 2º tri 2025'),
  averageIncome: s(3762, 'IBGE/PNAD Contínua — rendimento médio real habitual', 'mai–jul/2026'),
  povertyRate: s(23.1, 'IBGE/Síntese de Indicadores Sociais 2025', '2024'),
  extremePovertyRate: s(3.5, 'IBGE/Síntese de Indicadores Sociais 2025', '2024'),
  gini: s(0.504, 'IBGE/Síntese de Indicadores Sociais 2025', '2024'),
  hdi: s(0.805, 'PNUD, IBGE e FJP — Radar IDHM 2026', '2024'),
  lifeExpectancy: s(76.6, 'IBGE/Tábuas Completas de Mortalidade', '2024'),
  literacy: s(95.1, 'IBGE/PNAD Contínua Educação (analfabetismo de 4,9% aos 15+)', '2025'),
  homicideRate: s(19.1, 'FBSP/Anuário Brasileiro de Segurança Pública 2026 (mortes violentas intencionais)', '2025'),
  corruptionPerception: s(35, 'Transparência Internacional/Índice de Percepção da Corrupção', '2025'),
  ibovespa: s(185_629, 'B3 — fechamento', '09/09/2026'),
  countryRisk: s(138, 'Risco-país (JP Morgan) — último fechamento confirmado', '31/12/2025'),
  bolsaFamiliaFamilies: s(19_340_000, 'MDS — famílias atendidas', 'jun/2026'),
  bolsaFamiliaAverageBenefit: s(680, 'MDS — benefício médio', '2026'),
} as const;

/**
 * Acordos que o Brasil já tem em vigor no dia da posse.
 *
 * Entram na partida como acordos herdados: aparecem em Diplomacia, impedem que
 * o mesmo acordo seja "assinado" de novo com o mesmo parceiro e não contam como
 * conquista do mandato na avaliação final. Não têm custeio mensal no jogo — o
 * que eles já custam e entregam está embutido nos números de partida.
 */
export const INHERITED_TREATIES: readonly {
  treatyId: TreatyCategoryId;
  countryId: string;
  label: string;
}[] = [
  {
    treatyId: 'livre_comercio',
    countryId: 'uniao_europeia',
    label: 'Acordo Mercosul–União Europeia (em vigor provisório desde 1º/05/2026)',
  },
  {
    treatyId: 'livre_comercio',
    countryId: 'argentina',
    label: 'Mercosul — união aduaneira (desde 1991)',
  },
  {
    treatyId: 'livre_comercio',
    countryId: 'chile',
    label: 'Acordo de Livre Comércio Brasil–Chile (em vigor desde 2022)',
  },
  {
    treatyId: 'livre_comercio',
    countryId: 'colombia',
    label: 'Acordo Mercosul–Colômbia, ACE 72 (em vigor desde 2017)',
  },
  {
    treatyId: 'comercio_moeda_local',
    countryId: 'china',
    label: 'Swap de moedas entre o Banco Central e o Banco do Povo da China (2025)',
  },
];
