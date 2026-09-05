export default function ExpensesLoading() {
  return (
    <div className="space-y-3 p-4 animate-pulse">
      <div className="h-10 rounded-lg bg-muted" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-muted" />
      ))}
    </div>
  );
}
