import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { MunicipalityFeature, MunicipalityFeatureCollection } from '../types';

type Point = { x: number; y: number };
type Bounds = { minX: number; minY: number; width: number; height: number };
type MapShape = {
  key: string;
  cityId: string;
  path: string;
  label: Point;
  area: number;
  labelMinZoom: number;
  polygons: Point[][][];
  hitBounds: Bounds;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 7;

function touchDistance(event: GestureResponderEvent) {
  const [first, second] = event.nativeEvent.touches;
  if (!first || !second) return null;
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

function projected([longitude, latitude]: number[]): Point {
  return { x: longitude, y: -latitude };
}

function ringToPath(ring: number[][]) {
  if (!ring.length) return '';
  const [first, ...rest] = ring.map(projected);
  return `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(' ')} Z`;
}

function featureToPath(feature: MunicipalityFeature) {
  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

  return polygons.flatMap((rings) => rings.map(ringToPath)).join(' ');
}

function ringArea(ring: number[][]) {
  return ring.reduce((area, coordinate, index) => {
    const next = ring[(index + 1) % ring.length];
    return area + coordinate[0] * next[1] - next[0] * coordinate[1];
  }, 0) / 2;
}

function ringCentroid(ring: number[][]): Point {
  const area = ringArea(ring);
  if (!ring.length || Math.abs(area) < 1e-10) {
    const total = ring.reduce(
      (sum, coordinate) => ({ x: sum.x + coordinate[0], y: sum.y - coordinate[1] }),
      { x: 0, y: 0 },
    );
    return { x: total.x / Math.max(1, ring.length), y: total.y / Math.max(1, ring.length) };
  }

  let x = 0;
  let latitude = 0;
  ring.forEach((coordinate, index) => {
    const next = ring[(index + 1) % ring.length];
    const cross = coordinate[0] * next[1] - next[0] * coordinate[1];
    x += (coordinate[0] + next[0]) * cross;
    latitude += (coordinate[1] + next[1]) * cross;
  });
  return { x: x / (6 * area), y: -(latitude / (6 * area)) };
}

function pointInRing(point: Point, ring: Point[]) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const a = ring[current];
    const b = ring[previous];
    const intersects = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function shapeContainsPoint(shape: MapShape, point: Point) {
  const { hitBounds } = shape;
  if (
    point.x < hitBounds.minX
    || point.x > hitBounds.minX + hitBounds.width
    || point.y < hitBounds.minY
    || point.y > hitBounds.minY + hitBounds.height
  ) return false;

  return shape.polygons.some(([outerRing, ...holes]) =>
    Boolean(outerRing)
    && pointInRing(point, outerRing)
    && !holes.some((hole) => pointInRing(point, hole)),
  );
}

function squaredDistanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const x = start.x + ratio * dx;
  const y = start.y + ratio * dy;
  return (point.x - x) ** 2 + (point.y - y) ** 2;
}

function distanceFromBoundary(point: Point, ring: Point[]) {
  let minimum = Number.POSITIVE_INFINITY;
  ring.forEach((start, index) => {
    minimum = Math.min(minimum, squaredDistanceToSegment(point, start, ring[(index + 1) % ring.length]));
  });
  return minimum;
}

function interiorLabelPoint(ring: number[][]) {
  const projectedRing = ring.map(projected);
  const xs = projectedRing.map((point) => point.x);
  const ys = projectedRing.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centroid = ringCentroid(ring);
  const candidates: Point[] = [centroid, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }];

  // A small grid is enough to find a stable point inside concave municipalities.
  for (let row = 1; row < 10; row += 1) {
    for (let column = 1; column < 10; column += 1) {
      candidates.push({
        x: minX + ((maxX - minX) * column) / 10,
        y: minY + ((maxY - minY) * row) / 10,
      });
    }
  }

  const insideCandidates = candidates.filter((candidate) => pointInRing(candidate, projectedRing));
  if (!insideCandidates.length) return centroid;
  return insideCandidates.reduce((best, candidate) =>
    distanceFromBoundary(candidate, projectedRing) > distanceFromBoundary(best, projectedRing)
      ? candidate
      : best,
  );
}

