import "reflect-metadata";
import { AuthController } from "./auth.controller.js";
import { IS_PUBLIC_KEY } from "./decorators/public.decorator.js";

describe("AuthController route metadata", () => {
  it.each([
    "register",
    "login",
    "refresh",
    "forgotPassword",
    "resetPassword",
  ] as const)("marks %s as public for the global JWT guard", (handlerName) => {
    const handler = AuthController.prototype[handlerName];

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
  });

  it("keeps logout protected by the global JWT guard", () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.logout)).toBeUndefined();
  });
});
