import type { Metadata, Viewport } from "next";
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
  title: "Врата Бальдура — v3.4 «Мастерская»",
  description:
    "Фулстек-прототип CRPG в духе Baldur's Gate 3 с РЕДАКТОРОМ ИГРЫ как в Unity v3.4 «Мастерская» (кнопка 🛠 или ` / ё: Hierarchy — дерево сцены с фокусом по двойному клику и переносом юнитов drag&drop; Inspector — живые правки статов/оружия/ИИ/позиций; ГИЗМО W/E/R — перемещение/поворот/масштаб фигурок; кисть и drag&drop спавна; ДЕКОР МИРА — 38 моделей POLYGON Nature с persist; ПРАВКА ДИАЛОГОВ вживую; АНИМАЦИИ рига — клипы/скорость/перезагрузка; Play/Пауза/Шаг/Темп), мобильная версия (тач-управление, кнопка «Говорить», полноэкранный режим F/⛶), Three.js WebGPU (src/game), d20-бои, партия из шести героев (воин, волшебница, плут Илва, жрица Кая, друид Ольха, паладин Хальдир), боссы с фазами и аурами (Грат, некромант, Матерь Топей, великан Гаррум, лорд-комендант Малвех), пять карт (тракт, крипта, болота, перевал великанов, цитадель Дозора — финал кампании) и постгейм: арена «Испытание Глубин» (5 волн) и БЕСКОНЕЧНОЕ ИСПЫТАНИЕ (волны 6+, чемпионы бездны, ТЕНЬ ОТРЯДА, СЕЗОНЫ ГЛУБИНЫ, панель «Летопись Глубин» (T)), ОЗВУЧКА как в большой BG3 — 12 голосов НПС + рассказчик + БОЕВЫЕ РЕПЛИКИ ГЕРОЕВ (русский нейро-TTS piper, манифест 196 реплик, динамика /api/tts), миникарта, снаряжение, ассеты POLYGON Nature, скелетные анимации Synty без T-Pose, элитные враги, 3 слота сохранений с облачными и серверными скрижалями (Prisma/SQLite), лидерборд глубины (/api/scores), обучение, процедурный WebAudio-звук и партиклы.",
  keywords: ["Baldur's Gate 3", "WebGPU", "Three.js", "CRPG", "мобильная игра", "тач-управление", "полноэкранный режим", "прототип", "D&D", "WebAudio", "озвучка", "голоса", "piper", "TTS", "боевые реплики", "эхо битвы", "barks", "сохранения", "обучение", "цитадель Дозора", "арена", "чемпион бездны", "тень отряда", "сезоны глубины", "летопись Глубин", "реликвии Глубин", "лидерборд глубины", "постгейм", "снаряжение", "Synty POLYGON"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

/* v2.7: мобильная версия — вьюпорт без пинч-зума (камера крутится пальцем),
   safe-area для чёлок/кнопок телефонов */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0f0c",
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
