import type { BracketRound } from "../api/types.js";
import { roundLabel } from "../tournaments/bracket.js";
import { BracketMatchCard } from "./BracketMatchCard.js";

type BracketViewProps = {
  bracket: BracketRound[];
  currentUserId?: string;
};

export function BracketView({ bracket, currentUserId }: BracketViewProps) {
  const totalRounds = bracket.length;

  return (
    <div className="bracket-view">
      <div className="bracket-rounds">
        {bracket.map((round) => (
          <section
            className="bracket-round"
            key={round.round}
            aria-label={roundLabel(round.round, totalRounds)}
          >
            <h3 className="bracket-round-title">{roundLabel(round.round, totalRounds)}</h3>
            <div className="bracket-round-matches">
              {round.matches.map((match) => (
                <BracketMatchCard
                  key={match.id}
                  match={match}
                  round={round.round}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
