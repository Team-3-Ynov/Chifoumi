import { describe, expect, it } from "@jest/globals";
import { TemplateService } from "./template.service.js";

describe("TemplateService", () => {
  const service = new TemplateService();

  it("renders welcome template with interpolated displayName", () => {
    const rendered = service.render("welcome", { displayName: "alice" });

    expect(rendered.subject).toBe("Bienvenue sur Chifoumi");
    expect(rendered.html).toContain("alice");
    expect(rendered.text).toContain("alice");
    expect(rendered.html).not.toContain("__DISPLAY_NAME__");
    expect(rendered.text).not.toContain("__DISPLAY_NAME__");
  });

  it("renders reset-password template with interpolated resetUrl", () => {
    const rendered = service.render("reset-password", {
      resetUrl: "https://example.com/reset-password?token=abc",
    });

    expect(rendered.subject).toBe("Réinitialisation de votre mot de passe Chifoumi");
    expect(rendered.html).toContain("https://example.com/reset-password?token=abc");
    expect(rendered.text).toContain("https://example.com/reset-password?token=abc");
    expect(rendered.html).not.toContain("__RESET_URL__");
    expect(rendered.text).not.toContain("__RESET_URL__");
  });

  it("throws a clear error when template is unknown", () => {
    expect(() => service.render("missing-template", {})).toThrow(
      "Unknown mail template: missing-template",
    );
  });
});
