/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      // Trivial / non-logic files are excluded per CLAUDE.md coverage rules.
      exclude: [
        "src/main.tsx",
        "src/App.tsx",
        "src/pages/**",
        "src/layouts/**",
        "src/test/**",
        "src/vite-env.d.ts",
        "src/**/*.spec.{ts,tsx}",
      ],
    },
  },
});
