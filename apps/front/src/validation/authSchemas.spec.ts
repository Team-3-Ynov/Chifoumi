import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./authSchemas.js";

describe("authSchemas (AC7)", () => {
  describe("loginSchema", () => {
    it("accepts a valid email + non-empty password", () => {
      const result = loginSchema.safeParse({ email: "a@b.com", password: "x" });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid email", () => {
      const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
      expect(result.success).toBe(false);
    });

    it("rejects an empty password", () => {
      const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    const valid = {
      email: "player@example.com",
      password: "password1234",
      displayName: "player_1",
    };

    it("accepts a valid payload", () => {
      expect(registerSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects a password shorter than 10 characters", () => {
      expect(registerSchema.safeParse({ ...valid, password: "short123" }).success).toBe(false);
    });

    it("rejects a displayName shorter than 3 characters", () => {
      expect(registerSchema.safeParse({ ...valid, displayName: "ab" }).success).toBe(false);
    });

    it("rejects a displayName longer than 30 characters", () => {
      expect(registerSchema.safeParse({ ...valid, displayName: "a".repeat(31) }).success).toBe(
        false,
      );
    });

    it("rejects a displayName with forbidden characters", () => {
      expect(registerSchema.safeParse({ ...valid, displayName: "bad name!" }).success).toBe(false);
    });

    it("accepts letters, digits, underscores and dashes in displayName", () => {
      expect(registerSchema.safeParse({ ...valid, displayName: "a-b_1" }).success).toBe(true);
    });
  });
});
