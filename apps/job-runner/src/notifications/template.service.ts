import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Injectable } from "@nestjs/common";
import Handlebars from "handlebars";

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
      html: Handlebars.compile(htmlSource)(data),
      text: Handlebars.compile(textSource)(data),
    };
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
