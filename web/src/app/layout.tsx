import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LocalCart — 인천 동네장보기",
  description: "예산 맞춤 지역상권 장보기 추천",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
