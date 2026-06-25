import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTournament,
  listTournaments,
  registerForTournament,
  unregisterFromTournament,
} from "../api/apiClient.js";
import type { TournamentStatus } from "../api/types.js";

const TOURNAMENTS_KEY = "tournaments";
const TOURNAMENT_KEY = "tournament";

export function useTournaments(status?: TournamentStatus) {
  return useQuery({
    queryKey: [TOURNAMENTS_KEY, status ?? "all"],
    queryFn: () => listTournaments(status),
  });
}

export function useTournament(tournamentId: string | undefined) {
  return useQuery({
    queryKey: [TOURNAMENT_KEY, tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () => getTournament(tournamentId as string),
  });
}

export function useTournamentRegistration(tournamentId: string | undefined) {
  const queryClient = useQueryClient();

  const requireId = (): string => {
    if (!tournamentId) {
      throw new Error("Tournament id is required");
    }
    return tournamentId;
  };

  const invalidate = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [TOURNAMENT_KEY, tournamentId] }),
      queryClient.invalidateQueries({ queryKey: [TOURNAMENTS_KEY] }),
    ]);
  };

  const register = useMutation({
    mutationFn: () => registerForTournament(requireId()),
    onSuccess: invalidate,
  });

  const unregister = useMutation({
    mutationFn: () => unregisterFromTournament(requireId()),
    onSuccess: invalidate,
  });

  return { register, unregister };
}
