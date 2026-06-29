const REFRESH_TOKEN_KEY = "chifoumi.refreshToken";

export function getStoredRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string): void {
  sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearStoredRefreshToken(): void {
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}
