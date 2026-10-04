import { Prisma, PaymentMethod, PaymentKind, InventoryMovementType } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";

function normalizePaymentMethod(value: unknown): PaymentMethod {
  const v = String(value ?? "CASH").trim().toUpperCase();
  if (v === "CASH" || v === "UPI" || v === "CARD" || v === "BANK" || v === "OTHER") return v as PaymentMethod;
  if (v === "ONLINE" || v === "NETBANKING" || v === "NET_BANKING") return PaymentMethod.BANK;
  return PaymentMethod.CASH;
}
const D = Prisma.Decimal;

function dec(v: unknown) { const n = Number(v); if (!Number.isFinite(n) || n < 0) throw new Error("Invalid amount or quantity."); return new D(String(v)); }
function invoiceNo() { return `INV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*900+100)}`; }

export async function createSale(input: { businessId:string; userId?:string; customerId?:string|null; items:{productId:string; quantity:number|string; rate?:number|string}[]; payment?:number|string; paymentMethod?:PaymentMethod|string; occurredAt?:Date; notes?:string; source?:string; }) {
  if (!input.items?.length) throw new Error("At least one product is required.");
  const result = await db.$transaction(async tx => {
    if(input.customerId){const customer=await tx.customer.findFirst({where:{id:input.customerId,businessId:input.businessId,archived:false}});if(!customer)throw new Error("Customer is not part of this business.");}
    const items: { productId:string; nameSnapshot:string; quantity:Prisma.Decimal; rate:Prisma.Decimal; lineTotal:Prisma.Decimal }[] = [];
    let subtotal = new D(0);
    for (const raw of input.items) {
      const product = await tx.product.findFirst({ where: { id: raw.productId, businessId: input.businessId, archived:false } });
      if (!product) throw new Error("Product not found.");
      const quantity = dec(raw.quantity); if (quantity.lte(0)) throw new Error("Quantity must be greater than zero.");
      if (product.stock.lt(quantity)) throw new Error(`${product.name} has only ${product.stock.toString()} ${product.unit} in stock.`);
      const rate = raw.rate !== undefined ? dec(raw.rate) : product.sellingPrice;
      const lineTotal = quantity.mul(rate);
      subtotal = subtotal.add(lineTotal);
      items.push({ productId:product.id, nameSnapshot:product.name, quantity, rate, lineTotal });
    }
    const payment = dec(input.payment ?? 0);
    if (payment.gt(subtotal)) throw new Error("Payment cannot exceed the sale total. Record the excess as an advance if intended.");
    const sale = await tx.sale.create({ data: { businessId:input.businessId, customerId:input.customerId || undefined, invoiceNumber:invoiceNo(), subtotal, tax:new D(0), discount:new D(0), total:subtotal, amountPaid:payment, balanceDue:subtotal.sub(payment), occurredAt:input.occurredAt || new Date(), notes:input.notes, source:input.source || "manual", items:{create:items} }, include:{items:true,customer:true} });
    for (const item of items) {
      const product = await tx.product.findUniqueOrThrow({where:{id:item.productId}});
      const before = product.stock, after = before.sub(item.quantity);
      await tx.product.update({where:{id:product.id},data:{stock:after}});
      await tx.inventoryMovement.create({data:{businessId:input.businessId,productId:product.id,saleId:sale.id,type:InventoryMovementType.SALE,quantity:item.quantity.neg(),beforeStock:before,afterStock:after,referenceType:"SALE",referenceId:sale.id,occurredAt:sale.occurredAt}});
    }
    if (input.customerId && sale.total.gt(0)) await tx.ledgerEntry.create({data:{businessId:input.businessId,customerId:input.customerId,saleId:sale.id,type:"RECEIVABLE",debit:sale.total,credit:new D(0),description:`Sale ${sale.invoiceNumber}`,occurredAt:sale.occurredAt}});
    if (payment.gt(0)) {
      const p = await tx.payment.create({data:{businessId:input.businessId,customerId:input.customerId || undefined,saleId:sale.id,amount:payment,method:normalizePaymentMethod(input.paymentMethod),kind:PaymentKind.CUSTOMER_RECEIPT,occurredAt:sale.occurredAt,source:input.source || "manual"}});
      await tx.paymentAllocation.create({data:{paymentId:p.id,saleId:sale.id,amount:payment}});
      if (input.customerId) await tx.ledgerEntry.create({data:{businessId:input.businessId,customerId:input.customerId,paymentId:p.id,saleId:sale.id,type:"RECEIVABLE",debit:new D(0),credit:payment,description:`Payment for ${sale.invoiceNumber}`,occurredAt:sale.occurredAt}});
    }
    return sale;
  });
  await audit({businessId:input.businessId,userId:input.userId,action:"SALE_CREATED",entityType:"Sale",entityId:result.id,after:result,metadata:{source:input.source || "manual"}});
  return result;
}

