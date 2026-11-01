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
    // The entrance animation starts fully transparent, so printing during it gives a blank page.
    <main key={pathname} className={cn("motion-page print:animate-none", className)}>
      {children}
    </main>
  );
}
