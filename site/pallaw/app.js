import {
  ACTIONS,
  ACTORS,
  CONFIG_FILE_NAME,
  MAPS,
  MESSAGE_EVENTS,
  MODES,
  areaAt,
  clone,
  createDefaultConfig,
  effectiveActions,
  effectiveCombat,
  enabledMessageOutputCount,
  evaluateCombat,
  hydrateConfig,
  modeDefinition,
  mapFractionToWorld,
  parseConfigBytesWithMigration,
  parseConfigTextWithMigration,
  quickCombatOverride,
  setQuickCombatOverride,
  stringifyConfig,
  validateConfig,
  worldToInGameMap,
  worldToMapFraction
} from "./rules-core.js?v=6";
import { createMessageEditor } from "./message-editor.js?v=6";
import { createDocumentStore } from "./document-store.js?v=6";

const STORAGE_KEY = "pallaw.studio.v1";

const elements = {
  undoButton: document.querySelector("#undoButton"),
  redoButton: document.querySelector("#redoButton"),
  newButton: document.querySelector("#newButton"),
  importButton: document.querySelector("#importButton"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  sectionNav: document.querySelector("#sectionNav"),
  workspace: document.querySelector("#workspace"),
  workspaceViewNav: document.querySelector("#workspaceViewNav"),
  sidebar: document.querySelector("#sidebarContent"),
  inspector: document.querySelector("#inspectorContent"),
  regionCountBadge: document.querySelector("#regionCountBadge"),
  mapSwitcher: document.querySelector("#mapSwitcher"),
  map: document.querySelector("#map"),
  editShapeButton: document.querySelector("#editShapeButton"),
  drawButton: document.querySelector("#drawButton"),
  finishDrawButton: document.querySelector("#finishDrawButton"),
  cancelDrawButton: document.querySelector("#cancelDrawButton"),
  fitButton: document.querySelector("#fitButton"),
  drawHint: document.querySelector("#drawHint"),
  coordinateReadout: document.querySelector("#coordinateReadout"),
  mapHelp: document.querySelector("#mapHelp"),
  toastRegion: document.querySelector("#toastRegion"),
  regionEditorDialog: document.querySelector("#regionEditorDialog"),
  areaEditorKind: document.querySelector("#areaEditorKind"),
  regionEditorTitle: document.querySelector("#regionEditorTitle"),
  regionEditorContent: document.querySelector("#regionEditorContent"),
  regionEditorCloseButton: document.querySelector("#regionEditorCloseButton"),
  regionEditorDoneButton: document.querySelector("#regionEditorDoneButton"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmMessage: document.querySelector("#confirmMessage")
};

const L = window.L;
if (!L) throw new Error("The bundled map library could not be loaded.");

const LOCALIZATION_PANEL_ID = "localization";
let initialMigrationReport = [];

const documentStore = createDocumentStore({
  initialValue: loadDraft(),
  hydrate: hydrateConfig,
  serialize: stringifyConfig,
  persist: persistDraft,
  historyLimit: 80
});
let config = documentStore.value;
let activeSection = initialMigrationReport.length ? "json" : "regions";
let workspaceView = initialMigrationReport.length ? "edit" : "list";
let selectedMessagesPanelId = MESSAGE_EVENTS[0].id;
let activeMapId = "world";
let selectedRegionIndex = config.regions.length ? 0 : null;
let inspectorTab = "general";
let regionSearch = "";
let rawEditorValue = documentStore.serialized;
let drawing = false;
let drawPoints = [];
let drawPreview = null;
let editingRegionShape = false;
let suppressRegionClick = false;
let editingWilderness = false;
let activeAreaSettingsTrigger = null;


const map = L.map(elements.map, {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 3,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  attributionControl: false,
  doubleClickZoom: false,
  editable: true,
  maxBounds: [[-180, -180], [2228, 2228]],
  maxBoundsViscosity: 0.75
});
map.setView([1024, 1024], -0.35);

const baseLayerGroup = L.layerGroup().addTo(map);
const regionLayerGroup = L.layerGroup().addTo(map);
const drawPointLayerGroup = L.layerGroup().addTo(map);
const regionLayers = new Map();
let pendingMapFit = null;
let mapLayoutFrame = 0;

function mapHasUsableSize() {
  return elements.map.clientWidth > 0 && elements.map.clientHeight > 0;
}

function applyMapFit(kind) {
  if (kind === "selected") {
    const layer = selectedRegionIndex == null ? null : regionLayers.get(selectedRegionIndex);
    if (layer) map.fitBounds(layer.getBounds().pad(0.25), { animate: false });
    return;
  }

  const layers = [...regionLayers.values()];
  if (layers.length) {
    const group = L.featureGroup(layers);
    map.fitBounds(group.getBounds().pad(0.12), { animate: false });
  } else {
    map.fitBounds(canvasBounds(), { animate: false, padding: [10, 10] });
  }
}

function syncMapLayout() {
  mapLayoutFrame = 0;
  if (!mapHasUsableSize()) return false;

  map.invalidateSize({ animate: false, pan: true, debounceMoveend: true });
  if (pendingMapFit) {
    const fit = pendingMapFit;
    pendingMapFit = null;
    applyMapFit(fit);
  }
  return true;
}

function scheduleMapLayoutSync() {
  if (mapLayoutFrame) window.cancelAnimationFrame(mapLayoutFrame);
  mapLayoutFrame = window.requestAnimationFrame(syncMapLayout);
}

function requestMapFit(kind) {
  pendingMapFit = kind;
  if (mapLayoutFrame) {
    window.cancelAnimationFrame(mapLayoutFrame);
    mapLayoutFrame = 0;
  }
  if (!syncMapLayout()) scheduleMapLayoutSync();
}

const mapResizeObserver = typeof window.ResizeObserver === "function"
  ? new window.ResizeObserver(scheduleMapLayoutSync)
  : null;
if (mapResizeObserver) mapResizeObserver.observe(elements.map);
else window.addEventListener("resize", scheduleMapLayoutSync);

function loadDraft() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createDefaultConfig();
    const parsed = parseConfigTextWithMigration(saved);
    initialMigrationReport = parsed.migration.report;
    return parsed.config;
  } catch {
    return createDefaultConfig();
  }
}

function persistDraft(snapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    // Private browsing and storage quotas must not break the editor.
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message, type = "") {
  const node = document.createElement("div");
  node.className = `toast ${type}`.trim();
  node.textContent = message;
  elements.toastRegion.append(node);
  window.setTimeout(() => node.remove(), 3600);
}

function confirmAction(title, message) {
  if (typeof elements.confirmDialog.showModal !== "function") {
    return Promise.resolve(window.confirm(message));
  }
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmDialog.showModal();
  return new Promise((resolve) => {
    const close = () => {
      elements.confirmDialog.removeEventListener("close", close);
      resolve(elements.confirmDialog.returnValue === "confirm");
    };
    elements.confirmDialog.addEventListener("close", close);
  });
}

function currentMap() {
  return MAPS.find((entry) => entry.id === activeMapId) || MAPS[0];
}

function canvasSize(mapDefinition = currentMap()) {
  return mapDefinition.canvas || { width: 1600, height: 1000 };
}

function canvasBounds(mapDefinition = currentMap()) {
  const { width, height } = canvasSize(mapDefinition);
  return [[0, 0], [height, width]];
}

function paddedCanvasBounds(mapDefinition = currentMap()) {
  const { width, height } = canvasSize(mapDefinition);
  const padding = Math.max(width, height) * 0.08;
  return [[-padding, -padding], [height + padding, width + padding]];
}

function worldToLatLng(point, mapDefinition = currentMap()) {
  const [horizontal, vertical] = worldToMapFraction(point, mapDefinition);
  const { width, height } = canvasSize(mapDefinition);
  return L.latLng(vertical * height, horizontal * width);
}

function latLngToWorld(latlng, mapDefinition = currentMap()) {
  const { width, height } = canvasSize(mapDefinition);
  const [x, y] = mapFractionToWorld([latlng.lng / width, latlng.lat / height], mapDefinition);
  return [Number(x.toFixed(2)), Number(y.toFixed(2))];
}

