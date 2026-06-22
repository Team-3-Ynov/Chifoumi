import type { Move } from "@chifoumi/schemas/game-events";

const moves: Array<{ move: Move; label: string }> = [
  { move: "rock", label: "Pierre" },
  { move: "paper", label: "Feuille" },
  { move: "scissors", label: "Ciseaux" },
];

type MoveButtonsProps = {
  disabled: boolean;
  onPlay: (move: Move) => void;
};

export function MoveButtons({ disabled, onPlay }: MoveButtonsProps) {
  return (
    <fieldset className="move-buttons">
      <legend className="visually-hidden">Choisir un coup</legend>
      {moves.map(({ move, label }) => (
        <button
          className={`move-button move-${move}`}
          disabled={disabled}
          key={move}
          onClick={() => onPlay(move)}
          type="button"
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
