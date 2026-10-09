import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import TopBar from "@/components/TopBar";

const mocks = vi.hoisted(() => ({ post: vi.fn(), clear: vi.fn(), replace: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/auth", () => ({ clearToken: mocks.clear, usesSessionProxy: () => true }));
vi.mock("@/lib/api", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiPost: mocks.post }));
vi.mock("@/lib/language", () => ({ useLanguage: () => ({ language: "ar", toggleLanguage: vi.fn() }) }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ resolvedTheme: "light", toggleTheme: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
beforeEach(() => { for (const mock of Object.values(mocks)) mock.mockReset(); });

it("does not claim logout succeeded when the Worker could not be reached", async () => {
  mocks.post.mockRejectedValue(new ApiError("Network unavailable", 0));
  render(<TopBar />);
  await userEvent.click(screen.getByRole("button", { name: "تسجيل الخروج" }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalled());
  expect(mocks.clear).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("clears the navigation hint after the server clears the cookie", async () => {
  mocks.post.mockResolvedValue({ success: true });
  render(<TopBar />);
  await userEvent.click(screen.getByRole("button", { name: "تسجيل الخروج" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
  expect(mocks.clear).toHaveBeenCalledOnce();
});

it("finishes local sign-out after the Worker clears a cookie during an upstream outage", async () => {
  mocks.post.mockRejectedValue(new ApiError("Upstream unavailable", 502));
  render(<TopBar />);
  await userEvent.click(screen.getByRole("button", { name: "تسجيل الخروج" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
  expect(mocks.clear).toHaveBeenCalledOnce();
});
