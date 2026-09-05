export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-48 rounded-lg bg-muted" />
      <div className="h-32 rounded-lg bg-muted" />
    </div>
  );
}
