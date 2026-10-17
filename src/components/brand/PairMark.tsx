import { useId } from "react";

/**
 * The Sacred Pair mark: two interlocking rings. The violet ring passes over
 * the gold one at the top and under it at the bottom, so neither ring sits
 * on top of the other.
 */
export function PairMark({
  size = 32,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  const clipId = useId();
  return (
    <svg
      width={size}
      height={(size * 28) / 30}
      viewBox="0 0 30 28"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="15" cy="5.94" r="3.6" />
        </clipPath>
      </defs>
      <circle cx="11" cy="14" r="9" stroke="var(--covenant)" strokeWidth="3" />
      <circle cx="19" cy="14" r="9" stroke="var(--ring)" strokeWidth="3" />
      {/* Where the rings cross at the top, the violet ring passes over the
          gold one: redraw it there with a thin paper-colored gap around it. */}
      <g clipPath={`url(#${clipId})`}>
        <circle cx="11" cy="14" r="9" stroke="var(--paper)" strokeWidth="6" />
        <circle
          cx="11"
          cy="14"
          r="9"
          stroke="var(--covenant)"
          strokeWidth="3"
        />
      </g>
    </svg>
  );
}
