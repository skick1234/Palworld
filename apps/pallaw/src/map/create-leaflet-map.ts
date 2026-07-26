import { mapFractionToWorld, worldToInGameMap, worldToMapFraction } from "../domain/map-coordinates";
import type { MapDefinition } from "../domain/map-coordinates";

export interface MapRegion {
  readonly name: string;
  readonly enabled?: boolean;
  readonly mode: string;
  readonly map?: string;
  readonly polygon: readonly (readonly [number, number])[];
}

export interface MapMode { readonly id: string; readonly color: string; }

export interface MapSnapshot {
  readonly maps: readonly MapDefinition[];
  readonly activeMapId: string;
  readonly modes: readonly MapMode[];
  readonly regions: readonly MapRegion[];
  readonly selectedRegionIndex: number | null;
  readonly editingShape: boolean;
}

export type MapCommand =
  | { readonly type: "fit-visible" }
  | { readonly type: "fit-selected" }
  | { readonly type: "start-drawing" }
  | { readonly type: "finish-drawing" }
  | { readonly type: "cancel-drawing" };

export interface MapController {
  update(snapshot: MapSnapshot): void;
  dispatch(command: MapCommand): void;
  dispose(): void;
}

export interface MapCallbacks {
  readonly onSelect: (index: number) => void;
  readonly onPolygonChange: (index: number, polygon: readonly (readonly [number, number])[]) => void;
  readonly onDrawn: (polygon: readonly (readonly [number, number])[]) => void;
  readonly onCoordinate: (text: string) => void;
  readonly onDrawingChange?: (drawing: boolean, pointCount: number) => void;
}

interface LatLngLike { readonly lat: number; readonly lng: number; distanceTo?(other: LatLngLike): number; }
interface BoundsLike { pad(ratio: number): BoundsLike; }
interface LayerLike {
  addTo?(target: unknown): LayerLike;
  bindTooltip?(text: string, options: Readonly<Record<string, unknown>>): LayerLike;
  on?(event: string, handler: (event: unknown) => void): LayerLike;
  off?(event?: string, handler?: (event: unknown) => void): LayerLike;
  getBounds?(): BoundsLike;
  getLatLngs?(): readonly (readonly LatLngLike[])[];
  getElement?(): PointerPathLike | null;
  setLatLngs?(points: readonly LatLngLike[]): LayerLike;
  redraw?(): LayerLike;
  enableEdit?(): void;
  disableEdit?(): void;
}
interface PointerPathLike {
  addEventListener(event: string, handler: (event: PointerEvent) => void): void;
  removeEventListener(event: string, handler: (event: PointerEvent) => void): void;
  setPointerCapture?(pointerId: number): void;
  hasPointerCapture?(pointerId: number): boolean;
  releasePointerCapture?(pointerId: number): void;
}
interface LayerGroupLike { clearLayers(): void; addLayer(layer: unknown): void; }
interface MapLike {
  setView(center: readonly [number, number], zoom: number): MapLike;
  setMaxBounds?(bounds: readonly [readonly [number, number], readonly [number, number]]): void;
  fitBounds?(bounds: unknown, options?: Readonly<Record<string, unknown>>): void;
  on(event: string, handler: (event: unknown) => void): MapLike;
  off(event: string, handler: (event: unknown) => void): MapLike;
  removeLayer?(layer: unknown): void;
  remove(): void;
  invalidateSize?(options?: unknown): void;
  mouseEventToLatLng?(event: PointerEvent): LatLngLike;
  readonly dragging?: { enable(): void; disable(): void };
}
interface LeafletPort {
  readonly CRS: { readonly Simple: unknown };
  readonly DomEvent?: { stopPropagation(event: unknown): void };
  map(element: HTMLElement, options: Readonly<Record<string, unknown>>): MapLike;
  layerGroup(): { addTo(map: MapLike): LayerGroupLike };
  imageOverlay(source: string, bounds: unknown, options: Readonly<Record<string, unknown>>): LayerLike;
  polygon(points: readonly LatLngLike[], options: Readonly<Record<string, unknown>>): LayerLike;
  polyline(points: readonly LatLngLike[], options: Readonly<Record<string, unknown>>): LayerLike;
  circleMarker(point: LatLngLike, options: Readonly<Record<string, unknown>>): LayerLike;
  featureGroup(layers: readonly LayerLike[]): { getBounds(): BoundsLike };
  latLng?(lat: number, lng: number): LatLngLike;
}
interface ResizeObserverPort { observe(element: Element): void; disconnect(): void; }
interface MapDependencies {
  readonly leaflet?: LeafletPort;
  readonly createResizeObserver?: (callback: () => void) => ResizeObserverPort;
}

