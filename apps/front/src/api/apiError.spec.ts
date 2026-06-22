import { describe, expect, it } from "vitest";
import { resolveAuthErrorMessage } from "./apiError.js";

function axiosLikeError(status: number): unknown {
  return { isAxiosError: true, response: { status } };
}

describe("resolveAuthErrorMessage (AC3)", () => {
  it("maps a known status to its message", () => {
    expect(
      resolveAuthErrorMessage(axiosLikeError(409), { 409: "Email déjà utilisé" }, "fallback"),
    ).toBe("Email déjà utilisé");
  });

  it("falls back for an unmapped status", () => {
    expect(resolveAuthErrorMessage(axiosLikeError(500), { 401: "x" }, "fallback")).toBe("fallback");
  });

  it("falls back for a non-axios error", () => {
    expect(resolveAuthErrorMessage(new Error("boom"), { 401: "x" }, "fallback")).toBe("fallback");
  });
});
