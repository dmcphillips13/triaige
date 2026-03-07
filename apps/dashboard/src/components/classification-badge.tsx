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
        expected: "border-green-300 bg-green-100 text-green-800",
        uncertain: "border-yellow-300 bg-yellow-100 text-yellow-800",
        unexpected: "border-red-300 bg-red-100 text-red-800",
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
