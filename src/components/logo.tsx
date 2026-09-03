import { cn } from "@/lib/utils";

/**
 * ProgFrog mark — a frog mid-leap, climbing up and to the right over a fading
 * trail of hops (progress). Body fills with the brand amber (`--brand`); eyes
 * white, pupils `--brand-ink`. Reads down to ~16px.
 */
export function FrogMark({ className }: { className?: string }) {
  const brand = "var(--brand, #c17f21)";
  const ink = "var(--brand-ink, #3f2c17)";
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="ProgFrog"
      className={cn("size-6", className)}
    >
      {/* trail of hops */}
      <circle cx="4.4" cy="27.9" r="1.35" fill={brand} opacity={0.3} />
      <circle cx="8.5" cy="24.3" r="1.5" fill={brand} opacity={0.52} />
      <circle cx="12.3" cy="21" r="1.65" fill={brand} opacity={0.74} />
      {/* tucked back legs, blunt feet */}
      <path
        d="M15.6 14.2C12.7 13.5 10.6 15.4 11.4 18.4C12.6 17.5 14 17.2 15.2 17.4C14.7 16 14.8 14.9 15.6 14.2Z"
        fill={brand}
      />
      <path
        d="M12.9 17.4C11.7 18.5 11.1 20 11.4 21.7C12.5 20.9 13.7 20.6 14.8 20.8C14.3 19.4 14.4 18.2 15 17.1Z"
        fill={brand}
      />
      <circle cx="11.7" cy="18.4" r="1.4" fill={brand} />
      <circle cx="11.6" cy="21.4" r="1.5" fill={brand} />
      {/* body */}
      <ellipse
        cx="19"
        cy="13.6"
        rx="6.6"
        ry="4.2"
        transform="rotate(-24 19 13.6)"
        fill={brand}
      />
      {/* reaching arms with round hands */}
      <path
        d="M22.2 13.7C23.8 13.1 25.3 12.9 26.5 13.1"
        stroke={brand}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22.6 11.6C24.5 10.7 26.2 10.2 27.8 10.3"
        stroke={brand}
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="26.8" cy="13.2" r="1.2" fill={brand} />
      <circle cx="28.4" cy="10.3" r="1.55" fill={brand} />
      {/* head */}
      <circle cx="23.6" cy="10.4" r="2.9" fill={brand} />
      <circle cx="22.3" cy="7.9" r="1.9" fill={brand} />
      <circle cx="25.4" cy="7.9" r="1.9" fill={brand} />
      <circle cx="22.3" cy="7.75" r="0.88" fill="#ffffff" />
      <circle cx="25.4" cy="7.75" r="0.88" fill="#ffffff" />
      <circle cx="22.3" cy="7.8" r="0.66" fill={ink} />
      <circle cx="25.4" cy="7.8" r="0.66" fill={ink} />
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
          Prog<span style={{ color: "var(--brand, #c17f21)" }}>Frog</span>
        </span>
      ) : null}
    </span>
  );
}
