/**
 * Gera os arquivos de DADO INICIAL de GOV3RNE a partir de fontes oficiais.
 *
 *   node scripts/fetch-official-data.mjs
 *
 * Fontes:
 *   IBGE  - malhas territoriais (UF), Censo 2022 (populacao), PIB estadual, PNAD continua
 *   BCB   - Sistema Gerenciador de Series Temporais (SGS)
 *   Camara dos Deputados - dados abertos (composicao da Casa)
 *
 * Os numeros baixados aqui sao o PONTO DE PARTIDA da simulacao. A partir do
 * primeiro mes jogado, todos os indicadores passam a ser produzidos pelo motor
 * do jogo e nao representam mais a realidade.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'src/game/data/generated');
mkdirSync(OUT_DIR, { recursive: true });

const HEADER = `/**
 * ARQUIVO GERADO AUTOMATICAMENTE - nao edite a mao.
 * Origem: scripts/fetch-official-data.mjs
 * Gerado em: ${new Date().toISOString()}
 *
 * Os valores abaixo sao DADO INICIAL, extraidos de fontes publicas oficiais.
 * Durante a partida, o motor de simulacao assume e os numeros deixam de
 * corresponder a realidade.
 */
`;

async function getJson(url, label) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return res.json();
}

async function sgs(series, label) {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados/ultimos/1?formato=json`;
  const data = await getJson(url, label);
  const last = data[data.length - 1];
  return { value: Number(last.valor), date: last.data, series, label };
}

// ---------------------------------------------------------------------------
// 1. Malha territorial -> paths SVG
// ---------------------------------------------------------------------------
const UF_BY_CODE = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO',
  21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA',
  31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP',
  41: 'PR', 42: 'SC', 43: 'RS',
  50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
};

const VIEW_W = 1000;

function mercatorY(lat) {
  const rad = (lat * Math.PI) / 180;
  // Devolve em "graus de Mercator" para ficar na mesma escala da longitude.
  return (Math.log(Math.tan(Math.PI / 4 + rad / 2)) * 180) / Math.PI;
}

/** Remove vertices que nao mudam a silhueta (Douglas-Peucker iterativo). */
function simplifyRing(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDist = 0;
    let index = -1;
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    for (let i = start + 1; i < end; i += 1) {
      const [px, py] = points[i];
      let dist;
      if (lenSq === 0) {
        dist = Math.hypot(px - ax, py - ay);
      } else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
        dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (maxDist > tolerance && index > 0) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringsOf(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  return geometry.coordinates.flat();
}

async function buildGeo() {
  const geo = await getJson(
    'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=UF',
    'IBGE malhas',
  );

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minMy = Infinity;
  let maxMy = -Infinity;
  for (const feature of geo.features) {
    for (const ring of ringsOf(feature.geometry)) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        const my = mercatorY(lat);
        if (my < minMy) minMy = my;
        if (my > maxMy) maxMy = my;
      }
    }
  }

  const scale = VIEW_W / (maxLon - minLon);
  const viewH = Math.round((maxMy - minMy) * scale);
  const project = ([lon, lat]) => [(lon - minLon) * scale, (maxMy - mercatorY(lat)) * scale];

  const shapes = {};
  const centroids = {};

  for (const feature of geo.features) {
    const uf = UF_BY_CODE[Number(feature.properties.codarea)];
    if (!uf) continue;
    const parts = [];
    let cx = 0;
    let cy = 0;
    let area = 0;
    for (const ring of ringsOf(feature.geometry)) {
      const projected = ring.map(project);
      const xs = projected.map((p) => p[0]);
      const ys = projected.map((p) => p[1]);
      const box = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
      // Descarta ilhotas irrelevantes na escala do mapa.
      if (box < 2 && projected.length < 12) continue;
      const simplified = simplifyRing(projected, 0.7);
      if (simplified.length < 3) continue;
      parts.push(`M${simplified.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`);
      // Centroide por area (formula do poligono), para posicionar a sigla.
      let ringArea = 0;
      let rx = 0;
      let ry = 0;
      for (let i = 0; i < simplified.length; i += 1) {
        const [x1, y1] = simplified[i];
        const [x2, y2] = simplified[(i + 1) % simplified.length];
        const cross = x1 * y2 - x2 * y1;
        ringArea += cross;
        rx += (x1 + x2) * cross;
        ry += (y1 + y2) * cross;
      }
      ringArea /= 2;
      if (Math.abs(ringArea) > Math.abs(area)) {
        area = ringArea;
        cx = rx / (6 * ringArea);
        cy = ry / (6 * ringArea);
      }
    }
    shapes[uf] = parts.join('');
    centroids[uf] = [Number(cx.toFixed(1)), Number(cy.toFixed(1))];
  }

  const body = [
    HEADER,
    `/** Malha territorial das 27 UFs (IBGE, qualidade intermediaria), projecao de Mercator. */`,
    `export const MAP_VIEWBOX = '0 0 ${VIEW_W} ${viewH}';`,
    ``,
    `export const MAP_WIDTH = ${VIEW_W};`,
    `export const MAP_HEIGHT = ${viewH};`,
    ``,
    `export const STATE_SHAPES: Record<string, string> = ${JSON.stringify(shapes, null, 2)};`,
    ``,
    `/** Ponto onde a sigla do estado e desenhada. */`,
    `export const STATE_CENTROIDS: Record<string, [number, number]> = ${JSON.stringify(centroids, null, 2)};`,
    ``,
  ].join('\n');

  writeFileSync(resolve(OUT_DIR, 'geo.ts'), body, 'utf8');
  console.log(`geo.ts  -> ${Object.keys(shapes).length} UFs, viewBox 0 0 ${VIEW_W} ${viewH}`);
}

