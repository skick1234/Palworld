import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { App } from "../src/App";

describe("landing application", () => {
  afterEach(cleanup);

  test("renders the complete product landing page through Solid", () => {
    render(() => <App />);

    expect(screen.getByRole("heading", { name: /Rule the map.*Run the server/ })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Open Rules Studio" })[0]?.getAttribute("href")).toBe("pallaw/");
    expect(document.querySelectorAll(".map-mosaic img")).toHaveLength(16);
    expect(screen.getByText("Your world stays yours.")).toBeTruthy();
  });
});
