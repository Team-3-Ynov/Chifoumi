import type { Move } from "@chifoumi/schemas/game-events";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { FinalScreen } from "../components/FinalScreen.js";
import { GameErrorNotice } from "../components/GameErrorNotice.js";
import { MatchHeader } from "../components/MatchHeader.js";
import { MoveButtons } from "../components/MoveButtons.js";
import { RoundResultBanner } from "../components/RoundResultBanner.js";
import { useGame } from "../game/GameSocketContext.js";
import { useDeadlineCountdown } from "../hooks/useDeadlineCountdown.js";

export function MatchPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const game = useGame();
  const countdown = useDeadlineCountdown(game.round?.deadline);

  if (!user) {
    return null;
  }

  if (!matchId || !game.activeMatch || game.activeMatch.matchId !== matchId) {
    return (
      <main className="game-shell">
        <section className="empty-match">
          <h1>Match introuvable</h1>
          <p>Aucune partie active ne correspond à cette URL.</p>
          <button className="primary-button" onClick={() => navigate("/lobby")} type="button">
            Retour au lobby
          </button>
        </section>
      </main>
    );
  }

  const returnToLobby = () => {
    game.clearMatch();
    navigate("/lobby");
  };

  if (game.matchEnded) {
    return (
      <main className="game-shell">
        <FinalScreen result={game.matchEnded} userId={user.id} onReturn={returnToLobby} />
      </main>
    );
  }

  const canPlay =
    Boolean(game.round) &&
    countdown > 0 &&
    !game.awaitingOpponent &&
    game.connectionState === "connected";
  const play = (move: Move) => {
    if (game.round) {
      game.play(matchId, game.round.roundNumber, move);
    }
  };

  return (
    <main className="game-shell">
      <section className="match-card" aria-labelledby="match-title">
        <MatchHeader opponent={game.activeMatch.opponent} player={user} score={game.score} />

        <div className="round-panel">
          <span className="eyebrow">Round {game.round?.roundNumber ?? 1}</span>
          <h1 id="match-title">Choisissez votre coup</h1>
          <div className={`countdown ${countdown <= 2 ? "countdown-urgent" : ""}`}>
            <strong>{countdown}s</strong>
            <span>avant le forfait</span>
          </div>

          <MoveButtons key={game.round?.roundNumber ?? 0} disabled={!canPlay} onPlay={play} />

          {game.awaitingOpponent ? (
            <output className="waiting-message">En attente de l’adversaire...</output>
          ) : null}

          {game.roundResult ? <RoundResultBanner result={game.roundResult} /> : null}
        </div>

        <button className="text-button" onClick={() => navigate("/lobby")} type="button">
          Quitter l’écran de match
        </button>
      </section>

      {game.error ? <GameErrorNotice error={game.error} onClose={game.clearError} /> : null}
    </main>
  );
}
