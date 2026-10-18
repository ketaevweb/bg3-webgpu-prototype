import type { NextConfig } from "next";

/* v2.7: GH_PAGES=1 — сборка для GitHub Pages: чистый статический экспорт
   (out/) с basePath /bg3-webgpu-prototype. API-роуты на время сборки
   временно убирает scripts/deploy_ghpages.sh (Pages — только статика:
   сейвы/скрижали/лидерборд/динамический TTS там молча падают в фоллбеки,
   офлайн-озвучка public/voices работает полностью). */
const ghPages = process.env.GH_PAGES === "1";

const nextConfig: NextConfig = {
  ...(ghPages
    ? {
        output: "export" as const,
        basePath: "/bg3-webgpu-prototype",
        images: { unoptimized: true },
      }
    : { output: "standalone" as const }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
