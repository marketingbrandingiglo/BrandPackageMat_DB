import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/server";
import { isCatalogFile } from "@/lib/brand/fonts";

/** File font katalog untuk halaman tinjauan font (super admin saja). */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const cu = await getCurrentUser();
  if (!cu || cu.user.role !== "superadmin") return new Response("unauthorized", { status: 401 });
  const rel = (await ctx.params).path.join("/");
  // Hanya file yang tercatat di katalog (sekaligus mencegah path traversal).
  if (!isCatalogFile(rel)) return new Response("not found", { status: 404 });
  const buf = await readFile(path.join(process.cwd(), "fonts/lib", rel));
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "font/ttf",
      "cache-control": "private, max-age=86400",
    },
  });
}
