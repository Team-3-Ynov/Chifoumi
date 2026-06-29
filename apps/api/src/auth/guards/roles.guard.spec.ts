import { jest } from "@jest/globals";
import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { AppRole } from "../decorators/roles.decorator.js";
import { RolesGuard } from "./roles.guard.js";

function createContext(user: { role?: AppRole } | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function createGuard(requiredRoles: AppRole[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe("RolesGuard", () => {
  it("allows the request when no roles are declared", () => {
    const guard = createGuard(undefined);
    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });

  it("allows the request when the declared roles array is empty", () => {
    const guard = createGuard([]);
    expect(guard.canActivate(createContext({ role: "player" }))).toBe(true);
  });

  it("allows a user whose role is included in the required roles", () => {
    const guard = createGuard(["admin"]);
    expect(guard.canActivate(createContext({ role: "admin" }))).toBe(true);
  });

  it("rejects a user whose role is not included", () => {
    const guard = createGuard(["admin"]);
    expect(() => guard.canActivate(createContext({ role: "player" }))).toThrow(ForbiddenException);
  });

  it("rejects a request without an authenticated user", () => {
    const guard = createGuard(["admin"]);
    expect(() => guard.canActivate(createContext(undefined))).toThrow(ForbiddenException);
  });
});
