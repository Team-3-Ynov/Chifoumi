import { PasswordService } from "./password.service.js";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("hashes and verifies a password", async () => {
    const hash = await service.hash("securePass123");
    expect(hash).not.toBe("securePass123");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(service.verify(hash, "securePass123")).resolves.toBe(true);
    await expect(service.verify(hash, "wrongPassword")).resolves.toBe(false);
  });
});
