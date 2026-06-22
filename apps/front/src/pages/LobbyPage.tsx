import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameSession } from "../auth/GameSessionContext.js";
import { GameErrorNotice } from "../components/GameErrorNotice.js";
import { useGame } from "../game/GameSocketContext.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export function LobbyPage() {
  const navigate = useNavigate();
  const session = useGameSession();
  const game = useGame();
  const [profileRating, setProfileRating] = useState<number | null>(session?.user.rating ?? null);
  const elapsed = useQueueElapsed(game.queue.status === "queued" ? game.queue.queuedAt : undefined);

  useEffect(() => {
    if (game.matchFoundVersion > 0 && game.activeMatch) {
      game.acknowledgeMatchFound();
      navigate(`/match/${game.activeMatch.matchId}`);
    }
  }, [game.acknowledgeMatchFound, game.activeMatch, game.matchFoundVersion, navigate]);

  useEffect(() => {
    if (!session?.accessToken || profileRating !== null) {
      return;
    }
    const controller = new AbortController();
    void fetch(`${apiBaseUrl}/me`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const profile = (await response.json()) as { rating?: unknown };
        if (typeof profile.rating === "number") {
          setProfileRating(profile.rating);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [profileRating, session?.accessToken]);

  const rating =
    game.queue.status === "queued" ? game.queue.currentRating : (profileRating ?? undefined);

  return (
    <main className="game-shell">
      <section className="lobby-card" aria-labelledby="lobby-title">
        <div>
          <span className="eyebrow">Lobby classé</span>
          <h1 id="lobby-title">Prêt pour un BO3 ?</h1>
          <p className="supporting-text">
            Le matchmaking cherche un adversaire proche de votre classement.
          </p>
        </div>

        <div className="rating-card">
          <span>Votre rating</span>
          <strong>{rating === undefined ? "Chargement" : `${rating} ELO`}</strong>
        </div>

        {game.activeMatch ? (
          <output className="resume-warning">
            <div>
              <strong>Vous avez un match en cours</strong>
              <p>Reprenez la partie contre {game.activeMatch.opponent.displayName}.</p>
            </div>
            <button
              className="secondary-button"
              onClick={() => navigate(`/match/${game.activeMatch?.matchId}`)}
              type="button"
            >
              Reprendre
            </button>
          </output>
        ) : null}

        {game.queue.status === "queued" ? (
          <output className="queue-status">
            <span className="search-pulse" aria-hidden="true" />
            <div>
              <strong>Recherche depuis {formatDuration(elapsed)}...</strong>
              <p>Élargissement progressif de la fenêtre ELO.</p>
            </div>
          </output>
        ) : null}

        <div className="lobby-actions">
          {game.queue.status === "queued" ? (
            <button className="secondary-button" onClick={game.leaveQueue} type="button">
              Annuler la recherche
            </button>
          ) : (
            <button
              className="primary-button"
              disabled={game.connectionState !== "connected" || Boolean(game.activeMatch)}
              onClick={game.joinQueue}
              type="button"
            >
              Trouver un match
            </button>
          )}
          <span className={`connection-state connection-${game.connectionState}`}>
            Temps réel : {connectionLabel(game.connectionState)}
          </span>
        </div>
      </section>

      {game.error ? <GameErrorNotice error={game.error} onClose={game.clearError} /> : null}
    </main>
  );
}

function useQueueElapsed(queuedAt?: string): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!queuedAt) {
      setElapsed(0);
      return;
    }
    const update = () => setElapsed(Math.max(0, Date.now() - Date.parse(queuedAt)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [queuedAt]);
  return elapsed;
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function connectionLabel(state: "connected" | "connecting" | "disconnected"): string {
  if (state === "connected") {
    return "connecté";
  }
  return state === "connecting" ? "connexion" : "déconnecté";
}
