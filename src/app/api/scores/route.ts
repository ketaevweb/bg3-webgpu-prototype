/* ================= API /api/scores (v2.3 «Тень отряда») =================
   Серверный лидерборд глубины — рекорды «Бесконечного испытания»
   (Prisma/SQLite, модель Score). Клиент (game/save/leaderboard.ts)
   постит рекорд при улучшении S.arenaBest и читает топ-10 у стелы
   рекордов. Недоступность сервера — не ошибка игры: клиент no-throw.
   GET            → [{name,best,when}…] топ-10 (best desc, when asc)
   POST {name,best} → {ok:true}                     (новая запись) */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = await db.score.findMany({
    select: { name: true, best: true, when: true },
    orderBy: [{ best: "desc" }, { when: "asc" }],
    take: 10,
  });
  return NextResponse.json(rows.map(r => ({ name: r.name, best: r.best, when: Number(r.when) })));
}

export async function POST(req: Request) {
  let body: { name?: unknown; best?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 24) : "";
  const best = Number(body.best);
  if (!name || !Number.isInteger(best) || best < 1 || best > 999) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  await db.score.create({ data: { name, best, when: BigInt(Date.now()) } });
  return NextResponse.json({ ok: true });
}