function selectedRegion() {
  return selectedRegionIndex == null ? null : config.regions[selectedRegionIndex] || null;
}

function areaDisclosureKey(area) {
  if (!area) return "global";
  if (area === config.wilderness) return "wilderness";
  return `region:${String(area.name || "").trim().toLocaleLowerCase()}`;
}

function nextRegionName() {
  const names = new Set([
    config.wilderness.name.toLowerCase(),
    ...config.regions.map((region) => region.name.toLowerCase())
  ]);
  let number = config.regions.length + 1;
  while (names.has(`region ${number}`)) number += 1;
  return `Region ${number}`;
}

function commit(mutator, options = {}) {
  const changed = documentStore.mutate(
    () => mutator(),
    { recordHistory: options.history !== false });
  config = documentStore.value;
  if (changed) rawEditorValue = documentStore.serialized;
  renderAll();
}

const messageEditor = createMessageEditor({
  getConfig: () => config,
  mutate: commit,
  escapeHtml,
  getAreaKey: areaDisclosureKey
});

function replaceConfig(next, markDirty = false) {
  documentStore.replace(next, { markDirty });
  config = documentStore.value;
  selectedRegionIndex = config.regions.length ? 0 : null;
  inspectorTab = "general";
  editingRegionShape = false;
  messageEditor.reset();
  rawEditorValue = documentStore.serialized;
  renderAll();
}

function undo() {
  if (!documentStore.undo()) return;
  config = documentStore.value;
  selectedRegionIndex = selectedRegionIndex == null
    ? null
    : Math.min(selectedRegionIndex, config.regions.length - 1);
  editingRegionShape = false;
  rawEditorValue = documentStore.serialized;
  renderAll();
}

function redo() {
  if (!documentStore.redo()) return;
  config = documentStore.value;
  selectedRegionIndex = selectedRegionIndex == null
    ? null
    : Math.min(selectedRegionIndex, config.regions.length - 1);
  editingRegionShape = false;
  rawEditorValue = documentStore.serialized;
  renderAll();
}

function download(name, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function renderStatus(validation) {
  elements.undoButton.disabled = !documentStore.canUndo;
  elements.redoButton.disabled = !documentStore.canRedo;
  elements.exportButton.disabled = !validation.valid;
}

function renderWorkspace() {
  elements.workspace.dataset.section = activeSection;
  elements.workspace.dataset.view = workspaceView;
  elements.workspace.dataset.layout = ["regions", "messages"].includes(activeSection) ? "split" : "single";
  const views = activeSection === "regions"
    ? [["list", "Regions"], ["map", "Map"]]
    : activeSection === "messages"
      ? [["list", "Events"], ["edit", selectedMessagesPanelId === LOCALIZATION_PANEL_ID ? "Localization" : "Message"]]
      : [];
  elements.workspaceViewNav.innerHTML = views.map(([id, label]) => `<button type="button" data-workspace-view="${id}" class="${workspaceView === id ? "active" : ""}">${label}</button>`).join("");
  elements.workspaceViewNav.hidden = !views.length;
  elements.workspaceViewNav.querySelectorAll("[data-workspace-view]").forEach((button) => {
    button.addEventListener("click", () => {
      workspaceView = button.dataset.workspaceView;
      renderWorkspace();
      scheduleMapLayoutSync();
    });
  });
}

function renderNavigation() {
  elements.sectionNav.querySelectorAll("[data-section]").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === activeSection);
  });
  elements.regionCountBadge.textContent = String(config.regions.length);
}

function renderMapSwitcher() {
  elements.mapSwitcher.innerHTML = MAPS.map((definition) =>
    `<button type="button" class="${definition.id === activeMapId ? "active" : ""}" data-map-id="${escapeHtml(definition.id)}">${escapeHtml(definition.label)}</button>`
  ).join("");
  elements.mapSwitcher.querySelectorAll("[data-map-id]").forEach((button) => {
    button.addEventListener("click", () => switchMap(button.dataset.mapId));
  });
}

function renderBaseLayer() {
  baseLayerGroup.clearLayers();
  const definition = currentMap();
  const { width, height } = canvasSize(definition);
  map.setMaxBounds(paddedCanvasBounds(definition));
  if (definition.tiles) {
    const tileWidth = width / definition.tiles.columns;
    const tileHeight = height / definition.tiles.rows;
    for (let y = 0; y < definition.tiles.rows; ++y) {
      for (let x = 0; x < definition.tiles.columns; ++x) {
        const west = x * tileWidth;
        const east = west + tileWidth;
        const north = height - y * tileHeight;
        const south = north - tileHeight;
        const source = `${definition.tiles.root}/z${definition.tiles.zoom}x${x}y${y}.webp`;
        baseLayerGroup.addLayer(L.imageOverlay(
          source,
          [[south, west], [north, east]],
          { interactive: false, opacity: 1 }
        ));
      }
    }
    return;
  }
  baseLayerGroup.addLayer(L.imageOverlay(
    definition.image,
    canvasBounds(definition),
    { interactive: false, opacity: 1 }
  ));
}

function polygonStyle(region, selected) {
  return {
    className: selected ? "region-polygon selected-region-polygon" : "region-polygon",
    color: region.color,
    fillColor: region.color,
    fillOpacity: region.enabled === false ? 0.06 : (selected ? 0.28 : 0.16),
    opacity: region.enabled === false ? 0.45 : 0.95,
    weight: selected ? 4 : 2,
    dashArray: region.enabled === false ? "7 7" : null
  };
}

function layerPolygonPoints(layer) {
  const points = layer.getLatLngs()?.[0] || [];
  return points.map((latlng) => latLngToWorld(latlng));
}

function bindRegionDrag(layer, index) {
  const path = layer.getElement();
  if (!path) return;

  let pointerId = null;
  let startClient = null;
  let startLatLng = null;
  let originalLatLngs = null;
  let moved = false;

  const finish = (event) => {
    if (pointerId == null || (event.pointerId != null && event.pointerId !== pointerId)) return;
    const cancelled = event.type === "pointercancel";
    path.removeEventListener("pointermove", move);
    path.removeEventListener("pointerup", finish);
    path.removeEventListener("pointercancel", finish);
    if (path.hasPointerCapture?.(pointerId)) path.releasePointerCapture(pointerId);
    map.dragging.enable();
    elements.map.classList.remove("moving-region");

    if (cancelled && moved) layer.setLatLngs(originalLatLngs).redraw();
    const shouldCommit = moved && !cancelled;
    pointerId = null;
    if (!shouldCommit) return;

    suppressRegionClick = true;
    const points = layerPolygonPoints(layer);
    commit(() => {
      if (config.regions[index]) config.regions[index].polygon = points;
    });
    window.setTimeout(() => { suppressRegionClick = false; }, 0);
  };

  const move = (event) => {
    if (pointerId == null || event.pointerId !== pointerId) return;
    const distance = Math.hypot(event.clientX - startClient.x, event.clientY - startClient.y);
    if (!moved && distance < 3) return;
    moved = true;

    const current = map.mouseEventToLatLng(event);
    const latitudeDelta = current.lat - startLatLng.lat;
    const longitudeDelta = current.lng - startLatLng.lng;
    layer.setLatLngs(originalLatLngs.map((point) => L.latLng(
      point.lat + latitudeDelta,
      point.lng + longitudeDelta
    ))).redraw();
    event.preventDefault();
    event.stopPropagation();
  };

  path.addEventListener("pointerdown", (event) => {
    if (drawing || editingRegionShape || event.isPrimary === false || event.button !== 0) return;
    pointerId = event.pointerId;
    startClient = { x: event.clientX, y: event.clientY };
    startLatLng = map.mouseEventToLatLng(event);
    originalLatLngs = layer.getLatLngs()[0].map((point) => L.latLng(point.lat, point.lng));
    moved = false;
    map.dragging.disable();
    elements.map.classList.add("moving-region");
    path.setPointerCapture?.(pointerId);
    path.addEventListener("pointermove", move);
    path.addEventListener("pointerup", finish);
    path.addEventListener("pointercancel", finish);
    event.preventDefault();
    event.stopPropagation();
  });
}

