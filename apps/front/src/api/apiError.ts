import axios from "axios";

// Maps an API failure to a human-readable message. Callers pass the
// status-specific copy they care about (e.g. 401 → "Identifiants invalides")
// and a generic fallback for everything else.
export function resolveAuthErrorMessage(
  error: unknown,
  messagesByStatus: Record<number, string>,
  fallback: string,
): string {
  if (axios.isAxiosError(error) && error.response) {
    const mapped = messagesByStatus[error.response.status];
    if (mapped) {
      return mapped;
    }
  }
  return fallback;
}
