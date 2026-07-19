"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="max-w-[500px] w-full text-center">
        <div className="font-display text-[11px] font-black uppercase tracking-[0.3em] text-secondary-text mb-4">
          System Error
        </div>
        <h1 className="font-display text-[64px] font-black italic text-foreground uppercase leading-none tracking-tight mb-6">
          CRASH
        </h1>
        <p className="text-[14px] text-secondary-text mb-8 leading-relaxed">
          Something went wrong. The error has been logged.
        </p>
        {error.digest && (
          <div className="font-mono text-[10px] text-secondary-text/50 uppercase tracking-[1.5px] mb-8">
            ref: {error.digest}
          </div>
        )}
        <button
          onClick={reset}
          className="bg-mint text-black font-bold text-[11px] uppercase tracking-[0.15em] px-6 py-3 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