function renderRegionLayers() {
  regionLayerGroup.clearLayers();
  regionLayers.clear();
  config.regions.forEach((region, index) => {
    if (region.map !== activeMapId || region.polygon.length < 3) return;
    const layer = L.polygon(region.polygon.map((point) => worldToLatLng(point)), polygonStyle(region, index === selectedRegionIndex));
    layer.addTo(regionLayerGroup);
    layer.bindTooltip(`${region.name} · ${modeDefinition(region.mode).label}`, {
      permanent: false,
      direction: "center",
      className: "region-label"
    });
    layer.on("click", (event) => {
      L.DomEvent.stopPropagation(event);
      if (suppressRegionClick || index === selectedRegionIndex) return;
      selectRegion(index, { revealInList: true });
    });
    regionLayers.set(index, layer);
  });

  const selectedLayer = selectedRegionIndex == null ? null : regionLayers.get(selectedRegionIndex);
  if (editingRegionShape && selectedLayer?.enableEdit && !drawing) {
    selectedLayer.enableEdit();
    selectedLayer.on("editable:vertex:dragend editable:vertex:deleted", () => {
      const points = layerPolygonPoints(selectedLayer);
      if (points.length >= 3) {
        commit(() => { config.regions[selectedRegionIndex].polygon = points; });
      }
    });
  } else if (selectedLayer && !drawing) {
    bindRegionDrag(selectedLayer, selectedRegionIndex);
  }
}

function fitVisible() {
  requestMapFit("visible");
}

function fitSelected() {
  requestMapFit("selected");
}

function switchMap(id) {
  if (!MAPS.some((entry) => entry.id === id) || id === activeMapId) return;
  cancelDrawing();
  editingRegionShape = false;
  activeMapId = id;
  const current = selectedRegion();
  if (current && current.map !== activeMapId) {
    const candidate = config.regions.findIndex((region) => region.map === activeMapId);
    selectedRegionIndex = candidate >= 0 ? candidate : null;
  }
  renderMapSwitcher();
  renderBaseLayer();
  renderRegionLayers();
  fitVisible();
  renderSidebar();
  renderInspector();
}

function updateDrawButtons() {
  const canEditShape = selectedRegionIndex != null && regionLayers.has(selectedRegionIndex) && !drawing;
  elements.editShapeButton.disabled = !canEditShape;
  elements.editShapeButton.classList.toggle("hidden", drawing);
  elements.editShapeButton.classList.toggle("active", canEditShape && editingRegionShape);
  elements.editShapeButton.setAttribute("aria-pressed", String(canEditShape && editingRegionShape));
  elements.editShapeButton.textContent = editingRegionShape ? "Done" : "Edit shape";
  elements.drawButton.classList.toggle("hidden", drawing);
  elements.finishDrawButton.classList.toggle("hidden", !drawing);
  elements.cancelDrawButton.classList.toggle("hidden", !drawing);
  elements.drawHint.classList.toggle("hidden", !drawing);
  elements.finishDrawButton.disabled = drawPoints.length < 3;
  elements.map.classList.toggle("shape-editing", canEditShape && editingRegionShape);
  elements.map.classList.toggle("region-move-enabled", canEditShape && !editingRegionShape);
  elements.mapHelp.textContent = drawing
    ? `${drawPoints.length} point${drawPoints.length === 1 ? "" : "s"} added`
    : editingRegionShape
      ? "Drag the round handles to reshape the selected region."
      : canEditShape
        ? "Drag the selected region to move it. Choose Edit shape to move vertices."
        : "Select a region to move or reshape it.";
}

function startDrawing() {
  if (drawing) return;
  editingRegionShape = false;
  drawing = true;
  drawPoints = [];
  if (selectedRegionIndex != null) regionLayers.get(selectedRegionIndex)?.disableEdit?.();
  elements.map.classList.add("drawing");
  updateDrawButtons();
}

function refreshDrawPreview() {
  if (drawPreview) map.removeLayer(drawPreview);
  drawPreview = drawPoints.length
    ? L.polyline(drawPoints, { color: "#f8fafc", weight: 3, dashArray: "7 6" }).addTo(map)
    : null;
  drawPointLayerGroup.clearLayers();
  drawPoints.forEach((point, index) => {
    const marker = L.circleMarker(point, {
      radius: index === 0 ? 7 : 5,
      color: "#f8fafc",
      weight: index === 0 ? 3 : 2,
      fillColor: index === 0 ? "#38bdf8" : "#0ea5e9",
      fillOpacity: 1,
      interactive: false
    }).addTo(drawPointLayerGroup);
    if (index === 0) {
      marker.bindTooltip("Start", {
        permanent: true,
        direction: "top",
        className: "draw-start-label",
        offset: [0, -6]
      });
    }
  });
}

function addDrawPoint(latlng) {
  const previous = drawPoints.at(-1);
  if (!previous || previous.distanceTo(latlng) > 0.01) drawPoints.push(latlng);
  refreshDrawPreview();
  updateDrawButtons();
}

function finishDrawing() {
  if (!drawing || drawPoints.length < 3) return;
  const region = {
    name: nextRegionName(),
    enabled: true,
    mode: "pve",
    minimumLevel: null,
    map: activeMapId,
    color: modeDefinition("pve").color,
    polygon: drawPoints.map((latlng) => latLngToWorld(latlng)),
    actions: {},
    combat: [],
    messages: {}
  };
  cancelDrawing(false);
  commit(() => {
    config.regions.push(region);
    selectedRegionIndex = config.regions.length - 1;
    activeSection = "regions";
    inspectorTab = "general";
  });
  toast("Region created. Name and configure it in the inspector.", "success");
}

function cancelDrawing(render = true) {
  drawing = false;
  drawPoints = [];
  if (drawPreview) map.removeLayer(drawPreview);
  drawPreview = null;
  drawPointLayerGroup.clearLayers();
  elements.map.classList.remove("drawing");
  updateDrawButtons();
  if (render) renderRegionLayers();
}

function scrollSelectedRegionIntoView() {
  if (selectedRegionIndex == null) return;
  const card = elements.sidebar
    .querySelector(`[data-region-select="${selectedRegionIndex}"]`)
    ?.closest(".region-card");
  if (!card) return;
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  card.scrollIntoView({ block: "nearest", behavior });
}

function selectRegion(index, { revealInList = false } = {}) {
  if (!config.regions[index]) return;
  selectedRegionIndex = index;
  editingRegionShape = false;
  activeSection = "regions";
  inspectorTab = "general";
  const region = config.regions[index];
  if (revealInList) {
    const query = regionSearch.trim().toLowerCase();
    const searchable = `${region.name} ${region.map} ${region.mode}`.toLowerCase();
    if (query && !searchable.includes(query)) regionSearch = "";
  }
  if (region.map !== activeMapId) switchMap(region.map);
  else renderAll();
  if (revealInList) window.requestAnimationFrame(scrollSelectedRegionIntoView);
}

function openRegionEditor(index, trigger) {
  const region = config.regions[index];
  if (!region) return;
  activeAreaSettingsTrigger = trigger;
  editingWilderness = false;
  selectedRegionIndex = index;
  editingRegionShape = false;
  activeSection = "regions";
  inspectorTab = "general";
  if (region.map !== activeMapId) switchMap(region.map);
  else renderAll();
  renderAreaEditor();
  elements.regionEditorDialog.showModal();
  elements.regionEditorCloseButton.focus();
}

function openWildernessEditor(trigger) {
  activeAreaSettingsTrigger = trigger;
  editingWilderness = true;
  editingRegionShape = false;
  activeSection = "regions";
  inspectorTab = "general";
  renderAll();
  renderAreaEditor();
  elements.regionEditorDialog.showModal();
  elements.regionEditorCloseButton.focus();
}

