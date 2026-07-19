import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-[440px]">
        <div className="mb-10">
          <div className="font-display text-4xl font-black italic tracking-tighter bg-gradient-to-br from-[#0ea5e9] to-[#8b5cf6] bg-clip-text text-transparent drop-shadow-sm mb-8 text-center">
            NetrAI
          </div>
          <p className="text-[11px] font-light text-secondary-text uppercase tracking-[1.9px]">
            Sign in to your account
          </p>
        </div>
        <SignIn path="/login" signUpUrl="/register" fallbackRedirectUrl="/" />
      </div>
    </div>
  );
}
