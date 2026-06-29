import { SetMetadata } from "@nestjs/common";

export type AppRole = "player" | "admin";

export const ROLES_KEY = "roles";

/**
 * Restrict a route (or a whole controller) to the given roles. Without this
 * decorator the {@link RolesGuard} is a no-op, so existing authenticated
 * endpoints keep accepting any role.
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
