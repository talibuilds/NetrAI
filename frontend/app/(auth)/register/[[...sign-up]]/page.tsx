import { SignUp } from "@clerk/nextjs";
import Image from "next/image";

export default function RegisterPage() {
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
            <div className="font-display text-4xl font-bold tracking-tight text-white drop-shadow-sm text-center">
              NetrAI
            </div>
          </div>
          <p className="text-[11px] font-light text-secondary-text uppercase tracking-[1.9px]">
            Create your account
          </p>
        </div>
        <SignUp path="/register" signInUrl="/login" fallbackRedirectUrl="/" />
      </div>
    </div>
  );
}
