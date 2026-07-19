"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogIn, Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Show, UserButton } from "@clerk/nextjs";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/scan", label: "Scan" },
  { href: "/map", label: "Map" },
  { href: "/impact", label: "Impact" },
  { href: "/admin", label: "Issues" },
];

const AUTH_PATH_PREFIXES = ["/login", "/register"];

export default function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (AUTH_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-[72px] bg-canvas/60 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2"
          >
            <Image 
              src="/netrai_icon.svg" 
              alt="NetrAI Icon" 
              width={32} 
              height={32} 
              className="h-[32px] w-auto object-contain drop-shadow-md" 
              priority
            />
            <span className="font-display text-2xl font-black italic tracking-tighter bg-gradient-to-br from-[#0ea5e9] to-[#8b5cf6] bg-clip-text text-transparent drop-shadow-sm mt-1">
              NetrAI
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-sans text-[11px] font-bold uppercase tracking-[0.15em] transition-colors pb-1 ${
                    active
                      ? "text-primary border-b border-primary shadow-[0_1px_10px_rgba(14,165,233,0.3)]"
                      : "text-foreground/50 hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="md:hidden text-foreground/50 hover:text-foreground p-2 rounded-full hover:bg-foreground/5 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link
            href="/scan"
            className="bg-foreground text-canvas font-sans text-[11px] font-bold uppercase tracking-[0.15em] px-5 py-2 rounded-[24px] hover:bg-primary hover:text-white transition-all hover:shadow-[0_0_15px_rgba(14,165,233,0.4)]"
          >
            New Inspection
          </Link>
          <ThemeToggle />

          <Show when="signed-in">
            <div className="ml-1 pl-3 border-l border-image-frame flex items-center">
              <UserButton />
            </div>
          </Show>
          <Show when="signed-out">
            <Link
              href="/login"
              className="flex items-center gap-1.5 ml-1 pl-3 border-l border-image-frame text-foreground/50 hover:text-foreground text-[11px] font-bold uppercase tracking-[0.12em] transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Link>
          </Show>
        </div>
      </nav>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[72px] bg-canvas z-40 flex flex-col p-6 gap-2 border-t border-border">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center px-4 py-3 rounded-full text-[13px] font-bold uppercase tracking-[0.15em] transition-colors ${
                  active
                    ? "bg-mint text-black"
                    : "text-foreground/50 hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/scan"
            onClick={() => setMobileOpen(false)}
            className="mt-4 bg-mint text-black font-sans text-[13px] font-bold uppercase tracking-[0.15em] px-5 py-3 rounded-[24px] text-center hover:bg-foreground hover:text-canvas transition-colors"
          >
            New Inspection
          </Link>
        </div>
      )}
    </>
  );
}
