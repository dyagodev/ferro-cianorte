import { NextRequest, NextResponse } from "next/server";
import { ROLE_COOKIE, TOKEN_COOKIE } from "@/lib/session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value;

  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/pdv", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/pdv/:path*", "/admin/:path*"],
};