function buildVectorMap(map: MunicipalityFeatureCollection): { shapes: MapShape[]; bounds: Bounds } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const shapes = map.features.map((feature) => {
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;

    const projectedPolygons = polygons.map((rings) => rings.map((ring) => ring.map(projected)));
    let shapeMinX = Number.POSITIVE_INFINITY;
    let shapeMinY = Number.POSITIVE_INFINITY;
    let shapeMaxX = Number.NEGATIVE_INFINITY;
    let shapeMaxY = Number.NEGATIVE_INFINITY;

    for (const rings of projectedPolygons) {
      for (const ring of rings) {
        for (const point of ring) {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
          shapeMinX = Math.min(shapeMinX, point.x);
          shapeMinY = Math.min(shapeMinY, point.y);
          shapeMaxX = Math.max(shapeMaxX, point.x);
          shapeMaxY = Math.max(shapeMaxY, point.y);
        }
      }
    }

    const outerRings = polygons.map((rings) => rings[0]).filter(Boolean);
    const labelRing = outerRings.reduce((largest, ring) =>
      Math.abs(ringArea(ring)) > Math.abs(ringArea(largest)) ? ring : largest,
    );

    const cityId = String(feature.properties.codarea);
    return {
      key: cityId,
      cityId,
      path: featureToPath(feature),
      label: interiorLabelPoint(labelRing),
      area: Math.abs(ringArea(labelRing)),
      labelMinZoom: MIN_ZOOM,
      polygons: projectedPolygons,
      hitBounds: {
        minX: shapeMinX,
        minY: shapeMinY,
        width: shapeMaxX - shapeMinX,
        height: shapeMaxY - shapeMinY,
      },
    };
  });

  [...shapes]
    .sort((first, second) => second.area - first.area)
    .forEach((shape, index) => {
      shape.labelMinZoom = index < 18 ? 1 : index < 65 ? 2.25 : index < 170 ? 3.75 : 5.25;
    });

  const horizontalPadding = (maxX - minX) * 0.04;
  const verticalPadding = (maxY - minY) * 0.04;

  return {
    shapes,
    bounds: {
      minX: minX - horizontalPadding,
      minY: minY - verticalPadding,
      width: maxX - minX + horizontalPadding * 2,
      height: maxY - minY + verticalPadding * 2,
    },
  };
}

function clampCenter(center: Point, bounds: Bounds, zoom: number): Point {
  const halfWidth = bounds.width / zoom / 2;
  const halfHeight = bounds.height / zoom / 2;
  const minCenterX = bounds.minX + halfWidth;
  const maxCenterX = bounds.minX + bounds.width - halfWidth;
  const minCenterY = bounds.minY + halfHeight;
  const maxCenterY = bounds.minY + bounds.height - halfHeight;

  return {
    x: Math.min(maxCenterX, Math.max(minCenterX, center.x)),
    y: Math.min(maxCenterY, Math.max(minCenterY, center.y)),
  };
}

function screenToMapPoint(
  screenPoint: Point,
  layout: { width: number; height: number },
  bounds: Bounds,
  center: Point,
  zoom: number,
) {
  const visibleWidth = bounds.width / zoom;
  const visibleHeight = bounds.height / zoom;
  const scale = Math.min(layout.width / visibleWidth, layout.height / visibleHeight);
  const renderedWidth = visibleWidth * scale;
  const renderedHeight = visibleHeight * scale;
  const offsetX = (layout.width - renderedWidth) / 2;
  const offsetY = (layout.height - renderedHeight) / 2;

  if (
    screenPoint.x < offsetX
    || screenPoint.x > offsetX + renderedWidth
    || screenPoint.y < offsetY
    || screenPoint.y > offsetY + renderedHeight
  ) return null;

  return {
    x: center.x - visibleWidth / 2 + (screenPoint.x - offsetX) / scale,
    y: center.y - visibleHeight / 2 + (screenPoint.y - offsetY) / scale,
  };
}

function mapUnitsPerPixel(
  layout: { width: number; height: number },
  bounds: Bounds,
  zoom: number,
) {
  const visibleWidth = bounds.width / zoom;
  const visibleHeight = bounds.height / zoom;
  const scale = Math.min(layout.width / visibleWidth, layout.height / visibleHeight);
  return scale > 0 ? 1 / scale : Number.POSITIVE_INFINITY;
}

