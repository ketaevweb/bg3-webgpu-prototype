/* ================= API /api/tablets (v1.5 «Болота культистов») =================
   Серверные скрижали — зеркало трёх слотов сохранений на сервере
   (Prisma/SQLite, модель Tablet). Формат данных — тот же SaveData v2,
   сериализованный в строку data (REFACTORING.md §8: SAVE_VER не меняется).
   GET            → [{slot,when}…]                (список мета)
   GET ?slot=N    → {slot,when,data} | null       (одна скрижаль)
   PUT {slot,…}   → {ok:true}                     (upsert)
   DELETE ?slot=N → {ok:true}
   Недоступность сервера — не ошибка игры: клиент работает no-throw. */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("slot");
  if (raw !== null) {
    const slot = Number(raw);
    if (!Number.isInteger(slot) || slot < 1 || slot > 9) {
      return NextResponse.json({ error: "bad slot" }, { status: 400 });
    }
    const t = await db.tablet.findUnique({ where: { slot } });
    return NextResponse.json(t ? { slot: t.slot, when: Number(t.when), data: t.data } : null);
  }
  const rows = await db.tablet.findMany({ select: { slot: true, when: true }, orderBy: { slot: "asc" } });
  return NextResponse.json(rows.map(r => ({ slot: r.slot, when: Number(r.when) })));
}

export async function PUT(req: Request) {
  let body: { slot?: unknown; when?: unknown; data?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const slot = Number(body.slot);
  const when = Number(body.when);
  const data = typeof body.data === "string" ? body.data : null;
  if (!Number.isInteger(slot) || slot < 1 || slot > 9 || !Number.isFinite(when) || !data || data.length > 512 * 1024) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  await db.tablet.upsert({
    where: { slot },
    update: { data, when: BigInt(when) },
    create: { slot, data, when: BigInt(when) },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const slot = Number(url.searchParams.get("slot"));
  if (!Number.isInteger(slot) || slot < 1 || slot > 9) {
    return NextResponse.json({ error: "bad slot" }, { status: 400 });
  }
  await db.tablet.deleteMany({ where: { slot } });
  return NextResponse.json({ ok: true });
}
