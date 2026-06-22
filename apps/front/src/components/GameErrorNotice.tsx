import type { GameSocketError } from "@chifoumi/schemas/game-events";

export function GameErrorNotice({
  error,
  onClose,
}: {
  error: GameSocketError;
  onClose: () => void;
}) {
  return (
    <div className="error-notice" role="alert">
      <div>
        <strong>Le jeu a rencontré un problème</strong>
        <p>{humanizeError(error)}</p>
      </div>
      <button aria-label="Fermer le message" onClick={onClose} type="button">
        Fermer
      </button>
    </div>
  );
}

function humanizeError(error: GameSocketError): string {
  const messages: Record<string, string> = {
    ALREADY_IN_QUEUE: "Vous êtes déjà dans la file d’attente.",
    ALREADY_IN_MATCH: "Vous avez déjà un match en cours.",
    RATE_LIMITED: "Patientez un instant avant de relancer une recherche.",
    AUTH_UNAVAILABLE: "Le service d’authentification est temporairement indisponible.",
    INVALID_TOKEN: "Votre session a expiré. Reconnectez-vous.",
    SOCKET_DISCONNECTED: "La connexion temps réel est interrompue.",
  };
  return messages[String(error.code)] ?? error.message;
}
