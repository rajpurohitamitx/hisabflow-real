import { db } from "./db";
export async function audit(input: { businessId: string; userId?: string; actorType?: "USER"|"AI"|"SYSTEM"; action: string; entityType?: string; entityId?: string; before?: unknown; after?: unknown; metadata?: unknown; }) {
  return db.auditLog.create({ data: { businessId: input.businessId, userId: input.userId, actorType: input.actorType || "USER", action: input.action, entityType: input.entityType, entityId: input.entityId, before: input.before as any, after: input.after as any, metadata: input.metadata as any } });
}
