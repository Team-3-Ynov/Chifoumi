const DEFAULT_CORS_ORIGINS = ["http://localhost:5173"];

export function resolveCorsOrigins() {
  const origins = process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL;

  if (!origins) {
    return DEFAULT_CORS_ORIGINS;
  }

  return origins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
