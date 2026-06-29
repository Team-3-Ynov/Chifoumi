import { ApiError } from "../api/apiClient.js";
import type { TournamentFormat, TournamentStatus, TournamentSummary } from "../api/types.js";

export type TournamentStatusFilter = TournamentStatus;

export const TOURNAMENT_STATUS_FILTERS: { label: string; value: TournamentStatusFilter | "" }[] = [
  { label: "Tous", value: "" },
  { label: "À venir", value: "upcoming" },
  { label: "Inscriptions ouvertes", value: "registration_open" },
  { label: "En cours", value: "in_progress" },
  { label: "Terminés", value: "completed" },
];

const STATUS_LABELS: Record<TournamentStatus, string> = {
  upcoming: "À venir",
  registration_open: "Inscriptions ouvertes",
  in_progress: "En cours",
  completed: "Terminé",
};

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  single_elim: "Élimination directe",
  double_elim: "Double élimination",
};

export function formatTournamentStatus(status: TournamentStatus): string {
  return STATUS_LABELS[status];
}

export function formatTournamentFormat(format: TournamentFormat): string {
  return FORMAT_LABELS[format];
}

export function isRegistrationOpen(status: TournamentStatus): boolean {
  return status === "registration_open";
}

export function isTournamentFull(tournament: TournamentSummary): boolean {
  return tournament.registrationsCount >= tournament.bracketSize;
}

const ERROR_MESSAGES: Record<string, string> = {
  TOURNAMENT_FULL: "Ce tournoi est complet, aucune place disponible.",
  REGISTRATION_CLOSED: "Les inscriptions à ce tournoi sont fermées.",
  ALREADY_REGISTERED: "Vous êtes déjà inscrit à ce tournoi.",
  NOT_REGISTERED: "Vous n’êtes pas inscrit à ce tournoi.",
  TOURNAMENT_NOT_FOUND: "Ce tournoi est introuvable.",
};

export function humanizeTournamentError(error: unknown): string {
  if (error instanceof ApiError) {
    return ERROR_MESSAGES[error.message] ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Une erreur est survenue.";
}
