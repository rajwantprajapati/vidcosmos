"use client";

// Field errors for the auth forms: every invalid field is shown at once, and focus moves to
// the first one. Screen readers then announce that field with its error (TextField ties
// the message to the input with aria-describedby). Errors for the whole form use
// FormMessage, which is a live region, so focus stays where it is.
import { useEffect, useState } from "react";

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

/**
 * `fieldIds` maps each field to its input id, in the order the fields appear on screen; the
 * first invalid one in that order gets focus.
 */
export function useFormErrors<F extends string>(
  fieldIds: Record<F, string>,
  initialMessage?: string,
) {
  const [fields, setFields] = useState<FieldErrors<F>>({});
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);
  // Bumped on every report, so the same error twice still moves focus again.
  const [reported, setReported] = useState(0);

  useEffect(() => {
    if (reported === 0) return;
    const first = (Object.keys(fieldIds) as F[]).find((field) => fields[field]);
    if (first) document.getElementById(fieldIds[first])?.focus();
    // Runs after the errors render, so the input is announced with its new description.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new report moves focus
  }, [reported]);

  return {
    fieldError: (field: F) => fields[field],
    message,
    /** Show these field errors and/or form message, replacing the previous ones. */
    report(next: { fields?: FieldErrors<F>; message?: string | null }) {
      setFields(next.fields ?? {});
      setMessage(next.message ?? null);
      setReported((n) => n + 1);
    },
    clear() {
      setFields({});
      setMessage(null);
    },
  };
}
