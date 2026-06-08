import { scrubTokenFromUrl } from "./scrub-token.js";

describe("scrubTokenFromUrl", () => {
  it("redacts token query values from websocket URLs", () => {
    const url = "/game?token=super-secret-jwt&EIO=4";
    expect(scrubTokenFromUrl(url)).toBe("/game?token=***&EIO=4");
    expect(scrubTokenFromUrl(url)).not.toContain("super-secret-jwt");
  });
});
