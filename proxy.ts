import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./app/lib/auth";

const publicPages = new Set(["/login", "/register"]);
const publicApi = "/api/auth/";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith(publicApi) || pathname === "/api/auth") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);

  if (pathname.startsWith("/api/")) {
    if (!session) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }
    if (
      pathname === "/api/notifications" ||
      pathname.startsWith("/api/portal/") ||
      pathname === "/api/availability"
    ) {
      return NextResponse.next();
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Accès réservé à l’administration." }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (publicPages.has(pathname)) {
    if (session) {
      return NextResponse.redirect(
        new URL(session.role === "admin" ? "/" : "/portal", request.url),
      );
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role !== "admin" && pathname !== "/portal") {
    return NextResponse.redirect(new URL("/portal", request.url));
  }
  if (session.role === "admin" && pathname === "/portal") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
