import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests for the site's math (tests/*.test.ts). Pure functions only: no network, no database. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node", testTimeout: 60_000 },
});
