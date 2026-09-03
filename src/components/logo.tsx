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
      <circle cx="4.8" cy="27.8" r="1.6" fill={brand} opacity={0.28} />
      <circle cx="8.9" cy="24.2" r="1.6" fill={brand} opacity={0.5} />
      <circle cx="12.6" cy="20.4" r="1.6" fill={brand} opacity={0.75} />
      {/* tucked back legs */}
      <path
        d="M15.6 14.2C12.7 13.5 10.6 15.4 11.4 18.4C12.6 17.5 14 17.2 15.2 17.4C14.7 16 14.8 14.9 15.6 14.2Z"
        fill={brand}
      />
      <path
        d="M12.6 17.4C11.1 18.7 10.4 20.8 10.9 22.9C12.1 22 13.4 21.6 14.6 21.8C14.1 20.2 14.2 18.6 14.9 17.3Z"
        fill={brand}
      />
      {/* webbed feet */}
      <path
        d="M10.6 22.2L9 23.9M11.4 22.8L10.6 25M12.4 22.9L12.2 25.1"
        stroke={brand}
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M11.7 18L10.5 19.4M12.4 18.3L11.8 19.9"
        stroke={brand}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* body */}
      <ellipse
        cx="19"
        cy="13.6"
        rx="6.6"
        ry="4.2"
        transform="rotate(-24 19 13.6)"
        fill={brand}
      />
      {/* reaching arms */}
      <path
        d="M22 13.6C23.8 13 25.5 12.8 27.1 13"
        stroke={brand}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22.6 11.6C24.5 10.6 26.3 10.1 28.1 10.3"
        stroke={brand}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M27.7 9.4L29.3 9.5M27.9 10.3L29.5 10.5M27.9 11.1L29.2 11.7"
        stroke={brand}
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      {/* head */}
      <circle cx="23.8" cy="10.2" r="2.7" fill={brand} />
      <circle cx="22.3" cy="7.7" r="2.05" fill={brand} />
      <circle cx="25.6" cy="7.5" r="2.05" fill={brand} />
      <circle cx="22.3" cy="7.4" r="1" fill="#ffffff" />
      <circle cx="25.6" cy="7.2" r="1" fill="#ffffff" />
      <circle cx="22.7" cy="7.5" r="0.55" fill={ink} />
      <circle cx="26" cy="7.3" r="0.55" fill={ink} />
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