function moveRegion(index, direction) {
  const destination = index + direction;
  if (destination < 0 || destination >= config.regions.length) return;
  editingRegionShape = false;
  commit(() => {
    [config.regions[index], config.regions[destination]] = [config.regions[destination], config.regions[index]];
    selectedRegionIndex = destination;
  });
}

function duplicateRegion(index) {
  const original = config.regions[index];
  if (!original) return;
  editingRegionShape = false;
  commit(() => {
    const copy = clone(original);
    copy.name = `${original.name} Copy`;
    copy.polygon = copy.polygon.map(([x, y]) => [x + 2500, y + 2500]);
    config.regions.splice(index + 1, 0, copy);
    selectedRegionIndex = index + 1;
  });
}

async function deleteRegion(index) {
  const region = config.regions[index];
  if (!region) return;
  if (!await confirmAction("Delete region", `Delete “${region.name}”? This cannot be recovered after the undo history is cleared.`)) return;
  editingRegionShape = false;
  commit(() => {
    config.regions.splice(index, 1);
    selectedRegionIndex = config.regions.length
      ? Math.min(index, config.regions.length - 1)
      : null;
  });
}

function modeBadge(mode) {
  const definition = modeDefinition(mode);
  return `<span class="badge ${escapeHtml(mode)}">${escapeHtml(definition.label)}</span>`;
}

function renderRegionSidebar() {
  const query = regionSearch.trim().toLowerCase();
  const visible = config.regions
    .map((region, index) => ({ region, index }))
    .filter(({ region }) => !query || `${region.name} ${region.map} ${region.mode}`.toLowerCase().includes(query));
  elements.sidebar.innerHTML = `
    <div class="panel-heading"><div><h2>Regions</h2><p>Later polygon entries win overlaps. The Wilderness applies only when none match.</p></div></div>
    <div class="search-row"><input id="regionSearch" type="search" placeholder="Search regions" value="${escapeHtml(regionSearch)}"></div>
    <div class="list-stack">
      <div class="region-card wilderness-card" data-wilderness>
        <button type="button" class="region-card-select" data-wilderness-open aria-label="Edit Wilderness ${escapeHtml(config.wilderness.name)}">
          <span class="region-card-top">
            <span class="region-card-title">${escapeHtml(config.wilderness.name)}</span>
            ${modeBadge(config.wilderness.mode)}
          </span>
        </button>
        <div class="region-card-footer wilderness-footer">
          <span class="wilderness-kind-label">${config.wilderness.name.trim().toLocaleLowerCase() === "wilderness" ? "Outside region" : "Wilderness"}</span>
          <div class="region-card-actions">
            <button type="button" class="region-card-icon settings" data-wilderness-settings title="Wilderness settings" aria-label="Open settings for Wilderness ${escapeHtml(config.wilderness.name)}">
              <span class="region-card-icon-glyph" aria-hidden="true">⚙︎</span>
            </button>
          </div>
        </div>
      </div>
      ${visible.map(({ region, index }) => `
        <div class="region-card ${index === selectedRegionIndex ? "selected" : ""} ${region.enabled === false ? "disabled" : ""}">
          <button type="button" class="region-card-select" data-region-select="${index}" aria-label="Edit ${escapeHtml(region.name)}">
            <span class="region-card-top">
              <span class="color-dot" style="background:${escapeHtml(region.color)};color:${escapeHtml(region.color)}"></span>
              <span class="region-card-title">${escapeHtml(region.name)}</span>
              ${modeBadge(region.mode)}
            </span>
            <span class="region-meta"><span>${escapeHtml(MAPS.find((entry) => entry.id === region.map)?.label || region.map)}</span><span>${region.polygon.length} vertices</span><span>Order ${index + 1}</span>${region.minimumLevel ? `<span>Level ${region.minimumLevel}+</span>` : ""}</span>
          </button>
          <div class="region-card-footer">
            <div class="order-controls">
              <button type="button" class="order-button" data-move="-1" data-index="${index}" title="Move earlier" aria-label="Move ${escapeHtml(region.name)} earlier" ${index === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="order-button" data-move="1" data-index="${index}" title="Move later" aria-label="Move ${escapeHtml(region.name)} later" ${index === config.regions.length - 1 ? "disabled" : ""}>↓</button>
            </div>
            <div class="region-card-actions">
              <button type="button" class="region-card-icon settings" data-region-settings="${index}" title="Region settings" aria-label="Open settings for ${escapeHtml(region.name)}">
                <span class="region-card-icon-glyph" aria-hidden="true">⚙︎</span>
              </button>
              <button type="button" class="region-card-icon" data-region-duplicate="${index}" title="Duplicate region" aria-label="Duplicate ${escapeHtml(region.name)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg>
              </button>
              <button type="button" class="region-card-icon danger" data-region-delete="${index}" title="Delete region" aria-label="Delete ${escapeHtml(region.name)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg>
              </button>
            </div>
          </div>
        </div>`).join("")}
    </div>`;

  elements.sidebar.querySelector("#regionSearch")?.addEventListener("input", (event) => {
    regionSearch = event.target.value;
    renderRegionSidebar();
  });
  elements.sidebar.querySelector("[data-wilderness-open]")?.addEventListener("click", (event) => {
    openWildernessEditor(event.currentTarget);
  });
  elements.sidebar.querySelector("[data-wilderness-settings]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    openWildernessEditor(event.currentTarget);
  });
  elements.sidebar.querySelectorAll("[data-region-select]").forEach((button) => {
    button.addEventListener("click", () => selectRegion(Number(button.dataset.regionSelect)));
  });
  elements.sidebar.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      moveRegion(Number(button.dataset.index), Number(button.dataset.move));
    });
  });
  elements.sidebar.querySelectorAll("[data-region-duplicate]").forEach((button) => {
    button.addEventListener("click", () => duplicateRegion(Number(button.dataset.regionDuplicate)));
  });
  elements.sidebar.querySelectorAll("[data-region-settings]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openRegionEditor(Number(button.dataset.regionSettings), button);
    });
  });
  elements.sidebar.querySelectorAll("[data-region-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteRegion(Number(button.dataset.regionDelete)));
  });
}

function renderMessagesSidebar() {
  elements.sidebar.innerHTML = `
    <div class="panel-heading"><div><h2>Global messages</h2><p>Each event and output channel can be enabled and customized independently.</p></div></div>
    <div class="list-stack">
      ${MESSAGE_EVENTS.map((event) => {
    const message = config.messages[event.id];
    const outputCount = enabledMessageOutputCount(message);
    const active = config.messages.enabled && message.enabled && outputCount > 0;
    return `<button type="button" class="region-card message-nav-item ${selectedMessagesPanelId === event.id ? "selected" : ""} ${active ? "" : "disabled"}" data-message-event-id="${escapeHtml(event.id)}">
          <div class="region-card-top"><span class="region-card-title">${escapeHtml(event.label)}</span><span class="badge ${active ? "pve" : ""}">${active ? "On" : "Off"}</span></div>
          <div class="region-meta"><span>${outputCount} output${outputCount === 1 ? "" : "s"}</span><span>${message.cooldownSeconds}s cooldown</span></div>
        </button>`;
  }).join("")}
      <button type="button" class="region-card message-nav-item ${selectedMessagesPanelId === LOCALIZATION_PANEL_ID ? "selected" : ""}" data-message-localization>
        <div class="region-card-top"><span class="region-card-title">Localization</span></div>
        <div class="region-meta"><span>Action names</span><span>Mode names</span></div>
      </button>
    </div>
    <p class="help">A region uses these global defaults unless it overrides an event.</p>`;
  elements.sidebar.querySelectorAll("[data-message-event-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMessagesPanelId = button.dataset.messageEventId;
      workspaceView = "edit";
      renderWorkspace();
      renderMessagesSidebar();
      renderMessagesInspector();
    });
  });
  elements.sidebar.querySelector("[data-message-localization]")?.addEventListener("click", () => {
    selectedMessagesPanelId = LOCALIZATION_PANEL_ID;
    workspaceView = "edit";
    renderWorkspace();
    renderMessagesSidebar();
    renderMessagesInspector();
  });
}

