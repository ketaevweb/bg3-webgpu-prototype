import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Врата Бальдура — v1.2 «Отряд Долгого Дозора»",
  description:
    "Фулстек-прототип CRPG в духе Baldur's Gate 3: Three.js WebGPU (src/game), d20-бои, партия из четырёх героев (воин, волшебница, плут Илва, жрица Кая), босс-некромант с фазами, две карты, 3 слота сохранений с экспортом/импортом JSON, настройки графики, процедурный WebAudio-звук и партиклы.",
  keywords: ["Baldur's Gate 3", "WebGPU", "Three.js", "CRPG", "прототип", "D&D", "WebAudio", "сохранения"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
