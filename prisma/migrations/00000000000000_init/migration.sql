-- Hisab Flow initial PostgreSQL migration generated from prisma/schema.prisma
-- Review this migration before applying to a production database.

CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'CASHIER', 'SALESPERSON', 'INVENTORY');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'BANK', 'OTHER');
CREATE TYPE "PaymentKind" AS ENUM ('CUSTOMER_RECEIPT', 'SUPPLIER_PAYMENT', 'ADVANCE', 'REFUND');
CREATE TYPE "SaleStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'REVERSED');
CREATE TYPE "PurchaseStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'REVERSED');
CREATE TYPE "LedgerType" AS ENUM ('RECEIVABLE', 'PAYABLE');
CREATE TYPE "InventoryMovementType" AS ENUM ('SALE', 'PURCHASE', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT', 'TRANSFER');
CREATE TYPE "AuditActor" AS ENUM ('USER', 'AI', 'SYSTEM');
CREATE TYPE "AIActionStatus" AS ENUM ('INTERPRETED', 'CONFIRMED', 'EXECUTED', 'REJECTED', 'FAILED');
CREATE TYPE "AIRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "MemoryScope" AS ENUM ('BUSINESS', 'BRANCH', 'USER');
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'REVIEWED', 'IMPORTED', 'REJECTED');
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED', 'CONVERTED', 'CANCELLED');
CREATE TYPE "ReturnStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'REVERSED');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');
CREATE TYPE "ImportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Business" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "businessType" TEXT NOT NULL DEFAULT 'general',
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "gstEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Membership" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL DEFAULT 'OWNER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "Branch" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "address" TEXT,
  "isMain" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "Warehouse" (
  "id" TEXT PRIMARY KEY,
  "branchId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "Customer" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "gstin" TEXT,
  "creditLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Supplier" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "gstin" TEXT,
  "notes" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Product" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "warehouseId" TEXT,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "barcode" TEXT,
  "category" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'piece',
  "purchasePrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "sellingPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "stock" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "reorderPoint" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "batchTracking" BOOLEAN NOT NULL DEFAULT FALSE,
  "expiryTracking" BOOLEAN NOT NULL DEFAULT FALSE,
  "serialTracking" BOOLEAN NOT NULL DEFAULT FALSE,
  "metadata" JSONB,
  "archived" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Sale" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "customerId" TEXT,
  "invoiceNumber" TEXT NOT NULL,
  "status" "SaleStatus" NOT NULL DEFAULT 'CONFIRMED',
  "subtotal" DECIMAL(18,2) NOT NULL,
  "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL,
  "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "balanceDue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "SaleItem" (
  "id" TEXT PRIMARY KEY,
  "saleId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "nameSnapshot" TEXT NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "rate" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL
);
CREATE TABLE "Purchase" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "supplierId" TEXT,
  "referenceNumber" TEXT,
  "status" "PurchaseStatus" NOT NULL DEFAULT 'CONFIRMED',
  "subtotal" DECIMAL(18,2) NOT NULL,
  "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL,
  "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "balanceDue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PurchaseItem" (
  "id" TEXT PRIMARY KEY,
  "purchaseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "nameSnapshot" TEXT NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "rate" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL
);
CREATE TABLE "Payment" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "customerId" TEXT,
  "supplierId" TEXT,
  "saleId" TEXT,
  "purchaseId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "kind" "PaymentKind" NOT NULL DEFAULT 'CUSTOMER_RECEIPT',
  "notes" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "PaymentAllocation" (
  "id" TEXT PRIMARY KEY,
  "paymentId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL
);
CREATE TABLE "Expense" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "category" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "description" TEXT,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "LedgerEntry" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT,
  "supplierId" TEXT,
  "saleId" TEXT,
  "purchaseId" TEXT,
  "paymentId" TEXT,
  "type" "LedgerType" NOT NULL,
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "description" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "InventoryMovement" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "productId" TEXT NOT NULL,
  "saleId" TEXT,
  "purchaseId" TEXT,
  "type" "InventoryMovementType" NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "beforeStock" DECIMAL(18,3) NOT NULL,
  "afterStock" DECIMAL(18,3) NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "note" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "Reminder" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT,
  "title" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'in_app',
  "notes" TEXT,
  "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "BusinessMemory" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "scope" "MemoryScope" NOT NULL DEFAULT 'BUSINESS',
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'user',
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Alias" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT,
  "supplierId" TEXT,
  "productId" TEXT,
  "value" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "IndustryConfig" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "industry" TEXT NOT NULL,
  "fields" JSONB NOT NULL,
  "rules" JSONB NOT NULL,
  "vocabulary" JSONB NOT NULL,
  "workflows" JSONB NOT NULL,
  "templates" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Conversation" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "customerId" TEXT,
  "productId" TEXT,
  "lastIntent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ConversationMessage" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "AIAction" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "userId" TEXT,
  "input" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "entities" JSONB NOT NULL,
  "confidence" JSONB NOT NULL,
  "risk" "AIRisk" NOT NULL,
  "status" "AIActionStatus" NOT NULL DEFAULT 'INTERPRETED',
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "userId" TEXT,
  "actorType" "AuditActor" NOT NULL DEFAULT 'USER',
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "Automation" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Document" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT,
  "mimeType" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "extraction" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "Notification" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "Quote" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT,
  "number" TEXT NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" DECIMAL(18,2) NOT NULL,
  "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "QuoteItem" (
  "id" TEXT PRIMARY KEY,
  "quoteId" TEXT NOT NULL,
  "productId" TEXT,
  "nameSnapshot" TEXT NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "rate" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL
);
CREATE TABLE "SaleReturn" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT,
  "saleId" TEXT,
  "number" TEXT NOT NULL,
  "status" "ReturnStatus" NOT NULL DEFAULT 'CONFIRMED',
  "total" DECIMAL(18,2) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "SaleReturnItem" (
  "id" TEXT PRIMARY KEY,
  "returnId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "rate" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL
);
CREATE TABLE "StockBatch" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchNumber" TEXT NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "expiryAt" TIMESTAMP(3),
  "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "StockSerial" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "serial" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "ApprovalRequest" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "requestedBy" TEXT,
  "type" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "reviewedAt" TIMESTAMP(3)
);
CREATE TABLE "IntegrationConnection" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "config" JSONB NOT NULL,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ImportJob" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "fileName" TEXT,
  "status" "ImportStatus" NOT NULL DEFAULT 'QUEUED',
  "mapping" JSONB,
  "stats" JSONB,
  "errors" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "CashSession" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "openedBy" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "closedAt" TIMESTAMP(3),
  "openingCash" DECIMAL(18,2) NOT NULL,
  "closingCash" DECIMAL(18,2),
  "difference" DECIMAL(18,2),
  "notes" TEXT
);
CREATE TABLE "RecurringTransaction" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "frequency" TEXT NOT NULL,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "config" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PaymentLink" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT,
  "paymentId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "provider" TEXT NOT NULL,
  "externalId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "url" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "AIInsight" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "data" JSONB,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "resolvedAt" TIMESTAMP(3)
);
CREATE TABLE "EntityResolutionEvent" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "selectedId" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL,
  "candidates" JSONB,
  "outcome" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE "WorkflowRun" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "workflow" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "input" JSONB,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");
