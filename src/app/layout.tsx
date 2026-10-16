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
  title: "Врата Бальдура — v0.8 «Крипта Костепёра»",
  description:
    "Фулстек-прототип CRPG в духе Baldur's Gate 3: Three.js WebGPU (src/game), d20-бои, диалоги с проверками ХАР, квесты, торговец, процедурный WebAudio-звук, партиклы и слоумо-криты.",
  keywords: ["Baldur's Gate 3", "WebGPU", "Three.js", "CRPG", "прототип", "D&D", "WebAudio"],
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
