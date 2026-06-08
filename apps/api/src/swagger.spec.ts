import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { createSwaggerBasicAuthMiddleware, isSwaggerEnabled } from "./swagger.js";

describe("swagger", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("is disabled in production when basic auth credentials are missing", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      SWAGGER_USER: "",
      SWAGGER_PASSWORD: "",
    };

    expect(isSwaggerEnabled()).toBe(false);
  });

  it("allows Swagger in production with valid basic auth credentials", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      SWAGGER_USER: "docs",
      SWAGGER_PASSWORD: "secret",
    };
    const middleware = createSwaggerBasicAuthMiddleware();
    const next = jest.fn();
    const res = {
      setHeader: jest.fn(),
      status: jest.fn(() => ({ send: jest.fn() })),
    };

    middleware(
      {
        headers: {
          authorization: `Basic ${Buffer.from("docs:secret").toString("base64")}`,
        },
      },
      res,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects Swagger in production with invalid basic auth credentials", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      SWAGGER_USER: "docs",
      SWAGGER_PASSWORD: "secret",
    };
    const middleware = createSwaggerBasicAuthMiddleware();
    const next = jest.fn();
    const send = jest.fn();
    const res = {
      setHeader: jest.fn(),
      status: jest.fn(() => ({ send })),
    };

    middleware({ headers: { authorization: "Basic wrong" } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      "WWW-Authenticate",
      'Basic realm="Chifoumi Swagger"',
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith("Authentication required");
  });
});
