import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET(req:Request){try{const s=await requireSession();const u=new URL(req.url);const days=Math.min(Math.max(Number(u.searchParams.get("days")||30),1),365);const from=new Date();from.setDate(from.getDate()-days);from.setHours(0,0,0,0);
const [sales,purchases,expenses,payments,topProducts,topCustomers,low,overdue]=await Promise.all([
 db.sale.aggregate({where:{businessId:s.businessId,status:"CONFIRMED",occurredAt:{gte:from}},_sum:{total:true},_count:{_all:true}}),
 db.purchase.aggregate({where:{businessId:s.businessId,status:"CONFIRMED",occurredAt:{gte:from}},_sum:{total:true},_count:{_all:true}}),
 db.expense.aggregate({where:{businessId:s.businessId,occurredAt:{gte:from}},_sum:{amount:true},_count:{_all:true}}),
 db.payment.aggregate({where:{businessId:s.businessId,occurredAt:{gte:from}},_sum:{amount:true},_count:{_all:true}}),
 db.saleItem.groupBy({by:["productId"],where:{sale:{businessId:s.businessId,status:"CONFIRMED",occurredAt:{gte:from}}},_sum:{quantity:true,lineTotal:true},orderBy:{_sum:{lineTotal:"desc"}},take:10}),
 db.sale.groupBy({by:["customerId"],where:{businessId:s.businessId,status:"CONFIRMED",occurredAt:{gte:from},customerId:{not:null}},_sum:{total:true},orderBy:{_sum:{total:"desc"}},take:10}),
 db.product.findMany({where:{businessId:s.businessId,archived:false},orderBy:{stock:"asc"},take:20}),
 db.sale.count({where:{businessId:s.businessId,status:"CONFIRMED",balanceDue:{gt:0},occurredAt:{lt:new Date()}}})
]);
const productIds=topProducts.map(x=>x.productId);const customerIds=topCustomers.map(x=>x.customerId).filter(Boolean) as string[];const [products,customers]=await Promise.all([db.product.findMany({where:{id:{in:productIds}}}),db.customer.findMany({where:{id:{in:customerIds}}})]);const pm=new Map(products.map(x=>[x.id,x.name])),cm=new Map(customers.map(x=>[x.id,x.name]));
return NextResponse.json({period:{from,to:new Date(),days},sales:Number(sales._sum.total||0),purchases:Number(purchases._sum.total||0),expenses:Number(expenses._sum.amount||0),payments:Number(payments._sum.amount||0),invoiceCount:sales._count._all,purchaseCount:purchases._count._all,expenseCount:expenses._count._all,overdueInvoices:overdue,topProducts:topProducts.map(x=>({name:pm.get(x.productId)||x.productId,quantity:Number(x._sum.quantity||0),revenue:Number(x._sum.lineTotal||0)})),topCustomers:topCustomers.map(x=>({name:x.customerId?cm.get(x.customerId)||x.customerId:"Walk-in",revenue:Number(x._sum.total||0)})),lowStock:low.filter(x=>Number(x.stock)<=Number(x.reorderPoint)).map(x=>({id:x.id,name:x.name,stock:Number(x.stock),reorderPoint:Number(x.reorderPoint)}))});
}catch(e:any){return NextResponse.json({error:e.message||"Report failed"},{status:400})}}
