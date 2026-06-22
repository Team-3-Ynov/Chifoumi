import type { Move, RoundResolvedPayload } from "@chifoumi/schemas/game-events";

const moveLabels: Record<Move, string> = {
  rock: "Pierre",
  paper: "Feuille",
  scissors: "Ciseaux",
};

export function RoundResultBanner({ result }: { result: RoundResolvedPayload }) {
  const outcome = resolvePersonalOutcome(result.yourMove, result.theirMove);
  const message =
    outcome === "win"
      ? "Vous gagnez le round !"
      : outcome === "loss"
        ? "Vous perdez le round."
        : "Égalité sur ce round.";

  return (
    <output className={`round-result round-result-${outcome}`}>
      <span>
        Vous : {moveLabels[result.yourMove]} - Adversaire : {moveLabels[result.theirMove]}
      </span>
      <strong>{message}</strong>
    </output>
  );
}

function resolvePersonalOutcome(yourMove: Move, theirMove: Move): "win" | "loss" | "draw" {
  if (yourMove === theirMove) {
    return "draw";
  }
  if (
    (yourMove === "rock" && theirMove === "scissors") ||
    (yourMove === "paper" && theirMove === "rock") ||
    (yourMove === "scissors" && theirMove === "paper")
  ) {
    return "win";
  }
  return "loss";
}
