import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/lib/theme";

function stubColorScheme(dark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: dark,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("printing in dark mode", () => {
  const root = document.documentElement;

  beforeEach(() => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    root.classList.remove("dark");
  });

  it("prints in light colours, then returns to dark", () => {
    stubColorScheme(true);
    render(<ThemeProvider><span /></ThemeProvider>);
    expect(root).toHaveClass("dark");

    window.dispatchEvent(new Event("beforeprint"));
    expect(root).not.toHaveClass("dark");

    window.dispatchEvent(new Event("afterprint"));
    expect(root).toHaveClass("dark");
  });

  it("still returns to dark when the browser fires beforeprint twice", () => {
    stubColorScheme(true);
    render(<ThemeProvider><span /></ThemeProvider>);

    window.dispatchEvent(new Event("beforeprint"));
    window.dispatchEvent(new Event("beforeprint"));
    window.dispatchEvent(new Event("afterprint"));
    expect(root).toHaveClass("dark");
  });

  it("does not turn on dark mode after printing in light mode", () => {
    stubColorScheme(false);
    render(<ThemeProvider><span /></ThemeProvider>);

    window.dispatchEvent(new Event("beforeprint"));
    window.dispatchEvent(new Event("afterprint"));
    expect(root).not.toHaveClass("dark");
  });
});
