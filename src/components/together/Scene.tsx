import type { ReactNode } from "react";
import type { PathCode } from "@/lib/journey/content";

/**
 * The couple's shared picture for a path. It has ten stages: 0 before
 * anything is done, then one more for each level both people have finished.
 * Drawn with the app's colors so it suits light and dark mode.
 */
export function Scene({
  path,
  stage,
  label,
  animate = false,
  className = "",
}: {
  path: PathCode;
  stage: number;
  label: string;
  /** Grow the newest part in, after a level is finished. */
  animate?: boolean;
  className?: string;
}) {
  const s = Math.max(0, Math.min(9, stage));
  const draw =
    path === "grow_a_tree" ? tree : path === "build_a_house" ? house : book;
  return (
    <svg
      viewBox="0 0 240 200"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label={label}
      className={`block h-auto w-full ${className}`}
    >
      {draw(s, (at, node) =>
        at === s && animate ? <g className="stage-in">{node}</g> : node,
      )}
    </svg>
  );
}

type Grow = (atStage: number, node: ReactNode) => ReactNode;

const sky = (
  <>
    <rect width="240" height="200" fill="var(--sky)" />
    <circle cx="200" cy="38" r="16" fill="var(--ring)" opacity="0.85" />
  </>
);

/* ---------------------------------------------------------------- tree */

