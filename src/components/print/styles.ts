import "./itinerary.css";

/**
 * Class names for the itinerary. The project's Turbopack rule sends every
 * `*.css` file through Tailwind as plain CSS, so CSS Modules are not hashed
 * here; itinerary.css uses an `itin-` prefix instead, and `styles.sheet`
 * reads as "itin-sheet".
 */
export const styles: Record<string, string> = new Proxy({}, {
  get: (_target, key) => (typeof key === "string" ? `itin-${key}` : undefined),
});
