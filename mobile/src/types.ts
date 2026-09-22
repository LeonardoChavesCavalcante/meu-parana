export type City = {
  ibgeCode: string;
  name: string;
  state: 'PR';
  region: string;
  info: string;
};

export type Visit = {
  cityId: string;
  cityName: string;
  visitedDate: string;
  userInfo: string;
  updatedAt: Date | null;
};

export type SharePermission = 'read' | 'edit';

export type MapShare = {
  code: string;
  ownerId: string;
  ownerName: string;
  mapName: string;
  permission: SharePermission;
};

export type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export type MunicipalityFeature = {
  type: 'Feature';
  geometry: GeoJsonGeometry;
  properties: { codarea: string };
};

export type MunicipalityFeatureCollection = {
  type: 'FeatureCollection';
  features: MunicipalityFeature[];
};
