interface TopBarProps {
  businessName?: string | null;
}

export default function TopBar({ businessName }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-base font-extrabold text-white">
            د
          </span>
          <span className="text-lg font-extrabold text-gray-900">دفتر</span>
        </div>
        {businessName && (
          <span className="max-w-[140px] truncate text-sm font-medium text-gray-500">
            {businessName}
          </span>
        )}
      </div>
    </header>
  );
}
