import { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
      <span className="rounded-full bg-brand-50 p-3 text-brand-700">
        <Icon className="h-6 w-6" strokeWidth={2} />
      </span>
      <p className="font-semibold text-gray-800">{title}</p>
      {description && (
        <p className="text-sm text-gray-500">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white active:bg-brand-800"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionHref && onAction && (
        <Button
          onClick={onAction}
          className="mt-2 bg-brand-700 text-white hover:bg-brand-800"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