function renderSettingsSidebar() {
  elements.sidebar.innerHTML = `
    <div class="panel-heading"><div><h2>Runtime settings</h2><p>Safe defaults are supplied; most servers only need regions and modes.</p></div></div>
    <div class="list-stack">
      <div class="region-card"><div class="region-card-top"><span class="region-card-title">Hot reload</span><span class="badge ${config.settings.hotReload ? "pve" : ""}">${config.settings.hotReload ? "On" : "Off"}</span></div><div class="region-meta"><span>Every ${config.settings.hotReloadSeconds}s</span></div></div>
      <div class="region-card"><div class="region-card-top"><span class="region-card-title">Regional combat authority</span><span class="badge ${config.regionalCombat.enabled ? "pve" : ""}">${config.regionalCombat.enabled ? "On" : "Off"}</span></div><div class="region-meta"><span>${config.regionalCombat.enabled ? "PalLaw manages regional final damage and regional PvP" : "All combat remains vanilla"}</span></div></div>
      <div class="region-card"><div class="region-card-top"><span class="region-card-title">World actions</span><span class="badge ${config.settings.worldRules ? "pve" : ""}">${config.settings.worldRules ? "On" : "Off"}</span></div><div class="region-meta"><span>${config.settings.adminBypass ? "Admins bypass restrictions" : "Admins follow restrictions"}</span></div></div>
    </div>`;
}



function renderJsonSidebar() {
  elements.sidebar.innerHTML = `
    <div class="panel-heading"><div><h2>Raw configuration</h2><p>The form and JSON editor modify the same <code>${CONFIG_FILE_NAME}</code> document.</p></div></div>
    <div class="section-card"><div class="section-card-body"><p class="help">JSON was selected because it can be parsed identically by the DLL and browser, validated with the bundled schema, and edited without additional runtime dependencies.</p></div></div>`;
}

function renderSidebar() {
  if (activeSection === "regions") renderRegionSidebar();
  else if (activeSection === "messages") renderMessagesSidebar();
  else if (activeSection === "settings") renderSettingsSidebar();
  else renderJsonSidebar();
}

function modeSelector(area, scope) {
  return `<div class="mode-grid">${MODES.map((mode) => `
    <div class="mode-option" style="--mode-color:${escapeHtml(mode.color)}">
      <input id="${scope}-mode-${mode.id}" name="${scope}-mode" type="radio" value="${mode.id}" ${area.mode === mode.id ? "checked" : ""}>
      <label for="${scope}-mode-${mode.id}"><strong>${escapeHtml(mode.label)}</strong><span>${escapeHtml(mode.description)}</span></label>
    </div>`).join("")}</div>`;
}

function bindModeSelector(container, areaGetter) {
  container.querySelectorAll('input[type="radio"][name$="-mode"]').forEach((input) => {
    input.addEventListener("change", () => commit(() => {
      const area = areaGetter();
      const oldDefault = modeDefinition(area.mode).color;
      const shouldUpdateColor = Object.hasOwn(area, "color") && area.color.toLowerCase() === oldDefault.toLowerCase();
      area.mode = input.value;
      if (shouldUpdateColor) area.color = modeDefinition(area.mode).color;
    }));
  });
}

function tabStrip(tabs) {
  return `<div class="tab-strip" role="tablist" aria-label="Editor sections">${tabs.map((tab) => `<button type="button" role="tab" aria-selected="${inspectorTab === tab.id}" data-inspector-tab="${tab.id}" class="${inspectorTab === tab.id ? "active" : ""}">${escapeHtml(tab.label)}</button>`).join("")}</div>`;
}

function bindInspectorTabs(container) {
  container.querySelectorAll("[data-inspector-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      inspectorTab = button.dataset.inspectorTab;
      renderInspector();
    });
  });
}

function renderGeneralArea(area, isRegion) {
  const mapOptions = MAPS.map((entry) => `<option value="${entry.id}" ${isRegion && area.map === entry.id ? "selected" : ""}>${escapeHtml(entry.label)}</option>`).join("");
  return `
    <div class="form-grid ${isRegion ? "region-general-grid" : ""}">
      <label class="field full"><span>Name</span><input id="areaName" type="text" maxlength="96" value="${escapeHtml(area.name)}"><small>Names must be unique, ignoring letter case. This value appears in messages.</small></label>
      ${isRegion ? `
        <div class="field"><span>Enabled</span><div class="toggle-row"><div class="checkbox-copy"><strong>Use this region</strong><span>Disabled regions remain in the file.</span></div><label class="switch"><input id="regionEnabled" type="checkbox" ${area.enabled !== false ? "checked" : ""}><span class="switch-track"></span></label></div></div>
        <label class="field"><span>Coordinate map</span><select id="regionMap">${mapOptions}</select></label>
        <label class="field"><span>Display color</span><input id="regionColor" type="color" value="${escapeHtml(area.color)}"></label>
        <label class="field"><span>Minimum player level</span><input id="minimumLevel" type="number" min="1" max="999" step="1" value="${area.minimumLevel ?? ""}" placeholder="No requirement"><small>Leave blank to allow every level.</small></label>` : ""}
    </div>
    <div class="section-card">
      <div class="section-card-header"><h3>Mode preset</h3><span class="badge ${escapeHtml(area.mode)}">${escapeHtml(modeDefinition(area.mode).label)}</span></div>
      <div class="section-card-body">${modeSelector(area, isRegion ? "region" : "wilderness")}</div>
    </div>
    ${isRegion ? `
      <div class="section-card"><div class="section-card-header"><h3>Polygon</h3><span class="badge">${area.polygon.length} vertices</span></div><div class="section-card-body">
        <label class="field"><span>Runtime world coordinates</span><textarea id="polygonCoordinates" class="mono" spellcheck="false">${escapeHtml(JSON.stringify(area.polygon, null, 2))}</textarea><small>Each point is an Unreal-world <code>[X, Y]</code> pair used by the server. The map hover readout also shows the matching in-game coordinates.</small></label>
        <div class="code-actions"><button id="applyPolygonButton" type="button" class="button small ghost">Apply coordinates</button><button id="fitRegionButton" type="button" class="button small ghost">Fit region</button></div>
      </div></div>` : ""}`;
}

