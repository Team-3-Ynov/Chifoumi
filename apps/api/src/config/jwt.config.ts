import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type JwtConfig = {
  privateKey: string;
  publicKey: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
};

function readPemFromEnvOrPath(envValue: string | undefined, pathEnv: string | undefined): string {
  if (envValue?.includes("BEGIN")) {
    return envValue.replace(/\\n/g, "\n");
  }
  if (!pathEnv) {
    throw new Error("JWT key missing: set JWT_*_KEY or JWT_*_KEY_PATH");
  }
  return readFileSync(resolve(pathEnv), "utf8");
}

export function loadJwtConfig(): JwtConfig {
  return {
    privateKey: readPemFromEnvOrPath(process.env.JWT_PRIVATE_KEY, process.env.JWT_PRIVATE_KEY_PATH),
    publicKey: readPemFromEnvOrPath(process.env.JWT_PUBLIC_KEY, process.env.JWT_PUBLIC_KEY_PATH),
    accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    refreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 604800),
  };
}

export const JWT_CONFIG = "JWT_CONFIG";
