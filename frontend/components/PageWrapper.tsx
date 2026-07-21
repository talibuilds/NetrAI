"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const AUTH_PATH_PREFIXES = ["/login", "/register"];

export function PageWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_PATH_PREFIXES.some((p) => pathname.startsWith(p));

  if (isAuth) {
    return <div className="min-h-screen flex flex-col">{children}</div>;
  }

  return (
    <div className="md:pl-[260px] pt-[72px] md:pt-0 min-h-screen flex flex-col">
      {children}
    </div>
  );
}
