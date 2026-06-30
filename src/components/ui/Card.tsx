import { clsx } from "clsx";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-card bg-surface-card p-4", className)}
      {...props}
    />
  );
}
