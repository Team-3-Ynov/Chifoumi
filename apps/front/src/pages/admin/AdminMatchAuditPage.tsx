import { Link, useParams } from "react-router-dom";
import type { AuditRound } from "../../api/types.js";
import { AsyncPanel, TableSkeleton } from "../../components/AsyncState.js";
import { useMatchAudit } from "../../hooks/useMatchAudit.js";

function HashBadge({ status }: { status: "match" | "mismatch" }) {
  return (
    <span className={`badge badge-${status === "match" ? "ok" : "error"}`}>
      {status === "match" ? "✓ hash vérifié" : "✗ hash invalide"}
    </span>
  );
}

function RoundCard({ round }: { round: AuditRound }) {
  return (
    <div className="audit-round">
      <h3 className="audit-round-title">Round {round.roundNumber}</h3>
      <div className="audit-grid">
        <div className="audit-player">
          <h4>Joueur A</h4>
          <dl>
            <dt>Move</dt>
            <dd>{round.moveA ?? "—"}</dd>
            <dt>Commit</dt>
            <dd className="mono">{round.commitA ?? "—"}</dd>
            <dt>Nonce</dt>
            <dd className="mono">{round.nonceA ?? "—"}</dd>
            <dt>Hash recalculé</dt>
            <dd>
              <HashBadge status={round.hashCheck.a} />
            </dd>
          </dl>
        </div>
        <div className="audit-player">
          <h4>Joueur B</h4>
          <dl>
            <dt>Move</dt>
            <dd>{round.moveB ?? "—"}</dd>
            <dt>Commit</dt>
            <dd className="mono">{round.commitB ?? "—"}</dd>
            <dt>Nonce</dt>
            <dd className="mono">{round.nonceB ?? "—"}</dd>
            <dt>Hash recalculé</dt>
            <dd>
              <HashBadge status={round.hashCheck.b} />
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

export function AdminMatchAuditPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useMatchAudit(id);

  const playerA = data?.players[0];
  const playerB = data?.players[1];
  const winnerName =
    data?.winner === null
      ? "Match nul"
      : (data?.players.find((player) => player.id === data?.winner)?.displayName ?? data?.winner);

  return (
    <div className="page">
      <section className="panel panel-wide" aria-labelledby="admin-audit-title">
        <div className="page-heading">
          <h1 id="admin-audit-title" className="title">
            Audit commit-reveal
          </h1>
          <p className="subtitle">
            <Link to="/admin/users">← Retour aux utilisateurs</Link>
          </p>
        </div>

        <AsyncPanel
          isLoading={isLoading}
          isError={isError}
          errorMessage={
            error instanceof Error
              ? error.message
              : "Audit indisponible (match introuvable ou encore en cours)."
          }
          onRetry={() => void refetch()}
          skeleton={<TableSkeleton rows={6} />}
        >
          {data ? (
            <>
              <dl className="audit-summary">
                <dt>Match</dt>
                <dd className="mono">{data.matchId}</dd>
                <dt>Joueurs</dt>
                <dd>
                  {playerA?.displayName ?? "?"} (A) vs {playerB?.displayName ?? "?"} (B)
                </dd>
                <dt>Score final</dt>
                <dd>
                  {data.finalScore[0]} – {data.finalScore[1]}
                </dd>
                <dt>Vainqueur</dt>
                <dd>{winnerName}</dd>
                <dt>Terminé le</dt>
                <dd>{new Date(data.endedAt).toLocaleString("fr-FR")}</dd>
              </dl>

              <div className="audit-rounds">
                {data.rounds.map((round) => (
                  <RoundCard key={round.roundNumber} round={round} />
                ))}
              </div>
            </>
          ) : null}
        </AsyncPanel>
      </section>
    </div>
  );
}
