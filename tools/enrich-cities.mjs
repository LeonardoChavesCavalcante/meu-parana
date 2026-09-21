import { readFile, writeFile } from 'node:fs/promises';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const IBGE_CITIES_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/41/municipios';
const SIDRA_POPULATION_URL = 'https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2041/v/9324/p/last%201?formato=json';
const WIKIPEDIA_API = 'https://pt.wikipedia.org/w/api.php';
const IBGE_MAP_URL = 'https://servicodados.ibge.gov.br/api/v3/malhas/estados/41?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio';
const OVERPASS_URL = 'https://overpass.kumi.systems/api/interpreter';
const EXPECTED_CITY_COUNT = 399;
const MAX_WORDS = 250;
const FOUNDATION_OVERRIDES = new Map([
  ['4104907', '19/03/1778'], // Castro
  ['4106902', '29/03/1693'], // Curitiba
  ['4109609', '29/04/1771'], // Guaratuba
]);
const PLACE_OVERRIDES = new Map([
  ['4104907', ['Museu do Tropeiro', 'Moinho de Castrolanda', 'Museu do Imigrante Holandês', 'Morro do Cristo']],
  ['4108304', ['Cataratas do Iguaçu', 'Parque das Aves', 'Marco das Três Fronteiras', 'Itaipu Binacional']],
  ['4106902', ['Jardim Botânico de Curitiba', 'Museu Oscar Niemeyer', 'Ópera de Arame', 'Parque Tanguá']],
  ['4109609', ['Morro do Cristo', 'Praia Central', 'Baía de Guaratuba', 'Parque Nacional Saint-Hilaire/Lange']],
  ['4113700', ['Lago Igapó', 'Museu Histórico de Londrina', 'Jardim Botânico de Londrina', 'Catedral Metropolitana']],
  ['4115200', ['Catedral de Maringá', 'Parque do Ingá', 'Museu da Bacia do Paraná', 'Museu Dinâmico Interdisciplinar']],
]);
const writeToFirestore = process.argv.includes('--write');
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
const outputPath = outputArgument?.slice('--output='.length) || '/tmp/meu-parana-city-info.json';
const placesCacheArgument = process.argv.find((argument) => argument.startsWith('--places-cache='));
const placesCachePath = placesCacheArgument?.slice('--places-cache='.length);

async function fetchJson(url, attempts = 7) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'MeuParana/1.0 (municipal information enrichment)' },
      });
      if (!response.ok) {
        const error = new Error(`${response.status} ${response.statusText}`);
        error.retryAfter = Number(response.headers.get('retry-after') || 0);
        throw error;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const waitMilliseconds = Math.max(error.retryAfter * 1000, attempt * 2500);
        await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
      }
    }
  }
  throw lastError;
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function wikipediaPages(titles) {
  const pagesByRequestedTitle = new Map();
  for (const titleChunk of chunks(titles, 40)) {
    const parameters = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      redirects: '1',
      prop: 'extracts|revisions',
      exintro: '1',
      explaintext: '1',
      rvprop: 'content',
      rvslots: 'main',
      titles: titleChunk.join('|'),
      origin: '*',
    });
    const payload = await fetchJson(`${WIKIPEDIA_API}?${parameters}`);
    const aliases = new Map();
    for (const normalized of payload.query?.normalized ?? []) aliases.set(normalized.from, normalized.to);
    for (const redirect of payload.query?.redirects ?? []) aliases.set(redirect.from, redirect.to);
    const pagesByTitle = new Map((payload.query?.pages ?? []).map((page) => [page.title, page]));
    for (const requestedTitle of titleChunk) {
      let resolvedTitle = aliases.get(requestedTitle) ?? requestedTitle;
      resolvedTitle = aliases.get(resolvedTitle) ?? resolvedTitle;
      pagesByRequestedTitle.set(requestedTitle, pagesByTitle.get(resolvedTitle));
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return pagesByRequestedTitle;
}

async function fetchTourismPlaces() {
  const query = '[out:json][timeout:120];(nwr["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|theme_park)$"]["name"](-27,-55,-22,-48););out center tags;';
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'MeuParana/1.0 (municipal information enrichment)',
        },
        body: new URLSearchParams({ data: query }),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return (await response.json()).elements ?? [];
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
    }
  }
  throw lastError;
}

function pageWikitext(page) {
  return page?.revisions?.[0]?.slots?.main?.content ?? '';
}

function isParanaMunicipality(page) {
  if (!page || page.missing) return false;
  const text = `${page.extract ?? ''}\n${pageWikitext(page)}`;
  return /munic[ií]pio[^.]{0,100}(?:estado (?:do )?)?Paran[aá]/i.test(text)
    || /Categoria:Munic[ií]pios do Paran[aá]/i.test(text);
}

