import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { TEST_FONTS } from "@/lib/render/fonts";
import { SAMPLE_SIZE, sampleBusinessCardSvg } from "@/lib/render/sample";
import { svgToPdf, svgToPng } from "@/lib/render/svg";

/**
 * Uji render Tahap 1. Hanya untuk user yang sudah login.
 * Tidak menerima input user: selalu merender SVG contoh.
 *   /api/render-test            -> JSON diagnostik (durasi, ukuran, peringatan)
 *   /api/render-test?format=pdf -> PDF
 *   /api/render-test?format=png -> PNG preview
 *   /api/render-test?format=svg -> SVG sumber
 */
export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const svg = sampleBusinessCardSvg();
  if (format === "svg") {
    return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8" } });
  }

  const t0 = performance.now();
  const { pdf, warnings } = await svgToPdf(svg, { ...SAMPLE_SIZE, fonts: TEST_FONTS, title: "Uji render" });
  const pdfMs = performance.now() - t0;
  const t1 = performance.now();
  const png = svgToPng(svg, TEST_FONTS);
  const pngMs = performance.now() - t1;

  const timing = `pdf;dur=${pdfMs.toFixed(0)}, png;dur=${pngMs.toFixed(0)}`;
  if (format === "pdf") {
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="uji-kartu-nama.pdf"',
        "server-timing": timing,
      },
    });
  }
  if (format === "png") {
    return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "server-timing": timing } });
  }
  return Response.json({
    ok: true,
    runtime: { node: process.version, platform: process.platform, arch: process.arch, region: process.env.VERCEL_REGION ?? null },
    pdf: { bytes: pdf.length, ms: Math.round(pdfMs) },
    png: { bytes: png.length, ms: Math.round(pngMs) },
    warnings,
  });
}
