import type { ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

/** A message about the whole form. Screen readers announce it when it appears. */
export function FormAlert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={[
        "flex items-start gap-3 rounded-lg border px-4 py-3",
        tone === "error"
          ? "border-danger/40 bg-danger/[0.06] text-ink"
          : "border-leaf/40 bg-leaf/[0.08] text-ink",
      ].join(" ")}
    >
      <Icon
        aria-hidden
        size={20}
        className={`mt-0.5 shrink-0 ${tone === "error" ? "text-danger" : "text-leaf"}`}
      />
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