function cleanWikitext(value) {
  let text = String(value ?? '');
  text = text
    .replace(/^.*\[\[(?:Ficheiro|Arquivo|Imagem):.*$/gim, ' ')
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<ref\b[^>]*>[^]*?<\/ref>/gi, ' ')
    .replace(/<ref\b[^>]*\/\s*>/gi, ' ')
    .replace(/\{\{\s*(?:dtlink|dtext)\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})\s*\|\s*(\d{4})[^}]*\}\}/gi, '$1/$2/$3')
    .replace(/\{\{\s*nowrap\s*\|([^{}]*)\}\}/gi, '$1')
    .replace(/\{\{\s*formatnum\s*:\s*([^{}|]+)[^}]*\}\}/gi, '$1');
  for (let pass = 0; pass < 5; pass += 1) text = text.replace(/\{\{[^{}]*\}\}/g, ' ');
  return text
    .replace(/\[\[(?:Ficheiro|Arquivo|Imagem):[^\]]+\]\]/gi, ' ')
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[(?:https?:\/\/)[^\s\]]+\s+([^\]]+)\]/g, '$1')
    .replace(/\[(?:https?:\/\/)[^\]]+\]/g, ' ')
    .replace(/'{2,}/g, '')
    .replace(/\]\]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*[*#:;]+\s*/gm, '')
    .replace(/={2,}[^=]+={2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function section(wikitext, names) {
  const headings = [...wikitext.matchAll(/^(={2,})\s*([^=]+?)\s*\1\s*$/gm)];
  for (let index = 0; index < headings.length; index += 1) {
    const title = headings[index][2].trim();
    if (!names.some((name) => name.test(title))) continue;
    const start = headings[index].index + headings[index][0].length;
    const nextHeading = headings.slice(index + 1).find((heading) => heading[1].length <= headings[index][1].length);
    const end = nextHeading?.index ?? wikitext.length;
    return wikitext.slice(start, end);
  }
  return '';
}

function firstUsefulSentence(value, maximumWords = 35) {
  const clean = cleanWikitext(value);
  const sentence = clean
    .split(/(?<=[.!?])\s+/)
    .find((candidate) => candidate.length >= 35 && !/^(ver tamb[eé]m|refer[eê]ncias|liga[cç][oõ]es)/i.test(candidate));
  if (!sentence) return '';
  const words = sentence.split(/\s+/);
  return words.length <= maximumWords ? sentence : `${words.slice(0, maximumWords).join(' ')}…`;
}

function field(wikitext, name) {
  const match = new RegExp(`^\\|\\s*${name}\\s*=\\s*(.+)$`, 'im').exec(wikitext);
  return cleanWikitext(match?.[1] ?? '');
}

function foundation(mainText, templateText) {
  const fromTemplate = field(templateText, 'funda[cç][aã]o') || field(mainText, 'funda[cç][aã]o');
  if (fromTemplate && /\d{4}/.test(fromTemplate)) return fromTemplate;

  const categoryYear = /Categoria:Funda[cç][oõ]es no Paran[aá] em (\d{4})/i.exec(mainText)?.[1];
  if (categoryYear) return categoryYear;
  const history = cleanWikitext(section(mainText, [/hist[oó]ria/i]));
  const creation = /(?:criado|criada|emancipad[oa]|instalad[oa])[^.]{0,100}?(\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}|\d{4})/i.exec(history)?.[1];
  return creation || 'Não localizada nas fontes consultadas';
}

function typicalFood(mainText) {
  const raw = section(mainText, [/gastronomia/i, /culin[aá]ria/i, /comidas? t[ií]picas?/i]);
  const sentence = firstUsefulSentence(raw, 28);
  if (!sentence) return '';
  const hasFoodContext = /culin[aá]r|gastronom|comida|prato|receita|iguaria|consumo|servid[oa]/i.test(sentence);
  const namesFood = /barreado|pir[aá] de foz|pierog|pirogu|churrasc|pinh[aã]o|polenta|porco|peixe|dourado|carneiro|leit[aã]o|mingau/i.test(sentence);
  return hasFoodContext && namesFood
    ? sentence
    : '';
}

function placesFromTourism(mainText) {
  const raw = section(mainText, [/turismo/i, /pontos? tur[ií]sticos?/i, /atra[cç][oõ]es/i]);
  if (!raw) return [];
  const lines = raw.split('\n').filter((line) => /^\s*[*#]/.test(line));
  const candidates = lines;
  const places = [];
  for (const candidate of candidates) {
    const clean = cleanWikitext(candidate).replace(/\.$/, '');
    if (clean.length < 4 || clean.length > 90) continue;
    if (/refer[eê]ncia|http|prefeitura/i.test(clean) || /^(museu|parque|mirante|atra[cç][aã]o)$/i.test(clean)) continue;
    if (!places.some((place) => place.toLocaleLowerCase('pt-BR') === clean.toLocaleLowerCase('pt-BR'))) places.push(clean);
    if (places.length === 4) break;
  }
  return places;
}

function pointInRing(longitude, latitude, ring) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentX, currentY] = ring[current];
    const [previousX, previousY] = ring[previous];
    const intersects = (currentY > latitude) !== (previousY > latitude)
      && longitude < ((previousX - currentX) * (latitude - currentY)) / (previousY - currentY || Number.EPSILON) + currentX;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInFeature(longitude, latitude, feature) {
  const polygons = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
  return polygons.some(([outer, ...holes]) =>
    pointInRing(longitude, latitude, outer)
    && !holes.some((hole) => pointInRing(longitude, latitude, hole)),
  );
}

function tourismPlacesByCity(elements, municipalityMap) {
  const result = new Map();
  const priority = { museum: 1, zoo: 2, theme_park: 3, attraction: 4, gallery: 5, viewpoint: 6 };
  const points = elements
    .map((element) => ({
      name: String(element.tags?.name ?? '').trim(),
      tourism: element.tags?.tourism,
      latitude: element.lat ?? element.center?.lat,
      longitude: element.lon ?? element.center?.lon,
    }))
    .filter((point) => point.name && Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    .sort((first, second) => (priority[first.tourism] ?? 99) - (priority[second.tourism] ?? 99));

  for (const point of points) {
    const feature = municipalityMap.features.find((candidate) => pointInFeature(point.longitude, point.latitude, candidate));
    if (!feature) continue;
    const cityId = String(feature.properties.codarea);
    const places = result.get(cityId) ?? [];
    if (/^(museu|parque|mirante|atra[cç][aã]o|a casa da piscina)$/i.test(point.name)) continue;
    const normalizedName = point.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    const duplicate = places.some((name) => {
      const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
      return normalized === normalizedName
        || (Math.min(normalized.length, normalizedName.length) >= 10
          && (normalized.includes(normalizedName) || normalizedName.includes(normalized)));
    });
    if (places.length >= 4 || duplicate) continue;
    places.push(point.name);
    result.set(cityId, places);
  }
  return result;
}

async function cachedPlacesByCity(path) {
  const records = JSON.parse(await readFile(path, 'utf8'));
  return new Map(records.flatMap((record) => {
    const value = /^Lugares para conhecer:\s*(.+)$/m.exec(record.info)?.[1] ?? '';
    if (!value || /^n[aã]o identificados/i.test(value)) return [];
    const places = [];
    for (const rawPlace of value.split(';')) {
      const place = rawPlace.trim();
      if (!place || /^(museu|parque|mirante|atra[cç][aã]o|a casa da piscina)$/i.test(place)) continue;
      const normalizedPlace = place.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
      const duplicate = places.some((current) => {
        const normalized = current.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
        return normalized === normalizedPlace
          || (Math.min(normalized.length, normalizedPlace.length) >= 10
            && (normalized.includes(normalizedPlace) || normalizedPlace.includes(normalized)));
      });
      if (!duplicate) places.push(place);
      if (places.length === 4) break;
    }
    return [[String(record.ibgeCode), places]];
  }));
}

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function buildInfo(city, population, page, templatePage, osmPlaces) {
  const mainText = pageWikitext(page);
  const templateText = pageWikitext(templatePage);
  const historySection = section(mainText, [/hist[oó]ria/i, /origem/i]);
  const etymologySection = section(mainText, [/etimologia/i, /topon[ií]mia/i]);
  const history = firstUsefulSentence(historySection, 38)
    || 'A origem municipal não foi detalhada nas fontes enciclopédicas consultadas.';
  const curiosity = firstUsefulSentence(etymologySection, 28);
  const food = typicalFood(mainText)
    || 'Não foi identificada uma comida típica específica nas fontes consultadas.';
  const places = PLACE_OVERRIDES.get(String(city.id))
    ?? (osmPlaces.length ? osmPlaces : placesFromTourism(mainText));
  const foundationValue = FOUNDATION_OVERRIDES.get(String(city.id)) ?? foundation(mainText, templateText);
  const populationLabel = Number(population.value).toLocaleString('pt-BR');
  const lines = [
    `População: ${populationLabel} habitantes (estimativa IBGE ${population.year}).`,
    `Fundação/emancipação: ${foundationValue}.`,
    `Origem: ${history}`,
    ...(curiosity ? [`Curiosidade: ${curiosity}`] : []),
    `Comida típica: ${food}`,
    `Lugares para conhecer: ${places.length ? places.join('; ') : 'não identificados nas fontes consultadas.'}`,
  ];
  let info = lines.join('\n');
  if (wordCount(info) > MAX_WORDS) info = info.split(/\s+/).slice(0, MAX_WORDS).join(' ');
  return {
    ibgeCode: String(city.id),
    name: city.nome,
    info,
    wordCount: wordCount(info),
    population: Number(population.value),
    populationReferenceYear: Number(population.year),
    foundation: foundationValue,
    wikipediaTitle: page?.title ?? null,
    sources: [
      SIDRA_POPULATION_URL,
      ...(page?.title ? [`https://pt.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`] : []),
      ...(places.length && osmPlaces.length ? ['https://www.openstreetmap.org/'] : []),
    ],
  };
}

const [cities, populationRows] = await Promise.all([
  fetchJson(IBGE_CITIES_URL),
  fetchJson(SIDRA_POPULATION_URL),
]);
if (!Array.isArray(cities) || cities.length !== EXPECTED_CITY_COUNT) {
  throw new Error(`Esperados ${EXPECTED_CITY_COUNT} municípios; recebidos ${cities?.length}.`);
}
const populations = new Map(populationRows.slice(1).map((row) => [String(row.D1C), { value: row.V, year: row.D3N }]));
if (populations.size !== EXPECTED_CITY_COUNT) throw new Error(`População disponível para apenas ${populations.size} municípios.`);

const qualifiedTitles = cities.map((city) => `${city.nome} (Paraná)`);
const qualifiedPages = await wikipediaPages(qualifiedTitles);
const exactPages = await wikipediaPages(cities.map((city) => city.nome));
const selectedPages = new Map();
for (const city of cities) {
  const qualified = qualifiedPages.get(`${city.nome} (Paraná)`);
  const exact = exactPages.get(city.nome);
  selectedPages.set(String(city.id), isParanaMunicipality(qualified) ? qualified : isParanaMunicipality(exact) ? exact : null);
}

const templatePages = await wikipediaPages(cities.map((city) => `Predefinição:Info/Município do Brasil/${city.nome}`));
let osmPlaces;
if (placesCachePath) {
  osmPlaces = await cachedPlacesByCity(placesCachePath);
} else {
  const [tourismElements, municipalityMap] = await Promise.all([fetchTourismPlaces(), fetchJson(IBGE_MAP_URL)]);
  osmPlaces = tourismPlacesByCity(tourismElements, municipalityMap);
}
const records = cities.map((city) => buildInfo(
  city,
  populations.get(String(city.id)),
  selectedPages.get(String(city.id)),
  templatePages.get(`Predefinição:Info/Município do Brasil/${city.nome}`),
  osmPlaces.get(String(city.id)) ?? [],
));

const invalid = records.filter((record) => !record.info || record.wordCount > MAX_WORDS);
if (invalid.length) throw new Error(`${invalid.length} textos falharam na validação de conteúdo/tamanho.`);
await writeFile(outputPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');

if (writeToFirestore) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Defina FIREBASE_PROJECT_ID antes de usar --write.');
  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore(app);
  for (const recordChunk of chunks(records, 400)) {
    const batch = db.batch();
    for (const record of recordChunk) {
      batch.set(db.collection('cities').doc(record.ibgeCode), {
        info: record.info,
        population: record.population,
        populationReferenceYear: record.populationReferenceYear,
        foundation: record.foundation,
        infoSources: record.sources,
        infoUpdatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
  }
}

const coverage = {
  cities: records.length,
  wikipediaPages: records.filter((record) => record.wikipediaTitle).length,
  foundationsFound: records.filter((record) => !record.foundation.startsWith('Não localizada')).length,
  historiesFound: records.filter((record) => !record.info.includes('A origem municipal não foi detalhada')).length,
  foodsFound: records.filter((record) => !record.info.includes('Não foi identificada uma comida típica')).length,
  placesFound: records.filter((record) => !record.info.includes('não identificados nas fontes consultadas')).length,
  maximumWords: Math.max(...records.map((record) => record.wordCount)),
  outputPath,
  firestoreUpdated: writeToFirestore,
};
console.log(JSON.stringify(coverage, null, 2));
