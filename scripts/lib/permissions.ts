import type { MembershipRole } from "@prisma/client";

const levels: Record<MembershipRole, number> = { OWNER: 100, ADMIN: 90, MANAGER: 70, ACCOUNTANT: 60, INVENTORY: 50, SALESPERSON: 40, CASHIER: 30 };
export function can(role: MembershipRole, action: string) {
  if (levels[role] >= 70) return true;
  const lowRisk = ["VIEW_DASHBOARD", "VIEW_CUSTOMERS", "CREATE_SALE", "RECEIVE_PAYMENT", "VIEW_PRODUCTS", "CREATE_EXPENSE"];
  return lowRisk.includes(action);
}