CREATE UNIQUE INDEX "Membership_userId_businessId_key" ON "Membership" ("userId", "businessId");
CREATE UNIQUE INDEX "Branch_businessId_code_key" ON "Branch" ("businessId", "code");
CREATE UNIQUE INDEX "Warehouse_branchId_name_key" ON "Warehouse" ("branchId", "name");
CREATE UNIQUE INDEX "Sale_businessId_invoiceNumber_key" ON "Sale" ("businessId", "invoiceNumber");
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_saleId_key" ON "PaymentAllocation" ("paymentId", "saleId");
CREATE UNIQUE INDEX "BusinessMemory_businessId_key_key" ON "BusinessMemory" ("businessId", "key");
CREATE UNIQUE INDEX "Alias_businessId_normalized_key" ON "Alias" ("businessId", "normalized");
CREATE UNIQUE INDEX "IndustryConfig_businessId_key" ON "IndustryConfig" ("businessId");
CREATE UNIQUE INDEX "Conversation_businessId_key_key" ON "Conversation" ("businessId", "key");
CREATE UNIQUE INDEX "Quote_businessId_number_key" ON "Quote" ("businessId", "number");
CREATE UNIQUE INDEX "SaleReturn_businessId_number_key" ON "SaleReturn" ("businessId", "number");
CREATE UNIQUE INDEX "StockBatch_businessId_productId_batchNumber_key" ON "StockBatch" ("businessId", "productId", "batchNumber");
CREATE UNIQUE INDEX "StockSerial_businessId_serial_key" ON "StockSerial" ("businessId", "serial");
CREATE UNIQUE INDEX "IntegrationConnection_businessId_provider_key" ON "IntegrationConnection" ("businessId", "provider");
CREATE INDEX "Membership_businessId_role_idx" ON "Membership" ("businessId", "role");
CREATE INDEX "Branch_businessId_name_idx" ON "Branch" ("businessId", "name");
CREATE INDEX "Customer_businessId_name_idx" ON "Customer" ("businessId", "name");
CREATE INDEX "Customer_businessId_phone_idx" ON "Customer" ("businessId", "phone");
CREATE INDEX "Supplier_businessId_name_idx" ON "Supplier" ("businessId", "name");
CREATE INDEX "Supplier_businessId_phone_idx" ON "Supplier" ("businessId", "phone");
CREATE INDEX "Product_businessId_name_idx" ON "Product" ("businessId", "name");
CREATE INDEX "Product_businessId_sku_idx" ON "Product" ("businessId", "sku");
CREATE INDEX "Product_businessId_barcode_idx" ON "Product" ("businessId", "barcode");
CREATE INDEX "Sale_businessId_occurredAt_idx" ON "Sale" ("businessId", "occurredAt");
CREATE INDEX "Sale_customerId_occurredAt_idx" ON "Sale" ("customerId", "occurredAt");
CREATE INDEX "Purchase_businessId_occurredAt_idx" ON "Purchase" ("businessId", "occurredAt");
CREATE INDEX "Payment_businessId_occurredAt_idx" ON "Payment" ("businessId", "occurredAt");
CREATE INDEX "Payment_customerId_occurredAt_idx" ON "Payment" ("customerId", "occurredAt");
CREATE INDEX "Expense_businessId_occurredAt_idx" ON "Expense" ("businessId", "occurredAt");
CREATE INDEX "LedgerEntry_businessId_occurredAt_idx" ON "LedgerEntry" ("businessId", "occurredAt");
CREATE INDEX "LedgerEntry_customerId_occurredAt_idx" ON "LedgerEntry" ("customerId", "occurredAt");
CREATE INDEX "InventoryMovement_businessId_productId_occurredAt_idx" ON "InventoryMovement" ("businessId", "productId", "occurredAt");
CREATE INDEX "Reminder_businessId_dueAt_status_idx" ON "Reminder" ("businessId", "dueAt", "status");
CREATE INDEX "Alias_businessId_normalized_idx" ON "Alias" ("businessId", "normalized");
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage" ("conversationId", "createdAt");
CREATE INDEX "AIAction_businessId_createdAt_idx" ON "AIAction" ("businessId", "createdAt");
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog" ("businessId", "createdAt");
CREATE INDEX "Notification_businessId_createdAt_idx" ON "Notification" ("businessId", "createdAt");
CREATE INDEX "Quote_businessId_createdAt_idx" ON "Quote" ("businessId", "createdAt");
CREATE INDEX "SaleReturn_businessId_createdAt_idx" ON "SaleReturn" ("businessId", "createdAt");
CREATE INDEX "StockBatch_businessId_expiryAt_idx" ON "StockBatch" ("businessId", "expiryAt");
CREATE INDEX "ApprovalRequest_businessId_status_createdAt_idx" ON "ApprovalRequest" ("businessId", "status", "createdAt");
CREATE INDEX "ImportJob_businessId_status_createdAt_idx" ON "ImportJob" ("businessId", "status", "createdAt");
CREATE INDEX "CashSession_businessId_openedAt_idx" ON "CashSession" ("businessId", "openedAt");
CREATE INDEX "RecurringTransaction_businessId_nextRunAt_enabled_idx" ON "RecurringTransaction" ("businessId", "nextRunAt", "enabled");
CREATE INDEX "PaymentLink_businessId_status_createdAt_idx" ON "PaymentLink" ("businessId", "status", "createdAt");
CREATE INDEX "AIInsight_businessId_status_createdAt_idx" ON "AIInsight" ("businessId", "status", "createdAt");
CREATE INDEX "EntityResolutionEvent_businessId_createdAt_idx" ON "EntityResolutionEvent" ("businessId", "createdAt");
CREATE INDEX "WorkflowRun_businessId_workflow_createdAt_idx" ON "WorkflowRun" ("businessId", "workflow", "createdAt");
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessMemory" ADD CONSTRAINT "BusinessMemory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alias" ADD CONSTRAINT "Alias_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alias" ADD CONSTRAINT "Alias_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alias" ADD CONSTRAINT "Alias_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alias" ADD CONSTRAINT "Alias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IndustryConfig" ADD CONSTRAINT "IndustryConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SaleReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockSerial" ADD CONSTRAINT "StockSerial_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockSerial" ADD CONSTRAINT "StockSerial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntityResolutionEvent" ADD CONSTRAINT "EntityResolutionEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
