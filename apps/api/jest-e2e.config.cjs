/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@chifoumi/db$": "<rootDir>/../../packages/db/src/index.ts",
  },
  testEnvironment: "node",
  rootDir: ".",
  testRegex: "test/.*\\.e2e-spec\\.ts$",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.json",
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!(@prisma/client|\\.prisma/client)/)"],
};
