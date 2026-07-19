import { auth, currentUser, type User } from "@clerk/nextjs/server";

function adminEmailList(): string[] {
  return (process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  const role = (user.publicMetadata as Record<string, unknown> | undefined)?.role;
  if (typeof role === "string" && role.toLowerCase() === "admin") return true;
  const emails = adminEmailList();
  if (emails.length === 0) return true;
  const primary = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (primary && emails.includes(primary)) return true;
  for (const e of user.emailAddresses) {
    if (emails.includes(e.emailAddress.toLowerCase())) return true;
  }
  return false;
}

export async function requireAdmin(): Promise<
  | { ok: true; userId: string; email: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, status: 401, error: "Not signed in" };
  const user = await currentUser();
  if (!isAdminUser(user)) return { ok: false, status: 403, error: "Admin access required" };
  return {
    ok: true,
    userId,
    email: user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "",
  };
}
