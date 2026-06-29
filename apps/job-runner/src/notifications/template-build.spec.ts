import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";

describe("notification template build output", () => {
  const distTemplatesDir = join(process.cwd(), "dist/notifications/templates");

  it("copy script places welcome templates in dist", () => {
    rmSync(distTemplatesDir, { recursive: true, force: true });

    execSync("node scripts/copy-notification-templates.mjs", { cwd: process.cwd() });

    expect(existsSync(join(distTemplatesDir, "welcome.html"))).toBe(true);
    expect(existsSync(join(distTemplatesDir, "welcome.txt"))).toBe(true);
  });
});