function bindGeneralArea(container, areaGetter, isRegion) {
  container.querySelector("#areaName")?.addEventListener("change", (event) => {
    const previousKey = areaDisclosureKey(areaGetter());
    commit(() => { areaGetter().name = event.target.value.trim(); });
    messageEditor.renameAreaKey(previousKey, areaDisclosureKey(areaGetter()));
  });
  bindModeSelector(container, areaGetter);
  if (!isRegion) return;
  container.querySelector("#regionEnabled")?.addEventListener("change", (event) => commit(() => { areaGetter().enabled = event.target.checked; }));
  container.querySelector("#regionMap")?.addEventListener("change", (event) => commit(() => {
    areaGetter().map = event.target.value;
    activeMapId = event.target.value;
  }));
  container.querySelector("#regionColor")?.addEventListener("change", (event) => commit(() => { areaGetter().color = event.target.value; }));
  container.querySelector("#minimumLevel")?.addEventListener("change", (event) => commit(() => {
    const value = event.target.value.trim();
    areaGetter().minimumLevel = value ? Math.max(1, Math.min(999, Math.trunc(Number(value)))) : null;
  }));
  container.querySelector("#applyPolygonButton")?.addEventListener("click", () => {
    try {
      const points = JSON.parse(container.querySelector("#polygonCoordinates").value);
      if (!Array.isArray(points) || points.length < 3 || points.some((point) => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite))) {
        throw new Error("Polygon coordinates must be an array containing at least three [X, Y] number pairs.");
      }
      commit(() => { areaGetter().polygon = points.map(([x, y]) => [Number(x), Number(y)]); });
      toast("Polygon coordinates applied.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });
  container.querySelector("#fitRegionButton")?.addEventListener("click", fitSelected);
}

function renderActions(area) {
  const effective = effectiveActions(area);
  return `
    <p class="help">Mode presets allow all world actions. Add an override only when this area should explicitly allow or deny an action.</p>
    <div class="override-grid">${ACTIONS.map((action) => {
    const raw = Object.hasOwn(area.actions || {}, action.id) ? area.actions[action.id] : null;
    return `<div class="override-row">
        <div class="checkbox-copy"><strong>${escapeHtml(action.label)}</strong><span>${escapeHtml(action.description)} Effective: ${effective[action.id] ? "allowed" : "denied"}.</span></div>
        <select data-action-id="${action.id}" class="${raw === null ? "tri-default" : raw ? "tri-allow" : "tri-deny"}">
          <option value="default" ${raw === null ? "selected" : ""}>Default</option>
          <option value="allow" ${raw === true ? "selected" : ""}>Allow</option>
          <option value="deny" ${raw === false ? "selected" : ""}>Deny</option>
        </select>
      </div>`;
  }).join("")}</div>`;
}

function bindActions(container, areaGetter) {
  container.querySelectorAll("[data-action-id]").forEach((select) => {
    select.addEventListener("change", () => commit(() => {
      const area = areaGetter();
      area.actions ||= {};
      if (select.value === "default") delete area.actions[select.dataset.actionId];
      else area.actions[select.dataset.actionId] = select.value === "allow";
    }));
  });
}

function combatPolicyLabel(allowed) {
  return allowed ? "Allow" : "Deny";
}

function matrixActorLabel(actor) {
  return actor.matrixLabel || actor.label;
}

function nextCombatOverride(value) {
  if (value === "default") return "allow";
  if (value === "allow") return "deny";
  return "default";
}

function renderMatrixActorHeader(actor) {
  const description = actor.description || actor.label;
  return `<span class="matrix-actor-label" tabindex="0" data-matrix-actor="${actor.id}" aria-label="${escapeHtml(`${actor.label}. ${description}`)}" title="${escapeHtml(`${actor.label}: ${description}`)}">${escapeHtml(matrixActorLabel(actor))}</span>`;
}

function combatOverrideCount(area) {
  const sources = ACTORS.filter((actor) => !actor.targetOnly);
  return sources.reduce((count, source) =>
    count + ACTORS.filter((target) => quickCombatOverride(area, source.id, target.id) !== "default").length, 0);
}

function renderCombatMatrix(area) {
  const matrix = effectiveCombat(area);
  const targets = ACTORS;
  const sources = ACTORS.filter((actor) => !actor.targetOnly);
  const presetLabel = modeDefinition(area.mode).label;
  return `
    <div class="matrix-toolbar">
      <p>Rows deal damage. Columns receive it. Default follows the ${escapeHtml(presetLabel)} preset.</p>
    </div>
    <div class="matrix-wrap"><table class="combat-matrix">
      <thead><tr><th class="matrix-corner" scope="col">Source / Target</th>${targets.map((target) => `<th scope="col">${renderMatrixActorHeader(target)}</th>`).join("")}</tr></thead>
      <tbody>${sources.map((source, rowIndex) => `<tr><th scope="row">${renderMatrixActorHeader(source)}</th>${targets.map((target, columnIndex) => {
    const raw = quickCombatOverride(area, source.id, target.id);
    const effective = matrix[source.id]?.[target.id] === true;
    const next = nextCombatOverride(raw);
    const effectiveLabel = combatPolicyLabel(effective);
    const primaryLabel = raw === "default" ? "Default" : effectiveLabel;
    const secondaryLabel = raw === "default" ? effectiveLabel : "Override";
    const accessibleState = raw === "default" ? `Default, effective ${effectiveLabel}` : `${effectiveLabel} override`;
    return `<td><button type="button"
      class="matrix-cell ${effective ? "allowed" : "denied"} ${raw === "default" ? "is-default" : "is-override"}"
      data-combat-source="${source.id}"
      data-combat-target="${target.id}"
      data-combat-value="${raw}"
      data-combat-row="${rowIndex}"
      data-combat-column="${columnIndex}"
      aria-label="${escapeHtml(`${source.label} to ${target.label}: ${accessibleState}. Activate to set ${next}.`)}"
      title="${escapeHtml(`${source.label} to ${target.label}: ${accessibleState}`)}">
        <span class="matrix-cell-primary">${primaryLabel}</span>
        <span class="matrix-cell-secondary">${secondaryLabel}</span>
      </button></td>`;
  }).join("")}</tr>`).join("")}</tbody>
    </table></div>
    <div id="matrixActorDescription" class="matrix-actor-description">
      <strong>Actor definitions</strong>
      <span>Hover or focus a header or matrix button to see what it includes.</span>
    </div>`;
}

function bindCombatMatrix(container, areaGetter) {
  const description = container.querySelector("#matrixActorDescription");
  const defaultDescription = description?.innerHTML || "";
  container.querySelectorAll("[data-matrix-actor]").forEach((header) => {
    const actor = ACTORS.find((entry) => entry.id === header.dataset.matrixActor);
    const showDescription = () => {
      if (!description || !actor) return;
      description.innerHTML = `<strong>${escapeHtml(actor.label)}</strong><span>${escapeHtml(actor.description || actor.label)}</span>`;
    };
    const restoreDescription = () => {
      if (description) description.innerHTML = defaultDescription;
    };
    header.addEventListener("mouseenter", showDescription);
    header.addEventListener("focus", showDescription);
    header.addEventListener("mouseleave", () => {
      if (document.activeElement !== header) restoreDescription();
    });
    header.addEventListener("blur", restoreDescription);
  });

  const cells = [...container.querySelectorAll("[data-combat-source][data-combat-target]")];
  cells.forEach((button) => {
    const source = ACTORS.find((entry) => entry.id === button.dataset.combatSource);
    const target = ACTORS.find((entry) => entry.id === button.dataset.combatTarget);
    const showRelationshipDescription = () => {
      if (!description || !source || !target) return;
      const actors = source.id === target.id ? [source] : [source, target];
      description.innerHTML = `<div class="matrix-definition-list">${actors.map((actor) =>
        `<strong>${escapeHtml(actor.label)}</strong><span>${escapeHtml(actor.description || actor.label)}</span>`
      ).join("")}</div>`;
    };
    const restoreRelationshipDescription = () => {
      if (description) description.innerHTML = defaultDescription;
    };
    button.addEventListener("mouseenter", showRelationshipDescription);
    button.addEventListener("focus", showRelationshipDescription);
    button.addEventListener("mouseleave", () => {
      if (document.activeElement !== button) restoreRelationshipDescription();
    });
    button.addEventListener("blur", restoreRelationshipDescription);
    button.addEventListener("click", () => commit(() => {
      setQuickCombatOverride(
        areaGetter(),
        button.dataset.combatSource,
        button.dataset.combatTarget,
        nextCombatOverride(button.dataset.combatValue)
      );
    }));
    button.addEventListener("keydown", (event) => {
      const movement = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1]
      }[event.key];
      if (!movement) return;
      event.preventDefault();
      const row = Number(button.dataset.combatRow) + movement[0];
      const column = Number(button.dataset.combatColumn) + movement[1];
      container.querySelector(`[data-combat-row="${row}"][data-combat-column="${column}"]`)?.focus();
    });
  });
  container.querySelector("#resetCombatMatrixButton")?.addEventListener("click", () => commit(() => {
    areaGetter().combat = [];
  }));
}

function renderRules(area) {
  const combatInactive = !config.regionalCombat.enabled;
  const overrideCount = combatOverrideCount(area);
  return `<div class="rules-stack">
    ${combatInactive ? '<p class="help combat-inactive">Combat rules are saved but currently inactive. Level and world-action rules remain enabled.</p>' : ""}
    <div class="section-card rules-actions">
      <div class="section-card-header"><div><h3>Player actions</h3><p>Control building, dismantling, mounts, and other regional actions.</p></div></div>
      <div class="section-card-body">${renderActions(area)}</div>
    </div>
    <div class="section-card combat-matrix-card">
      <div class="section-card-header">
        <div><h3>Combat matrix</h3><p>Choose Default, Allow, or Deny for every combat relationship.</p></div>
        <div class="matrix-header-actions">
          <span class="matrix-override-count">${overrideCount} ${overrideCount === 1 ? "override" : "overrides"}</span>
          <button id="resetCombatMatrixButton" type="button" class="button small ghost" ${overrideCount ? "" : "disabled"}>Reset overrides</button>
        </div>
      </div>
      <div class="section-card-body">${renderCombatMatrix(area)}</div>
    </div>
  </div>`;
}

function bindRules(container, areaGetter) {
  bindActions(container, areaGetter);
  bindCombatMatrix(container, areaGetter);
}

function renderAreaEditor() {
  const isRegion = !editingWilderness;
  const area = isRegion ? selectedRegion() : config.wilderness;
  if (!area) {
    elements.areaEditorKind.textContent = "Region settings";
    elements.regionEditorTitle.textContent = "Region";
    elements.regionEditorCloseButton.setAttribute("aria-label", "Close region settings");
    elements.regionEditorContent.innerHTML = '<div class="empty-state"><div><strong>Select or draw a region</strong><span>Each region has a unique name, a mode preset, an editable polygon, and optional rule overrides.</span></div></div>';
    return;
  }
  const tabs = [
    { id: "general", label: "General" },
    { id: "rules", label: "Rules" },
    { id: "messages", label: "Messages" }
  ];
  const getter = isRegion
    ? () => config.regions[selectedRegionIndex]
    : () => config.wilderness;
  let body = "";
  if (inspectorTab === "general") body = renderGeneralArea(area, isRegion);
  else if (inspectorTab === "rules") body = renderRules(area);
  else body = messageEditor.render(config.messages, area);

  elements.areaEditorKind.textContent = isRegion ? "Region settings" : "Wilderness settings";
  elements.regionEditorTitle.textContent = area.name;
  elements.regionEditorCloseButton.setAttribute("aria-label", isRegion ? "Close region settings" : "Close Wilderness settings");
  elements.regionEditorContent.innerHTML = `
    <p class="region-editor-context">${isRegion ? "Order controls overlap precedence. Lower in the list means higher precedence." : "The Wilderness applies only where no enabled polygon Region matches and stays outside overlap priority."}</p>
    ${tabStrip(tabs)}
    ${body}`;
  bindInspectorTabs(elements.regionEditorContent);
  if (inspectorTab === "general") bindGeneralArea(elements.regionEditorContent, getter, isRegion);
  else if (inspectorTab === "rules") bindRules(elements.regionEditorContent, getter);
  else messageEditor.bind(elements.regionEditorContent, config.messages, area);
}

function renderMessagesInspector() {
  if (selectedMessagesPanelId === LOCALIZATION_PANEL_ID) {
    elements.inspector.innerHTML = `
      <div class="inspector-header"><h2>Localization</h2><p>Customize the global player-facing names inserted by the {action} and {mode} placeholders.</p></div>
      <div class="section-card localization-card">
        <div class="section-card-header"><div><h3>Area Mode Display Names</h3><p>Used by {mode} in any global or area message.</p></div></div>
        <div class="section-card-body"><div class="form-grid one localization-grid">${MODES.map((mode) => `
          <label class="field"><span>${escapeHtml(mode.label)}</span><input data-mode-name="${escapeHtml(mode.id)}" type="text" required value="${escapeHtml(config.messages.modeNames[mode.id])}"><small>Player-facing name for the ${escapeHtml(mode.id)} mode, up to 96 Unicode characters.</small></label>`).join("")}</div></div>
      </div>
      <div class="section-card localization-card">
        <div class="section-card-header"><div><h3>Player Action Display Names</h3><p>Used by {action} in Action denied messages.</p></div></div>
        <div class="section-card-body"><div class="form-grid one localization-grid">${ACTIONS.map((action) => `
          <label class="field"><span>${escapeHtml(action.label)}</span><input data-action-name="${escapeHtml(action.id)}" type="text" required value="${escapeHtml(config.messages.actionNames[action.id])}"><small>Player-facing name for the ${escapeHtml(action.id)} action, up to 96 Unicode characters.</small></label>`).join("")}</div></div>
      </div>`;
    elements.inspector.querySelectorAll("[data-action-name]").forEach((input) => {
      input.addEventListener("change", () => commit(() => {
        config.messages.actionNames[input.dataset.actionName] = input.value;
      }));
    });
    elements.inspector.querySelectorAll("[data-mode-name]").forEach((input) => {
      input.addEventListener("change", () => commit(() => {
        config.messages.modeNames[input.dataset.modeName] = input.value;
      }));
    });
    return;
  }
  const selectedDefinition = MESSAGE_EVENTS.find((event) => event.id === selectedMessagesPanelId) || MESSAGE_EVENTS[0];
  selectedMessagesPanelId = selectedDefinition.id;
  elements.inspector.innerHTML = `<div class="inspector-header"><h2>${escapeHtml(selectedDefinition.label)}</h2><p>System chat and native Palworld alert presentations are configured independently for this event.</p></div>${messageEditor.render(config.messages, null, selectedMessagesPanelId)}`;
  messageEditor.bind(elements.inspector, config.messages);
}

const SETTING_DEFINITIONS = [
  { group: "Configuration", id: "hotReload", label: "Hot reload", description: "Watch PalLaw.json and automatically apply valid changes.", type: "boolean" },
  { group: "Configuration", id: "hotReloadSeconds", label: "Reload interval", description: "Seconds between file timestamp checks.", type: "number", min: 0.1, max: 60, step: 0.1 },
  { group: "Enforcement", scope: "regionalCombat", id: "enabled", label: "Regional combat authority", description: "When enabled, PalLaw manages regional final damage and the Palworld player-damage setting so PvP regions work on a PvP-disabled world. Targeting and attack progression remain vanilla in PalLaw 0.2.0.", type: "boolean" },
  { group: "Enforcement", id: "worldRules", label: "World action rules", description: "Enforce build, dismantle, riding, flying, editing, decay, and level restrictions.", type: "boolean" },
  { group: "Enforcement", id: "adminBypass", label: "Administrator bypass", description: "Allow administrators to bypass action and level restrictions. Currently not working on 0.2.x", type: "boolean" },
  { group: "Player tracking", id: "playerSweepSeconds", label: "Player sweep interval", description: "Seconds between location, region, mount, and level checks.", type: "number", min: 0.05, max: 10, step: 0.05 },
  { group: "Player tracking", id: "mountGraceSeconds", label: "Mount denial grace period", description: "Safe-dismount seconds for a player who is already mounted when riding becomes denied; new mount attempts are denied immediately.", type: "number", min: 0, max: 120, step: 0.5 },
  { group: "Diagnostics", id: "debugLogging", label: "Debug logging", description: "Write verbose rule decisions and missing reflected symbols to the UE4SS log.", type: "boolean" }
];

function renderSettingsInspector() {
  const groups = [...new Set(SETTING_DEFINITIONS.map((setting) => setting.group))];
  const settingValue = (setting) => setting.scope === "regionalCombat"
    ? config.regionalCombat[setting.id]
    : config.settings[setting.id];
  elements.inspector.innerHTML = `
    <div class="inspector-header"><h2>Server behavior</h2><p>The defaults balance responsive enforcement with dedicated-server cost.</p></div>
    <div class="settings-groups">${groups.map((group) => `<section class="settings-group"><h3>${escapeHtml(group)}</h3><div>${SETTING_DEFINITIONS.filter((setting) => setting.group === group).map((setting) => setting.type === "boolean" ? `
      <div class="setting-row"><div class="checkbox-copy"><strong>${escapeHtml(setting.label)}</strong><span>${escapeHtml(setting.description)}</span></div><label class="switch"><input data-setting-id="${setting.id}" type="checkbox" ${settingValue(setting) ? "checked" : ""}><span class="switch-track"></span></label></div>` : `
      <label class="setting-row setting-number"><div class="checkbox-copy"><strong>${escapeHtml(setting.label)}</strong><span>${escapeHtml(setting.description)}</span></div><input data-setting-id="${setting.id}" type="number" min="${setting.min}" max="${setting.max}" step="${setting.step}" value="${settingValue(setting)}"></label>`).join("")}</div></section>`).join("")}</div>`;
  elements.inspector.querySelectorAll("[data-setting-id]").forEach((control) => {
    control.addEventListener("change", () => commit(() => {
      const definition = SETTING_DEFINITIONS.find((entry) => entry.id === control.dataset.settingId);
      const target = definition.scope === "regionalCombat"
        ? config.regionalCombat
        : config.settings;
      target[definition.id] = definition.type === "boolean"
        ? control.checked
        : Math.max(definition.min, Math.min(definition.max, Number(control.value)));
    }));
  });
}

function renderJsonInspector() {
  elements.inspector.innerHTML = `
    <div class="json-editor-shell">
      <div class="inspector-header"><h2>${CONFIG_FILE_NAME}</h2><p>Apply validates the document before replacing the form state. Invalid edits never affect the current configuration.</p></div>
      <textarea id="rawJsonEditor" class="code-editor" spellcheck="false">${escapeHtml(rawEditorValue)}</textarea>
      <div class="code-actions"><button id="applyJsonButton" type="button" class="button primary">Apply JSON</button><button id="formatJsonButton" type="button" class="button ghost">Format current</button><button id="copyJsonButton" type="button" class="button ghost">Copy</button><button id="resetJsonButton" type="button" class="button ghost">Discard edits</button></div>
    </div>`;
  const editor = elements.inspector.querySelector("#rawJsonEditor");
  editor.addEventListener("input", () => { rawEditorValue = editor.value; });
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      editor.setRangeText("  ", editor.selectionStart, editor.selectionEnd, "end");
      rawEditorValue = editor.value;
    }
  });
  elements.inspector.querySelector("#applyJsonButton").addEventListener("click", () => {
    try {
      const parsed = parseConfigTextWithMigration(editor.value);
      replaceConfig(parsed.config, true);
      toast(parsed.migration.changed ? "JSON migrated and applied." : "JSON applied.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });
  elements.inspector.querySelector("#formatJsonButton").addEventListener("click", () => {
    try {
      rawEditorValue = `${JSON.stringify(JSON.parse(editor.value), null, 2)}\n`;
      editor.value = rawEditorValue;
    } catch (error) {
      toast(`Cannot format: ${error.message}`, "error");
    }
  });
  elements.inspector.querySelector("#copyJsonButton").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(editor.value);
      toast("Configuration copied.", "success");
    } catch {
      editor.select();
      document.execCommand("copy");
      toast("Configuration copied.", "success");
    }
  });
  elements.inspector.querySelector("#resetJsonButton").addEventListener("click", () => {
    rawEditorValue = stringifyConfig(config);
    editor.value = rawEditorValue;
  });
}

