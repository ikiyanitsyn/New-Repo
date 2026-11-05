import styles from "./PlaneLoader.module.css";

/**
 * The project's Turbopack rule for "*.css" currently loads CSS modules as global CSS, so the
 * module exports no class map. Fall back to the (unique, prefixed) source class names; when
 * modules are processed normally the hashed names are used instead.
 */
const cx = (name: string): string => (styles as Record<string, string | undefined>)[name] ?? name;

/**
 * A calm loading animation: a small plane crossing a dotted arc from origin to destination.
 * Theme-aware through the colour tokens; holds still mid-flight when reduced motion is preferred.
 */
export function PlaneLoader({ className = "", label = "Working on it" }: { className?: string; label?: string }) {
  return (
    <div className={`${cx("planeLoader")} ${className}`} role="img" aria-label={label}>
      <svg className={cx("planeLoaderArc")} viewBox="0 0 168 64" width="168" height="64" aria-hidden="true">
        <path className={cx("planeLoaderTrack")} d="M 12 54 Q 84 -10 156 54" />
        <circle className={cx("planeLoaderOrigin")} cx="12" cy="54" r="3" />
        <circle className={cx("planeLoaderDestination")} cx="156" cy="54" r="3.5" />
      </svg>
      <span className={cx("planeLoaderPlane")} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M22 12c0 .8-1 1-2 1h-6l-4 8H8l2.5-8H6l-1.5 2.5H3l.8-3.5L3 8.5h1.5L6 11h4.5L8 3h2l4 8h6c1 0 2 .2 2 1z" />
        </svg>
      </span>
    </div>
  );
}
