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
  { icon: string; value: string; bg: string; heroBg: string; heroBorder: string }
> = {
  brand: {
    icon: "bg-brand-100 text-brand-700",
    value: "text-brand-700",
    bg: "bg-white",
    heroBg: "bg-brand-50",
    heroBorder: "border-brand-100",
  },
  red: {
    icon: "bg-red-100 text-red-600",
    value: "text-red-600",
    bg: "bg-white",
    heroBg: "bg-red-50",
    heroBorder: "border-red-100",
  },
  amber: {
    icon: "bg-amber-100 text-amber-600",
    value: "text-amber-700",
    bg: "bg-white",
    heroBg: "bg-amber-50",
    heroBorder: "border-amber-100",
  },
  neutral: {
    icon: "bg-gray-100 text-gray-600",
    value: "text-gray-900",
    bg: "bg-white",
    heroBg: "bg-gray-50",
    heroBorder: "border-gray-100",
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
      className={`animate-fade-up flex flex-col gap-3 rounded-2xl border p-4 shadow-sm ${
        hero
          ? `${cfg.heroBg} ${cfg.heroBorder}`
          : `${cfg.bg} border-gray-100`
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">{label}</span>
        <span className={`rounded-xl p-2 ${cfg.icon}`}>
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
