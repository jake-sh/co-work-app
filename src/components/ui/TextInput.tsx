import { forwardRef } from "react";
import { clsx } from "clsx";

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-xl bg-surface-input border border-border-divider px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-text-secondary",
        className
      )}
      {...props}
    />
  );
}

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