export async function receivePayment(input:{businessId:string;userId?:string;customerId?:string;supplierId?:string;amount:number|string;method?:PaymentMethod|string;saleId?:string;purchaseId?:string;occurredAt?:Date;notes?:string;source?:string;}) {
  const amount = dec(input.amount); if (amount.lte(0)) throw new Error("Payment must be greater than zero.");
  if (!input.customerId && !input.supplierId) throw new Error("Customer or supplier is required.");
  if (input.customerId && input.supplierId) throw new Error("Choose either customer or supplier, not both.");
  const result = await db.$transaction(async tx => {
    let saleId = input.saleId;
    let kind: PaymentKind = PaymentKind.CUSTOMER_RECEIPT;
    if (input.customerId) {
      const customer = await tx.customer.findFirst({where:{id:input.customerId,businessId:input.businessId,archived:false}});
      if(!customer) throw new Error("Customer is not part of this business.");
      if (saleId) {
        const sale = await tx.sale.findFirst({where:{id:saleId,businessId:input.businessId,customerId:input.customerId,status:"CONFIRMED"}});
        if (!sale) throw new Error("Sale not found for this customer.");
      } else {
        const openSales = await tx.sale.findMany({where:{businessId:input.businessId,customerId:input.customerId,status:"CONFIRMED",balanceDue:{gt:0}},orderBy:{occurredAt:"asc"}});
        let remaining = amount;
        for (const sale of openSales) {
          if (remaining.lte(0)) break;
          const alloc = remaining.lt(sale.balanceDue) ? remaining : sale.balanceDue;
          await tx.sale.update({where:{id:sale.id},data:{amountPaid:{increment:alloc},balanceDue:{decrement:alloc}}});
          const p = await tx.payment.create({data:{businessId:input.businessId,customerId:input.customerId,saleId:sale.id,amount:alloc,method:normalizePaymentMethod(input.method),kind,occurredAt:input.occurredAt || new Date(),notes:input.notes,source:input.source || "manual"}});
          await tx.paymentAllocation.create({data:{paymentId:p.id,saleId:sale.id,amount:alloc}});
          await tx.ledgerEntry.create({data:{businessId:input.businessId,customerId:input.customerId,paymentId:p.id,saleId:sale.id,type:"RECEIVABLE",debit:new D(0),credit:alloc,description:`Payment received for ${sale.invoiceNumber}`,occurredAt:p.occurredAt}});
          remaining = remaining.sub(alloc);
        }
        if (remaining.gt(0)) {
          const p = await tx.payment.create({data:{businessId:input.businessId,customerId:input.customerId,amount:remaining,method:normalizePaymentMethod(input.method),kind:PaymentKind.ADVANCE,occurredAt:input.occurredAt || new Date(),notes:input.notes || "Customer advance",source:input.source || "manual"}});
          await tx.ledgerEntry.create({data:{businessId:input.businessId,customerId:input.customerId,paymentId:p.id,type:"RECEIVABLE",debit:new D(0),credit:remaining,description:"Customer advance",occurredAt:p.occurredAt}});
        }
        return { amount: amount.toString(), allocated: amount.sub(remainingAfter(openSales, amount)).toString(), customerId:input.customerId };
      }
    }
    if (input.supplierId) { const supplier=await tx.supplier.findFirst({where:{id:input.supplierId,businessId:input.businessId,archived:false}}); if(!supplier) throw new Error("Supplier is not part of this business."); kind = PaymentKind.SUPPLIER_PAYMENT; }
    const p = await tx.payment.create({data:{businessId:input.businessId,customerId:input.customerId,supplierId:input.supplierId,saleId,purchaseId:input.purchaseId,amount,method:normalizePaymentMethod(input.method),kind,occurredAt:input.occurredAt || new Date(),notes:input.notes,source:input.source || "manual"}});
    if (input.saleId && input.customerId) {
      const sale = await tx.sale.findUniqueOrThrow({where:{id:input.saleId}});
      if (amount.gt(sale.balanceDue)) throw new Error("Payment exceeds this invoice balance. Use customer outstanding allocation or advance.");
      await tx.sale.update({where:{id:sale.id},data:{amountPaid:{increment:amount},balanceDue:{decrement:amount}}});
      await tx.paymentAllocation.create({data:{paymentId:p.id,saleId:sale.id,amount}});
    }
    if (input.customerId) await tx.ledgerEntry.create({data:{businessId:input.businessId,customerId:input.customerId,paymentId:p.id,saleId:input.saleId,type:"RECEIVABLE",debit:new D(0),credit:amount,description:"Payment received",occurredAt:p.occurredAt}});
    if (input.supplierId) await tx.ledgerEntry.create({data:{businessId:input.businessId,supplierId:input.supplierId,paymentId:p.id,purchaseId:input.purchaseId,type:"PAYABLE",debit:amount,credit:new D(0),description:"Supplier payment",occurredAt:p.occurredAt}});
    return p;
  });
  await audit({businessId:input.businessId,userId:input.userId,action:"PAYMENT_RECEIVED",entityType:"Payment",entityId:(result as any).id,after:result,metadata:{source:input.source || "manual"}});
  return result;
}