function mapToScreenPoint(
  mapPoint: Point,
  layout: { width: number; height: number },
  bounds: Bounds,
  center: Point,
  zoom: number,
) {
  const visibleWidth = bounds.width / zoom;
  const visibleHeight = bounds.height / zoom;
  const scale = Math.min(layout.width / visibleWidth, layout.height / visibleHeight);
  const renderedWidth = visibleWidth * scale;
  const renderedHeight = visibleHeight * scale;
  const offsetX = (layout.width - renderedWidth) / 2;
  const offsetY = (layout.height - renderedHeight) / 2;
  return {
    x: offsetX + (mapPoint.x - (center.x - visibleWidth / 2)) * scale,
    y: offsetY + (mapPoint.y - (center.y - visibleHeight / 2)) * scale,
  };
}

function squaredPointDistance(first: Point, second: Point) {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

type Props = {
  map: MunicipalityFeatureCollection;
  cityNamesById: Map<string, string>;
  visitedCityIds: Set<string>;
  selectedCityId?: string;
  onSelectCity: (cityId: string) => void;
  displayOnly?: boolean;
  showLabels?: boolean;
};

function ParanaMapComponent({
  map,
  cityNamesById,
  visitedCityIds,
  selectedCityId,
  onSelectCity,
  displayOnly = false,
  showLabels = false,
}: Props) {
  const vectorMap = useMemo(() => buildVectorMap(map), [map]);
  const initialCenter = useMemo(
    () => ({
      x: vectorMap.bounds.minX + vectorMap.bounds.width / 2,
      y: vectorMap.bounds.minY + vectorMap.bounds.height / 2,
    }),
    [vectorMap.bounds],
  );
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [center, setCenter] = useState(initialCenter);
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  const centerAtGestureStart = useRef(initialCenter);
  const zoomAtGestureStart = useRef(MIN_ZOOM);
  const pinchDistanceAtStart = useRef<number | null>(null);
  const zoomRef = useRef(MIN_ZOOM);
  const centerRef = useRef(initialCenter);
  const frameRef = useRef<number | null>(null);
  const pendingTransform = useRef<{ zoom: number; center: Point } | null>(null);
  const pinchedDuringGesture = useRef(false);
  const touchStartPoint = useRef<Point | null>(null);

  const visibleWidth = vectorMap.bounds.width / zoom;
  const visibleHeight = vectorMap.bounds.height / zoom;
  const viewBox = `${center.x - visibleWidth / 2} ${center.y - visibleHeight / 2} ${visibleWidth} ${visibleHeight}`;
  const visibleLabels = useMemo(() => {
    if (!showLabels) return [];
    const minX = center.x - visibleWidth / 2;
    const maxX = center.x + visibleWidth / 2;
    const minY = center.y - visibleHeight / 2;
    const maxY = center.y + visibleHeight / 2;
    const paddingX = visibleWidth * 0.04;
    const paddingY = visibleHeight * 0.04;
    return vectorMap.shapes.filter((shape) =>
      (shape.cityId === selectedCityId || zoom >= shape.labelMinZoom)
      && shape.label.x >= minX - paddingX
      && shape.label.x <= maxX + paddingX
      && shape.label.y >= minY - paddingY
      && shape.label.y <= maxY + paddingY,
    );
  }, [center.x, center.y, selectedCityId, showLabels, vectorMap.shapes, visibleHeight, visibleWidth, zoom]);

  const scheduleTransform = (nextZoom: number, nextCenter: Point) => {
    pendingTransform.current = { zoom: nextZoom, center: nextCenter };
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const pending = pendingTransform.current;
      pendingTransform.current = null;
      if (!pending) return;
      setZoom(pending.zoom);
      setCenter(pending.center);
    });
  };

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const selectAtScreenPoint = (screenPoint: Point) => {
    const mapPoint = screenToMapPoint(
      screenPoint,
      layout,
      vectorMap.bounds,
      centerRef.current,
      zoomRef.current,
    );
    if (!mapPoint) return;
    const exactShape = vectorMap.shapes
      .filter((shape) => shapeContainsPoint(shape, mapPoint))
      .sort((first, second) => first.area - second.area)[0];
    const snapPixels = zoomRef.current < 1.75 ? 22 : 30;
    const snapDistance = mapUnitsPerPixel(layout, vectorMap.bounds, zoomRef.current) * snapPixels;
    const closestLabelShape = vectorMap.shapes
      .map((shape) => ({ shape, distance: squaredPointDistance(shape.label, mapPoint) }))
      .filter(({ distance }) => distance <= snapDistance ** 2)
      .sort((first, second) => first.distance - second.distance)[0]?.shape;

    // On a phone, many municipalities are smaller than a fingertip. Prefer the
    // nearest city center inside a small screen-space radius, then fall back to
    // the mathematically exact polygon.
    const selectedShape = closestLabelShape ?? exactShape;
    if (selectedShape) onSelectCity(selectedShape.cityId);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          centerAtGestureStart.current = centerRef.current;
          zoomAtGestureStart.current = zoomRef.current;
          pinchDistanceAtStart.current = touchDistance(event);
          pinchedDuringGesture.current = event.nativeEvent.touches.length >= 2;
          const firstTouch = event.nativeEvent.touches[0];
          touchStartPoint.current = firstTouch
            ? { x: firstTouch.locationX, y: firstTouch.locationY }
            : { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
        },
        onPanResponderMove: (event, gesture) => {
          const distance = touchDistance(event);
          if (distance !== null) {
            pinchedDuringGesture.current = true;
            if (pinchDistanceAtStart.current === null) {
              pinchDistanceAtStart.current = distance;
              zoomAtGestureStart.current = zoomRef.current;
              centerAtGestureStart.current = centerRef.current;
              return;
            }

            const nextZoom = Math.min(
              MAX_ZOOM,
              Math.max(MIN_ZOOM, zoomAtGestureStart.current * (distance / pinchDistanceAtStart.current)),
            );
            const nextCenter = clampCenter(centerAtGestureStart.current, vectorMap.bounds, nextZoom);
            zoomRef.current = nextZoom;
            centerRef.current = nextCenter;
            scheduleTransform(nextZoom, nextCenter);
            return;
          }

          if (zoomRef.current <= MIN_ZOOM) return;
          const gestureVisibleWidth = vectorMap.bounds.width / zoomAtGestureStart.current;
          const gestureVisibleHeight = vectorMap.bounds.height / zoomAtGestureStart.current;
          const nextCenter = {
            x: centerAtGestureStart.current.x - (gesture.dx / layout.width) * gestureVisibleWidth,
            y: centerAtGestureStart.current.y - (gesture.dy / layout.height) * gestureVisibleHeight,
          };
          const clampedCenter = clampCenter(nextCenter, vectorMap.bounds, zoomRef.current);
          centerRef.current = clampedCenter;
          scheduleTransform(zoomRef.current, clampedCenter);
        },
        onPanResponderRelease: (event, gesture) => {
          if (
            !pinchedDuringGesture.current
            && Math.abs(gesture.dx) < 9
            && Math.abs(gesture.dy) < 9
          ) {
            const changedTouch = event.nativeEvent.changedTouches[0];
            selectAtScreenPoint(touchStartPoint.current ?? (changedTouch
              ? { x: changedTouch.locationX, y: changedTouch.locationY }
              : { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }));
          }
          pinchDistanceAtStart.current = null;
          pinchedDuringGesture.current = false;
          touchStartPoint.current = null;
        },
        onPanResponderTerminate: () => {
          pinchDistanceAtStart.current = null;
          pinchedDuringGesture.current = false;
          touchStartPoint.current = null;
        },
      }),
    [layout.height, layout.width, onSelectCity, vectorMap.bounds, vectorMap.shapes],
  );

  const changeZoom = (increment: number) => {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current + increment));
    const nextCenter = clampCenter(centerRef.current, vectorMap.bounds, nextZoom);
    zoomRef.current = nextZoom;
    centerRef.current = nextCenter;
    scheduleTransform(nextZoom, nextCenter);
  };

  const resetMap = () => {
    zoomRef.current = MIN_ZOOM;
    centerRef.current = initialCenter;
    scheduleTransform(MIN_ZOOM, initialCenter);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width: Math.max(1, width), height: Math.max(1, height) });
  };

  return (
    <View onLayout={handleLayout} style={styles.container}>
      <View {...(displayOnly ? {} : panResponder.panHandlers)} style={styles.mapSurface}>
        <View style={styles.watermarkOne} />
        <View style={styles.watermarkTwo} />
        <Svg
          width="100%"
          height="100%"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={styles.svg}
          pointerEvents="none"
        >
        {vectorMap.shapes.map((shape) => {
          const visited = visitedCityIds.has(shape.cityId);
          const selected = selectedCityId === shape.cityId;

          return (
            <Path
              key={shape.key}
              d={shape.path}
              fill={visited ? '#3C9B68' : '#F2E8C9'}
              fillRule="evenodd"
              stroke={selected ? '#D98117' : visited ? '#185C39' : '#587360'}
              strokeWidth={(selected ? 0.032 : 0.01) / zoom}
            />
          );
        })}
        </Svg>
        <View pointerEvents="none" style={styles.labelsLayer}>
          {visibleLabels.map((shape) => {
            const name = cityNamesById.get(shape.cityId);
            if (!name) return null;
            const screenPoint = mapToScreenPoint(shape.label, layout, vectorMap.bounds, center, zoom);
            const selected = shape.cityId === selectedCityId;
            return (
              <View
                key={`label-${shape.key}`}
                style={[styles.labelAnchor, { left: screenPoint.x - 70, top: screenPoint.y - 11 }]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.cityLabel,
                    { fontSize: selected ? 12 : 8 + Math.min(zoom, 5) * 0.55 },
                    selected && styles.selectedCityLabel,
                  ]}
                >
                  {name}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {!displayOnly ? <View style={styles.zoomControls}>
        <Pressable
          accessibilityLabel="Aproximar mapa"
          accessibilityRole="button"
          disabled={zoom >= MAX_ZOOM}
          onPress={() => changeZoom(1)}
          style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomPressed]}
        >
          <Text style={styles.zoomText}>+</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          accessibilityLabel="Afastar mapa"
          accessibilityRole="button"
          disabled={zoom <= MIN_ZOOM}
          onPress={() => changeZoom(-1)}
          style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomPressed]}
        >
          <Text style={styles.zoomText}>−</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          accessibilityLabel="Mostrar todo o Paraná"
          accessibilityRole="button"
          onPress={resetMap}
          style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomPressed]}
        >
          <Text style={styles.resetText}>PR</Text>
        </Pressable>
      </View> : null}

      {!displayOnly && zoom > MIN_ZOOM ? (
        <View style={styles.panHint}>
          <Text style={styles.panHintText}>Arraste para explorar · use a pinça para ajustar</Text>
        </View>
      ) : !displayOnly ? (
        <View style={styles.panHint}>
          <Text style={styles.panHintText}>Use os botões ou abra dois dedos para aproximar</Text>
        </View>
      ) : null}
    </View>
  );
}

