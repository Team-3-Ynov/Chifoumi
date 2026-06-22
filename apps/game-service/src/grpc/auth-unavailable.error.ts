export class AuthUnavailableError extends Error {
  constructor() {
    super("AUTH_UNAVAILABLE");
    this.name = "AuthUnavailableError";
  }
}