function remainingAfter(openSales: {balanceDue: Prisma.Decimal}[], amount: Prisma.Decimal) {
  let remaining=amount; for(const sale of openSales){ if(remaining.lte(0)) break; remaining=remaining.sub(remaining.lt(sale.balanceDue)?remaining:sale.balanceDue); } return remaining;
}

export async function createPurchase(input:{businessId:string;userId?:string;supplierId?:string|null;items:{productId:string;quantity:number|string;rate?:number|string}[];payment?:number|string;paymentMethod?:PaymentMethod|string;occurredAt?:Date;source?:string;}) {
  if(!input.items?.length) throw new Error("At least one product is required.");
  const result=await db.$transaction(async tx=>{
    const items:any[]=[]; let subtotal=new D(0);
    for(const raw of input.items){
      const product=await tx.product.findFirst({where:{id:raw.productId,businessId:input.businessId,archived:false}}); if(!product) throw new Error("Product not found.");
      const quantity=dec(raw.quantity); if(quantity.lte(0)) throw new Error("Quantity must be greater than zero.");
      const rate=raw.rate!==undefined?dec(raw.rate):product.purchasePrice; const lineTotal=quantity.mul(rate); subtotal=subtotal.add(lineTotal); items.push({productId:product.id,nameSnapshot:product.name,quantity,rate,lineTotal});
    }
    const payment=dec(input.payment||0); if(payment.gt(subtotal)) throw new Error("Payment cannot exceed purchase total.");
    const purchase=await tx.purchase.create({data:{businessId:input.businessId,supplierId:input.supplierId||undefined,referenceNumber:`PUR-${Date.now().toString(36).toUpperCase()}`,subtotal,tax:new D(0),total:subtotal,amountPaid:payment,balanceDue:subtotal.sub(payment),occurredAt:input.occurredAt||new Date(),source:input.source||"manual",items:{create:items}}});
    for(const item of items){const product=await tx.product.findUniqueOrThrow({where:{id:item.productId}});const before=product.stock,after=before.add(item.quantity);await tx.product.update({where:{id:product.id},data:{stock:after,purchasePrice:item.rate}});await tx.inventoryMovement.create({data:{businessId:input.businessId,productId:product.id,purchaseId:purchase.id,type:InventoryMovementType.PURCHASE,quantity:item.quantity,beforeStock:before,afterStock:after,referenceType:"PURCHASE",referenceId:purchase.id,occurredAt:purchase.occurredAt}})}
    if(input.supplierId) await tx.ledgerEntry.create({data:{businessId:input.businessId,supplierId:input.supplierId,purchaseId:purchase.id,type:"PAYABLE",debit:new D(0),credit:purchase.total,description:`Purchase ${purchase.referenceNumber}`,occurredAt:purchase.occurredAt}});
    if(payment.gt(0)){const p=await tx.payment.create({data:{businessId:input.businessId,supplierId:input.supplierId||undefined,purchaseId:purchase.id,amount:payment,method:normalizePaymentMethod(input.paymentMethod),kind:PaymentKind.SUPPLIER_PAYMENT,occurredAt:purchase.occurredAt,source:input.source||"manual"}});if(input.supplierId)await tx.ledgerEntry.create({data:{businessId:input.businessId,supplierId:input.supplierId,paymentId:p.id,purchaseId:purchase.id,type:"PAYABLE",debit:payment,credit:new D(0),description:`Payment for ${purchase.referenceNumber}`,occurredAt:p.occurredAt}})}
    return purchase;
  });
  await audit({businessId:input.businessId,userId:input.userId,action:"PURCHASE_CREATED",entityType:"Purchase",entityId:result.id,after:result});return result;
}

