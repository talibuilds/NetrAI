"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogIn, Menu, X, Home, ScanLine, Map as MapIcon, Activity, AlertCircle, FileText, Settings, Radio } from "lucide-react";
import { useState } from "react";
import { Show, UserButton } from "@clerk/nextjs";

const LINKS = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/impact", label: "Impact", icon: Activity },
  { href: "/priority", label: "Priority", icon: AlertCircle },
  { href: "/admin", label: "Issues", icon: FileText },
];

const AUTH_PATH_PREFIXES = ["/login", "/register"];

export default function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (AUTH_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      <nav className="fixed left-0 top-0 h-screen w-[260px] z-50 flex flex-col bg-[#111116]/80 backdrop-blur-xl hidden md:flex border-r border-white/5 my-0 rounded-none">
        <div className="p-8 pb-10 flex items-center gap-3">
          <Image 
            src="/netrai_icon.svg" 
            alt="NetrAI Icon" 
            width={28} 
            height={28} 
            className="h-[28px] w-auto drop-shadow-md" 
            priority
          />
          <span className="font-display text-[22px] font-bold tracking-tight text-white drop-shadow-sm mt-0.5">
            NetrAI
          </span>
        </div>

        <div className="flex-1 px-4 flex flex-col gap-2 overflow-y-auto">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group flex items-center gap-4 px-5 py-3.5 rounded-[12px] font-sans text-[13px] font-medium tracking-wide transition-all duration-300 ${
                  active
                    ? "bg-white/10 text-white shadow-sm border border-white/10"
                    : "text-white/50 hover:bg-white/5 hover:text-white border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-300 ${active ? "text-white" : "opacity-70 group-hover:opacity-100"}`} />
                {link.label}
              </Link>
            );
          })}
          
          <div className="mt-8 mb-2 px-4 text-[11px] font-medium text-white/40">
            System
          </div>
          <Link
            href="#"
            className="flex items-center gap-4 px-4 py-3 rounded-[12px] font-sans text-[13px] text-white/50 hover:bg-white/5 hover:text-white transition-all"
          >
            <Settings className="w-4 h-4 opacity-70" />
            Settings
          </Link>
        </div>

        <div className="p-6 mt-auto">
          <Show when="signed-in">
            <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-1 rounded-full bg-mint/10 border border-mint/20">
                  <UserButton />
                </div>
                <div className="text-[13px] font-medium text-white">Admin Access</div>
              </div>
            </div>
          </Show>
          <Show when="signed-out">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 mb-6 px-4 py-3 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 rounded-[12px] text-[13px] font-medium transition-all duration-300"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Link>
          </Show>
          <div className="flex items-center gap-3 text-[11px] text-white/50 p-4 rounded-xl bg-black/40 border border-white/5">
            <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
              <div className="absolute inset-0 rounded-full bg-[#22c55e]/20 animate-ping"></div>
              <div className="w-4 h-4 rounded-full bg-[#22c55e]/20 border border-[#22c55e]/50 flex items-center justify-center">
                <Radio className="w-2.5 h-2.5 text-[#22c55e]" />
              </div>
            </div>
            <div>
              <div className="text-white/90 font-medium">System Online</div>
              <div className="text-[11px] opacity-50">All systems nominal</div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 w-full z-50 flex justify-between items-center px-6 h-[72px] bg-[#07070a]/90 backdrop-blur-md border-b border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/netrai_icon.svg" alt="Icon" width={24} height={24} />
          <span className="font-display text-[20px] font-bold text-white tracking-tight">NetrAI</span>
        </Link>
        <button className="text-white p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[72px] bg-[#07070a] z-40 flex flex-col p-6 gap-2 border-t border-white/5 overflow-y-auto">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-4 px-4 py-4 rounded-[12px] font-sans text-[14px] transition-colors ${
                  active
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
