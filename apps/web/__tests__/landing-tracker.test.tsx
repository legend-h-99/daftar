import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));

import LandingTracker from "@/app/landing/_tracker";

// The production static export renders sign-in links with a trailing slash.
function renderLanding() {
  return render(
    <main>
      <LandingTracker />
      <header><a href="/login">ابدأ مجانًا</a></header>
      <a href="/login/"><span>جرّب مجانًا</span></a>
      <a href="/privacy/">إشعار الخصوصية</a>
      <a href="/login-help/">مساعدة الدخول</a>
      <footer><a href="/login/">تسجيل الدخول</a></footer>
    </main>,
  );
}

describe("landing CTA tracking", () => {
  beforeEach(() => track.mockClear());

  it("records the landing view once", () => {
    renderLanding();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("landing_viewed");
  });

  it("counts sign-in CTAs with or without the trailing slash, including clicks on inner text", () => {
    renderLanding();
    track.mockClear();
    fireEvent.click(screen.getByText("جرّب مجانًا"));
    fireEvent.click(screen.getByText("ابدأ مجانًا"));
    expect(track.mock.calls).toEqual([
      ["cta_clicked", { location: "body" }],
      ["cta_clicked", { location: "header" }],
    ]);
  });

  it("ignores the footer sign-in link and links to other pages", () => {
    renderLanding();
    track.mockClear();
    fireEvent.click(screen.getByText("تسجيل الدخول"));
    fireEvent.click(screen.getByText("إشعار الخصوصية"));
    fireEvent.click(screen.getByText("مساعدة الدخول"));
    expect(track).not.toHaveBeenCalled();
  });
});
