import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LocalCart — 인천 동네 장보기",
  description: "인천 전통시장·동네상권 최저가 장보기 앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head />
      <body style={{ overscrollBehavior: "none" }}>{children}</body>
    </html>
  );
}
