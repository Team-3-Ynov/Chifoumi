export const DEFAULT_ADMIN_EMAIL = "admin@chifoumi.local";
export const DEFAULT_ADMIN_PASSWORD = "admin-CHANGE-ME!";
export const DEFAULT_ADMIN_DISPLAY_NAME = "admin";

export type SeedConfig = {
  adminEmail: string;
  adminPassword: string;
  adminDisplayName: string;
};

export function getSeedConfig(env: NodeJS.ProcessEnv = process.env): SeedConfig {
  return {
    adminEmail: env.ADMIN_DEFAULT_EMAIL ?? DEFAULT_ADMIN_EMAIL,
    adminPassword: env.ADMIN_DEFAULT_PASSWORD ?? DEFAULT_ADMIN_PASSWORD,
    adminDisplayName: DEFAULT_ADMIN_DISPLAY_NAME,
  };
}
