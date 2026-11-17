import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // Ratchet floor set from the 2026-11-17 baseline (#72). Raise these as
      // tests land; never lower them to make a PR pass.
      thresholds: { statements: 66, branches: 50, functions: 64, lines: 69 },
    },
  },
});
