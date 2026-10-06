import { PrismaClient } from "@prisma/client";

/**
 * Reset ONLY a business explicitly marked with demo.seed.v1.
 * This is intentionally not a general production-data deletion helper.
 */
export async function resetDemoBusiness(db: PrismaClient, businessId: string) {
  const marker = await db.businessMemory.findUnique({
    where: { businessId_key: { businessId, key: "demo.seed.v1" } },
  });
  if (!marker?.active) {
    throw new Error("This business is not marked as demo data. Refusing to delete it.");
  }

  // Delete leaf/transaction records first, then their parents.
  await db.workflowRun.deleteMany({ where: { businessId } });
  await db.entityResolutionEvent.deleteMany({ where: { businessId } });
  await db.aiInsight.deleteMany({ where: { businessId } });
  await db.paymentLink.deleteMany({ where: { businessId } });
  await db.recurringTransaction.deleteMany({ where: { businessId } });
  await db.cashSession.deleteMany({ where: { businessId } });
  await db.importJob.deleteMany({ where: { businessId } });
  await db.integrationConnection.deleteMany({ where: { businessId } });
  await db.approvalRequest.deleteMany({ where: { businessId } });
  await db.stockSerial.deleteMany({ where: { businessId } });
  await db.stockBatch.deleteMany({ where: { businessId } });
  await db.saleReturn.deleteMany({ where: { businessId } });
  await db.quote.deleteMany({ where: { businessId } });
  await db.notification.deleteMany({ where: { businessId } });
  await db.document.deleteMany({ where: { businessId } });
  await db.automation.deleteMany({ where: { businessId } });
  await db.auditLog.deleteMany({ where: { businessId } });
  await db.aiAction.deleteMany({ where: { businessId } });
  await db.conversation.deleteMany({ where: { businessId } });
  await db.alias.deleteMany({ where: { businessId } });
  await db.businessMemory.deleteMany({ where: { businessId } });
  await db.industryConfig.deleteMany({ where: { businessId } });
  await db.inventoryMovement.deleteMany({ where: { businessId } });
  await db.ledgerEntry.deleteMany({ where: { businessId } });
  await db.payment.deleteMany({ where: { businessId } });
  await db.expense.deleteMany({ where: { businessId } });
  await db.purchase.deleteMany({ where: { businessId } });
  await db.sale.deleteMany({ where: { businessId } });
  await db.reminder.deleteMany({ where: { businessId } });
  await db.supplier.deleteMany({ where: { businessId } });
  await db.product.deleteMany({ where: { businessId } });
  await db.customer.deleteMany({ where: { businessId } });
  await db.warehouse.deleteMany({ where: { branch: { businessId } } });
  await db.branch.deleteMany({ where: { businessId } });
}
