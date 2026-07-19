import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/register(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/report/(.*)",
  "/api/report/(.*)",
  "/admin(.*)",
  "/impact(.*)",
  "/api/admin/me",
]);

const clerk = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

import { NextResponse } from 'next/server';
export default async function middleware(req: any, event: any) {
  try {
    return await clerk(req, event);
  } catch (err: any) {
    return new NextResponse(
      JSON.stringify({ 
        error: "Middleware crashed", 
        message: err.message || err.toString(),
        stack: err.stack
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|geojson|json|txt|map)).*)",
    "/(api|trpc)(.*)",
  ],
};
