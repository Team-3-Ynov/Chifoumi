export class PrismaClient {
  $connect(): Promise<void> {
    return Promise.resolve();
  }

  $disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

export enum UserRole {
  player = "player",
  admin = "admin",
}

export const Prisma = {
  PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
    code: string;
    meta?: Record<string, unknown>;

    constructor(message: string, options: { code: string; meta?: Record<string, unknown> }) {
      super(message);
      this.code = options.code;
      this.meta = options.meta;
    }
  },
};
