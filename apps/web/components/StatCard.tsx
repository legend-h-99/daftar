import { LucideIcon } from "lucide-react";
import { AnimatedCounter } from "./ui/animated-counter";

interface StatCardProps {
  label: string;
  value: string;
  rawValue?: number;
  formatter?: (n: number) => string;
  icon: LucideIcon;
  tone?: "brand" | "red" | "amber" | "neutral";
  hero?: boolean;
  style?: React.CSSProperties;
}

const toneConfig: Record<
  NonNullable<StatCardProps["tone"]>,
  { icon: string; value: string; heroBg: string; heroBorder: string }
> = {
  brand: {
    icon: "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400",
    value: "text-primary",
    heroBg: "bg-accent",
    heroBorder: "border-border",
  },
  red: {
    icon: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
    value: "text-red-600 dark:text-red-400",
    heroBg: "bg-red-50 dark:bg-red-950/40",
    heroBorder: "border-red-100 dark:border-red-900",
  },
  amber: {
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-400",
    heroBg: "bg-amber-50 dark:bg-amber-950/40",
    heroBorder: "border-amber-100 dark:border-amber-900",
  },
  neutral: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
    heroBg: "bg-muted",
    heroBorder: "border-border",
  },
};

export default function StatCard({
  label,
  value,
  rawValue,
  formatter,
  icon: Icon,
  tone = "neutral",
  hero = false,
  style,
}: StatCardProps) {
  const cfg = toneConfig[tone];
  const valueClass = `font-extrabold tracking-tight ${cfg.value} ${hero ? "text-3xl" : "text-2xl"}`;

  return (
    <div
      style={style}
      className={`motion-surface animate-fade-up flex flex-col gap-3 rounded-lg border p-4 shadow-sm ${
        hero
          ? `${cfg.heroBg} ${cfg.heroBorder}`
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className={`rounded-lg p-2 ${cfg.icon}`}>
          <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        </span>
      </div>

      {rawValue !== undefined && formatter ? (
        <AnimatedCounter to={rawValue} format={formatter} className={valueClass} />
      ) : (
        <span className={valueClass}>{value}</span>
      )}
    </div>
  );
}
