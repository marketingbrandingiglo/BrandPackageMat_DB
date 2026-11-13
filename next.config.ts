import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Upload logo maks 5 MB (SPEC bagian 3) + overhead multipart.
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Pustaka render dimuat apa adanya dari node_modules (PDFKit membaca file data
  // AFM lewat fs; resvg memakai binary native).
  serverExternalPackages: ["pdfkit", "svg-to-pdfkit", "@resvg/resvg-js", "@node-rs/argon2"],
  // File font dibaca lewat fs saat runtime, jadi harus ikut di bundle fungsi.
  outputFileTracingIncludes: {
    "/api/render-test": ["./fonts/test/**/*"],
    "/admin/lab/font/file/**": ["./fonts/lib/**/*"],
  },
};

export default nextConfig;
