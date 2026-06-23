import { AsyncPanel, TableSkeleton } from "../components/AsyncState.js";
import { LeaderboardTable } from "../components/LeaderboardTable.js";
import { useLeaderboard } from "../hooks/useLeaderboard.js";

export function LeaderboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useLeaderboard();

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

        <AsyncPanel
          isLoading={isLoading}
          isError={isError}
          errorMessage={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
          isEmpty={!isLoading && !isError && (data?.items.length ?? 0) === 0}
          emptyMessage="Aucun joueur classé pour le moment."
          skeleton={<TableSkeleton rows={10} />}
        >
          {data ? <LeaderboardTable items={data.items} /> : null}
        </AsyncPanel>
      </section>
    </div>
  );
}
