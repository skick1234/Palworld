import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { App } from "../src/App";

describe("PalOps guide application", () => {
  afterEach(cleanup);

  test("renders the complete operator guide through Solid", () => {
    render(() => <App />);

    expect(screen.getByRole("heading", { name: "Operate with every seam visible." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Policy belongs to each operation." })).toBeTruthy();
    expect(screen.getByText("SQLite")).toBeTruthy();
    expect(screen.getByRole("link", { name: "PalOps" }).getAttribute("aria-current")).toBe("page");
  });
});
