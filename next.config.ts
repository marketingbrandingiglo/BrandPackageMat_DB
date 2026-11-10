import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Pustaka render dimuat apa adanya dari node_modules (PDFKit membaca file data
  // AFM lewat fs; resvg memakai binary native).
  serverExternalPackages: ["pdfkit", "svg-to-pdfkit", "@resvg/resvg-js"],
  // File font dibaca lewat fs saat runtime, jadi harus ikut di bundle fungsi.
  outputFileTracingIncludes: {
    "/api/render-test": ["./fonts/test/**/*"],
  },
};

export default nextConfig;
