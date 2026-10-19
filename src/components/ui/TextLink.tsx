import Link from "next/link";
import type { ComponentProps } from "react";

export const textLinkClass =
  "font-semibold text-covenant underline decoration-covenant/40 underline-offset-4 hover:decoration-covenant";

export function TextLink({
  className = "",
  ...props
}: ComponentProps<typeof Link>) {
  return <Link {...props} className={`${textLinkClass} ${className}`} />;
}
