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
  title: "Врата Бальдура — v1.6 «Перевал великанов»",
  description:
    "Фулстек-прототип CRPG в духе Baldur's Gate 3: Three.js WebGPU (src/game), d20-бои, партия из пяти героев (воин, волшебница, плут Илва, жрица Кая, друид Ольха), боссы с фазами (некромант, Матерь Топей, великан Гаррум), четыре карты (тракт, крипта, болота, перевал великанов), снаряжение с эффектами, ассеты POLYGON Nature, элитные враги с реликвиями, 3 слота сохранений с облачными (IndexedDB) и серверными скрижалями (Prisma/SQLite), обучение, процедурный WebAudio-звук и партиклы.",
  keywords: ["Baldur's Gate 3", "WebGPU", "Three.js", "CRPG", "прототип", "D&D", "WebAudio", "сохранения", "обучение", "перевал великанов", "снаряжение", "Synty POLYGON"],
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
