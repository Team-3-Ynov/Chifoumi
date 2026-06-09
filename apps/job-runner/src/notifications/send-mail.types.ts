export type SendMailJobPayload = {
  to: string;
  template: string;
  data: Record<string, string>;
};

export type WelcomeMailData = {
  displayName: string;
};
