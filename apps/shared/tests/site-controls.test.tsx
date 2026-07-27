import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { SupportControl, ThemeToggle } from "../src/SiteControls";

describe("shared Solid site controls", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  test("persists theme changes", async () => {
    render(() => <ThemeToggle />);
    const toggle = screen.getByRole("button", { name: "Use light theme" });

    await fireEvent.click(toggle);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("palworld-mods-theme")).toBe("light");
  });

  test("does not create the Ko-fi iframe before Donate is selected", async () => {
    const showModal = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    try {
      render(() => <SupportControl />);
      expect(document.querySelector("iframe")).toBeNull();

      await fireEvent.click(screen.getByRole("button", { name: "Donate" }));

      expect(screen.getByTitle("Support Skick on Ko-fi")).toBeTruthy();
    } finally {
      HTMLDialogElement.prototype.showModal = showModal;
    }
  });
});
