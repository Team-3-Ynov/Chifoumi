import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tokenStorage } from "../auth/tokenStorage.js";
import { apiClient } from "./apiClient.js";
import { login, logout, register } from "./authApi.js";

describe("authApi", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    tokenStorage.clear();
  });

  afterEach(() => {
    mock.restore();
    tokenStorage.clear();
  });

  it("login returns the auth response", async () => {
    const body = {
      user: { id: "u1", email: "a@b.com", displayName: "alice", role: "player" },
      tokens: { access: "a", refresh: "r" },
    };
    mock.onPost("/auth/login").reply(200, body);

    expect(await login({ email: "a@b.com", password: "password1234" })).toEqual(body);
  });

  it("register returns the auth response", async () => {
    const body = {
      user: { id: "u2", email: "c@d.com", displayName: "bob", role: "player" },
      tokens: { access: "a2", refresh: "r2" },
    };
    mock.onPost("/auth/register").reply(201, body);

    expect(
      await register({ email: "c@d.com", password: "password1234", displayName: "bob" }),
    ).toEqual(body);
  });

  it("logout resolves on 204", async () => {
    mock.onPost("/auth/logout").reply(204);
    await expect(logout()).resolves.toBeUndefined();
  });
});
