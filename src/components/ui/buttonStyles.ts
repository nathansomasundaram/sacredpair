// Button looks, shared by server-rendered links and client buttons. Kept out
// of "use client" files so server components can use them as plain strings.

export const primaryButtonClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-covenant px-6 font-semibold text-on-covenant " +
  "transition-colors hover:bg-covenant-strong disabled:cursor-progress disabled:opacity-80";

export const quietButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-5 font-semibold text-covenant " +
  "transition-colors hover:bg-mist disabled:cursor-progress disabled:opacity-80";
