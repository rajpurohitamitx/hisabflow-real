import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSale, createPurchase, createExpense } from "@/lib/services/business";
import { Prisma } from "@prisma/client";

export async function POST(){
  try{
    const s=await requireSession();
    const existing=await db.businessMemory.findUnique({where:{businessId_key:{businessId:s.businessId,key:"demo.seed.v1"}}});
    if(existing?.active) return NextResponse.json({ok:true,message:"Demo business data is already loaded. Your existing records were not duplicated."});
    const D=Prisma.Decimal;
    const customers:any[]=[];
    for(const name of ["Arjun","Ramesh","Jinal","Suresh","Priya","Karthik","Meena","Rahul","Ananya","Vikram"]){
      customers.push(await db.customer.create({data:{businessId:s.businessId,name,address:name==="Arjun"?"Anna Nagar":null,phone:`90000${String(customers.length+1).padStart(5,'0')}`}}));
    }
    const products:any[]=[];
    for(const x of [
      ["Bajra","kg",750,600,40,10,"Grains"], ["Jawar","kg",680,520,35,8,"Grains"], ["Biscuits","piece",20,12,200,50,"Grocery"],
      ["Flowers","piece",50,25,80,20,"Puja"], ["Silver Chain","piece",24000,19000,12,3,"Jewellery"], ["Rice","kg",70,48,100,25,"Grocery"]
    ]){ const [name,unit,sell,cost,stock,reorder,category]=x as any[]; products.push(await db.product.create({data:{businessId:s.businessId,name,unit,sellingPrice:new D(sell),purchasePrice:new D(cost),stock:new D(stock),reorderPoint:new D(reorder),category,batchTracking:name==="Rice",expiryTracking:name==="Biscuits"}})); }
    for(const p of products) if(Number(p.stock)>0) await db.inventoryMovement.create({data:{businessId:s.businessId,productId:p.id,type:"ADJUSTMENT",quantity:p.stock,beforeStock:new D(0),afterStock:p.stock,referenceType:"DEMO",referenceId:"demo.seed.v1",note:"Demo opening stock"}});
    const suppliers=[]; for(const name of ["Sri Traders","Metro Wholesale","Lakshmi Suppliers"]){suppliers.push(await db.supplier.create({data:{businessId:s.businessId,name}}));}
    for(let i=0;i<12;i++){
      const c=customers[i%customers.length], p=products[i%products.length];
      const qty=p.unit==="piece"?2+(i%4):0.5+(i%5)*0.25;
      await createSale({businessId:s.businessId,userId:s.user.id,customerId:c.id,items:[{productId:p.id,quantity:qty,rate:Number(p.sellingPrice)}],payment:i%3===0?Number(p.sellingPrice)*qty*.5:0,paymentMethod:"CASH",source:"demo"});
    }
    for(let i=0;i<5;i++){
      const p=products[i%products.length], sup=suppliers[i%suppliers.length];
      await createPurchase({businessId:s.businessId,userId:s.user.id,supplierId:sup.id,items:[{productId:p.id,quantity:p.unit==="piece"?20:10,rate:Number(p.purchasePrice)}],payment:i%2?0:Number(p.purchasePrice)*2,paymentMethod:"CASH",source:"demo"});
    }
    for(const [category,amount] of [["Transport",1200],["Electricity",2800],["Packaging",650],["Flowers",500]] as any[]) await createExpense({businessId:s.businessId,userId:s.user.id,category,amount,description:"Demo expense",source:"demo"});
    const c=customers[0], p=products[4];
    await db.quote.create({data:{businessId:s.businessId,customerId:c.id,number:`QUO-DEMO-${Date.now()}`,subtotal:new D(Number(p.sellingPrice)*2),tax:new D(0),discount:new D(0),total:new D(Number(p.sellingPrice)*2),validUntil:new Date(Date.now()+7*86400000),notes:"Demo quotation",items:{create:[{productId:p.id,nameSnapshot:p.name,quantity:new D(2),rate:new D(Number(p.sellingPrice)),lineTotal:new D(Number(p.sellingPrice)*2)}]}}});
    await db.stockBatch.create({data:{businessId:s.businessId,productId:products[0].id,batchNumber:"DEMO-BATCH-01",quantity:new D(20),expiryAt:new Date(Date.now()+90*86400000),cost:products[0].purchasePrice}});
    await db.stockSerial.create({data:{businessId:s.businessId,productId:products[4].id,serial:"DEMO-SILVER-0001",status:"IN_STOCK"}});
    await db.approvalRequest.create({data:{businessId:s.businessId,requestedBy:s.user.id,type:"DEMO_SENSITIVE_ACTION",entityId:c.id,payload:{message:"Demo approval request"}}});
    await db.integrationConnection.create({data:{businessId:s.businessId,provider:"WhatsApp Demo",status:"DISCONNECTED",config:{demo:true}}});
    await db.importJob.create({data:{businessId:s.businessId,source:"CSV",fileName:"demo-import.csv",status:"COMPLETED",mapping:{demo:true}}});
    await db.cashSession.create({data:{businessId:s.businessId,openedBy:s.user.id,openingCash:new D(10000),notes:"Demo cash session"}});
    await db.recurringTransaction.create({data:{businessId:s.businessId,name:"Monthly shop rent",kind:"EXPENSE",amount:new D(15000),frequency:"MONTHLY",nextRunAt:new Date(Date.now()+7*86400000),config:{demo:true}}});
    await db.reminder.create({data:{businessId:s.businessId,customerId:c.id,title:"Follow up with Arjun",dueAt:new Date(Date.now()+86400000),channel:"in_app",notes:"Demo reminder"}});
    await db.businessMemory.create({data:{businessId:s.businessId,key:"demo.seed.v1",value:{loadedAt:new Date().toISOString()},source:"system",active:true}});
    return NextResponse.json({ok:true,message:"Demo business loaded: customers, products, suppliers, sales, purchases, payments, expenses, quotes, batches, serials, approvals, migration job, cash session, recurring automation and reminders are now populated."});
  }catch(e:any){return NextResponse.json({error:e.message||"Demo seed failed"},{status:400});}
}
