import { Link } from "react-router-dom";
import type { BracketMatch, BracketSlot } from "../api/types.js";
import { canCurrentPlayerPlay, isByeMatch } from "../tournaments/bracket.js";

function SlotRow({
  player,
  score,
  isWinner,
}: {
  player: BracketSlot | null;
  score: number | null;
  isWinner: boolean;
}) {
  return (
    <div className={`bracket-slot${isWinner ? " bracket-slot-winner" : ""}`}>
      <span className="bracket-slot-name">{player ? player.displayName : "À déterminer"}</span>
      {score !== null ? <span className="bracket-slot-score">{score}</span> : null}
      {isWinner ? <span className="sr-only"> (vainqueur)</span> : null}
    </div>
  );
}

export function BracketMatchCard({
  match,
  round,
  currentUserId,
}: {
  match: BracketMatch;
  round: number;
  currentUserId?: string;
}) {
  if (isByeMatch(match, round)) {
    const qualified = match.slotA ?? match.slotB;
    return (
      <div className="bracket-match bracket-match-bye">
        <SlotRow player={qualified} score={null} isWinner={true} />
        <p className="bracket-bye muted">Qualifié d’office</p>
      </div>
    );
  }

  const hasScore = match.scoreA !== null && match.scoreB !== null;

  return (
    <div className="bracket-match">
      <SlotRow
        player={match.slotA}
        score={hasScore ? match.scoreA : null}
        isWinner={match.winnerSlot === "a"}
      />
      <SlotRow
        player={match.slotB}
        score={hasScore ? match.scoreB : null}
        isWinner={match.winnerSlot === "b"}
      />
      {canCurrentPlayerPlay(match, currentUserId) ? (
        <Link className="button bracket-cta" to={`/match/${match.matchId}`}>
          Jouer
        </Link>
      ) : null}
    </div>
  );
}
