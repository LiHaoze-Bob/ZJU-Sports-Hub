import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZJU Sports Hub - 浙大体育赛事聚合平台",
  description: "汇聚浙大校内体育赛事信息，不错过每一场精彩比赛",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
