import { NextResponse, type NextRequest } from "next/server";

/**
 * Pemeriksaan cepat: tanpa cookie sesi, semua halaman diarahkan ke /login.
 * Validasi sesi sebenarnya (Redis) dilakukan di server lewat lib/auth/server.ts.
 */
export function proxy(req: NextRequest) {
  const hasCookie = req.cookies.has("__Host-bpa_session") || req.cookies.has("bpa_session");
  if (hasCookie) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  // Semua path kecuali /login, aset Next.js, dan file statis di public/.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|logo-iglo.png).*)"],
};
