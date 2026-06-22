import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setSessionExpiredHandler } from "../api/apiClient.js";
import {
  type LoginInput,
  login as loginRequest,
  logout as logoutRequest,
  type RegisterInput,
  register as registerRequest,
} from "../api/authApi.js";
import type { AuthResponse, AuthUser } from "../api/types.js";
import { tokenStorage } from "./tokenStorage.js";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuthResponse = useCallback((response: AuthResponse) => {
    tokenStorage.setSession(response.user, response.tokens);
    setUser(response.user);
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      applyAuthResponse(await loginRequest(input));
    },
    [applyAuthResponse],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      applyAuthResponse(await registerRequest(input));
    },
    [applyAuthResponse],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

  // Restore the session on reload straight from sessionStorage (no network):
  // the stored identity + refresh token are enough to consider the user logged
  // in. A fresh access token is fetched lazily by the apiClient interceptor on
  // the first authenticated request, and an expired refresh token there drops
  // the session and redirects to /login.
  useEffect(() => {
    const storedUser = tokenStorage.getUser();
    if (storedUser && tokenStorage.getRefreshToken()) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  // When a background refresh fails, drop the session so ProtectedRoute redirects.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      tokenStorage.clear();
      setUser(null);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
