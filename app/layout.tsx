import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "여행 셀러 자동화 SaaS",
  description: "여행 상품 URL을 넣으면 네이버 블로그용 마케팅 글 초안을 생성합니다.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
