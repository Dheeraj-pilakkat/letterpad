import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate (Next.js 16 proxy).
 * Real session validation happens server-side in layouts/actions/routes;
 * this only bounces obvious cases fast.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(
    request.cookies.get("better-auth.session_token") ??
      request.cookies.get("__Secure-better-auth.session_token"),
  );

  if (pathname.startsWith("/app") && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  if (
    (pathname === "/sign-in" || pathname === "/sign-up") &&
    hasSessionCookie
  ) {
    return NextResponse.redirect(new URL("/app", request.url));
  }
  if (pathname === "/onboarding" && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/sign-in", "/sign-up", "/onboarding"],
};
