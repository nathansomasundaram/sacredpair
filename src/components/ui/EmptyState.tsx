import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-line px-6 py-10">
      <span className="grid size-14 place-items-center rounded-full bg-mist text-covenant">
        <Icon aria-hidden size={28} strokeWidth={1.75} />
      </span>
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-prose text-ink-soft">{body}</p>
      {children}
    </section>
  );
}
