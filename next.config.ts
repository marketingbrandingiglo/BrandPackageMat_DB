import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Upload logo maks 4 MB (SPEC bagian 3) + overhead multipart; tetap di bawah batas Vercel 4,5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // Pustaka render dimuat apa adanya dari node_modules (PDFKit membaca file data
  // AFM lewat fs; resvg memakai binary native).
  serverExternalPackages: ["pdfkit", "svg-to-pdfkit", "@resvg/resvg-js", "@node-rs/argon2"],
  // File font dibaca lewat fs saat runtime, jadi harus ikut di bundle fungsi.
  outputFileTracingIncludes: {
    "/api/render-test": ["./fonts/test/**/*"],
    // Lab 3d (server action di /admin/lab) merender spesimen dengan file font katalog.
    "/admin/lab": ["./fonts/lib/**/*"],
    "/admin/lab/font/file/**": ["./fonts/lib/**/*"],
  },
};

export default nextConfig;
