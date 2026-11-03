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
