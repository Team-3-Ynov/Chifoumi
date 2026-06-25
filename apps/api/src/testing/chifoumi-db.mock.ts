export const UserRole = {
  player: "player",
  admin: "admin",
} as const;

export const MatchStatus = {
  in_progress: "in_progress",
  ended: "ended",
  aborted: "aborted",
} as const;

export const SeasonStatus = {
  upcoming: "upcoming",
  active: "active",
  closed: "closed",
} as const;

export const TournamentFormat = {
  single_elim: "single_elim",
  double_elim: "double_elim",
} as const;

export const TournamentStatus = {
  upcoming: "upcoming",
  registration_open: "registration_open",
  in_progress: "in_progress",
  completed: "completed",
} as const;

export type User = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: keyof typeof UserRole;
};

export type Season = {
  id: string;
  name: string;
  startedAt: Date;
  endsAt: Date | null;
  status: keyof typeof SeasonStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type Tournament = {
  id: string;
  name: string;
  format: keyof typeof TournamentFormat;
  bracketSize: number;
  registrationOpensAt: Date;
  startsAt: Date;
  endedAt: Date | null;
  status: keyof typeof TournamentStatus;
  winnerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaDelegate = {
  count: (...args: unknown[]) => Promise<number>;
  create: (...args: unknown[]) => Promise<unknown>;
  delete: (...args: unknown[]) => Promise<unknown>;
  deleteMany: (...args: unknown[]) => Promise<unknown>;
  findFirst: (...args: unknown[]) => Promise<unknown>;
  findMany: (...args: unknown[]) => Promise<unknown[]>;
  findUnique: (...args: unknown[]) => Promise<unknown>;
  update: (...args: unknown[]) => Promise<unknown>;
  updateMany: (...args: unknown[]) => Promise<unknown>;
};

const delegate = {} as PrismaDelegate;

export class PrismaClient {
  readonly eloRating = delegate;
  readonly league = delegate;
  readonly match = delegate;
  readonly passwordResetToken = delegate;
  readonly refreshToken = delegate;
  readonly season = delegate;
  readonly tournament = delegate;
  readonly tournamentRegistration = delegate;
  readonly user = delegate;

  async $queryRaw<T = unknown>(..._args: unknown[]): Promise<T> {
    return [] as T;
  }

  async $transaction<T>(callback: (tx: this) => Promise<T>): Promise<T> {
    return callback(this);
  }
}

export namespace Prisma {
  export type MatchWhereInput = Record<string, unknown>;

  export class PrismaClientKnownRequestError extends Error {
    readonly code: string;

    readonly meta?: Record<string, unknown>;

    constructor(
      message: string,
      opts: { code: string; clientVersion?: string; meta?: Record<string, unknown> },
    ) {
      super(message);
      this.code = opts.code;
      this.meta = opts.meta;
    }
  }
}
