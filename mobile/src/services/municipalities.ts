import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MunicipalityFeatureCollection } from '../types';

const MAP_CACHE_KEY = '@meu-parana/ibge-map-v1';
const IBGE_MAP_URL =
  'https://servicodados.ibge.gov.br/api/v3/malhas/estados/41?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio';

function parseMap(raw: string): MunicipalityFeatureCollection {
  const parsed = JSON.parse(raw) as MunicipalityFeatureCollection;

  if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw new Error('A malha retornada pelo IBGE é inválida.');
  }

  return parsed;
}

export async function loadMunicipalityMap(): Promise<MunicipalityFeatureCollection> {
  const cached = await AsyncStorage.getItem(MAP_CACHE_KEY);

  if (cached) {
    try {
      return parseMap(cached);
    } catch {
      await AsyncStorage.removeItem(MAP_CACHE_KEY);
    }
  }

  const response = await fetch(IBGE_MAP_URL);
  if (!response.ok) throw new Error(`IBGE respondeu com status ${response.status}.`);

  const raw = await response.text();
  const map = parseMap(raw);

  if (map.features.length !== 399) {
    throw new Error(`Era esperado receber 399 municípios, mas vieram ${map.features.length}.`);
  }

  await AsyncStorage.setItem(MAP_CACHE_KEY, raw);
  return map;
}
