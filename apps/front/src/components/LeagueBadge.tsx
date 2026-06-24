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

  return (
    <span className={`league-badge league-badge-tier-${tier}`} data-tier={tier}>
      <span className="league-badge-mark" aria-hidden="true" />
      <span>{name}</span>
      <span className="sr-only">, {tierLabel}</span>
    </span>
  );
}
