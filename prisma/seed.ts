import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resetDemoBusiness } from "../lib/demo-reset";
import { seedDemoBusiness } from "../lib/demo-seed";

const db = new PrismaClient();

async function main() {
  const email = "owner@hisabflow.local";
  const passwordHash = await bcrypt.hash("HisabFlow@123", 12);
  const user = await db.user.upsert({ where: { email }, update: {}, create: { name: "Amit", email, passwordHash } });
  const existing = await db.business.findUnique({ where: { id: "demo-business" } });
  if (existing) {
    const marker = await db.businessMemory.findUnique({ where: { businessId_key: { businessId: existing.id, key: "demo.seed.v1" } } });
    if (marker?.active) await resetDemoBusiness(db, existing.id);
  } else {
    await db.business.create({ data: { id: "demo-business", name: "Amit Silver & General Store", businessType: "jewellery", gstEnabled: true } });
  }
  await db.membership.upsert({ where: { userId_businessId: { userId: user.id, businessId: "demo-business" } }, update: { role: "OWNER" }, create: { userId: user.id, businessId: "demo-business", role: "OWNER" } });
  await seedDemoBusiness(db, "demo-business", user.id);
  console.log(`Clean demo database ready: ${email} / HisabFlow@123`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
