import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MunicipalityFeatureCollection } from '../types';

type Props = {
  map: MunicipalityFeatureCollection;
  cityNamesById: Map<string, string>;
  visitedCityIds: Set<string>;
  selectedCityId?: string;
  showLabels?: boolean;
  onSelectCity: (cityId: string) => void;
};

const OPEN_FREE_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

declare const require: (moduleName: string) => typeof import('@maplibre/maplibre-react-native');

export function MapLibreParanaMap({
  map,
  cityNamesById,
  visitedCityIds,
  selectedCityId,
  showLabels = true,
  onSelectCity,
}: Props) {
  const data = useMemo(() => ({
    ...map,
    features: map.features.map((feature) => {
      const cityId = String(feature.properties.codarea);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          cityId,
          cityName: cityNamesById.get(cityId) || cityId,
          visited: visitedCityIds.has(cityId) ? 1 : 0,
          selected: selectedCityId === cityId ? 1 : 0,
        },
      };
    }),
  }), [cityNamesById, map, selectedCityId, visitedCityIds]);

  let mapLibre: typeof import('@maplibre/maplibre-react-native') | null = null;
  try {
    mapLibre = require('@maplibre/maplibre-react-native');
  } catch {
    // Expo Go does not contain MapLibre's native module. A development build or
    // a newly generated APK does, because the config plugin is enabled.
  }

  if (!mapLibre) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableTitle}>Mapa detalhado indisponível neste app</Text>
        <Text style={styles.unavailableText}>
          Gere um novo APK ou development build para carregar o MapLibre. Essa biblioteca não está disponível no Expo Go.
        </Text>
      </View>
    );
  }

  const { Camera, GeoJSONSource, Layer, Map } = mapLibre;

  return (
    <View style={styles.container}>
      <Map
        attribution
        attributionPosition={{ bottom: 82, left: 8 }}
        compass={false}
        logo={false}
        mapStyle={OPEN_FREE_MAP_STYLE}
        style={styles.map}
        touchPitch={false}
        touchRotate={false}
      >
        <Camera
          initialViewState={{ center: [-51.55, -24.6], zoom: 5.8 }}
          maxBounds={[-55.1, -27.4, -47.5, -21.4]}
          maxZoom={13}
          minZoom={5.2}
        />
        <GeoJSONSource
          data={data as GeoJSON.FeatureCollection}
          hitbox={{ top: 32, right: 32, bottom: 32, left: 32 }}
          id="parana-municipalities"
          onPress={(event) => {
            const cityId = event.nativeEvent.features[0]?.properties?.cityId;
            if (cityId) onSelectCity(String(cityId));
          }}
          tolerance={0.8}
        >
          <Layer
            id="municipality-fill"
            type="fill"
            paint={{
              'fill-color': ['case', ['==', ['get', 'visited'], 1], '#3C9B68', '#F2E8C9'],
              'fill-opacity': 0.78,
            }}
          />
          <Layer
            id="municipality-border"
            type="line"
            paint={{
              'line-color': [
                'case',
                ['==', ['get', 'selected'], 1], '#D98117',
                ['==', ['get', 'visited'], 1], '#185C39',
                '#587360',
              ],
              'line-width': ['case', ['==', ['get', 'selected'], 1], 3, 0.8],
            }}
          />
          {showLabels ? (
            <Layer
              id="municipality-labels"
              type="symbol"
              minzoom={5.2}
              layout={{
                'text-field': ['get', 'cityName'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 5.2, 8, 8, 11, 12, 15],
                'text-font': ['Noto Sans Regular'],
                'text-max-width': 10,
                'text-allow-overlap': false,
                'text-ignore-placement': false,
              }}
              paint={{
                'text-color': '#000000',
                'text-halo-color': 'rgba(255,255,255,0.92)',
                'text-halo-width': 1.2,
              }}
            />
          ) : null}
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#DCE9ED' },
  map: { flex: 1 },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: '#DCE9ED' },
  unavailableTitle: { color: '#173821', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  unavailableText: { marginTop: 8, color: '#516459', fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
