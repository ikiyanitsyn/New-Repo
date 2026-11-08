/** Folds the fares panel away to a slim tab on the right edge. */
export function CollapseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-ghost btn-icon !h-7 !w-7" onClick={onClick} aria-label="Hide fares panel" title="Hide fares panel (a tab on the right brings it back)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m6 6 6 6-6 6M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}
