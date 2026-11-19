import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { connectWithCode, requestOrigin } from "@/lib/drive/drive";

/** Kembali dari Google: tukar kode dengan token, simpan terenkripsi, kembali ke Admin. */
export async function GET(req: NextRequest) {
  const cu = await getCurrentUser();
  if (!cu || cu.user.role !== "superadmin") return new Response("unauthorized", { status: 401 });
  const jar = await cookies();
  const expected = jar.get("bpa_drive_state")?.value ?? "";
  jar.delete({ name: "bpa_drive_state", path: "/api/drive" });
  const p = req.nextUrl.searchParams;
  const state = p.get("state") ?? "";
  const back = (status: string) => Response.redirect(new URL(`/admin?drive=${status}`, requestOrigin(req)));
  if (!expected || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) return back("state");
  if (p.get("error")) return back("denied");
  const code = p.get("code");
  if (!code) return back("error");
  try {
    await connectWithCode(code, `${requestOrigin(req)}/api/drive/callback`);
    return back("ok");
  } catch (e) {
    console.error("Sambungan Drive gagal:", (e as Error).message);
    return back("error");
  }
}