export const ParanaMap = memo(ParanaMapComponent);

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: '#DCE9ED' },
  mapSurface: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  labelsLayer: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2, elevation: 2,
  },
  labelAnchor: {
    position: 'absolute', width: 140, height: 22, alignItems: 'center', justifyContent: 'center',
  },
  cityLabel: {
    maxWidth: 132,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
    color: '#000000',
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    fontWeight: '700',
    textAlign: 'center',
  },
  selectedCityLabel: { backgroundColor: '#FFFFFF', fontWeight: '900' },
  svg: { zIndex: 1 },
  watermarkOne: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    left: -130,
    top: '31%',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  watermarkTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -120,
    bottom: '19%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  zoomControls: {
    position: 'absolute',
    zIndex: 2,
    right: 16,
    bottom: 92,
    width: 48,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: 'rgba(250, 252, 247, 0.96)',
    boxShadow: '0 5px 12px rgba(23, 53, 31, 0.15)',
    elevation: 5,
  },
  zoomButton: { height: 46, alignItems: 'center', justifyContent: 'center' },
  zoomPressed: { backgroundColor: '#E5EEE5' },
  zoomText: { color: '#244B30', fontSize: 27, lineHeight: 30, fontWeight: '500' },
  resetText: { color: '#1E6A42', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#D7E0D7' },
  panHint: {
    position: 'absolute',
    zIndex: 2,
    bottom: 91,
    alignSelf: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(24, 55, 33, 0.78)',
    pointerEvents: 'none',
  },
  panHintText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
