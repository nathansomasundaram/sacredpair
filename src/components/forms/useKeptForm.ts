"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Like useActionState, but the form keeps what the member typed after
 * submitting (React otherwise resets a form once its action finishes, which
 * loses unsaved changes when there's an error to fix).
 */
export function useKeptForm<S extends object>(
  action: (prev: S, data: FormData) => Promise<S>,
  initial: S,
) {
  const [state, run, pending] = useActionState<S, FormData>(
    action as (prev: Awaited<S>, data: FormData) => Promise<S>,
    initial as Awaited<S>,
  );
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };
  return { state, onSubmit, pending };
}
