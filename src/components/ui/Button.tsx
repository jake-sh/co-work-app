import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-white text-black hover:bg-zinc-200",
  secondary: "bg-surface-pill text-text-primary hover:bg-zinc-700",
  ghost: "bg-transparent text-text-secondary hover:text-text-primary",
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "rounded-pill px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