export async function createExpense(input:{businessId:string;userId?:string;category:string;amount:number|string;description?:string;paymentMethod?:PaymentMethod|string;occurredAt?:Date;source?:string;}) {
  const amount=dec(input.amount); if(amount.lte(0)) throw new Error("Expense must be greater than zero.");
  const expense=await db.expense.create({data:{businessId:input.businessId,category:input.category.trim()||"General",amount,description:input.description,paymentMethod:normalizePaymentMethod(input.paymentMethod),occurredAt:input.occurredAt||new Date(),source:input.source||"manual"}});
  await audit({businessId:input.businessId,userId:input.userId,action:"EXPENSE_CREATED",entityType:"Expense",entityId:expense.id,after:expense});
  return expense;
}

export async function customerBalance(businessId:string, customerId:string) {
  const [debits, credits] = await Promise.all([
    db.ledgerEntry.aggregate({where:{businessId,customerId,type:"RECEIVABLE"},_sum:{debit:true}}),
    db.ledgerEntry.aggregate({where:{businessId,customerId,type:"RECEIVABLE"},_sum:{credit:true}}),
  ]);
  return new D(debits._sum.debit || 0).sub(credits._sum.credit || 0);
}

export async function dashboardSummary(businessId:string) {
  const start=new Date(); start.setHours(0,0,0,0);
  const [sales,received,expenses,stock,customers,overdue,lowStock] = await Promise.all([
    db.sale.aggregate({where:{businessId,status:"CONFIRMED",occurredAt:{gte:start}},_sum:{total:true},_count:{_all:true}}),
    db.payment.aggregate({where:{businessId,kind:"CUSTOMER_RECEIPT",occurredAt:{gte:start}},_sum:{amount:true},_count:{_all:true}}),
    db.expense.aggregate({where:{businessId,occurredAt:{gte:start}},_sum:{amount:true},_count:{_all:true}}),
    db.product.aggregate({where:{businessId,archived:false},_sum:{stock:true},_count:{_all:true}}),
    db.customer.count({where:{businessId,archived:false}}),
    db.sale.count({where:{businessId,status:"CONFIRMED",balanceDue:{gt:0},occurredAt:{lt:start}}}),
    db.$queryRaw<Array<{count:string}>>`SELECT COUNT(*)::text AS count FROM "Product" WHERE "businessId"=${businessId} AND archived=false AND stock <= "reorderPoint"`,
  ]);
  const inventoryValue = await db.$queryRaw<Array<{value:string}>>`SELECT COALESCE(SUM(stock * "purchasePrice"),0)::text AS value FROM "Product" WHERE "businessId"=${businessId} AND archived=false`;
  const outstanding = await db.$queryRaw<Array<{value:string}>>`SELECT COALESCE(SUM("balanceDue"),0)::text AS value FROM "Sale" WHERE "businessId"=${businessId} AND status='CONFIRMED'`;
  return {sales:Number(sales._sum.total||0),salesCount:sales._count._all,received:Number(received._sum.amount||0),receivedCount:received._count._all,expenses:Number(expenses._sum.amount||0),stockValue:Number(inventoryValue[0]?.value||0),stockUnits:Number(stock._sum.stock||0),customers,overdue,lowStock:Number(lowStock[0]?.count||0),outstanding:Number(outstanding[0]?.value||0)};
}
