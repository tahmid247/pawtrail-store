"use client";
import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Like useActionState, but submits via onSubmit so React does NOT reset the form afterwards.
 * Users keep what they typed when the server returns a validation error.
 */
export function useFormAction<S>(action: (prev: Awaited<S>, fd: FormData) => Promise<S>, initial: Awaited<S>, opts: { confirm?: string } = {}) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (opts.confirm && !window.confirm(opts.confirm)) return;
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(fd));
  };
  return [state, onSubmit, pending] as const;
}
