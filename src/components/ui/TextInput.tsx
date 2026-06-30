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

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "w-full rounded-xl bg-surface-input border border-border-divider px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-text-secondary resize-none",
        className
      )}
      {...props}
    />
  );
}
