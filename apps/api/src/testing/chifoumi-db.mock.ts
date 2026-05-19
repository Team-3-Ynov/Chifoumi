export const UserRole = {
  player: "player",
  admin: "admin",
} as const;

export class PrismaClient {}

export const Prisma = {
  PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
    readonly code: string;

    constructor(message: string, opts: { code: string }) {
      super(message);
      this.code = opts.code;
    }
  },
};
