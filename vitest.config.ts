import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@gestoria/tax-engine": path.resolve(__dirname, "packages/tax-engine/src/index.ts"),
    },
  },
})
