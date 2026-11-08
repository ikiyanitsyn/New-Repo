const fmt = new Intl.NumberFormat("en-US");

/** A small "★ 4.6" next to a place, when its rating is known. */
export function RatingBadge({ rating }: { rating?: { rating: number; count?: number } }) {
  if (!rating) return null;
  const label = `${rating.rating.toFixed(1)} stars${rating.count !== undefined ? ` from ${fmt.format(rating.count)} Google reviews` : " on Google"}`;
  return (
    <span className="data ml-2 whitespace-nowrap text-[12px] text-ink-2" title={label}>
      <span aria-hidden="true" className="text-accent">★</span> {rating.rating.toFixed(1)}
      <span className="sr-only"> {label}</span>
    </span>
  );
}
