export type RoundWinner = "a" | "b" | "draw";

type RoundResultBannerProps = {
  winner: RoundWinner;
};

const MESSAGES: Record<RoundWinner, string> = {
  a: "Vous gagnez le round !",
  b: "L'adversaire gagne le round.",
  draw: "Round nul.",
};

export function RoundResultBanner({ winner }: RoundResultBannerProps) {
  return <output className="round-result-banner">{MESSAGES[winner]}</output>;
}
