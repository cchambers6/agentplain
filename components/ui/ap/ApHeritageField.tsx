import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

// Form field with mono eyebrow label above, bordered input, helper caption,
// inline error. Per design language §3.3. No floating labels, no placeholder-
// as-label. Helper text under the input, never to the right.
//
// Composes either an <input> (default) or a <textarea> via the `multiline`
// prop. Refs forward to the underlying element.

type CommonFieldProps = {
  /** Eyebrow label above the field. Required. Use lowercase, single word
   *  or phrase ("email", "workspace name"). */
  label: ReactNode;
  /** Helper text under the field (caption mute). Optional. */
  helper?: ReactNode;
  /** Inline error text. When present, takes precedence over helper. role=alert. */
  error?: ReactNode;
  /** Optional wrapping div className for layout adjustments. */
  wrapperClassName?: string;
};

type ApHeritageFieldProps =
  | (CommonFieldProps &
      InputHTMLAttributes<HTMLInputElement> & {
        multiline?: false;
      })
  | (CommonFieldProps &
      TextareaHTMLAttributes<HTMLTextAreaElement> & {
        multiline: true;
      });

const INPUT_BASE =
  "mt-1 block w-full border border-rule bg-paper px-3 py-2 text-[15px] text-ink outline-none transition focus:border-ink disabled:opacity-50";

/**
 * @example
 * <ApHeritageField
 *   label="email"
 *   name="email"
 *   type="email"
 *   required
 *   autoComplete="email"
 *   helper="We send a magic link."
 * />
 *
 * @example
 * <ApHeritageField
 *   multiline
 *   label="notes for your service partner"
 *   name="notes"
 *   rows={4}
 *   error={state.error}
 * />
 */
export const ApHeritageField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  ApHeritageFieldProps
>(function ApHeritageField(props, ref) {
  const generatedId = useId();
  const { label, helper, error, wrapperClassName, id, ...rest } = props as ApHeritageFieldProps & { id?: string };
  const fieldId = id ?? generatedId;
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;

  const describedBy = error
    ? errorId
    : helper
      ? helperId
      : undefined;

  return (
    <div className={wrapperClassName}>
      <label htmlFor={fieldId} className="block">
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {label}
        </span>
        {props.multiline ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
            className={[INPUT_BASE, "resize-y leading-relaxed", (rest as { className?: string }).className]
              .filter(Boolean)
              .join(" ")}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...(rest as InputHTMLAttributes<HTMLInputElement>)}
            className={[INPUT_BASE, (rest as { className?: string }).className]
              .filter(Boolean)
              .join(" ")}
          />
        )}
      </label>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-[13px] text-flag">
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className="mt-2 text-[13px] leading-relaxed text-mute">
          {helper}
        </p>
      ) : null}
    </div>
  );
});