// ---------------------------------------------------------------------------
// 2. Baseline macro + estados
// ---------------------------------------------------------------------------
async function buildBaseline() {
  const [selic, ipca12, usd, debt, reserves, primary] = await Promise.all([
    sgs(432, 'Selic meta % a.a.'),
    sgs(13522, 'IPCA acumulado 12 meses %'),
    sgs(1, 'Cambio R$/US$'),
    sgs(13762, 'Divida bruta do governo geral % PIB'),
    sgs(3546, 'Reservas internacionais US$ milhoes'),
    sgs(5793, 'Resultado primario acumulado 12 meses % PIB'),
  ]);

  const pnad = await getJson(
    'https://servicodados.ibge.gov.br/api/v3/agregados/6381/periodos/-1/variaveis/4099?localidades=N1%5Ball%5D',
    'IBGE PNAD',
  );
  const pnadSerie = pnad[0].resultados[0].series[0].serie;
  const pnadPeriod = Object.keys(pnadSerie)[0];
  const unemployment = Number(pnadSerie[pnadPeriod]);

  const popRaw = await getJson(
    'https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2022/variaveis/93?localidades=N3%5Ball%5D',
    'IBGE populacao',
  );
  const pibRaw = await getJson(
    'https://servicodados.ibge.gov.br/api/v3/agregados/5938/periodos/-1/variaveis/37?localidades=N3%5Ball%5D',
    'IBGE PIB estadual',
  );
  const deputies = await getJson(
    'https://dadosabertos.camara.leg.br/api/v2/deputados?ordem=ASC&ordenarPor=nome&itens=600',
    'Camara deputados',
  );

  const population = {};
  let popTotal = 0;
  for (const serie of popRaw[0].resultados[0].series) {
    const uf = UF_BY_CODE[Number(serie.localidade.id)];
    const value = Number(Object.values(serie.serie)[0]);
    population[uf] = value;
    popTotal += value;
  }

  const gdpByUf = {};
  let gdpTotal = 0;
  let gdpYear = '';
  for (const serie of pibRaw[0].resultados[0].series) {
    const uf = UF_BY_CODE[Number(serie.localidade.id)];
    gdpYear = Object.keys(serie.serie)[0];
    const value = Number(Object.values(serie.serie)[0]); // mil reais
    gdpByUf[uf] = value;
    gdpTotal += value;
  }
  const gdpShare = {};
  for (const [uf, value] of Object.entries(gdpByUf)) {
    gdpShare[uf] = Number(((value / gdpTotal) * 100).toFixed(2));
  }

  const seatsByUf = {};
  const seatsByParty = {};
  for (const deputy of deputies.dados) {
    seatsByUf[deputy.siglaUf] = (seatsByUf[deputy.siglaUf] ?? 0) + 1;
    seatsByParty[deputy.siglaPartido] = (seatsByParty[deputy.siglaPartido] ?? 0) + 1;
  }

  const body = [
    HEADER,
    `export interface SourcedNumber {`,
    `  value: number;`,
    `  source: string;`,
    `  reference: string;`,
    `}`,
    ``,
    `const s = (value: number, source: string, reference: string): SourcedNumber => ({ value, source, reference });`,
    ``,
    `/** Fotografia macro usada como ponto de partida de toda nova partida. */`,
    `export const MACRO_BASELINE = {`,
    `  selic: s(${selic.value}, 'BCB/SGS 432', '${selic.date}'),`,
    `  inflation12m: s(${ipca12.value}, 'BCB/SGS 13522', '${ipca12.date}'),`,
    `  usd: s(${usd.value}, 'BCB/SGS 1', '${usd.date}'),`,
    `  debtToGdp: s(${debt.value}, 'BCB/SGS 13762', '${debt.date}'),`,
    `  reservesUsdBillion: s(${Number((reserves.value / 1000).toFixed(1))}, 'BCB/SGS 3546', '${reserves.date}'),`,
    `  primaryBalancePctGdp: s(${primary.value}, 'BCB/SGS 5793', '${primary.date}'),`,
    `  unemployment: s(${unemployment}, 'IBGE/PNAD Continua', '${pnadPeriod}'),`,
    `  gdpNominalBillion: s(${Number((gdpTotal / 1000000).toFixed(0))}, 'IBGE/Contas Regionais', '${gdpYear}'),`,
    `  population: s(${popTotal}, 'IBGE/Censo', '2022'),`,
    `} as const;`,
    ``,
    `/** Populacao residente por UF (IBGE, Censo 2022). */`,
    `export const STATE_POPULATION: Record<string, number> = ${JSON.stringify(population, null, 2)};`,
    ``,
    `/** Participacao de cada UF no PIB nacional, em % (IBGE, ${gdpYear}). */`,
    `export const STATE_GDP_SHARE: Record<string, number> = ${JSON.stringify(gdpShare, null, 2)};`,
    ``,
    `/** Cadeiras na Camara por UF (Camara dos Deputados, dados abertos). */`,
    `export const STATE_SEATS: Record<string, number> = ${JSON.stringify(seatsByUf, null, 2)};`,
    ``,
    `/** Composicao partidaria da Camara usada como ponto de partida. */`,
    `export const PARTY_SEATS: Record<string, number> = ${JSON.stringify(seatsByParty, null, 2)};`,
    ``,
    `export const DATA_SOURCES = [`,
    `  'IBGE - Malhas territoriais, Censo 2022, Contas Regionais e PNAD Continua',`,
    `  'Banco Central do Brasil - Sistema Gerenciador de Series Temporais (SGS)',`,
    `  'Camara dos Deputados - Portal de Dados Abertos',`,
    `] as const;`,
    ``,
  ].join('\n');

  writeFileSync(resolve(OUT_DIR, 'baseline.ts'), body, 'utf8');
  console.log(
    `baseline.ts -> Selic ${selic.value}% | IPCA ${ipca12.value}% | USD ${usd.value} | desemprego ${unemployment}%`,
  );
}

await buildGeo();
await buildBaseline();
console.log('\nDados oficiais gravados em src/game/data/generated/');
