// Triaige logo — PNG wordmark with red plus and red "ai" highlight.
// Source file: public/logo.png (exported from Figma at 4x)
// Usage: <Logo /> for default nav size, <Logo className="h-10" /> for larger contexts.

import Image from "next/image";

interface LogoProps {
  className?: string;
}

export function Logo({ className = "h-7" }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="Triaige"
      width={435}
      height={194}
      className={`${className} w-auto`}
      priority
    />
  );
}
