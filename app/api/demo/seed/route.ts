import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { seedDemoBusiness } from "@/lib/demo-seed";

export async function POST() {
  try {
    const s = await requireSession();
    const existing = await db.businessMemory.findUnique({ where: { businessId_key: { businessId: s.businessId, key: "demo.seed.v1" } } });
    if (existing?.active) return NextResponse.json({ ok: true, message: "Clean demo data is already loaded. Nothing was duplicated." });
    await seedDemoBusiness(db, s.businessId, s.user.id);
    return NextResponse.json({ ok: true, message: "Clean demo business loaded: unique customers/products with a small deterministic transaction set." });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Demo seed failed" }, { status: 400 });
  }
}
