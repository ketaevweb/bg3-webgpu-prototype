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
  title: "Врата Бальдура — v2.4 «Сезоны глубины»",
  description:
    "Фулстек-прототип CRPG в духе Baldur's Gate 3: Three.js WebGPU (src/game), d20-бои, партия из шести героев (воин, волшебница, плут Илва, жрица Кая, друид Ольха, паладин Хальдир), боссы с фазами и аурами (Грат, некромант, Матерь Топей, великан Гаррум, лорд-комендант Малвех), пять карт (тракт, крипта, болота, перевал великанов, цитадель Дозора — финал кампании) и постгейм: арена «Испытание Глубин» (5 волн) и БЕСКОНЕЧНОЕ ИСПЫТАНИЕ (волны 6+, чемпионы бездны, ТЕНЬ ОТРЯДА — зеркальная волна-босс, СЕЗОНЫ ГЛУБИНЫ — еженедельный ротационный аффикс (Кровавый прилив, Костяная стужа, Мора глубин, Ярость толпы, Дань глубин) с косметикой тени — сезонным обликом врагов, панель «Летопись Глубин» (T) — сезон, рекорды, журнал и серверный топ-10, стела рекордов, призрак коменданта: обмен реликвий и их АПГРЕЙД), калибровка XP глубины, миникарта, снаряжение с эффектами, ассеты POLYGON Nature, скелетные анимации на Unity-клипах, элитные враги с реликвиями, 3 слота сохранений с облачными (IndexedDB) и серверными скрижалями (Prisma/SQLite), лидерборд глубины (/api/scores), обучение, процедурный WebAudio-звук и партиклы.",
  keywords: ["Baldur's Gate 3", "WebGPU", "Three.js", "CRPG", "прототип", "D&D", "WebAudio", "сохранения", "обучение", "цитадель Дозора", "арена", "чемпион бездны", "тень отряда", "сезоны глубины", "летопись Глубин", "реликвии Глубин", "лидерборд глубины", "постгейм", "снаряжение", "Synty POLYGON"],
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
