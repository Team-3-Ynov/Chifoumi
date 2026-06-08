import { BadRequestException } from "@nestjs/common";

export type HistoryCursorPayload = {
  ts: string;
  id: string;
};

export function encodeHistoryCursor(endedAt: Date, matchId: string): string {
  const payload: HistoryCursorPayload = {
    ts: endedAt.toISOString(),
    id: matchId,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeHistoryCursor(cursor: string): HistoryCursorPayload {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as HistoryCursorPayload;

    if (typeof parsed.ts !== "string" || typeof parsed.id !== "string") {
      throw new Error("invalid cursor shape");
    }

    const endedAt = new Date(parsed.ts);
    if (Number.isNaN(endedAt.getTime())) {
      throw new Error("invalid cursor timestamp");
    }

    return parsed;
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
}