function tree(s: number, g: Grow) {
  const canopy = (r: number) => (
    <>
      <circle cx="120" cy={128 - r} r={r} fill="var(--grass)" />
      <circle
        cx={120 - r * 0.6}
        cy={134 - r * 0.7}
        r={r * 0.62}
        fill="var(--grass)"
      />
      <circle
        cx={120 + r * 0.6}
        cy={134 - r * 0.7}
        r={r * 0.62}
        fill="var(--grass)"
      />
      <circle
        cx={120 - r * 0.25}
        cy={122 - r * 1.2}
        r={r * 0.5}
        fill="var(--leaf)"
        opacity="0.55"
      />
    </>
  );
  const leaf = (x: number, y: number, flip = false) => (
    <path
      d={`M${x} ${y}c${flip ? -9 : 9}-7 ${flip ? -16 : 16}-4 ${flip ? -18 : 18} 2c${flip ? 6 : -6} 5-${flip ? -14 : 14} 5-${flip ? -18 : 18}-2z`}
      fill="var(--grass)"
    />
  );
  return (
    <>
      {sky}
      {s >= 2 &&
        s <= 3 &&
        g(
          2,
          <g fill="var(--water)" opacity="0.8">
            <path d="M84 52c4 6 6 9 0 11-6-2-4-5 0-11z" />
            <path d="M104 40c4 6 6 9 0 11-6-2-4-5 0-11z" />
            <path d="M96 68c4 6 6 9 0 11-6-2-4-5 0-11z" />
          </g>,
        )}
      <rect y="140" width="240" height="60" fill="var(--soil)" />
      <rect y="140" width="240" height="5" fill="var(--grass)" />
      <circle cx="40" cy="170" r="3" fill="var(--soil-deep)" />
      <circle cx="200" cy="182" r="4" fill="var(--soil-deep)" />
      {s >= 8 &&
        g(
          8,
          <g
            stroke="var(--soil-deep)"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M120 145q-30 15-60 18M120 145q30 18 64 16M120 150q-10 25-30 40M120 150q12 25 34 38" />
          </g>,
        )}
      {s >= 1 &&
        s <= 3 &&
        g(
          s === 1 ? 1 : -1,
          <ellipse
            cx="120"
            cy="168"
            rx={s >= 2 ? 10 : 8}
            ry={s >= 2 ? 7 : 6}
            fill="var(--wood)"
          />,
        )}
      {s >= 3 &&
        s <= 5 &&
        g(
          3,
          <path
            d="M120 172q2 10-3 20"
            stroke="var(--page)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />,
        )}
      {s === 3 && (
        <path d="M113 165l14 6" stroke="var(--soil-deep)" strokeWidth="2" />
      )}
      {s === 4 &&
        g(
          4,
          <>
            <path
              d="M120 168v-44"
              stroke="var(--grass)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {leaf(120, 126)}
            {leaf(120, 126, true)}
          </>,
        )}
      {s === 5 &&
        g(
          5,
          <>
            <path
              d="M120 168v-66"
              stroke="var(--grass)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {leaf(120, 104)}
            {leaf(120, 104, true)}
            {leaf(120, 124)}
            {leaf(120, 124, true)}
          </>,
        )}
      {s >= 6 && (
        <>
          {g(
            6,
            <path
              d={`M${120 - (s >= 8 ? 9 : s >= 7 ? 6 : 3.5)} 145L${120 - (s >= 8 ? 5 : 3)} ${s >= 8 ? 80 : 90}h${s >= 8 ? 10 : 6}L${120 + (s >= 8 ? 9 : s >= 7 ? 6 : 3.5)} 145z`}
              fill="var(--wood)"
            />,
          )}
          {s >= 7 &&
            g(
              7,
              <g stroke="var(--wood)" strokeWidth="4" strokeLinecap="round">
                <path d="M120 108l-22-16M120 100l20-18" />
              </g>,
            )}
          {g(
            s >= 8 ? 8 : s >= 7 ? 7 : 6,
            canopy(s >= 8 ? 46 : s >= 7 ? 36 : 22),
          )}
          {s >= 9 &&
            g(
              9,
              <g>
                {[
                  [96, 70],
                  [140, 62],
                  [118, 48],
                  [150, 90],
                  [88, 96],
                  [128, 84],
                ].map(([x, y]) => (
                  <circle
                    key={`${x}-${y}`}
                    cx={x}
                    cy={y}
                    r="5"
                    fill="var(--fruit)"
                  />
                ))}
                <circle cx="108" cy="80" r="3" fill="var(--page)" />
                <circle cx="138" cy="104" r="3" fill="var(--page)" />
              </g>,
            )}
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------- house */

function house(s: number, g: Grow) {
  return (
    <>
      {sky}
      <rect y="160" width="240" height="40" fill="var(--grass)" />
      {s >= 2 &&
        g(
          2,
          <rect
            x="50"
            y="156"
            width="140"
            height="8"
            rx="2"
            fill="var(--soil)"
          />,
        )}
      {s === 1 &&
        g(
          1,
          <>
            <rect
              x="58"
              y="126"
              width="80"
              height="44"
              rx="3"
              fill="var(--water)"
              opacity="0.9"
            />
            <g stroke="var(--page)" strokeWidth="1" opacity="0.8">
              <path d="M66 136h64M66 146h64M66 156h40M80 130v34M110 130v34" />
            </g>
            <rect x="160" y="110" width="4" height="52" fill="var(--wood)" />
            <rect
              x="146"
              y="104"
              width="32"
              height="20"
              rx="2"
              fill="var(--page)"
              stroke="var(--line)"
            />
            <path
              d="M151 111h22M151 117h14"
              stroke="var(--ink-soft)"
              strokeWidth="2"
            />
          </>,
        )}
      {s === 2 &&
        g(
          2,
          <g>
            {[54, 186].map((x) => (
              <g key={x}>
                <rect
                  x={x - 1}
                  y="136"
                  width="3"
                  height="22"
                  fill="var(--wood)"
                />
                <path d={`M${x + 2} 137l10 4-10 4z`} fill="var(--fruit)" />
              </g>
            ))}
            <path
              d="M56 146h130"
              stroke="var(--ring)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          </g>,
        )}
      {s >= 3 &&
        g(
          3,
          <rect
            x="56"
            y="148"
            width="128"
            height="10"
            fill="var(--concrete)"
          />,
        )}
      {s >= 4 &&
        s <= 5 &&
        g(
          4,
          <g stroke="var(--wood)" strokeWidth="3" fill="none">
            <path d="M62 148V96h116v52" />
            {[78, 94, 110, 126, 142, 158].map((x) => (
              <path key={x} d={`M${x} 148V96`} strokeWidth="2" />
            ))}
            <path d="M56 98l64-46 64 46" />
            <path d="M88 76v20M120 54v42M152 76v20" strokeWidth="2" />
          </g>,
        )}
      {s === 5 &&
        g(
          5,
          <g fill="none" strokeWidth="2.5" strokeLinecap="round">
            <path d="M70 146v-30h24v-10" stroke="var(--water)" />
            <path d="M166 146v-36h-30v-6" stroke="var(--ring)" />
            <path d="M104 146v-20h20" stroke="var(--fruit)" />
          </g>,
        )}
      {s >= 6 &&
        g(
          6,
          <rect
            x="62"
            y="96"
            width="116"
            height="52"
            fill="var(--page)"
            stroke="var(--line)"
          />,
        )}
      {s === 6 &&
        g(
          6,
          <path
            d="M56 98l64-46 64 46"
            fill="none"
            stroke="var(--wood)"
            strokeWidth="3"
          />,
        )}
      {s >= 7 && (
        <>
          {g(
            7,
            <>
              <path d="M50 100l70-52 70 52z" fill="var(--covenant)" />
              <rect
                x="150"
                y="56"
                width="12"
                height="26"
                fill="var(--covenant-strong)"
              />
              <g stroke="var(--line)" strokeWidth="1">
                <path d="M62 108h116M62 120h116M62 132h116M62 144h116" />
              </g>
            </>,
          )}
          <rect
            x="74"
            y="108"
            width="24"
            height="20"
            rx="2"
            fill={s >= 8 ? "var(--ring)" : "var(--sky)"}
            stroke="var(--ink-soft)"
          />
          <rect
            x="142"
            y="108"
            width="24"
            height="20"
            rx="2"
            fill={s >= 8 ? "var(--ring)" : "var(--sky)"}
            stroke="var(--ink-soft)"
          />
          <rect
            x="110"
            y="116"
            width="20"
            height="32"
            rx="2"
            fill={s >= 8 ? "var(--fruit)" : "var(--wood)"}
          />
          {s >= 8 &&
            g(8, <circle cx="126" cy="133" r="1.8" fill="var(--ring)" />)}
        </>
      )}
      {s >= 9 &&
        g(
          9,
          <>
            <path d="M114 148l-10 52h32l-10-52z" fill="var(--concrete)" />
            <g fill="var(--fruit)">
              <circle cx="70" cy="156" r="4" />
              <circle cx="82" cy="158" r="4" />
              <circle cx="158" cy="157" r="4" />
              <circle cx="170" cy="155" r="4" />
            </g>
            <g
              fill="none"
              stroke="var(--ink-soft)"
              strokeWidth="2"
              opacity="0.45"
              strokeLinecap="round"
            >
              <path d="M156 52c-6-6 6-10 0-16s6-10 0-16" />
            </g>
          </>,
        )}
    </>
  );
}

/* ---------------------------------------------------------------- book */

function book(s: number, g: Grow) {
  const lines = (x: number, y: number, n: number, w = 56) =>
    Array.from({ length: n }, (_, i) => (
      <rect
        key={i}
        x={x}
        y={y + i * 8}
        width={i === n - 1 ? w * 0.6 : w}
        height="3"
        rx="1.5"
        fill="var(--ink-soft)"
        opacity="0.55"
      />
    ));
  return (
    <>
      <rect width="240" height="200" fill="var(--sky)" />
      <rect y="168" width="240" height="32" fill="var(--wood)" />
      {s < 9 && (
        <>
          {s >= 6 &&
            g(
              6,
              <g fill="var(--page)" stroke="var(--line)">
                <rect
                  x="78"
                  y="60"
                  width="84"
                  height="108"
                  rx="3"
                  transform="rotate(-5 120 114)"
                />
                <rect
                  x="80"
                  y="58"
                  width="84"
                  height="108"
                  rx="3"
                  transform="rotate(3 120 112)"
                />
              </g>,
            )}
          <rect
            x="78"
            y="56"
            width="84"
            height="110"
            rx="3"
            fill="var(--page)"
            stroke="var(--line)"
          />
          {s >= 1 && g(1, <>{lines(90, 70, 2, 60)}</>)}
          {s >= 3 &&
            g(
              3,
              <g>
                {[0, 1, 2, 3].map((i) => (
                  <g key={i}>
                    <circle
                      cx="93"
                      cy={94 + i * 14}
                      r="2.5"
                      fill="var(--covenant)"
                    />
                    <rect
                      x="100"
                      y={92 + i * 14}
                      width={44 - (i % 2) * 12}
                      height="3.5"
                      rx="1.5"
                      fill="var(--ink-soft)"
                      opacity="0.55"
                    />
                  </g>
                ))}
              </g>,
            )}
          {s >= 7 &&
            g(
              7,
              <g
                stroke="var(--fruit)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              >
                <path d="M88 76l40 0" />
                <path d="M132 100q8-6 14 2" />
                <path d="M150 140l6-6m-6 0l6 6" />
              </g>,
            )}
          {s >= 2 &&
            g(
              2,
              <>
                <rect
                  x="150"
                  y="48"
                  width="28"
                  height="26"
                  rx="2"
                  fill="var(--ring)"
                  transform="rotate(8 164 61)"
                />
                <rect
                  x="58"
                  y="120"
                  width="26"
                  height="24"
                  rx="2"
                  fill="var(--leaf)"
                  opacity="0.85"
                  transform="rotate(-8 71 132)"
                />
              </>,
            )}
          {s >= 4 &&
            g(
              4,
              <g>
                <rect
                  x="20"
                  y="96"
                  width="46"
                  height="62"
                  rx="3"
                  fill="var(--page)"
                  stroke="var(--line)"
                />
                <circle
                  cx="34"
                  cy="114"
                  r="7"
                  fill="none"
                  stroke="var(--covenant)"
                  strokeWidth="2"
                />
                <circle
                  cx="52"
                  cy="114"
                  r="7"
                  fill="none"
                  stroke="var(--ring)"
                  strokeWidth="2"
                />
                {lines(28, 130, 3, 30)}
              </g>,
            )}
          {s >= 5 &&
            g(
              5,
              <g>
                <rect
                  x="176"
                  y="96"
                  width="48"
                  height="56"
                  rx="3"
                  fill="var(--page)"
                  stroke="var(--line)"
                />
                <rect
                  x="176"
                  y="96"
                  width="48"
                  height="12"
                  rx="3"
                  fill="var(--covenant)"
                />
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <path
                    key={i}
                    d={`M${183 + (i % 3) * 14} ${118 + Math.floor(i / 3) * 14}l3 3 6-7`}
                    stroke="var(--leaf)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                ))}
              </g>,
            )}
          {s >= 8 &&
            g(
              8,
              <g>
                <path
                  d="M30 40h44a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H48l-10 9v-9h-8a6 6 0 0 1-6-6V46a6 6 0 0 1 6-6z"
                  fill="var(--page)"
                  stroke="var(--line)"
                />
                <path
                  d="M52 63l-7-7a4 4 0 0 1 7-4 4 4 0 0 1 7 4z"
                  fill="var(--fruit)"
                />
              </g>,
            )}
        </>
      )}
      {s >= 9 &&
        g(
          9,
          <g>
            <rect
              x="72"
              y="40"
              width="96"
              height="128"
              rx="4"
              fill="var(--covenant)"
            />
            <rect
              x="72"
              y="40"
              width="12"
              height="128"
              rx="3"
              fill="var(--covenant-strong)"
            />
            <rect
              x="96"
              y="62"
              width="56"
              height="8"
              rx="2"
              fill="var(--ring)"
            />
            <rect
              x="104"
              y="76"
              width="40"
              height="4"
              rx="2"
              fill="var(--on-covenant)"
              opacity="0.7"
            />
            <circle
              cx="116"
              cy="120"
              r="14"
              fill="none"
              stroke="var(--on-covenant)"
              strokeWidth="4"
            />
            <circle
              cx="134"
              cy="120"
              r="14"
              fill="none"
              stroke="var(--ring)"
              strokeWidth="4"
            />
            <rect x="166" y="44" width="4" height="122" fill="var(--page)" />
          </g>,
        )}
    </>
  );
}
