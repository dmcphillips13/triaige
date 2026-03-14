// Triaige logo — SVG wordmark with plus sign and red "ai" highlight.
// Usage: <Logo /> for default nav size, <Logo className="h-10" /> for larger contexts.

interface LogoProps {
  className?: string;
}

const BRAND_RED = "#E03E3E";

export function Logo({ className = "h-7" }: LogoProps) {
  // Plus sign: 24x24, centered at (12, 20) in the viewbox
  // Each arm is 8px wide, extends 8px from center square
  // Total: 24w x 24h, arms are equal length
  const cx = 12; // center x
  const cy = 20; // center y
  const arm = 8;  // arm length (from center edge)
  const w = 8;    // arm width

  return (
    <svg
      className={className}
      viewBox="0 0 160 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Triaige"
    >
      {/* Plus sign — equal arms, hard edges */}
      <rect x={cx - w / 2} y={cy - w / 2 - arm} width={w} height={w + arm * 2} rx={1} fill={BRAND_RED} />
      <rect x={cx - w / 2 - arm} y={cy - w / 2} width={w + arm * 2} height={w} rx={1} fill={BRAND_RED} />

      {/* "riaige" as continuous text */}
      <text
        x="27"
        y="28"
        fontFamily="Lora, Georgia, serif"
        fontSize="26"
        fill="#1a1a1a"
      >
        <tspan>ri</tspan>
        <tspan fill={BRAND_RED}>ai</tspan>
        <tspan>ge</tspan>
      </text>
    </svg>
  );
}
