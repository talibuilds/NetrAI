import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-[440px]">
        <div className="mb-10">
          <div className="flex flex-col items-center justify-center mb-6 gap-3">
            <Image 
              src="/netrai_icon.svg" 
              alt="NetrAI Icon" 
              width={64} 
              height={64} 
              className="h-[64px] w-auto drop-shadow-lg" 
              priority
            />
            <div className="font-display text-4xl font-black italic tracking-tighter bg-gradient-to-br from-[#0ea5e9] to-[#8b5cf6] bg-clip-text text-transparent drop-shadow-sm text-center">
              NetrAI
            </div>
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
