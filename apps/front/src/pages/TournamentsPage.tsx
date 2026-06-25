import { useState } from "react";
import type { TournamentStatus } from "../api/types.js";
import { AsyncPanel, TableSkeleton } from "../components/AsyncState.js";
import { TournamentList } from "../components/TournamentList.js";
import { useTournaments } from "../hooks/useTournaments.js";
import { TOURNAMENT_STATUS_FILTERS } from "../tournaments/tournamentFilters.js";

export function TournamentsPage() {
  const [status, setStatus] = useState<TournamentStatus | undefined>();
  const { data, isLoading, isError, error, refetch, isFetching } = useTournaments(status);

  return (
    <div className="page">
      <section className="panel panel-wide" aria-labelledby="tournaments-title">
        <div className="page-heading">
          <h1 id="tournaments-title" className="title">
            Tournois
          </h1>
          <p className="subtitle">Parcourez les tournois et inscrivez-vous aux compétitions.</p>
          {isFetching && !isLoading ? <span className="badge">Mise à jour…</span> : null}
        </div>

        <label className="field">
          <span>Statut</span>
          <select
            value={status ?? ""}
            onChange={(event) =>
              setStatus((event.target.value || undefined) as TournamentStatus | undefined)
            }
          >
            {TOURNAMENT_STATUS_FILTERS.map((filter) => (
              <option key={filter.value || "all"} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>

        <AsyncPanel
          isLoading={isLoading}
          isError={isError}
          errorMessage={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
          isEmpty={!isLoading && !isError && (data?.items.length ?? 0) === 0}
          emptyMessage={
            status
              ? "Aucun tournoi avec ce statut pour le moment."
              : "Aucun tournoi pour le moment."
          }
          skeleton={<TableSkeleton rows={8} />}
        >
          {data ? <TournamentList items={data.items} /> : null}
        </AsyncPanel>
      </section>
    </div>
  );
}
