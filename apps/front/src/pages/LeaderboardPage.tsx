import { useState } from "react";
import { Link } from "react-router-dom";
import { AsyncPanel, TableSkeleton } from "../components/AsyncState.js";
import { LeaderboardTable } from "../components/LeaderboardTable.js";
import { useClosedSeasons } from "../hooks/useClosedSeasons.js";
import { type LeaderboardLeagueFilter, useLeaderboard } from "../hooks/useLeaderboard.js";
import { LEAGUE_FILTERS } from "../leagues/leagueFilters.js";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function LeaderboardPage() {
  const [league, setLeague] = useState<LeaderboardLeagueFilter | undefined>();
  const { data, isLoading, isError, error, refetch, isFetching } = useLeaderboard(league);
  const closedSeasonsQuery = useClosedSeasons();

  return (
    <div className="page">
      <section className="panel panel-wide" aria-labelledby="leaderboard-title">
        <div className="page-heading">
          <h1 id="leaderboard-title" className="title">
            Leaderboard
          </h1>
          <p className="subtitle">
            Top 50 joueurs par rating. Actualisation automatique toutes les 30s.
          </p>
          {isFetching && !isLoading ? <span className="badge">Mise à jour…</span> : null}
        </div>

        <label className="field leaderboard-filter">
          <span>Ligue</span>
          <select
            value={league ?? ""}
            onChange={(event) =>
              setLeague((event.target.value || undefined) as LeaderboardLeagueFilter | undefined)
            }
          >
            {LEAGUE_FILTERS.map((filter) => (
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
            league
              ? "Aucun joueur classé dans cette ligue pour le moment."
              : "Aucun joueur classé pour le moment."
          }
          skeleton={<TableSkeleton rows={10} />}
        >
          {data ? <LeaderboardTable items={data.items} /> : null}
        </AsyncPanel>

        {closedSeasonsQuery.data?.items.length ? (
          <section className="season-archive" aria-labelledby="season-archive-title">
            <h2 id="season-archive-title" className="section-title">
              Palmarès archivés
            </h2>
            <ul className="archive-list">
              {closedSeasonsQuery.data.items.map((season) => (
                <li key={season.id}>
                  <Link to={`/seasons/${season.id}/standings`} className="table-link">
                    {season.name}
                  </Link>
                  <span className="muted">
                    {season.endsAt ? `Terminée le ${formatDate(season.endsAt)}` : "Terminée"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>
    </div>
  );
}
