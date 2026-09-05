export default function InvoicesLoading() {
  return (
    <div className="space-y-3 p-4 animate-pulse">
      <div className="h-10 rounded-lg bg-muted" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-16 rounded-lg bg-muted" />
      ))}
    </div>
  );
}
