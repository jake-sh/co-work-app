export function ColorDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ backgroundColor: color, width: size, height: size }}
    />
  );
}
