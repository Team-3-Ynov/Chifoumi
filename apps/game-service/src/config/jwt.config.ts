import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type JwtConfig = {
  publicKey: string;
};

function readPemFromEnvOrPath(envValue: string | undefined, pathEnv: string | undefined): string {
  if (envValue?.includes("BEGIN")) {
    return envValue.replace(/\\n/g, "\n");
  }
  if (!pathEnv) {
    throw new Error("JWT key missing: set JWT_PUBLIC_KEY or JWT_PUBLIC_KEY_PATH");
  }
  return readFileSync(resolve(pathEnv), "utf8");
}

export function loadJwtConfig(): JwtConfig {
  return {
    publicKey: readPemFromEnvOrPath(process.env.JWT_PUBLIC_KEY, process.env.JWT_PUBLIC_KEY_PATH),
  };
}

export const JWT_CONFIG = "JWT_CONFIG";
