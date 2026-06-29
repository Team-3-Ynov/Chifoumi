export type League = {
  minRating: number;
  maxRating: number | null;
};

export type ReferenceLeague = League & {
  name: string;
  tier: number;
};

export type LeagueSummary = {
  name: string;
  tier: number;
};
