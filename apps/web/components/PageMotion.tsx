"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface PageMotionProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageMotion({ children, className }: PageMotionProps) {
  const pathname = usePathname();

  return (
    <main key={pathname} className={cn("motion-page", className)}>
      {children}
    </main>
  );
}
