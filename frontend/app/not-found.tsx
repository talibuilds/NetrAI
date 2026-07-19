import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="max-w-[500px] w-full text-center">
        <div className="font-display text-[11px] font-black uppercase tracking-[0.3em] text-secondary-text mb-4">
          404 Not Found
        </div>
        <h1 className="font-display text-[96px] font-black italic text-foreground uppercase leading-none tracking-tight mb-6">
          LOST
        </h1>
        <p className="text-[14px] text-secondary-text mb-8 leading-relaxed">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="bg-mint text-black font-bold text-[11px] uppercase tracking-[0.15em] px-6 py-3 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors inline-block"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
