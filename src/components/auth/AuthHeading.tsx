import type { ReactNode } from "react";

export function AuthHeading({
  title,
  intro,
}: {
  title: string;
  intro?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3">
      <h1 className="text-2xl sm:text-3xl">{title}</h1>
      {intro && <p className="text-ink-soft">{intro}</p>}
    </div>
  );
}

export function AuthFooter({ children }: { children: ReactNode }) {
  return <p className="mt-8 text-ink-soft">{children}</p>;
}
