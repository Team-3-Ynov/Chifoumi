import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/apiClient.js";
import type { SeasonStandingEntry } from "../api/types.js";
import { AsyncPanel, TableSkeleton } from "../components/AsyncState.js";
import { LeagueBadge } from "../components/LeagueBadge.js";
import { SEASON_STANDINGS_LIMIT, useSeasonStandings } from "../hooks/useSeasonStandings.js";
import { LEAGUE_FILTERS, type LeagueFilter } from "../leagues/leagueFilters.js";

function SeasonStandingsTable({ items }: { items: SeasonStandingEntry[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Rang</th>
            <th scope="col">Joueur</th>
            <th scope="col">Rating final</th>
            <th scope="col">Ligue finale</th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr key={entry.userId}>
              <td>{entry.rank}</td>
              <td>
                <Link to={`/profile/${entry.userId}`} className="table-link">
                  {entry.displayName}
                </Link>
              </td>
              <td>{entry.finalRating}</td>
              <td>
                <LeagueBadge name={entry.finalLeague.name} tier={entry.finalLeague.tier} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SeasonStandingsPage() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const [league, setLeague] = useState<LeagueFilter | undefined>();
  const { data, isLoading, isError, error, refetch, isFetching } = useSeasonStandings(
    id,
    page,
    league,
  );

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / SEASON_STANDINGS_LIMIT));
  const canPrev = page > 1;
  const canNext = page < pageCount;

  function handleLeagueChange(value: string) {
    setLeague((value || undefined) as LeagueFilter | undefined);
    setPage(1);
  }

  return (
    <div className="page">
      <section className="panel panel-wide" aria-labelledby="season-standings-title">
        <div className="page-heading">
          <h1 id="season-standings-title" className="title">
            Palmarès de saison
          </h1>
          <p className="subtitle">
            {data ? `Classement final de ${data.season.name}.` : "Classement final archivé."}
          </p>
          {isFetching && !isLoading ? <span className="badge">Mise à jour…</span> : null}
        </div>

        <label className="field leaderboard-filter">
          <span>Ligue finale</span>
          <select value={league ?? ""} onChange={(event) => handleLeagueChange(event.target.value)}>
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
          errorMessage={
            error instanceof ApiError && error.status === 404
              ? "Saison introuvable."
              : error instanceof ApiError && error.status === 409
                ? "Cette saison n'est pas encore clôturée."
                : error instanceof Error
                  ? error.message
                  : undefined
          }
          onRetry={() => void refetch()}
          isEmpty={!isLoading && !isError && (data?.items.length ?? 0) === 0}
          emptyMessage={
            league
              ? "Aucun palmarès archivé dans cette ligue pour cette saison."
              : "Aucun palmarès archivé pour cette saison."
          }
          skeleton={<TableSkeleton rows={10} />}
        >
          {data ? (
            <>
              <SeasonStandingsTable items={data.items} />

              <div className="pagination">
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={!canPrev}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Précédent
                </button>
                <span className="muted">
                  Page {page} / {pageCount}
                </span>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={!canNext}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Suivant
                </button>
              </div>
            </>
          ) : null}
        </AsyncPanel>
      </section>
    </div>
  );
}
