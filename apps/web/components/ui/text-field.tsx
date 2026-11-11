import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement> & {
  /** Always give a visible label; placeholders are examples, not labels. */
  label?: string;
  helper?: string;
  /** Replaces the helper, turns the field danger and sets aria-invalid. */
  error?: string;
  multiline?: boolean;
  rows?: number;
  /** Extra classes for the input or textarea itself (the wrapper takes `className`). */
  controlClassName?: string;
};

export function TextField({
  label,
  helper,
  error,
  multiline = false,
  rows,
  id,
  className,
  controlClassName,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const helpId = `${controlId}-help`;
  const help = error ?? helper;

  const shared = {
    id: controlId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": help ? helpId : undefined,
    className: cn(
      "box-border min-h-11 w-full rounded-md border bg-surface px-3.5 py-2.5 text-[15px] leading-[22px] text-ink",
      "transition-[border-color] duration-[120ms] placeholder:text-ink-muted focus:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-45",
      error ? "border-danger" : "border-line-strong hover:border-ink-muted focus:border-brand-text",
      multiline && "min-h-24 resize-y",
      controlClassName,
    ),
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={controlId} className="text-[14px] font-semibold leading-5 text-ink">
          {label}
        </label>
      ) : null}
      {multiline ? (
        // The props type covers both elements (as in the design system); here they are textarea props.
        <textarea
          rows={rows ?? 3}
          {...shared}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input {...shared} {...rest} />
      )}
      {help ? (
        <p
          id={helpId}
          className={cn(
            "m-0 flex items-center gap-1 text-[13px] leading-5",
            error ? "text-danger" : "text-ink-muted",
          )}
        >
          {error ? <Icon name="alert" size={14} /> : null}
          {help}
        </p>
      ) : null}
    </div>
  );
}
