module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.js"],
  clearMocks: true,
  /** Скрывает console.* из кода тестов и приложения (меньше «красного» в терминале). Для отладки временно поставьте false. */
  silent: true,
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/server.js",
    "!src/config/prisma.js"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      statements: 88,
      branches: 78,
      functions: 95,
      lines: 91
    }
  }
};
