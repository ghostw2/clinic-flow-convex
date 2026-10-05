import { cn } from "cn";

// `colour` is whatever convex's `services.colour` stores -- a raw hex string
// in practice (see convex/lib/constants.ts's seed data), not one of the
// design system's named --svc-* tokens. Accepting any CSS color value here
// (a var(...) reference works too) keeps this usable for both real service
// data and the /dev/kit token demo.
export function ServiceDot({
  colour,
  className,
}: {
  colour: string;
  className?: string;
}) {
  return (
    <span
      data-slot="service-dot"
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: colour }}
    />
  );
}
