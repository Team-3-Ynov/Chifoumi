import { Inject, Injectable } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import { JOB_RUNNER_CONFIG, type JobRunnerConfig } from "../config/env.js";
import { TemplateService } from "./template.service.js";

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;

  constructor(
    @Inject(JOB_RUNNER_CONFIG) private readonly config: JobRunnerConfig,
    private readonly templateService: TemplateService,
  ) {}

  async send(input: { to: string; template: string; data: Record<string, string> }): Promise<void> {
    const rendered = this.templateService.render(input.template, input.data);
    const transporter = this.getTransporter();

    await transporter.sendMail({
      from: this.config.MAIL_FROM,
      to: input.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.MAIL_HOST,
        port: this.config.MAIL_PORT,
        secure: false,
      });
    }

    return this.transporter;
  }
}
