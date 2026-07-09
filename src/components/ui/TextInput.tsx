import { forwardRef } from "react";
import { clsx } from "clsx";

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={clsx(
          "w-full rounded-xl bg-surface-input border border-border-divider px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-text-secondary",
          className
        )}
        {...props}
      />
    );
  }
);

// Chrome for Android shows its password/payment-card/address autofill
// suggestion bar above *any* focused <input>, regardless of type/
// autocomplete — it's a general manual-fallback UI, not something
// triggered by field relevance, and isn't suppressible via HTML
// attributes. It only applies to <input>, never <textarea>. For fields
// that don't need character masking (i.e. not a password), rendering as
// a single-row, horizontally-scrolling textarea sidesteps it entirely
// while looking and behaving like a normal single-line input.
export const SingleLineInput = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function SingleLineInput({ className, onKeyDown, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={1}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
          onKeyDown?.(e);
        }}
        className={clsx(
          "w-full resize-none overflow-x-auto overflow-y-hidden whitespace-pre rounded-xl bg-surface-input border border-border-divider px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-text-secondary",
          className
        )}
        {...props}
      />
    );
  }
);

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={clsx(
          "w-full rounded-xl bg-surface-input border border-border-divider px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-text-secondary resize-none",
          className
        )}
        {...props}
      />
    );
  }
);
