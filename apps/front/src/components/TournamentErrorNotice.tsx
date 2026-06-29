import { humanizeTournamentError } from "../tournaments/tournamentFilters.js";

export function TournamentErrorNotice({ error, onClose }: { error: unknown; onClose: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <div>
        <strong>L’inscription a échoué</strong>
        <p>{humanizeTournamentError(error)}</p>
      </div>
      <button aria-label="Fermer le message" onClick={onClose} type="button">
        Fermer
      </button>
    </div>
  );
}
