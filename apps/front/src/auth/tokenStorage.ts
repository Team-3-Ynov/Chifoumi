import type { AuthTokens, AuthUser } from "../api/types.js";

const REFRESH_STORAGE_KEY = "chifoumi.refresh-token";
const USER_STORAGE_KEY = "chifoumi.user";

// The access token is kept in memory only — never in storage — to limit XSS
// exposure. The refresh token and the (non-sensitive) user identity live in
// sessionStorage so the session can be restored on reload without an extra
// network round-trip; both are dropped when the tab is closed.
let accessToken: string | null = null;

export const tokenStorage = {
  getAccessToken(): string | null {
    return accessToken;
  },

  getRefreshToken(): string | null {
    return sessionStorage.getItem(REFRESH_STORAGE_KEY);
  },

  getUser(): AuthUser | null {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  // Persist a full session after login/register.
  setSession(user: AuthUser, tokens: AuthTokens): void {
    accessToken = tokens.access;
    sessionStorage.setItem(REFRESH_STORAGE_KEY, tokens.refresh);
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  },

  // Update only the tokens after a background refresh (keeps the stored user).
  setTokens(tokens: AuthTokens): void {
    accessToken = tokens.access;
    sessionStorage.setItem(REFRESH_STORAGE_KEY, tokens.refresh);
  },

  clear(): void {
    accessToken = null;
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
  },
};
