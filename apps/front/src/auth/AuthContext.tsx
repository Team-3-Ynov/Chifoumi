import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, configureApiClient, refreshTokens } from "../api/apiClient.js";
import type { AuthResponse, AuthUser, MeProfile } from "../api/types.js";
import { queryClient } from "../queryClient.js";
import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from "./authStorage.js";

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(profile: MeProfile): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
  };
}

function clearUserQueries(): void {
  queryClient.clear();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const hasBootstrappedRef = useRef(false);

  const clearSession = useCallback(() => {
    accessTokenRef.current = null;
    setAccessToken(null);
    clearStoredRefreshToken();
    setUser(null);
    clearUserQueries();
  }, []);

  const redirectToLogin = useCallback(() => {
    clearSession();
    navigate("/login", { replace: true });
  }, [clearSession, navigate]);

  const applyTokens = useCallback((access: string, refresh: string) => {
    accessTokenRef.current = access;
    setAccessToken(access);
    setStoredRefreshToken(refresh);
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const storedRefresh = getStoredRefreshToken();
    if (!storedRefresh) {
      clearSession();
      return null;
    }

    refreshPromiseRef.current = (async () => {
      try {
        const { tokens } = await refreshTokens(storedRefresh);
        applyTokens(tokens.access, tokens.refresh);
        return tokens.access;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [applyTokens, clearSession]);

  const bootstrapSession = useCallback(async () => {
    const storedRefresh = getStoredRefreshToken();
    if (!storedRefresh) {
      setIsBootstrapping(false);
      return;
    }

    try {
      const access = await refreshAccessToken();
      if (!access) {
        setIsBootstrapping(false);
        return;
      }

      const profile = await apiRequest<MeProfile>("/me");
      setUser(toAuthUser(profile));
    } catch {
      clearSession();
    } finally {
      setIsBootstrapping(false);
    }
  }, [clearSession, refreshAccessToken]);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => accessTokenRef.current,
      refreshAccessToken,
      onAuthFailure: redirectToLogin,
    });

    if (hasBootstrappedRef.current) {
      return;
    }

    hasBootstrappedRef.current = true;
    void bootstrapSession();
  }, [bootstrapSession, redirectToLogin, refreshAccessToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      clearUserQueries();
      applyTokens(result.tokens.access, result.tokens.refresh);
      setUser(result.user);
    },
    [applyTokens],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const result = await apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
      });

      clearUserQueries();
      applyTokens(result.tokens.access, result.tokens.refresh);
      setUser(result.user);
    },
    [applyTokens],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>("/auth/logout", { method: "POST" });
    } catch {
      // logout is best-effort client-side
    } finally {
      redirectToLogin();
    }
  }, [redirectToLogin]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: user !== null,
      isBootstrapping,
      login,
      register,
      logout,
    }),
    [user, accessToken, isBootstrapping, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
