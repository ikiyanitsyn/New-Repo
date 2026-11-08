/**
 * Carry-on and checked-bag icons with a count. A bag that is not included shows
 * a circle-and-slash; a bag the provider did not mention shows a faint "?".
 */
type Kind = "carryOn" | "checked";

const ICON: Record<Kind, React.ReactNode> = {
  carryOn: (
    <>
      <rect x="4.5" y="8.5" width="13" height="11" rx="2.5" />
      <path d="M8.5 8.5V6.8c0-.9.7-1.6 1.6-1.6h1.8c.9 0 1.6.7 1.6 1.6v1.7" />
    </>
  ),
  checked: (
    <>
      <rect x="5.5" y="6.5" width="11" height="12" rx="2" />
      <path d="M9 6.5V4.5h4v2M9 18.5v1.3M13 18.5v1.3M9.2 10v5.5M12.8 10v5.5" />
    </>
  ),
};

const LABEL: Record<Kind, string> = { carryOn: "Carry-on bag", checked: "Checked bag" };

export function BagBadge({ kind, count }: { kind: Kind; count: number | undefined }) {
  const unknown = count === undefined;
  const none = count === 0;
  const text = unknown ? `${LABEL[kind]}: not stated` : none ? `${LABEL[kind]}: not included` : `${LABEL[kind]}: ${count} included`;
  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={text}
      role="img"
      aria-label={text}
      data-bag={kind}
      data-state={unknown ? "unknown" : none ? "none" : "included"}
      style={{ color: unknown || none ? "var(--ink-3)" : "var(--ink)", opacity: unknown ? 0.7 : 1 }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ICON[kind]}
        {none && (
          <>
            <circle cx="17.5" cy="17.5" r="5" fill="var(--surface-solid)" stroke="var(--bad)" strokeWidth="1.6" />
            <path d="M14 21l7-7" stroke="var(--bad)" strokeWidth="1.6" />
          </>
        )}
      </svg>
      {!none && <span className="data text-[11.5px]">{unknown ? "?" : count}</span>}
    </span>
  );
}
