import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { App } from "../src/App";

describe("legal application", () => {
  afterEach(cleanup);

  test("renders the notices and navigation through Solid", () => {
    render(() => <App />);

    expect(screen.getByRole("heading", { name: "Unofficial fan-made project." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Map imagery" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Legal" }).getAttribute("aria-current")).toBe("page");
  });
});
