import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const jakarta = localFont({
  src: "./fonts/PlusJakartaSans[wght].ttf",
  variable: "--font-sans",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Automation Brand Package",
  description: "Aplikasi internal pembuat brand package material.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
