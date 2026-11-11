/** Shared hierarchy for workspace screens: title, then their primary action. */
export default function ScreenHeader({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
        {title}
      </h1>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </header>
  );
}
