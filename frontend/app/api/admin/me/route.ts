import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ signedIn: false, admin: false });
  const user = await currentUser();
  return NextResponse.json({
    signedIn: true,
    admin: isAdminUser(user),
    email: user?.primaryEmailAddress?.emailAddress ?? null,
  });
}