declare global { interface Window { L?: unknown; } }

function eventLatLng(event: unknown): LatLngLike | null {
  if (!event || typeof event !== "object" || !("latlng" in event)) return null;
  const value = event.latlng;
  return value && typeof value === "object" && "lat" in value && "lng" in value &&
    typeof value.lat === "number" && typeof value.lng === "number"
    ? value as LatLngLike
    : null;
}

export function createLeafletMap(element: HTMLElement, callbacks: MapCallbacks, dependencies: MapDependencies = {}): MapController {
  const candidate = dependencies.leaflet ?? window.L as unknown as LeafletPort | undefined;
  if (!candidate) throw new Error("The bundled map library could not be loaded.");
  const port: LeafletPort = candidate;
  const map = port.map(element, {
    crs: port.CRS.Simple, minZoom: -2, maxZoom: 3, zoomSnap: 0.25, zoomDelta: 0.5,
    attributionControl: false, doubleClickZoom: false, editable: true,
    maxBounds: [[-180, -180], [2228, 2228]], maxBoundsViscosity: 0.75
  }).setView([1024, 1024], -0.35);
  const baseLayers = port.layerGroup().addTo(map);
  const regionLayers = port.layerGroup().addTo(map);
  const drawLayers = port.layerGroup().addTo(map);
  const eventHandlers: Array<readonly [string, (event: unknown) => void]> = [];
  const renderedRegions = new Map<number, LayerLike>();
  let regionBindings: Array<() => void> = [];
  let current: MapSnapshot | null = null;
  let drawing = false;
  let drawPoints: LatLngLike[] = [];
  let drawPreview: LayerLike | null = null;
  let renderedBaseKey = "";
  let renderedRegionKey = "";

  const definition = () => current?.maps.find((entry) => entry.id === current?.activeMapId) ?? current?.maps[0] ?? null;
  const canvasBounds = (mapDefinition: MapDefinition): readonly [readonly [number, number], readonly [number, number]] =>
    [[0, 0], [mapDefinition.canvas.height, mapDefinition.canvas.width]];
  const paddedBounds = (mapDefinition: MapDefinition): readonly [readonly [number, number], readonly [number, number]] => {
    const padding = Math.max(mapDefinition.canvas.width, mapDefinition.canvas.height) * 0.08;
    return [[-padding, -padding], [mapDefinition.canvas.height + padding, mapDefinition.canvas.width + padding]];
  };
  const toLatLng = (point: readonly [number, number], mapDefinition: MapDefinition): LatLngLike => {
    const [horizontal, vertical] = worldToMapFraction(point, mapDefinition);
    return { lat: vertical * mapDefinition.canvas.height, lng: horizontal * mapDefinition.canvas.width };
  };
  const toWorld = (point: LatLngLike, mapDefinition: MapDefinition): readonly [number, number] => {
    const [x, y] = mapFractionToWorld([point.lng / mapDefinition.canvas.width, point.lat / mapDefinition.canvas.height], mapDefinition);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  };
  const bind = (event: string, handler: (event: unknown) => void) => { eventHandlers.push([event, handler]); map.on(event, handler); };
  const notifyDrawing = () => { callbacks.onDrawingChange?.(drawing, drawPoints.length); };

  function clearDrawing(): void {
    drawing = false;
    drawPoints = [];
    if (drawPreview) map.removeLayer?.(drawPreview);
    drawPreview = null;
    drawLayers.clearLayers();
    notifyDrawing();
  }

  function refreshDrawing(): void {
    if (drawPreview) map.removeLayer?.(drawPreview);
    drawPreview = drawPoints.length
      ? port.polyline(drawPoints, { color: "#f8fafc", weight: 3, dashArray: "7 6" })
      : null;
    drawPreview?.addTo?.(map);
    drawLayers.clearLayers();
    drawPoints.forEach((point, index) => {
      const marker = port.circleMarker(point, {
        radius: index === 0 ? 7 : 5, color: "#f8fafc", weight: index === 0 ? 3 : 2,
        fillColor: index === 0 ? "#38bdf8" : "#0ea5e9", fillOpacity: 1, interactive: false
      });
      drawLayers.addLayer(marker);
    });
    notifyDrawing();
  }

  function renderBaseLayer(mapDefinition: MapDefinition): void {
    baseLayers.clearLayers();
    map.setMaxBounds?.(paddedBounds(mapDefinition));
    const tileWidth = mapDefinition.canvas.width / mapDefinition.tiles.columns;
    const tileHeight = mapDefinition.canvas.height / mapDefinition.tiles.rows;
    for (let y = 0; y < mapDefinition.tiles.rows; y += 1) for (let x = 0; x < mapDefinition.tiles.columns; x += 1) {
      const west = x * tileWidth;
      const east = west + tileWidth;
      const north = mapDefinition.canvas.height - y * tileHeight;
      const south = north - tileHeight;
      baseLayers.addLayer(port.imageOverlay(
        `${mapDefinition.tiles.root}/z${mapDefinition.tiles.zoom}x${x}y${y}.webp`,
        [[south, west], [north, east]], { interactive: false, opacity: 1 }
      ));
    }
  }

  function renderRegions(snapshot: MapSnapshot, mapDefinition: MapDefinition): void {
    for (const dispose of regionBindings) dispose();
    regionBindings = [];
    regionLayers.clearLayers();
    renderedRegions.clear();
    snapshot.regions.forEach((region, index) => {
      if ((region.map ?? "world") !== snapshot.activeMapId || region.polygon.length < 3) return;
      const selected = index === snapshot.selectedRegionIndex;
      const color = snapshot.modes.find((mode) => mode.id === region.mode)?.color ?? snapshot.modes[0]?.color ?? "#38BDF8";
      const layer = port.polygon(region.polygon.map((point) => toLatLng(point, mapDefinition)), {
        className: selected ? "region-polygon selected-region-polygon" : "region-polygon",
        color, fillColor: color, fillOpacity: region.enabled === false ? 0.06 : selected ? 0.28 : 0.2,
        opacity: region.enabled === false ? 0.45 : 0.95, weight: selected ? 4 : 2,
        dashArray: region.enabled === false ? "7 7" : null
      });
      regionLayers.addLayer(layer);
      layer.bindTooltip?.(region.name, { permanent: false, direction: "center", className: "region-label" });
      layer.on?.("click", (event) => { port.DomEvent?.stopPropagation(event); callbacks.onSelect(index); });
      if (selected && snapshot.editingShape) {
        layer.enableEdit?.();
        const changed = () => {
          const points = layer.getLatLngs?.()[0] ?? [];
          if (points.length >= 3) callbacks.onPolygonChange(index, points.map((point) => toWorld(point, mapDefinition)));
        };
        layer.on?.("editable:vertex:dragend", changed);
        layer.on?.("editable:vertex:deleted", changed);
      } else if (selected && !drawing) {
        const path = layer.getElement?.();
        if (path && layer.getLatLngs && layer.setLatLngs && layer.redraw && map.mouseEventToLatLng) {
          let pointerId: number | null = null;
          let startClient = { x: 0, y: 0 };
          let startPoint: LatLngLike | null = null;
          let original: LatLngLike[] = [];
          let moved = false;
          const move = (event: PointerEvent) => {
            if (pointerId === null || event.pointerId !== pointerId || !startPoint) return;
            if (!moved && Math.hypot(event.clientX - startClient.x, event.clientY - startClient.y) < 3) return;
            moved = true;
            const point = map.mouseEventToLatLng!(event);
            const latitudeDelta = point.lat - startPoint.lat;
            const longitudeDelta = point.lng - startPoint.lng;
            layer.setLatLngs!(original.map((entry) => port.latLng?.(entry.lat + latitudeDelta, entry.lng + longitudeDelta) ?? { lat: entry.lat + latitudeDelta, lng: entry.lng + longitudeDelta })).redraw?.();
            event.preventDefault();
            event.stopPropagation();
          };
          const finish = (event: PointerEvent) => {
            if (pointerId === null || event.pointerId !== pointerId) return;
            path.removeEventListener("pointermove", move);
            path.removeEventListener("pointerup", finish);
            path.removeEventListener("pointercancel", finish);
            if (path.hasPointerCapture?.(pointerId)) path.releasePointerCapture?.(pointerId);
            map.dragging?.enable();
            element.classList.remove("moving-region");
            const cancelled = event.type === "pointercancel";
            if (cancelled && moved) layer.setLatLngs?.(original).redraw?.();
            if (moved && !cancelled) {
              const points = layer.getLatLngs?.()[0] ?? [];
              callbacks.onPolygonChange(index, points.map((point) => toWorld(point, mapDefinition)));
            }
            pointerId = null;
          };
          const start = (event: PointerEvent) => {
            if (drawing || snapshot.editingShape || event.isPrimary === false || event.button !== 0) return;
            pointerId = event.pointerId;
            startClient = { x: event.clientX, y: event.clientY };
            startPoint = map.mouseEventToLatLng!(event);
            original = [...(layer.getLatLngs?.()[0] ?? [])].map((point) => port.latLng?.(point.lat, point.lng) ?? { lat: point.lat, lng: point.lng });
            moved = false;
            map.dragging?.disable();
            element.classList.add("moving-region");
            path.setPointerCapture?.(pointerId);
            path.addEventListener("pointermove", move);
            path.addEventListener("pointerup", finish);
            path.addEventListener("pointercancel", finish);
            event.preventDefault();
            event.stopPropagation();
          };
          path.addEventListener("pointerdown", start);
          regionBindings.push(() => {
            path.removeEventListener("pointerdown", start);
            path.removeEventListener("pointermove", move);
            path.removeEventListener("pointerup", finish);
            path.removeEventListener("pointercancel", finish);
          });
        }
      }
      renderedRegions.set(index, layer);
    });
  }

  bind("mousemove", (event) => {
    const point = eventLatLng(event);
    const mapDefinition = definition();
    if (!point || !mapDefinition) return;
    const world = toWorld(point, mapDefinition);
    const [mapX, mapY] = worldToInGameMap(world, mapDefinition);
    callbacks.onCoordinate(`Map X ${Math.round(mapX).toLocaleString()} · Y ${Math.round(mapY).toLocaleString()} | World X ${world[0].toLocaleString()} · Y ${world[1].toLocaleString()}`);
  });
  bind("mouseout", () => { callbacks.onCoordinate("Map X - | Y -"); });
  bind("click", (event) => {
    if (!drawing) return;
    const point = eventLatLng(event);
    if (!point) return;
    const previous = drawPoints.at(-1);
    if (!previous || !previous.distanceTo || previous.distanceTo(point) > 0.01) drawPoints.push(point);
    refreshDrawing();
  });
  bind("dblclick", () => { controller.dispatch({ type: "finish-drawing" }); });

  const createObserver = dependencies.createResizeObserver ?? ((callback: () => void) => new ResizeObserver(callback));
  const observer = createObserver(() => { map.invalidateSize?.({ animate: false, pan: true }); });
  observer.observe(element);

  const controller: MapController = {
    update(snapshot) {
      current = snapshot;
      const mapDefinition = definition();
      if (!mapDefinition) return;
      const baseKey = JSON.stringify([snapshot.activeMapId, mapDefinition]);
      const regionKey = JSON.stringify([
        snapshot.activeMapId, snapshot.selectedRegionIndex, snapshot.editingShape,
        snapshot.modes.map(({ id, color }) => [id, color]),
        snapshot.regions.map(({ name, enabled, mode, map: regionMap, polygon }) => [name, enabled, mode, regionMap, polygon])
      ]);
      if (baseKey !== renderedBaseKey) {
        clearDrawing();
        renderBaseLayer(mapDefinition);
        renderedBaseKey = baseKey;
      }
      if (regionKey !== renderedRegionKey) {
        renderRegions(snapshot, mapDefinition);
        renderedRegionKey = regionKey;
      }
    },
    dispatch(command) {
      const mapDefinition = definition();
      if (!current || !mapDefinition) return;
      if (command.type === "start-drawing") {
        clearDrawing();
        drawing = true;
        notifyDrawing();
      } else if (command.type === "cancel-drawing") {
        clearDrawing();
        renderRegions(current, mapDefinition);
      } else if (command.type === "finish-drawing") {
        if (!drawing || drawPoints.length < 3) return;
        const polygon = drawPoints.map((point) => toWorld(point, mapDefinition));
        clearDrawing();
        callbacks.onDrawn(polygon);
      } else if (command.type === "fit-selected") {
        const layer = current.selectedRegionIndex === null ? null : renderedRegions.get(current.selectedRegionIndex);
        const bounds = layer?.getBounds?.();
        if (bounds) map.fitBounds?.(bounds.pad(0.25), { animate: false });
      } else {
        const layers = [...renderedRegions.values()];
        const bounds = layers.length ? port.featureGroup(layers).getBounds().pad(0.12) : canvasBounds(mapDefinition);
        map.fitBounds?.(bounds, { animate: false, padding: [10, 10] });
      }
    },
    dispose() {
      clearDrawing();
      observer.disconnect();
      for (const dispose of regionBindings) dispose();
      for (const layer of renderedRegions.values()) layer.off?.();
      for (const [event, handler] of eventHandlers) map.off(event, handler);
      map.remove();
    }
  };
  return Object.freeze(controller);
}