function renderInspector() {
  if (activeSection === "regions") {
    elements.inspector.innerHTML = "";
    if (elements.regionEditorDialog.open) renderAreaEditor();
  }
  else if (activeSection === "messages") renderMessagesInspector();
  else if (activeSection === "settings") renderSettingsInspector();
  else renderJsonInspector();
}

function renderAll() {
  const validation = validateConfig(config);
  renderStatus(validation);
  renderNavigation();
  renderWorkspace();
  renderMapSwitcher();
  renderBaseLayer();
  renderRegionLayers();
  renderSidebar();
  renderInspector();
  updateDrawButtons();
  scheduleMapLayoutSync();
}

map.on("mousemove", (event) => {
  const worldPoint = latLngToWorld(event.latlng);
  if (currentMap().inGameCoordinates) {
    const [mapX, mapY] = worldToInGameMap(worldPoint, currentMap());
    elements.coordinateReadout.textContent = `Map X ${Math.round(mapX).toLocaleString()} · Y ${Math.round(mapY).toLocaleString()} | World X ${worldPoint[0].toLocaleString()} · Y ${worldPoint[1].toLocaleString()}`;
  } else {
    elements.coordinateReadout.textContent = `World X ${worldPoint[0].toLocaleString()} · Y ${worldPoint[1].toLocaleString()}`;
  }
});
map.on("mouseout", () => { elements.coordinateReadout.textContent = "Map X - | Y -"; });
map.on("click", (event) => {
  if (drawing) {
    addDrawPoint(event.latlng);
    return;
  }
});
map.on("dblclick", () => { if (drawing) finishDrawing(); });

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawing) cancelDrawing();
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z" && !event.target.matches("input,textarea")) {
    event.preventDefault();
    undo();
  }
  if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z")) && !event.target.matches("input,textarea")) {
    event.preventDefault();
    redo();
  }
});

