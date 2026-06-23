import type { MeHistoryItem } from "../api/types.js";
import { AsyncPanel, HistorySkeleton } from "./AsyncState.js";

type MatchHistoryListProps = {
  items: MeHistoryItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatEloDelta(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

export function MatchHistoryList({
  items,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: MatchHistoryListProps) {
  return (
    <section className="history-section" aria-labelledby="history-title">
      <h2 id="history-title" className="section-title">
        Historique
      </h2>

      <AsyncPanel
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        onRetry={onRetry}
        isEmpty={!isLoading && !isError && items.length === 0}
        emptyMessage="Aucun match joué encore."
        skeleton={<HistorySkeleton />}
      >
        <ul className="history-list">
          {items.map((item) => (
            <li key={item.matchId} className="history-item">
              <div className="history-item-main">
                <span className="history-opponent">vs {item.opponent.displayName}</span>
                <span className="history-score">
                  {item.scoreA} - {item.scoreB}
                </span>
              </div>
              <div className="history-item-meta">
                <span className={item.isWinner ? "result-win" : "result-loss"}>
                  {item.isWinner ? "Victoire" : "Défaite"}
                </span>
                <span className={item.eloDelta >= 0 ? "delta-positive" : "delta-negative"}>
                  {formatEloDelta(item.eloDelta)} ELO
                </span>
                <span className="history-date">{formatDate(item.endedAt)}</span>
              </div>
            </li>
          ))}
        </ul>

        {hasNextPage ? (
          <button
            type="button"
            className="button button-secondary load-more"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage ? "Chargement…" : "Charger plus"}
          </button>
        ) : null}
      </AsyncPanel>
    </section>
  );
}
