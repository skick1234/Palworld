import { describe, expect, test, vi } from "vitest";
import { createLeafletMap } from "../src/map/create-leaflet-map";

describe("MapController", () => {
  test("disposes its observer and the single Leaflet map", () => {
    const remove = vi.fn();
    const disconnect = vi.fn();
    const map = { setView: () => map, on: () => map, off: () => map, remove };
    const inertLayer = { addTo: vi.fn() };
    const leaflet = {
      CRS: { Simple: {} }, map: () => map,
      layerGroup: () => ({ addTo: () => ({ clearLayers: vi.fn(), addLayer: vi.fn() }) }),
      imageOverlay: () => inertLayer, polygon: () => inertLayer, polyline: () => inertLayer,
      circleMarker: () => inertLayer, featureGroup: () => ({ getBounds: () => ({ pad: () => ({}) }) })
    };
    const controller = createLeafletMap(document.createElement("div"), { onSelect: vi.fn(), onPolygonChange: vi.fn(), onDrawn: vi.fn(), onCoordinate: vi.fn() }, { leaflet: leaflet as never, createResizeObserver: () => ({ observe: vi.fn(), disconnect }) });

    controller.dispose();

    expect(remove).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  test("renders, selects, reports coordinates, and completes a drawn polygon", () => {
    const handlers = new Map<string, (event: unknown) => void>();
    const overlays: string[] = [];
    const polygons: Array<{ trigger(event: string): void }> = [];
    const layerGroup = () => ({ clearLayers: vi.fn(), addLayer: vi.fn(), addTo: () => group });
    const group = { clearLayers: vi.fn(), addLayer: vi.fn() };
    const map = {
      setView: () => map,
      on: (event: string, handler: (event: unknown) => void) => { handlers.set(event, handler); return map; },
      off: (event: string) => { handlers.delete(event); return map; },
      remove: vi.fn(),
      setMaxBounds: vi.fn(),
      fitBounds: vi.fn(),
      invalidateSize: vi.fn()
    };
    const leaflet = {
      CRS: { Simple: {} },
      DomEvent: { stopPropagation: vi.fn() },
      map: () => map,
      layerGroup,
      imageOverlay: (source: string) => { overlays.push(source); return { addTo: vi.fn() }; },
      polygon: () => {
        const layerHandlers = new Map<string, () => void>();
        const layer = {
          addTo: vi.fn(() => layer),
          bindTooltip: vi.fn(() => layer),
          on: vi.fn((event: string, handler: () => void) => { layerHandlers.set(event, handler); return layer; }),
          getBounds: () => ({ pad: () => ({}) }),
          getLatLngs: () => [[]],
          getElement: () => null,
          trigger: (event: string) => { layerHandlers.get(event)?.(); }
        };
        polygons.push(layer);
        return layer;
      },
      polyline: () => ({ addTo: vi.fn() }),
      circleMarker: () => ({ addTo: vi.fn() }),
      featureGroup: () => ({ getBounds: () => ({ pad: () => ({}) }) })
    };
    const onSelect = vi.fn();
    const onDrawn = vi.fn();
    const onCoordinate = vi.fn();
    const controller = createLeafletMap(document.createElement("div"), { onSelect, onPolygonChange: vi.fn(), onDrawn, onCoordinate }, { leaflet: leaflet as never, createResizeObserver: () => ({ observe: vi.fn(), disconnect: vi.fn() }) });

    controller.update({
      maps: [{ id: "world", label: "World", projection: "paldb-world", canvas: { width: 2048, height: 2048 }, inGameCoordinates: { scale: 459, mapXOffset: -158000, mapYOffset: 123888 }, tiles: { root: "assets/map", zoom: 2, columns: 1, rows: 1 }, bounds: { minX: -1099400, minY: -724400, maxX: 349400, maxY: 724400 } }],
      activeMapId: "world",
      modes: [{ id: "pve", color: "#38BDF8" }],
      regions: [{ name: "Town", mode: "pve", map: "world", polygon: [[-100, -100], [100, -100], [0, 100]] }],
      selectedRegionIndex: null,
      editingShape: false
    });
    const renderedPolygonCount = polygons.length;
    controller.update({
      maps: [{ id: "world", label: "World", projection: "paldb-world", canvas: { width: 2048, height: 2048 }, inGameCoordinates: { scale: 459, mapXOffset: -158000, mapYOffset: 123888 }, tiles: { root: "assets/map", zoom: 2, columns: 1, rows: 1 }, bounds: { minX: -1099400, minY: -724400, maxX: 349400, maxY: 724400 } }],
      activeMapId: "world", modes: [{ id: "pve", color: "#38BDF8" }],
      regions: [{ name: "Town", mode: "pve", map: "world", polygon: [[-100, -100], [100, -100], [0, 100]] }],
      selectedRegionIndex: null, editingShape: false
    });
    polygons[0]!.trigger("click");
    handlers.get("mousemove")?.({ latlng: { lat: 1024, lng: 1024 } });
    controller.dispatch({ type: "start-drawing" });
    handlers.get("click")?.({ latlng: { lat: 100, lng: 100, distanceTo: () => 10 } });
    handlers.get("click")?.({ latlng: { lat: 200, lng: 100, distanceTo: () => 10 } });
    handlers.get("click")?.({ latlng: { lat: 200, lng: 200, distanceTo: () => 10 } });
    controller.dispatch({ type: "finish-drawing" });

    expect(overlays).toEqual(["assets/map/z2x0y0.webp"]);
    expect(polygons).toHaveLength(renderedPolygonCount);
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(onCoordinate).toHaveBeenCalledWith(expect.stringContaining("Map X"));
    expect(onDrawn).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Array)]));
  });

  test("publishes one polygon change after moving the selected region", () => {
    const mapHandlers = new Map<string, (event: unknown) => void>();
    const pathHandlers = new Map<string, (event: PointerEvent) => void>();
    const path = {
      addEventListener: (event: string, handler: (value: PointerEvent) => void) => { pathHandlers.set(event, handler); },
      removeEventListener: (event: string) => { pathHandlers.delete(event); },
      setPointerCapture: vi.fn(), hasPointerCapture: () => false, releasePointerCapture: vi.fn()
    };
    let points = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 0 }];
    const layer = {
      bindTooltip: () => layer, on: () => layer, getElement: () => path,
      getLatLngs: () => [points], setLatLngs: (next: typeof points) => { points = next; return layer; }, redraw: () => layer,
      getBounds: () => ({ pad: () => ({ pad: vi.fn() }) })
    };
    const map = {
      setView: () => map, on: (event: string, handler: (event: unknown) => void) => { mapHandlers.set(event, handler); return map; }, off: () => map,
      remove: vi.fn(), setMaxBounds: vi.fn(), mouseEventToLatLng: (event: { clientX: number; clientY: number }) => ({ lat: event.clientY, lng: event.clientX }),
      dragging: { enable: vi.fn(), disable: vi.fn() }
    };
    const leaflet = {
      CRS: { Simple: {} }, map: () => map, latLng: (lat: number, lng: number) => ({ lat, lng }),
      layerGroup: () => ({ addTo: () => ({ clearLayers: vi.fn(), addLayer: vi.fn() }) }), imageOverlay: () => ({}), polygon: () => layer,
      polyline: () => ({}), circleMarker: () => ({}), featureGroup: () => ({ getBounds: () => ({ pad: () => ({}) }) })
    };
    const onPolygonChange = vi.fn();
    const controller = createLeafletMap(document.createElement("div"), { onSelect: vi.fn(), onPolygonChange, onDrawn: vi.fn(), onCoordinate: vi.fn() }, { leaflet: leaflet as never, createResizeObserver: () => ({ observe: vi.fn(), disconnect: vi.fn() }) });
    controller.update({ maps: [{ id: "world", label: "World", projection: "paldb-world", canvas: { width: 100, height: 100 }, inGameCoordinates: { scale: 1, mapXOffset: 0, mapYOffset: 0 }, tiles: { root: "tiles", zoom: 0, columns: 1, rows: 1 }, bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } }], activeMapId: "world", modes: [{ id: "pve", color: "#fff" }], regions: [{ name: "Move", mode: "pve", map: "world", polygon: [[0, 0], [10, 0], [0, 10]] }], selectedRegionIndex: 0, editingShape: false });
    const pointer = (type: string, values: Record<string, unknown>) => {
      const event = { type, pointerId: 1, isPrimary: true, button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...values } as unknown as PointerEvent;
      pathHandlers.get(type)?.(event);
    };

    pointer("pointerdown", { clientX: 0, clientY: 0 });
    pointer("pointermove", { clientX: 10, clientY: 10 });
    pointer("pointerup", { clientX: 10, clientY: 10 });

    expect(onPolygonChange).toHaveBeenCalledOnce();
  });
});
