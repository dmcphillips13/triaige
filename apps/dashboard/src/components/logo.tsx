// Triaige logo — PNG wordmark with red plus and red "ai" highlight.
// Source file: public/logo.png (exported from Figma at 4x)
// Usage: <Logo /> for default nav size, <Logo className="h-10" /> for larger contexts.

interface LogoProps {
  className?: string;
}

export function Logo({ className = "h-7" }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Triaige"
      className={`${className} w-auto`}
    />
  );
}
