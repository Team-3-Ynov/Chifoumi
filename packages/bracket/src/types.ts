export type PlayerId = string & { readonly _brand: "PlayerId" };

export type Player = {
  id: PlayerId;
  rating: number;
};

export type SeededPlayer = Player & {
  seed: number;
};

export type BracketMatch = {
  player1: SeededPlayer;
  player2: SeededPlayer | null;
};
