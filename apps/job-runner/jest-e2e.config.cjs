/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@chifoumi/db$": "@prisma/client",
  },
  testEnvironment: "node",
  maxWorkers: 1,
  testTimeout: 30_000,
  rootDir: ".",
  testRegex: "test/.*\\.integration-spec\\.ts$",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.e2e.json",
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!(@prisma/client|\\.prisma/client)/)"],
};
