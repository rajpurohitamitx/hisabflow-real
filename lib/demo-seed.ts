import { PrismaClient, Prisma } from "@prisma/client";
import { createSale, createPurchase, createExpense } from "./services/business";

export async function seedDemoBusiness(db: PrismaClient, businessId: string, userId: string) {
  const D = Prisma.Decimal;
  const business = await db.business.findUnique({ where: { id: businessId } });
  if (!business) throw new Error("Business not found");
  const branch = await db.branch.upsert({
    where: { businessId_code: { businessId, code: "MAIN" } },
    update: { name: "Chennai Main Branch", isMain: true },
    create: { businessId, name: "Chennai Main Branch", code: "MAIN", isMain: true },
  });

  await db.industryConfig.upsert({
    where: { businessId },
    update: { industry: "jewellery" },
    create: {
      businessId,
      industry: "jewellery",
      fields: { metal: true, purity: true, grossWeight: true, netWeight: true, makingCharge: true, wastage: true, itemCode: true },
      rules: { requireConfirmationAbove: 10000, highValueThreshold: 50000, trackPurity: true },
      vocabulary: { "silver chain": "Silver Chain", chain: "Silver Chain", ring: "Silver Ring" },
      workflows: { dailyOpening: true, dailyClosing: true, collectionSweep: true, stockReview: true },
      templates: { invoice: "jewellery-default", statement: "customer-default" },
    },
  });

  const customers = await Promise.all([
    ["Ramesh Kumar", "9876543210", "Anna Nagar"],
    ["Jinal Shah", "9876543211", "T Nagar"],
    ["Arjun Mehta", "9876543212", "Velachery"],
    ["Meena Iyer", "9876543213", "Adyar"],
    ["Karthik Rao", "9876543214", "Tambaram"],
  ].map(([name, phone, address]) => db.customer.create({ data: { businessId, branchId: branch.id, name, phone, address } })));

  const productSeed: Array<{ name: string; sku: string; unit: string; sell: number; cost: number; stock: number; reorder: number; category: string }> = [
    { name: "Bajra", sku: "BAJRA-001", unit: "kg", sell: 400, cost: 300, stock: 40, reorder: 10, category: "Grains" },
    { name: "Jawar", sku: "JAWAR-001", unit: "kg", sell: 680, cost: 520, stock: 35, reorder: 8, category: "Grains" },
    { name: "Biscuits", sku: "BISC-001", unit: "piece", sell: 20, cost: 12, stock: 200, reorder: 50, category: "Grocery" },
    { name: "Rice", sku: "RICE-001", unit: "kg", sell: 70, cost: 48, stock: 100, reorder: 25, category: "Grocery" },
    { name: "Silver Chain", sku: "SIL-CHAIN-001", unit: "piece", sell: 24000, cost: 19000, stock: 12, reorder: 3, category: "Jewellery" },
    { name: "Silver Ring", sku: "SIL-RING-001", unit: "piece", sell: 7500, cost: 5000, stock: 18, reorder: 5, category: "Jewellery" },
  ];

  const products: Prisma.ProductGetPayload<{}>[] = [];
  for (const item of productSeed) {
    const product = await db.product.create({
      data: {
        businessId,
        branchId: branch.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        sellingPrice: D(item.sell),
        purchasePrice: D(item.cost),
        stock: D(item.stock),
        reorderPoint: D(item.reorder),
        category: item.category,
        gstRate: D(3),
      },
    });
    products.push(product);
  }

  for (const p of products) {
    await db.inventoryMovement.create({
      data: { businessId, branchId: branch.id, productId: p.id, type: "ADJUSTMENT", quantity: p.stock, beforeStock: D(0), afterStock: p.stock, referenceType: "DEMO", referenceId: "demo.seed.v1", note: "Clean demo opening stock" },
    });
  }

  const suppliers = await Promise.all(["Sri Traders", "Metro Wholesale", "Lakshmi Suppliers"].map(name => db.supplier.create({ data: { businessId, name } })));

  // A small, deterministic transaction set. No duplicate customers/products.
  await createSale({ businessId, userId, customerId: customers[0].id, items: [{ productId: products[4].id, quantity: 2, rate: 24000 }], payment: 20000, paymentMethod: "CASH", source: "demo" });
  await createSale({ businessId, userId, customerId: customers[1].id, items: [{ productId: products[0].id, quantity: 1.5, rate: 400 }], payment: 0, paymentMethod: "CASH", source: "demo" });
  await createSale({ businessId, userId, customerId: customers[2].id, items: [{ productId: products[2].id, quantity: 10, rate: 20 }], payment: 200, paymentMethod: "UPI", source: "demo" });

  await createPurchase({ businessId, userId, supplierId: suppliers[0].id, items: [{ productId: products[3].id, quantity: 50, rate: 48 }], payment: 1000, paymentMethod: "CASH", source: "demo" });
  await createPurchase({ businessId, userId, supplierId: suppliers[1].id, items: [{ productId: products[2].id, quantity: 100, rate: 12 }], payment: 0, paymentMethod: "CASH", source: "demo" });

  await createExpense({ businessId, userId, category: "Electricity", amount: 2800, description: "Demo expense", source: "demo" });
  await createExpense({ businessId, userId, category: "Transport", amount: 1200, description: "Demo expense", source: "demo" });

  await db.reminder.create({ data: { businessId, customerId: customers[0].id, title: "Follow up with Ramesh", dueAt: new Date(Date.now() + 86400000), channel: "in_app", notes: "Clean demo reminder" } });
  await db.stockBatch.create({ data: { businessId, productId: products[0].id, batchNumber: "BAJRA-DEMO-01", quantity: D(20), expiryAt: new Date(Date.now() + 90 * 86400000), cost: products[0].purchasePrice } });
  await db.stockSerial.create({ data: { businessId, productId: products[4].id, serial: "SILVER-DEMO-0001", status: "IN_STOCK" } });
  await db.businessMemory.create({ data: { businessId, key: "demo.seed.v1", value: { loadedAt: new Date().toISOString(), dataset: "clean-v21" }, source: "system", active: true } });
}
