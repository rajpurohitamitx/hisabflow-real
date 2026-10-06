import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { resetDemoBusiness } from "@/lib/demo-reset";
import { seedDemoBusiness } from "@/lib/demo-seed";

export async function POST() {
  try {
    const s = await requireSession();
    const marker = await db.businessMemory.findUnique({
      where: { businessId_key: { businessId: s.businessId, key: "demo.seed.v1" } },
    });
    if (!marker?.active) {
      return NextResponse.json({ error: "Reset is available only for the seeded demo business." }, { status: 403 });
    }
    await resetDemoBusiness(db, s.businessId);
    await seedDemoBusiness(db, s.businessId, s.user.id);
    return NextResponse.json({ ok: true, message: "Demo data reset. Duplicate customers, products and transactions were removed and a clean dataset was created." });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Demo reset failed" }, { status: 400 });
  }
}
