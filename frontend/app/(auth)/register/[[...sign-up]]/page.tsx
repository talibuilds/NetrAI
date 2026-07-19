import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-[440px]">
        <div className="mb-10">
          <h1 className="font-display text-[48px] font-black italic text-mint-fg uppercase leading-none tracking-tight mb-2">
            CivikEye
          </h1>
          <p className="text-[11px] font-light text-secondary-text uppercase tracking-[1.9px]">
            Create your account
          </p>
        </div>
        <SignUp path="/register" signInUrl="/login" fallbackRedirectUrl="/" />
      </div>
    </div>
  );
}
