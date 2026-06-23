import type { MatchEndedPayload } from "@chifoumi/schemas/game-events";

type FinalScreenProps = {
  result: MatchEndedPayload;
  userId: string;
  onReturn: () => void;
};

export function FinalScreen({ result, userId, onReturn }: FinalScreenProps) {
  const outcome = getMatchOutcome(result, userId);
  const delta = getPersonalDelta(result, outcome);
  const title =
    result.reason === "FORFEIT_TIMEOUT" && outcome === "loss"
      ? "Défaite par forfait"
      : outcome === "win"
        ? "Victoire"
        : outcome === "loss"
          ? "Défaite"
          : "Match nul";

  return (
    <section className={`final-screen final-${outcome}`} aria-labelledby="final-title">
      <span className="eyebrow">Match terminé</span>
      <h2 id="final-title">{title}</h2>
      <p className="final-score">
        Score final : {result.finalScore.a} - {result.finalScore.b}
      </p>
      <p className={`elo-delta ${delta >= 0 ? "positive" : "negative"}`}>
        {delta > 0 ? "+" : ""}
        {delta} ELO
      </p>
      <button className="primary-button" onClick={onReturn} type="button">
        Retour au lobby
      </button>
    </section>
  );
}

function getMatchOutcome(result: MatchEndedPayload, userId: string): "win" | "loss" | "draw" {
  if (result.winner === null) {
    return "draw";
  }
  return result.winner === userId ? "win" : "loss";
}

function getPersonalDelta(result: MatchEndedPayload, outcome: "win" | "loss" | "draw"): number {
  if (outcome === "draw") {
    return Math.abs(result.eloDelta.a) <= Math.abs(result.eloDelta.b)
      ? result.eloDelta.a
      : result.eloDelta.b;
  }
  return outcome === "win"
    ? Math.max(result.eloDelta.a, result.eloDelta.b)
    : Math.min(result.eloDelta.a, result.eloDelta.b);
}
