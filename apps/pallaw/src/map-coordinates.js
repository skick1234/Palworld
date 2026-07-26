export const MAPS = Object.freeze([
  Object.freeze({
    id: "world",
    label: "World",
    projection: "paldb-world",
    canvas: Object.freeze({ width: 2048, height: 2048 }),
    inGameCoordinates: Object.freeze({ scale: 459, mapXOffset: -158000, mapYOffset: 123888 }),
    tiles: Object.freeze({
      root: "assets/paldb-map",
      zoom: 2,
      columns: 4,
      rows: 4
    }),
    bounds: Object.freeze({ minX: -1099400, minY: -724400, maxX: 349400, maxY: 724400 })
  }),
  Object.freeze({
    id: "tree",
    label: "World Tree",
    projection: "paldb-world",
    canvas: Object.freeze({ width: 2048, height: 2048 }),
    inGameCoordinates: Object.freeze({
      scale: 1335.144531,
      mapXOffset: 647699.0433913,
      mapYOffset: 518756.7572597
    }),
    tiles: Object.freeze({
      root: "assets/paldb-tree-map",
      zoom: 2,
      columns: 4,
      rows: 4
    }),
    bounds: Object.freeze({ minX: 347351.5, minY: -818197, maxX: 689148.5, maxY: -476400 })
  })
]);

export function worldToInGameMap([worldX, worldY], mapDefinition = MAPS[0]) {
  const transform = mapDefinition.inGameCoordinates;
  return [
    (Number(worldY) + transform.mapXOffset) / transform.scale,
    (Number(worldX) + transform.mapYOffset) / transform.scale
  ];
}

export function inGameMapToWorld([mapX, mapY], mapDefinition = MAPS[0]) {
  const transform = mapDefinition.inGameCoordinates;
  return [
    Number(mapY) * transform.scale - transform.mapYOffset,
    Number(mapX) * transform.scale - transform.mapXOffset
  ];
}

export function worldToMapFraction([worldX, worldY], mapDefinition) {
  const { minX, minY, maxX, maxY } = mapDefinition.bounds;
  const xFraction = (Number(worldX) - minX) / (maxX - minX);
  const yFraction = (Number(worldY) - minY) / (maxY - minY);
  return mapDefinition.projection === "paldb-world"
    ? [yFraction, xFraction]
    : [xFraction, yFraction];
}

export function mapFractionToWorld([horizontal, vertical], mapDefinition) {
  const { minX, minY, maxX, maxY } = mapDefinition.bounds;
  return mapDefinition.projection === "paldb-world"
    ? [minX + Number(vertical) * (maxX - minX), minY + Number(horizontal) * (maxY - minY)]
    : [minX + Number(horizontal) * (maxX - minX), minY + Number(vertical) * (maxY - minY)];
}
