import { cn } from "@/lib/utils";

/**
 * ProgFrog mark — a frog-headed lifter pressing a dumbbell overhead. Body uses
 * the brand green (`--brand`); eyes white, pupils `--brand-ink`. Scales from 16px.
 */
export function FrogMark({ className }: { className?: string }) {
  const brand = "var(--brand, #16a34a)";
  const ink = "var(--brand-ink, #0b3b2e)";
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="ProgFrog"
      className={cn("size-6", className)}
    >
      {/* dumbbell overhead */}
      <g fill={brand}>
        <rect x="7" y="2.2" width="18" height="3" rx="1.5" />
        <rect x="3.6" y="0" width="4.4" height="7.6" rx="1.5" />
        <rect x="24" y="0" width="4.4" height="7.6" rx="1.5" />
      </g>
      {/* arms up to the bar */}
      <path
        d="M11.5 14.5 L9 4.2"
        stroke={brand}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20.5 14.5 L23 4.2"
        stroke={brand}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* legs, braced */}
      <path
        d="M13.6 22.5 L12.2 29.5"
        stroke={brand}
        strokeWidth="3.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18.4 22.5 L19.8 29.5"
        stroke={brand}
        strokeWidth="3.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* torso */}
      <rect x="10.8" y="13" width="10.4" height="10.5" rx="3.6" fill={brand} />
      {/* frog head */}
      <circle cx="16" cy="10.6" r="4.1" fill={brand} />
      <circle cx="13.2" cy="7.4" r="2.6" fill={brand} />
      <circle cx="18.8" cy="7.4" r="2.6" fill={brand} />
      <circle cx="13.2" cy="7.3" r="1.5" fill="#ffffff" />
      <circle cx="18.8" cy="7.3" r="1.5" fill="#ffffff" />
      <circle cx="13.6" cy="7.5" r="0.8" fill={ink} />
      <circle cx="18.4" cy="7.5" r="0.8" fill={ink} />
      <path
        d="M13.7 11.4 Q16 13.1 18.3 11.4"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  showText = true,
}: {
  className?: string;
  markClassName?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <FrogMark className={cn("size-6", markClassName)} />
      {showText ? (
        <span className="font-heading text-[0.95rem] leading-none font-semibold tracking-tight">
          Prog<span style={{ color: "var(--brand, #16a34a)" }}>Frog</span>
        </span>
      ) : null}
    </span>
  );
}
