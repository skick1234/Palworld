import "leaflet";

declare module "leaflet" {
  interface MapOptions {
    editable?: boolean;
  }

  interface Map {
    editTools?: unknown;
  }

  interface Polygon {
    enableEdit(map?: Map): this;
    disableEdit(): this;
  }
}
