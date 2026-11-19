import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { authUrl, requestOrigin } from "@/lib/drive/drive";

/** Super admin: mulai menghubungkan Google Drive (OAuth, scope drive.file). */
export async function GET(req: NextRequest) {
  const cu = await getCurrentUser();
  if (!cu || cu.user.role !== "superadmin") return new Response("unauthorized", { status: 401 });
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.DRIVE_TOKEN_SECRET) {
    return Response.redirect(new URL("/admin?drive=config", requestOrigin(req)));
  }
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("bpa_drive_state", state, { httpOnly: true, sameSite: "lax", secure: requestOrigin(req).startsWith("https:"), path: "/api/drive", maxAge: 600 });
  return Response.redirect(authUrl(`${requestOrigin(req)}/api/drive/callback`, state));
}
