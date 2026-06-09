import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Injectable } from "@nestjs/common";

export type RenderedMail = {
  subject: string;
  html: string;
  text: string;
};

const TEMPLATE_SUBJECTS: Record<string, string> = {
  welcome: "Bienvenue sur Chifoumi",
};

@Injectable()
export class TemplateService {
  private readonly templatesDir = join(dirname(fileURLToPath(import.meta.url)), "templates");

  render(template: string, data: Record<string, string>): RenderedMail {
    const subject = TEMPLATE_SUBJECTS[template];
    if (!subject) {
      throw new Error(`Unknown mail template: ${template}`);
    }

    const htmlSource = this.readTemplate(template, "html");
    const textSource = this.readTemplate(template, "txt");

    return {
      subject,
      html: this.interpolate(htmlSource, data),
      text: this.interpolate(textSource, data),
    };
  }

  private interpolate(source: string, data: Record<string, string>): string {
    return Object.entries(data).reduce((content, [key, value]) => {
      const placeholder = `__${key.replace(/([A-Z])/g, "_$1").toUpperCase()}__`;
      return content.replaceAll(placeholder, value);
    }, source);
  }

  private readTemplate(template: string, extension: "html" | "txt"): string {
    const filePath = join(this.templatesDir, `${template}.${extension}`);

    try {
      return readFileSync(filePath, "utf8");
    } catch {
      throw new Error(`Missing mail template file: ${template}.${extension}`);
    }
  }
}
