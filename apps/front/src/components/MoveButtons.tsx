import { useState } from "react";

export type GameMove = "ROCK" | "PAPER" | "SCISSORS";

const MOVES: Array<{ move: GameMove; label: string }> = [
  { move: "ROCK", label: "Pierre" },
  { move: "PAPER", label: "Feuille" },
  { move: "SCISSORS", label: "Ciseaux" },
];

type MoveButtonsProps = {
  disabled?: boolean;
  onPlay: (move: GameMove) => void;
};

export function MoveButtons({ disabled = false, onPlay }: MoveButtonsProps) {
  const [hasPlayed, setHasPlayed] = useState(false);
  const isDisabled = disabled || hasPlayed;

  return (
    <fieldset className="move-buttons">
      <legend className="sr-only">Choix du coup</legend>
      {MOVES.map(({ move, label }) => (
        <button
          key={move}
          type="button"
          className="button move-button"
          disabled={isDisabled}
          onClick={() => {
            setHasPlayed(true);
            onPlay(move);
          }}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