elements.sectionNav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-section]");
  if (!button) return;
  activeSection = button.dataset.section;
  inspectorTab = "general";
  editingRegionShape = false;
  workspaceView = ["regions", "messages"].includes(activeSection) ? "list" : "edit";
  if (activeSection === "json") rawEditorValue = stringifyConfig(config);
  renderAll();
});

elements.undoButton.addEventListener("click", undo);
elements.redoButton.addEventListener("click", redo);
elements.editShapeButton.addEventListener("click", () => {
  if (selectedRegionIndex == null || drawing) return;
  editingRegionShape = !editingRegionShape;
  renderRegionLayers();
  updateDrawButtons();
});
elements.drawButton.addEventListener("click", startDrawing);
elements.finishDrawButton.addEventListener("click", finishDrawing);
elements.cancelDrawButton.addEventListener("click", () => cancelDrawing());
elements.fitButton.addEventListener("click", fitVisible);

elements.regionEditorCloseButton.addEventListener("click", () => elements.regionEditorDialog.close());
elements.regionEditorDoneButton.addEventListener("click", () => elements.regionEditorDialog.close());
elements.regionEditorDialog.addEventListener("close", () => {
  const wildernessTrigger = editingWilderness
    ? elements.sidebar.querySelector("[data-wilderness-settings]")
    : selectedRegionIndex == null
      ? null
      : elements.sidebar.querySelector(`[data-region-settings="${selectedRegionIndex}"]`);
  const target = activeAreaSettingsTrigger?.isConnected ? activeAreaSettingsTrigger : wildernessTrigger;
  editingWilderness = false;
  activeAreaSettingsTrigger = null;
  target?.focus();
});

elements.newButton.addEventListener("click", async () => {
  if (!await confirmAction("Create a new configuration", "Replace the current editor state with a clean configuration containing only the Wilderness?")) return;
  replaceConfig(createDefaultConfig(), true);
  toast("New configuration created.", "success");
});

elements.importButton.addEventListener("click", () => elements.importInput.click());
elements.importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const parsed = parseConfigBytesWithMigration(await file.arrayBuffer());
    if (parsed.migration.changed) {
      activeSection = "json";
      workspaceView = "edit";
    }
    replaceConfig(parsed.config, parsed.migration.changed);
    toast(
      parsed.migration.changed
        ? `${file.name} imported and migrated to Configuration Version ${parsed.migration.targetVersion}.`
        : `${file.name} imported.`,
      "success"
    );
  } catch (error) {
    toast(error.message, "error");
  }
});

elements.exportButton.addEventListener("click", () => {
  const validation = validateConfig(config);
  if (!validation.valid) {
    toast("Fix validation errors before exporting.", "error");
    return;
  }
  download(CONFIG_FILE_NAME, stringifyConfig(config));
  documentStore.markExported();
  renderStatus(validation);
  toast(`${CONFIG_FILE_NAME} exported.`, "success");
});

renderAll();
window.setTimeout(fitVisible, 0);
