import { describe, expect, it } from "@jest/globals";
import { TemplateService } from "./template.service.js";

describe("TemplateService", () => {
  const service = new TemplateService();

  it("renders welcome template with interpolated displayName", () => {
    const rendered = service.render("welcome", { displayName: "alice" });

    expect(rendered.subject).toBe("Bienvenue sur Chifoumi");
    expect(rendered.html).toContain("alice");
    expect(rendered.text).toContain("alice");
    expect(rendered.html).not.toContain("{{displayName}}");
    expect(rendered.text).not.toContain("{{displayName}}");
  });

  it("throws a clear error when template is unknown", () => {
    expect(() => service.render("missing-template", {})).toThrow(
      "Unknown mail template: missing-template",
    );
  });
});
