import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
    /** Компактный вывод по файлам (без дерева каждого it) */
    reporters: [["default", { summary: false }]],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/main.ts",
        "src/ui/render.ts",
        "src/features/events.ts"
      ],
      thresholds: {
        statements: 100,
        lines: 100,
        functions: 100,
        branches: 80
      }
    }
  }
});
