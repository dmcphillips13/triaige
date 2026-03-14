// Stoplight classification badge using the project's color scheme:
//   - green  → "expected"   (known change, recommend baseline update)
//   - yellow → "uncertain"  (partial match, recommend human review)
//   - red    → "unexpected" (no explanation found, recommend filing a bug)
//
// Unknown classification values fall back to "uncertain" styling.
// Uses class-variance-authority (cva) for variant-based Tailwind classes.

import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
  {
    variants: {
      classification: {
        expected: "border-emerald-200 bg-emerald-50 text-emerald-700",
        uncertain: "border-amber-200 bg-amber-50 text-amber-700",
        unexpected: "border-rose-200 bg-rose-50 text-rose-700",
      },
    },
    defaultVariants: {
      classification: "uncertain",
    },
  }
);

type Classification = "expected" | "uncertain" | "unexpected";

export function ClassificationBadge({
  classification,
  className,
}: {
  classification: string;
  className?: string;
}) {
  const variant = (
    ["expected", "uncertain", "unexpected"].includes(classification) ? classification : "uncertain"
  ) as Classification;

  return (
    <span className={cn(badgeVariants({ classification: variant }), className)}>
      {classification}
    </span>
  );
}
