import { describe, expect, it } from "vitest";
import { loginFormSchema, registerFormSchema } from "./authSchemas.js";

describe("loginFormSchema", () => {
  it("accepts valid credentials", () => {
    expect(
      loginFormSchema.safeParse({ email: "player@example.com", password: "secret" }).success,
    ).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginFormSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
  });
});

describe("registerFormSchema", () => {
  it("accepts valid registration payload", () => {
    expect(
      registerFormSchema.safeParse({
        email: "player@example.com",
        password: "password1234",
        displayName: "player_1",
      }).success,
    ).toBe(true);
  });

  it("rejects short passwords", () => {
    const result = registerFormSchema.safeParse({
      email: "player@example.com",
      password: "short",
      displayName: "player1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid display names", () => {
    const result = registerFormSchema.safeParse({
      email: "player@example.com",
      password: "password1234",
      displayName: "bad name",
    });
    expect(result.success).toBe(false);
  });
});
