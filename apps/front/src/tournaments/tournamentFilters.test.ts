import { describe, expect, it } from "vitest";
import { ApiError } from "../api/apiClient.js";
import type { TournamentDetail } from "../api/types.js";
import {
  formatTournamentFormat,
  formatTournamentStatus,
  humanizeTournamentError,
  isRegistrationOpen,
  isTournamentFull,
} from "./tournamentFilters.js";

function makeDetail(overrides: Partial<TournamentDetail> = {}): TournamentDetail {
  return {
    id: "t-1",
    name: "Spring Cup",
    format: "single_elim",
    status: "registration_open",
    bracketSize: 8,
    registrationsCount: 4,
    startsAt: "2026-07-15T18:00:00.000Z",
    registrationOpensAt: "2026-07-01T00:00:00.000Z",
    endedAt: null,
    registrations: [],
    bracket: [],
    ...overrides,
  };
}

describe("formatTournamentStatus / formatTournamentFormat", () => {
  it("maps status enums to French labels", () => {
    expect(formatTournamentStatus("registration_open")).toBe("Inscriptions ouvertes");
    expect(formatTournamentStatus("completed")).toBe("Terminé");
  });

  it("maps format enums to French labels", () => {
    expect(formatTournamentFormat("single_elim")).toBe("Élimination directe");
    expect(formatTournamentFormat("double_elim")).toBe("Double élimination");
  });
});

describe("isRegistrationOpen", () => {
  it("is true only for the registration_open status", () => {
    expect(isRegistrationOpen("registration_open")).toBe(true);
    expect(isRegistrationOpen("upcoming")).toBe(false);
    expect(isRegistrationOpen("in_progress")).toBe(false);
  });
});

describe("isTournamentFull", () => {
  it("is true when registered players reach the bracket size", () => {
    expect(isTournamentFull(makeDetail({ registrationsCount: 8, bracketSize: 8 }))).toBe(true);
    expect(isTournamentFull(makeDetail({ registrationsCount: 9, bracketSize: 8 }))).toBe(true);
  });

  it("is false when seats remain", () => {
    expect(isTournamentFull(makeDetail({ registrationsCount: 4, bracketSize: 8 }))).toBe(false);
  });
});

describe("humanizeTournamentError", () => {
  it("maps known API conflict codes to clear messages", () => {
    expect(humanizeTournamentError(new ApiError("TOURNAMENT_FULL", 409))).toBe(
      "Ce tournoi est complet, aucune place disponible.",
    );
    expect(humanizeTournamentError(new ApiError("ALREADY_REGISTERED", 409))).toBe(
      "Vous êtes déjà inscrit à ce tournoi.",
    );
    expect(humanizeTournamentError(new ApiError("REGISTRATION_CLOSED", 409))).toBe(
      "Les inscriptions à ce tournoi sont fermées.",
    );
  });

  it("falls back to the raw message for unknown API codes", () => {
    expect(humanizeTournamentError(new ApiError("SOMETHING_ELSE", 400))).toBe("SOMETHING_ELSE");
  });

  it("handles generic errors and unknown values", () => {
    expect(humanizeTournamentError(new Error("boom"))).toBe("boom");
    expect(humanizeTournamentError("nope")).toBe("Une erreur est survenue.");
  });
});
