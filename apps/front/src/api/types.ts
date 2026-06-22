export type UserRole = "player" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

export type AuthTokens = {
  access: string;
  refresh: string;
};

export type AuthResponse = {
  user: AuthUser;
  tokens: AuthTokens;
};
