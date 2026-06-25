import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { AsyncPanel, ProfileSkeleton } from "../components/AsyncState.js";
import { TournamentErrorNotice } from "../components/TournamentErrorNotice.js";
import { useTournament, useTournamentRegistration } from "../hooks/useTournaments.js";
import {
  formatTournamentFormat,
  formatTournamentStatus,
  isRegistrationOpen,
  isTournamentFull,
} from "../tournaments/tournamentFilters.js";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useTournament(id);
  const { register, unregister } = useTournamentRegistration(id);

  const isRegistered = data?.registrations.some((r) => r.userId === user?.id) ?? false;

  const mutationError = register.error ?? unregister.error;
  const resetErrors = () => {
    register.reset();
    unregister.reset();
  };

  return (
    <div className="page">
      <section className="panel" aria-labelledby="tournament-detail-title">
        <div className="page-heading">
          <Link to="/tournaments" className="table-link">
            ← Retour aux tournois
          </Link>
        </div>

        <AsyncPanel
          isLoading={isLoading}
          isError={isError}
          errorMessage={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
          skeleton={<ProfileSkeleton />}
        >
          {data ? (
            <>
              <h1 id="tournament-detail-title" className="title">
                {data.name}
              </h1>

              <dl className="detail-list">
                <dt>Format</dt>
                <dd>{formatTournamentFormat(data.format)}</dd>
                <dt>Statut</dt>
                <dd>{formatTournamentStatus(data.status)}</dd>
                <dt>Inscrits</dt>
                <dd>
                  {data.registrationsCount} / {data.bracketSize}
                </dd>
                <dt>Ouverture des inscriptions</dt>
                <dd>{formatDateTime(data.registrationOpensAt)}</dd>
                <dt>Début</dt>
                <dd>{formatDateTime(data.startsAt)}</dd>
              </dl>

              <p className="muted">
                {isRegistered
                  ? "Vous êtes inscrit à ce tournoi."
                  : "Vous n’êtes pas inscrit à ce tournoi."}
              </p>

              {mutationError ? (
                <TournamentErrorNotice error={mutationError} onClose={resetErrors} />
              ) : null}

              {isRegistrationOpen(data.status) ? (
                isRegistered ? (
                  <button
                    type="button"
                    className="button"
                    disabled={unregister.isPending}
                    onClick={() => unregister.mutate()}
                  >
                    {unregister.isPending ? "Désinscription…" : "Se désinscrire"}
                  </button>
                ) : (
                  <>
                    {isTournamentFull(data) ? (
                      <p className="muted">
                        Ce tournoi est complet, aucune place n’est disponible.
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="button"
                      disabled={register.isPending || isTournamentFull(data)}
                      onClick={() => register.mutate()}
                    >
                      {register.isPending ? "Inscription…" : "S’inscrire"}
                    </button>
                  </>
                )
              ) : null}

              <section aria-labelledby="tournament-participants-title">
                <h2 id="tournament-participants-title" className="subtitle">
                  Participants ({data.registrations.length})
                </h2>
                {data.registrations.length > 0 ? (
                  <ol className="participant-list">
                    {data.registrations.map((registration) => (
                      <li key={registration.userId}>
                        {registration.seed != null ? `#${registration.seed} ` : ""}
                        {registration.displayName}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">Aucun joueur inscrit pour le moment.</p>
                )}
              </section>
            </>
          ) : null}
        </AsyncPanel>
      </section>
    </div>
  );
}
