import type { MunicipalityFeatureCollection } from '../types';
import { ParanaMap } from './ParanaMap';

type Props = {
  map: MunicipalityFeatureCollection;
  cityNamesById: Map<string, string>;
  visitedCityIds: Set<string>;
  selectedCityId?: string;
  showLabels?: boolean;
  onSelectCity: (cityId: string) => void;
};

// The browser preview keeps using the SVG implementation. Metro automatically
// selects MapLibreParanaMap.native.tsx in Android and iOS builds.
export function MapLibreParanaMap(props: Props) {
  return <ParanaMap {...props} />;
}
