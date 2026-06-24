export type Player = {
  id: string;
  rating: number;
};

export type SeededPlayer = Player & {
  seed: number;
};

export type BracketMatch = {
  player1: SeededPlayer;
  player2: SeededPlayer | null;
};
