import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-[440px]">
        <div className="mb-10">
          <div className="flex justify-center mb-6">
            <Image 
              src="/netrai_logo.svg" 
              alt="NetrAI" 
              width={160} 
              height={180} 
              className="h-[120px] w-auto drop-shadow-lg" 
              priority
            />
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
