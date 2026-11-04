import type { Mode } from "@/lib/ground";

type P = { size?: number; className?: string };
const base = (size = 16) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const PlaneIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M10.5 13.5 3 11l1.2-1.6 7.3.9 4.6-5.1c.9-1 2.4-1.3 3.1-.6.7.7.4 2.2-.6 3.1l-5.1 4.6.9 7.3L13 20.9l-2.5-7.4Z" /></svg>
);
export const TrainIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="6" y="3" width="12" height="13" rx="3" /><path d="M6 10h12M9 16l-2 4M15 16l2 4M9.5 13h.01M14.5 13h.01" /></svg>
);
export const BusIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4" y="4" width="16" height="13" rx="2.5" /><path d="M4 11h16M8 17v2.5M16 17v2.5M8 14h.01M16 14h.01" /></svg>
);
export const CarIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 16V12l2-5h10l2 5v4" /><path d="M3.5 16h17v2.5h-17zM7.5 16v0M8 12h8" /><circle cx="7.5" cy="18.5" r="1.2" /><circle cx="16.5" cy="18.5" r="1.2" /></svg>
);
export const FerryIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 14h16l-2.5 4h-11L4 14ZM7 14V9h10v5M10 9V6h4v3" /><path d="M3 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" /></svg>
);

export const MODE_ICON: Record<Mode, (p: P) => React.ReactElement> = {
  flight: PlaneIcon,
  train: TrainIcon,
  bus: BusIcon,
  car: CarIcon,
  ferry: FerryIcon,
};

export const MODE_LABEL: Record<Mode, string> = { flight: "Flight", train: "Train", bus: "Bus", car: "Car", ferry: "Ferry" };

export const PlusIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const MinusIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 12h14" /></svg>
);
export const CloseIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const UpIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="m6 15 6-6 6 6" /></svg>
);
export const DownIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="m6 9 6 6 6-6" /></svg>
);
export const ArrowIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const ExternalIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const SunIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const MoonIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></svg>
);
export const MonitorIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
);
export const BoltIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" /></svg>
);

export const BedIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="1.6" /></svg>
);
export const ColumnsIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 9 12 4l9 5M4 9h16M6 9v9M10 9v9M14 9v9M18 9v9M3 20h18" /></svg>
);
export const CompassIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></svg>
);
export const ForkIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1.5-3 4-3 7v3h3" /></svg>
);
export const GlassIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 3h12l-1 7a5 5 0 0 1-10 0L6 3ZM12 15v6M8 21h8M6.5 7h11" /></svg>
);
export const BagIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 8h14l-1 12H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2" /></svg>
);
export const HeartIcon = ({ size, className, filled }: P & { filled?: boolean }) => (
  <svg {...base(size)} className={className} fill={filled ? "currentColor" : "none"}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>
);
export const MapIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14" /></svg>
);
export const ListIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
);
export const SparkIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
);
