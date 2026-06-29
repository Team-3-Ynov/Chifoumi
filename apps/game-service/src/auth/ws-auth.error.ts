export const WS_AUTH_INVALID_TOKEN_CODE = 4001;
export const WS_AUTH_UNAVAILABLE_CODE = 4002;
export const WS_AUTH_TOKEN_REVOKED_CODE = 4003;

export class WsAuthError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
    this.name = "WsAuthError";
  }
}
