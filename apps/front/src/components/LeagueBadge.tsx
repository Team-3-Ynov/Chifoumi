type LeagueBadgeProps = {
  name: string;
  tier: number;
};

const TIER_LABELS: Record<number, string> = {
  1: "palier Bronze",
  2: "palier Silver",
  3: "palier Gold",
  4: "palier Platinum",
};

export function LeagueBadge({ name, tier }: LeagueBadgeProps) {
  const tierLabel = TIER_LABELS[tier] ?? `palier ${tier}`;
  const visualTier = tier >= 1 && tier <= 4 ? String(tier) : "default";

  return (
    <span
      className={`league-badge league-badge-tier-${visualTier}`}
      data-tier={tier}
      role="img"
      aria-label={`Ligue ${name}, ${tierLabel}`}
    >
      <span className="league-badge-mark" aria-hidden="true" />
      <span aria-hidden="true">{name}</span>
    </span>
  );
}
