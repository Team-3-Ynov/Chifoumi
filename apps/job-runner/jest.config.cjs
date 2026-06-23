/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testRegex: ".*\\.spec\\.ts$",
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "\\.spec\\.ts$",
    "main\\.ts$", // NestJS bootstrap entrypoint
    "\\.module\\.ts$", // NestJS module wiring
    "/config/", // env/config loaders
    "/templates/", // static notification templates (HTML/text)
    "metrics\\.controller\\.ts$", // Prometheus scrape wiring
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.spec.json",
      },
    ],
  },
};
