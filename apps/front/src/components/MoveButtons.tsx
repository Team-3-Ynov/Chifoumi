import type { Move } from "@chifoumi/schemas/game-events";
import { useState } from "react";

const moves: Array<{ move: Move; label: string }> = [
  { move: "rock", label: "Pierre" },
  { move: "paper", label: "Feuille" },
  { move: "scissors", label: "Ciseaux" },
];

type MoveButtonsProps = {
  disabled?: boolean;
  onPlay: (move: Move) => void;
};

export function MoveButtons({ disabled = false, onPlay }: MoveButtonsProps) {
  const [hasPlayed, setHasPlayed] = useState(false);
  const isDisabled = disabled || hasPlayed;

  return (
    <fieldset className="move-buttons">
      <legend className="visually-hidden">Choisir un coup</legend>
      {moves.map(({ move, label }) => (
        <button
          className={`move-button move-${move}`}
          disabled={isDisabled}
          key={move}
          onClick={() => {
            setHasPlayed(true);
            onPlay(move);
          }}
          type="button"
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
