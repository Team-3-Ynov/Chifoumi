import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AsyncPanel, TableSkeleton } from "../../components/AsyncState.js";
import { ADMIN_USERS_PAGE_SIZE, useAdminUsers } from "../../hooks/useAdminUsers.js";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function AdminUsersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [matchId, setMatchId] = useState("");
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminUsers(page);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < pageCount;

  function handleAuditLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = matchId.trim();
    if (trimmed) {
      navigate(`/admin/matches/${trimmed}`);
    }
  }

  return (
    <div className="page">
      <section className="panel panel-wide" aria-labelledby="admin-users-title">
        <div className="page-heading">
          <h1 id="admin-users-title" className="title">
            Administration — Utilisateurs
          </h1>
          <p className="subtitle">
            Liste de tous les comptes de la plateforme. {total} utilisateur{total > 1 ? "s" : ""}.
          </p>
          {isFetching && !isLoading ? <span className="badge">Mise à jour…</span> : null}
        </div>

        <form className="form-inline" onSubmit={handleAuditLookup}>
          <label className="field">
            <span>Consulter l'audit commit-reveal d'un match (UUID)</span>
            <input
              type="text"
              value={matchId}
              onChange={(event) => setMatchId(event.target.value)}
              placeholder="550e8400-e29b-41d4-a716-446655440000"
            />
          </label>
          <button type="submit" className="button">
            Voir l'audit
          </button>
        </form>

        <AsyncPanel
          isLoading={isLoading}
          isError={isError}
          errorMessage={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
          isEmpty={!isLoading && !isError && (data?.items.length ?? 0) === 0}
          emptyMessage="Aucun utilisateur."
          skeleton={<TableSkeleton rows={10} />}
        >
          {data ? (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Joueur</th>
                      <th scope="col">Email</th>
                      <th scope="col">ELO</th>
                      <th scope="col">Rôle</th>
                      <th scope="col">Inscription</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((user) => (
                      <tr key={user.id}>
                        <td>{user.displayName}</td>
                        <td>{user.email}</td>
                        <td>{user.rating}</td>
                        <td>
                          <span className={`badge badge-${user.role}`}>{user.role}</span>
                        </td>
                        <td>{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
