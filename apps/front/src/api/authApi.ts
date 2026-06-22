import { apiClient } from "./apiClient.js";
import type { AuthResponse } from "./types.js";

export type LoginInput = { email: string; password: string };
export type RegisterInput = { email: string; password: string; displayName: string };

export async function login(input: LoginInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", input);
  return data;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/register", input);
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}
