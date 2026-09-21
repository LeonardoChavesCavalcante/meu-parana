import { useEffect, useMemo, useState } from 'react';

import { subscribeToCities, subscribeToVisits } from '../services/firestore';
import { loadMunicipalityMap } from '../services/municipalities';
import type { City, MunicipalityFeatureCollection, Visit } from '../types';

export function useMapData(visitOwnerId: string) {
  const [cities, setCities] = useState<City[]>([]);
  const [visits, setVisits] = useState<Map<string, Visit>>(new Map());
  const [municipalityMap, setMunicipalityMap] = useState<MunicipalityFeatureCollection | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [citiesLoaded, setCitiesLoaded] = useState(false);
  const [visitsLoaded, setVisitsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setMapLoading(true);
    setError(null);

    loadMunicipalityMap()
      .then((map) => {
        if (mounted) setMunicipalityMap(map);
      })
      .catch((reason: unknown) => {
        if (mounted) setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o mapa.');
      })
      .finally(() => {
        if (mounted) setMapLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    setCitiesLoaded(false);
    setVisitsLoaded(false);

    const stopCities = subscribeToCities(
      (nextCities) => {
        setCities(nextCities);
        setCitiesLoaded(true);
      },
      (reason) => {
        setError(reason.message);
        setCitiesLoaded(true);
      },
    );
    const stopVisits = subscribeToVisits(
      visitOwnerId,
      (nextVisits) => {
        setVisits(nextVisits);
        setVisitsLoaded(true);
      },
      (reason) => {
        setError(reason.message);
        setVisitsLoaded(true);
      },
    );

    return () => {
      stopCities();
      stopVisits();
    };
  }, [reloadKey, visitOwnerId]);

  const citiesById = useMemo(
    () => new Map(cities.map((city) => [city.ibgeCode, city])),
    [cities],
  );

  const setLocalVisit = (visit: Visit) => {
    setVisits((current) => {
      const next = new Map(current);
      next.set(visit.cityId, visit);
      return next;
    });
  };

  const removeLocalVisit = (cityId: string) => {
    setVisits((current) => {
      const next = new Map(current);
      next.delete(cityId);
      return next;
    });
  };

  return {
    cities,
    citiesById,
    visits,
    setLocalVisit,
    removeLocalVisit,
    municipalityMap,
    loading: mapLoading || !citiesLoaded || !visitsLoaded,
    error,
    retry: () => setReloadKey((value) => value + 1),
  };
}
