import type { ReactNode } from "react";

type AsyncPanelProps = {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyMessage?: string;
  skeleton: ReactNode;
  children: ReactNode;
};

export function AsyncPanel({
  isLoading,
  isError,
  errorMessage,
  onRetry,
  isEmpty = false,
  emptyMessage = "Aucune donnée disponible.",
  skeleton,
  children,
}: AsyncPanelProps) {
  if (isLoading) {
    return <>{skeleton}</>;
  }

  if (isError) {
    return (
      <div className="state state-error" role="alert">
        <p>{errorMessage ?? "Une erreur est survenue."}</p>
        {onRetry ? (
          <button type="button" className="button" onClick={onRetry}>
            Réessayer
          </button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return <div className="state state-empty">{emptyMessage}</div>;
  }

  return <>{children}</>;
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  const placeholders = Array.from({ length: rows }, (_, index) => `row-${index}`);

  return (
    <div className="skeleton-table" aria-hidden="true">
      {placeholders.map((key) => (
        <div key={key} className="skeleton-row" />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="skeleton-profile" aria-hidden="true">
      <div className="skeleton-line skeleton-line-lg" />
      <div className="skeleton-line" />
      <div className="skeleton-line" />
      <div className="skeleton-line" />
    </div>
  );
}

export function HistorySkeleton({ rows = 4 }: { rows?: number }) {
  const placeholders = Array.from({ length: rows }, (_, index) => `history-${index}`);

  return (
    <div className="skeleton-list" aria-hidden="true">
      {placeholders.map((key) => (
        <div key={key} className="skeleton-card" />
      ))}
    </div>
  );
}
