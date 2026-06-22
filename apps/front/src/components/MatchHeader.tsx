type PlayerSummary = {
  displayName: string;
  rating?: number;
};

type MatchHeaderProps = {
  player: PlayerSummary;
  opponent: PlayerSummary;
  score: { a: number; b: number };
};

export function MatchHeader({ player, opponent, score }: MatchHeaderProps) {
  return (
    <header className="match-header">
      <PlayerCard label="Vous" player={player} />
      <output className="score" aria-label={`Score ${score.a} à ${score.b}`}>
        <strong>
          {score.a} - {score.b}
        </strong>
        <span>BO3</span>
      </output>
      <PlayerCard label="Adversaire" player={opponent} />
    </header>
  );
}

function PlayerCard({ label, player }: { label: string; player: PlayerSummary }) {
  return (
    <div className="player-card">
      <span className="eyebrow">{label}</span>
      <strong>{player.displayName}</strong>
      <span>{player.rating ? `${player.rating} ELO` : "ELO indisponible"}</span>
    </div>
  );
}
