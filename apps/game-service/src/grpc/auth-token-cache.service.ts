import type { VerifyTokenResponse } from "@chifoumi/proto";
import { Injectable } from "@nestjs/common";

type CacheEntry = {
  result: VerifyTokenResponse;
  expiresAt: number;
};

@Injectable()
export class AuthTokenCacheService {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly ttlMs = 30_000;

  get(token: string): VerifyTokenResponse | null {
    const entry = this.entries.get(token);
    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(token);
      return null;
    }

    return entry.result;
  }

  set(token: string, result: VerifyTokenResponse): void {
    if (!result.valid) {
      return;
    }

    this.entries.set(token, {
      result,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(token: string): void {
    this.entries.delete(token);
  }
}
