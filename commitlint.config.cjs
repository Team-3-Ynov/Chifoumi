module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "api",
        "game-service",
        "job-runner",
        "front",
        "db",
        "schemas",
        "elo",
        "proto",
        "leagues",
        "bracket",
        "biome",
        "tsconfig",
        "infra",
        "ci",
        "deps",
      ],
    ],
    "scope-empty": [1, "never"],
  },
};
