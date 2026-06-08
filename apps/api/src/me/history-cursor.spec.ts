import { describe, expect, it } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { decodeHistoryCursor, encodeHistoryCursor } from "./history-cursor.js";

describe("history-cursor", () => {
  it("round-trips endedAt and match id", () => {
    const endedAt = new Date("2026-06-01T12:00:00.000Z");
    const cursor = encodeHistoryCursor(endedAt, "match-uuid");

    expect(decodeHistoryCursor(cursor)).toEqual({
      ts: "2026-06-01T12:00:00.000Z",
      id: "match-uuid",
    });
  });

  it("rejects invalid cursor", () => {
    expect(() => decodeHistoryCursor("not-a-cursor")).toThrow(BadRequestException);
  });
});
