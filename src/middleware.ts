import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(request.auth?.user);
  const isLoginPage = pathname === "/login";

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  if (isLoginPage || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!isAuthenticated && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
