export type RatingDeltaTone = "positive" | "negative" | "neutral";

export type RatingDeltaFormat = {
  text: string;
  tone: RatingDeltaTone;
  className: string;
};

export function formatRatingDelta(delta: number): RatingDeltaFormat {
  const text = delta >= 0 ? `+${delta}` : String(delta);
  const tone: RatingDeltaTone = delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral";
  const className =
    tone === "positive"
      ? "delta-positive"
      : tone === "negative"
        ? "delta-negative"
        : "delta-neutral";

  return { text, tone, className };
}
