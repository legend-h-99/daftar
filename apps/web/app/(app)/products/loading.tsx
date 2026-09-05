export default function ProductsLoading() {
  return (
    <div className="space-y-3 p-4 animate-pulse">
      <div className="h-10 rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
