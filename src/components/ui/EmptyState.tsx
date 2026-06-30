export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}
