import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createExpense, receivePayment, createSale, createPurchase } from "@/lib/services/business";
import { customerBalance, dashboardSummary } from "@/lib/services/business";
import { money } from "@/lib/utils";
import { geminiJson, isGeminiEnabled } from "@/lib/ai/gemini";


async function bindCustomer(businessId:string,e:any,allowCreate:boolean){
  let customerId=typeof e.customerId==="string"?e.customerId:undefined;
  let customerName=String(e.customerName||e.customerQuery||e.proposedCustomerName||"").trim();
  if(customerName){
    const exact=await db.customer.findMany({where:{businessId,archived:false,name:{equals:customerName,mode:"insensitive"}},take:5});
    if(exact.length>1) return {error:`I found multiple customers named ${customerName}. Please choose one before continuing.`,matches:exact.map((x:any)=>({id:x.id,name:x.name,phone:x.phone,address:x.address}))};
    if(exact.length===1){
      customerId=exact[0].id; customerName=exact[0].name;
    } else if(allowCreate && e.createCustomer===true){
      const created=await db.customer.create({data:{businessId,name:customerName,phone:e.phone||undefined,email:e.email||undefined,address:e.address||e.proposedCustomerAddress||undefined}});
      customerId=created.id; customerName=created.name;
    } else {
      return {error:`I couldn't find ${customerName}. I won't use another customer or save this as a walk-in. Should I create ${customerName}?`,requiresCustomer:true,canCreateCustomer:true,proposedCustomerName:customerName};
    }
  } else if(customerId){
    const bound=await db.customer.findFirst({where:{id:customerId,businessId,archived:false},select:{id:true,name:true,phone:true,address:true}});
    if(!bound) return {error:"The selected customer no longer exists. Please choose the customer again.",requiresCustomer:true};
    customerName=bound.name;
  }
  return {customerId,customerName};
}

function OP_SAFE_CREATE(op:string){ return op === "CREATE"; }

export async function POST(req:Request){
  try{
    const s=await requireSession(); const {actionId,confirmed=false}=await req.json();
    const action=await db.aIAction.findFirst({where:{id:actionId,businessId:s.businessId}}); if(!action) return NextResponse.json({error:"AI action not found."},{status:404});
    if(action.status==="EXECUTED") return NextResponse.json({ok:true,result:action.result});
    if(action.risk!=="LOW"&&!confirmed) return NextResponse.json({error:"Confirmation required before this financial action.",requiresConfirmation:true,action},{status:409});
    const e=action.entities as any; let result:any;
    // Resolve the customer from the action's CURRENT explicit name before every
    // customer-sensitive operation. This blocks stale conversation IDs.
    const allowCustomerCreate=["RECEIVE_PAYMENT","CREATE_SALE","CREATE_PURCHASE","CREATE_REMINDER"].includes(action.intent);
    const boundCustomer=await bindCustomer(s.businessId,e,allowCustomerCreate);
    if((boundCustomer as any).error && ["RECEIVE_PAYMENT","CREATE_SALE","CUSTOMER_STATEMENT","CUSTOMER_BALANCE","CREATE_REMINDER","DELETE_CUSTOMER"].includes(action.intent)) return NextResponse.json(boundCustomer,{status:409});
    if((boundCustomer as any).customerId){ e.customerId=(boundCustomer as any).customerId; e.customerName=(boundCustomer as any).customerName; }
    if(action.intent === "MANAGE_ENTITY") {
      const op=String(e.operation||"UPDATE").toUpperCase();
      const type=String(e.entityType||"").toUpperCase();
      const fields=(e.fields&&typeof e.fields==="object")?e.fields:{};
      const name=String(e.name||e.customerName||e.productName||e.supplierName||e.query||"").trim();
      let entityId=String(e.entityId||e.customerId||e.productId||e.supplierId||"").trim();
      const fieldMap:any={
        CUSTOMER:["name","phone","email","address","gstin","notes","creditLimit"],
        PRODUCT:["name","sku","barcode","category","unit","purchasePrice","sellingPrice","reorderPoint","gstRate"],
        SUPPLIER:["name","phone","email","address","gstin","notes"],
        EXPENSE:["category","amount","description","paymentMethod","occurredAt"],
        REMINDER:["title","dueAt","channel","notes","status"]
      };
      if(!fieldMap[type]) return NextResponse.json({error:"I understood the action, but that record type is not safely editable yet."},{status:422});
      const allowed=fieldMap[type];
      const data:any={};
      for(const k of allowed) if(Object.prototype.hasOwnProperty.call(fields,k)) data[k]=fields[k];
      const decimalFields=new Set(["creditLimit","purchasePrice","sellingPrice","reorderPoint","gstRate","amount"]);
      for(const k of Object.keys(data)) if(decimalFields.has(k)) data[k]=new Prisma.Decimal(String(data[k]));
      if(data.paymentMethod) data.paymentMethod=String(data.paymentMethod).toUpperCase();
      if(data.dueAt) data.dueAt=new Date(data.dueAt);
      if(data.occurredAt) data.occurredAt=new Date(data.occurredAt);
      if(OP_SAFE_CREATE(op)) {
        if(type==="CUSTOMER") { if(!data.name) data.name=name; if(!data.name) throw new Error("Customer name is required."); result=await db.customer.create({data:{businessId:s.businessId,name:String(data.name),phone:data.phone||null,email:data.email||null,address:data.address||null,gstin:data.gstin||null,notes:data.notes||null,creditLimit:data.creditLimit||new Prisma.Decimal(0)}}); }
        else if(type==="PRODUCT") { if(!data.name) data.name=name; if(!data.name) throw new Error("Product name is required."); result=await db.product.create({data:{businessId:s.businessId,name:String(data.name),sku:data.sku||null,barcode:data.barcode||null,category:data.category||null,unit:data.unit||"piece",purchasePrice:data.purchasePrice||new Prisma.Decimal(0),sellingPrice:data.sellingPrice||new Prisma.Decimal(0),stock:data.stock?new Prisma.Decimal(String(data.stock)):new Prisma.Decimal(0),reorderPoint:data.reorderPoint||new Prisma.Decimal(0),gstRate:data.gstRate||new Prisma.Decimal(0)}}); }
        else if(type==="SUPPLIER") { if(!data.name) data.name=name; if(!data.name) throw new Error("Supplier name is required."); result=await db.supplier.create({data:{businessId:s.businessId,name:String(data.name),phone:data.phone||null,email:data.email||null,address:data.address||null,gstin:data.gstin||null,notes:data.notes||null}}); }
        else if(type==="EXPENSE") { if(data.amount==null||!data.category) throw new Error("Expense needs an amount and category."); result=await db.expense.create({data:{businessId:s.businessId,category:String(data.category),amount:data.amount,description:data.description||null,paymentMethod:data.paymentMethod||"CASH",occurredAt:data.occurredAt||new Date(),source:"ai"}}); }
        else if(type==="REMINDER") { if(!data.title||!data.dueAt) throw new Error("Reminder needs a title and due date."); result=await db.reminder.create({data:{businessId:s.businessId,title:String(data.title),dueAt:data.dueAt,channel:data.channel||"in_app",notes:data.notes||null,customerId:e.customerId||null}}); }
        result={message:`Done. ${type.toLowerCase()} created.`,record:result};
      } else {
        let row:any=null;
        if(!entityId && name){
          if(type==="CUSTOMER"){ const x=await db.customer.findMany({where:{businessId:s.businessId,archived:false,name:{equals:name,mode:"insensitive"}},take:5}); if(x.length===1) entityId=x[0].id; else if(x.length>1) return NextResponse.json({error:`I found multiple customers named ${name}. Please specify which one.` ,matches:x.map((z:any)=>({id:z.id,name:z.name,phone:z.phone,address:z.address}))},{status:409}); }
          if(type==="PRODUCT"){ const x=await db.product.findMany({where:{businessId:s.businessId,archived:false,name:{equals:name,mode:"insensitive"}},take:5}); if(x.length===1) entityId=x[0].id; else if(x.length>1) return NextResponse.json({error:`I found multiple products named ${name}. Please specify which one.`,matches:x.map((z:any)=>({id:z.id,name:z.name,sku:z.sku}))},{status:409}); }
          if(type==="SUPPLIER"){ const x=await db.supplier.findMany({where:{businessId:s.businessId,archived:false,name:{equals:name,mode:"insensitive"}},take:5}); if(x.length===1) entityId=x[0].id; else if(x.length>1) return NextResponse.json({error:`I found multiple suppliers named ${name}. Please specify which one.`,matches:x.map((z:any)=>({id:z.id,name:z.name,phone:z.phone}))},{status:409}); }
        }
        if(entityId){
          if(type==="CUSTOMER") row=await db.customer.findFirst({where:{id:entityId,businessId:s.businessId}});
          if(type==="PRODUCT") row=await db.product.findFirst({where:{id:entityId,businessId:s.businessId}});
          if(type==="SUPPLIER") row=await db.supplier.findFirst({where:{id:entityId,businessId:s.businessId}});
          if(type==="EXPENSE") row=await db.expense.findFirst({where:{id:entityId,businessId:s.businessId}});
          if(type==="REMINDER") row=await db.reminder.findFirst({where:{id:entityId,businessId:s.businessId}});
        }
        if(!row) return NextResponse.json({error:`I couldn't safely find that ${type.toLowerCase()}. Please specify its name or details.`},{status:409});
        if(op==="ARCHIVE") { if(!["CUSTOMER","PRODUCT","SUPPLIER"].includes(type)) return NextResponse.json({error:"Only customers, products and suppliers can be archived safely."},{status:422}); const data={archived:true}; result= type==="CUSTOMER"?await db.customer.update({where:{id:row.id},data}):type==="PRODUCT"?await db.product.update({where:{id:row.id},data}):await db.supplier.update({where:{id:row.id},data}); result={message:`${type[0]+type.slice(1).toLowerCase()} archived. Historical records remain intact.`,record:result}; }
        else if(op==="CANCEL" && type==="REMINDER") { result=await db.reminder.update({where:{id:row.id},data:{status:"CANCELLED"}}); result={message:"Reminder cancelled.",record:result}; }
        else if(op==="COMPLETE" && type==="REMINDER") { result=await db.reminder.update({where:{id:row.id},data:{status:"COMPLETED"}}); result={message:"Reminder marked complete.",record:result}; }
        else { if(!Object.keys(data).length) return NextResponse.json({error:"Tell me what should change."},{status:409}); if(type==="CUSTOMER") result=await db.customer.update({where:{id:row.id},data}); else if(type==="PRODUCT") result=await db.product.update({where:{id:row.id},data}); else if(type==="SUPPLIER") result=await db.supplier.update({where:{id:row.id},data}); else if(type==="EXPENSE") result=await db.expense.update({where:{id:row.id},data}); else result=await db.reminder.update({where:{id:row.id},data}); result={message:`Done. ${type.toLowerCase()} updated.`,record:result}; }
      }
      await db.aIAction.update({where:{id:action.id},data:{status:"EXECUTED",result:result as any}});
      await db.auditLog.create({data:{businessId:s.businessId,userId:s.user.id,actorType:"AI",action:"AI_ACTION_EXECUTED",entityType:"AIAction",entityId:action.id,after:result as any}});
      return NextResponse.json({ok:true,result});
    }
    switch(action.intent){
      case "RECEIVE_PAYMENT": {
        if(!e.amount) return NextResponse.json({error:"What amount did the customer pay?"},{status:409});
        const customerId=e.customerId as string|undefined;
        const customerName=String(e.customerName||"").trim();
        if(!customerId) return NextResponse.json({error:"Which customer should receive this payment?",requiresCustomer:true,matches:e.matches||[],canCreateCustomer:Boolean(e.proposedCustomerName)},{status:409});
        result=await receivePayment({businessId:s.businessId,userId:s.user.id,customerId,amount:e.amount,method:String(e.paymentMethod||"CASH").trim().toUpperCase() as any,source:"ai",applyToOutstanding:Boolean(e.applyToOutstanding)});
        result={message:`${money(e.amount)} received from ${customerName||"customer"}.`,payment:result,customerId,customerName}; break;
      }
      case "DELETE_CUSTOMER": {
        if(!e.customerId) return NextResponse.json({error:"Which customer should be archived?",requiresCustomer:true,matches:e.matches||[]},{status:409});
        const customer=await db.customer.findFirst({where:{id:e.customerId,businessId:s.businessId,archived:false}});
        if(!customer) return NextResponse.json({error:"Customer not found or already archived."},{status:404});
        const archived=await db.customer.update({where:{id:customer.id},data:{archived:true}});
        result={message:`${archived.name} has been archived. Historical sales and payments were kept intact.`,customer:archived};
        break;
      }
      case "CREATE_REMINDER": {
        const due=e.dueAt||e.fields?.dueAt;
        const title=String(e.title||e.fields?.title||"Customer follow-up").trim();
        if(!title||!due) return NextResponse.json({error:"Reminder needs a title and due date/time."},{status:409});
        const r=await db.reminder.create({data:{businessId:s.businessId,customerId:e.customerId||null,title,dueAt:new Date(due),channel:String(e.channel||e.fields?.channel||"in_app"),notes:e.notes||e.fields?.notes||null}});
        result={message:`Reminder “${title}” created for ${new Date(due).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})}.`,reminder:r};
        break;
      }
      case "CUSTOMER_STATEMENT":
        {if(!e.customerId)return NextResponse.json({error:"Which customer do you mean?",requiresCustomer:true,matches:e.matches||[]},{status:409});const customer=await db.customer.findFirst({where:{id:e.customerId,businessId:s.businessId},include:{sales:{orderBy:{occurredAt:"asc"}},payments:{orderBy:{occurredAt:"asc"}}}});if(!customer)return NextResponse.json({error:"Customer not found."},{status:404});const statement=[...customer.sales.map(x=>({date:x.occurredAt,type:"Invoice",reference:x.invoiceNumber,debit:Number(x.total),credit:0})),...customer.payments.map(x=>({date:x.occurredAt,type:"Payment",reference:x.id.slice(-8),debit:0,credit:Number(x.amount)}))].sort((a,b)=>+new Date(a.date)-+new Date(b.date));result={message:`Statement prepared for ${customer.name}.`,customer:customer.name,statement};}
        break;
      case "CREATE_EXPENSE":
        result=await createExpense({businessId:s.businessId,userId:s.user.id,category:e.category||"General",amount:e.amount,description:e.description,source:"ai"});
        result={message:`Expense of ${money(e.amount)} recorded.`,expense:result}; break;
      case "CUSTOMER_BALANCE":
        if(!e.customerId) return NextResponse.json({error:"Which customer do you mean?",matches:e.matches||[]},{status:409});
        result={message:`${e.customerName||"Customer"} outstanding is ${money(await customerBalance(s.businessId,e.customerId))}.`}; break;
      case "SALES_TODAY":
        {const d=await dashboardSummary(s.businessId);result={message:`Today's confirmed sales are ${money(d.sales)} across ${d.salesCount} invoices.`};} break;
      case "LOW_STOCK":
        {const products=await db.product.findMany({where:{businessId:s.businessId,archived:false},orderBy:{stock:"asc"},take:20});const low=products.filter(p=>p.stock.lte(p.reorderPoint));result={message:low.length?`${low.length} products are at or below reorder point.`:"No products are currently below their reorder point.",products:low};} break;
      case "DAILY_BRIEFING":
        {const d=await dashboardSummary(s.businessId);result={message:`Today: ${money(d.sales)} sales, ${money(d.received)} received, ${money(d.outstanding)} outstanding, ${d.lowStock} low-stock products and ${d.overdue} overdue invoices.`,summary:d};} break;
      case "OUTSTANDING_CUSTOMERS":
        {const rows=await db.customer.findMany({where:{businessId:s.businessId,archived:false},select:{id:true,name:true,phone:true},take:100});const enriched=await Promise.all(rows.map(async c=>({ ...c, outstanding:Number(await customerBalance(s.businessId,c.id)) })));const customers=enriched.filter(x=>x.outstanding>0).sort((a,b)=>b.outstanding-a.outstanding).slice(0,25);result={message:customers.length?`${customers.length} customers have outstanding balances.`:"No customer balances are currently outstanding.",customers};} break;
      case "SUPPLIER_DUES":
        {const rows=await db.supplier.findMany({where:{businessId:s.businessId,archived:false},select:{id:true,name:true,phone:true},take:100});const suppliers=await Promise.all(rows.map(async x=>{const [p,paid]=await Promise.all([db.purchase.aggregate({where:{businessId:s.businessId,supplierId:x.id},_sum:{total:true}}),db.payment.aggregate({where:{businessId:s.businessId,supplierId:x.id,kind:"SUPPLIER_PAYMENT"},_sum:{amount:true}})]);return {...x,outstanding:Number(p._sum.total||0)-Number(paid._sum.amount||0)}}));result={message:"Supplier balances calculated from recorded purchases and payments.",suppliers:suppliers.filter(x=>x.outstanding>0).sort((a,b)=>b.outstanding-a.outstanding)};} break;
      case "SALES_ANALYSIS": {
        const now=new Date();
        const startThis=new Date(now.getFullYear(),now.getMonth(),1);
        const startPrev=new Date(now.getFullYear(),now.getMonth()-1,1);
        const endPrev=startThis;
        const [current,previous,currentCount,previousCount,recent]=await Promise.all([
          db.sale.aggregate({where:{businessId:s.businessId,status:"CONFIRMED",occurredAt:{gte:startThis,lte:now}},_sum:{total:true}}),
          db.sale.aggregate({where:{businessId:s.businessId,status:"CONFIRMED",occurredAt:{gte:startPrev,lt:endPrev}},_sum:{total:true}}),
          db.sale.count({where:{businessId:s.businessId,status:"CONFIRMED",occurredAt:{gte:startThis,lte:now}}}),
          db.sale.count({where:{businessId:s.businessId,status:"CONFIRMED",occurredAt:{gte:startPrev,lt:endPrev}}}),
          db.sale.findMany({where:{businessId:s.businessId,status:"CONFIRMED",occurredAt:{gte:startThis,lte:now}},include:{items:{include:{product:true}},customer:{select:{name:true}}},orderBy:{occurredAt:"desc"},take:200})
        ]);
        const cur=Number(current._sum.total||0), prev=Number(previous._sum.total||0);
        const change=cur-prev, pct=prev?((change/prev)*100):null;
        const productMap=new Map<string,{name:string,revenue:number,quantity:number}>();
        for(const sale of recent){ for(const item of sale.items){ const name=item.nameSnapshot||item.product?.name||"Unknown product"; const row=productMap.get(name)||{name,revenue:0,quantity:0}; row.revenue+=Number(item.lineTotal||0); row.quantity+=Number(item.quantity||0); productMap.set(name,row); } }
        const topProducts=[...productMap.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,5);
        const direction=change>0?"increased":change<0?"decreased":"did not change";
        const pctText=pct===null?"there is no previous-month baseline":"that is "+Math.abs(pct).toFixed(1)+"% "+(change>0?"higher":change<0?"lower":"than");
        result={message:`Sales this month are ${money(cur)} across ${currentCount} invoices, versus ${money(prev)} across ${previousCount} invoices last month. Sales ${direction} by ${money(Math.abs(change))}; ${pctText}.`,currentSales:cur,previousSales:prev,change,pct,currentCount,previousCount,topProducts};
        break;
      }
      case "PROFIT_SUMMARY":
        {const [sales,purchases,expenses]=await Promise.all([db.sale.aggregate({where:{businessId:s.businessId,status:"CONFIRMED"},_sum:{total:true}}),db.purchase.aggregate({where:{businessId:s.businessId,status:"CONFIRMED"},_sum:{total:true}}),db.expense.aggregate({where:{businessId:s.businessId},_sum:{amount:true}})]);const revenue=Number(sales._sum.total||0),cost=Number(purchases._sum.total||0),expense=Number(expenses._sum.amount||0);result={message:`Recorded revenue is ${money(revenue)}, purchases are ${money(cost)}, expenses are ${money(expense)} and the simple operating difference is ${money(revenue-cost-expense)}.`,revenue,purchases:cost,expenses:expense,operatingDifference:revenue-cost-expense};} break;
      case "SEARCH_BUSINESS":
        {const q=String(e.query||"");const minAmount=e.minAmount!=null?Number(e.minAmount):null;const maxAmount=e.maxAmount!=null?Number(e.maxAmount):null;const purchaseWhere:any={businessId:s.businessId,referenceNumber:q?{contains:q,mode:"insensitive"}:undefined};const [customers,products,sales,purchases]=await Promise.all([db.customer.findMany({where:{businessId:s.businessId,archived:false,name:{contains:q,mode:"insensitive"}},take:10}),db.product.findMany({where:{businessId:s.businessId,archived:false,name:{contains:q,mode:"insensitive"}},take:10}),db.sale.findMany({where:{businessId:s.businessId,invoiceNumber:{contains:q,mode:"insensitive"}},take:10,orderBy:{occurredAt:"desc"}}),db.purchase.findMany({where:purchaseWhere,include:{supplier:{select:{name:true}},items:{include:{product:true}}},take:50,orderBy:{occurredAt:"desc"}})]);const filteredPurchases=purchases.filter((x:any)=>(minAmount==null||Number(x.total)>=minAmount)&&(maxAmount==null||Number(x.total)<=maxAmount));result={message:`Search completed for “${q}”.`,customers,products,sales,purchases:filteredPurchases};} break;
      case "GENERAL_BUSINESS_QUERY": {
        const d=await dashboardSummary(s.businessId);
        if(isGeminiEnabled()){
          const [customers,products,sales,purchases,expenses]=await Promise.all([
            db.customer.findMany({where:{businessId:s.businessId,archived:false},select:{name:true,phone:true},take:100}),
            db.product.findMany({where:{businessId:s.businessId,archived:false},select:{name:true,stock:true,reorderPoint:true},take:100}),
            db.sale.findMany({where:{businessId:s.businessId,status:"CONFIRMED"},select:{occurredAt:true,total:true,customer:{select:{name:true}}},orderBy:{occurredAt:"desc"},take:50}),
            db.purchase.findMany({where:{businessId:s.businessId,status:"CONFIRMED"},include:{supplier:{select:{name:true}},items:{select:{nameSnapshot:true,quantity:true,rate:true,lineTotal:true,product:{select:{name:true,sku:true}}}}},orderBy:{occurredAt:"desc"},take:100}),
            db.expense.findMany({where:{businessId:s.businessId},select:{occurredAt:true,amount:true,category:true},orderBy:{occurredAt:"desc"},take:50}),
          ]);
          const answer=await geminiJson([{role:"user",content:`You are Hisab Flow's business answer layer. Answer the user's question naturally and concisely using ONLY the supplied live business context. Do not invent facts. If the data is insufficient, say what is missing. User question: ${String(e.query||"")}\nLive dashboard: ${JSON.stringify(d)}\nRecent customers: ${JSON.stringify(customers)}\nProducts/stock: ${JSON.stringify(products)}\nRecent sales: ${JSON.stringify(sales)}\nRecent purchases: ${JSON.stringify(purchases)}\nIf the question asks for purchases above/below an amount, filter the supplied purchase records by their total or matching item amounts before answering. If it asks for a purchase order for a product, inspect purchase items and return reference number, date, supplier and matching items.\nRecent expenses: ${JSON.stringify(expenses)}\nReturn JSON: {"message":"string"}`}]);
          result={message:String(answer?.message||"I found the relevant business data, but I couldn't summarize it yet.")};
        } else result={message:`Current recorded sales are ${money(d.sales)} and outstanding is ${money(d.outstanding)}.`};
        break;
      }
      case "CREATE_SALE": {
        if(!e.items?.length) return NextResponse.json({error:"I understood the sale, but need the product and quantity.",needsDetails:true},{status:409});
        const customerId=e.customerId as string|undefined;
        const customerName=String(e.customerName||"").trim();
        if(!customerId) return NextResponse.json({error:"Which customer is this sale for? I won't save this as a walk-in sale.",requiresCustomer:true,proposedCustomerName:e.proposedCustomerName},{status:409});
        result=await createSale({businessId:s.businessId,userId:s.user.id,customerId:customerId||undefined,items:e.items,payment:e.payment||0,paymentMethod:String(e.paymentMethod||"CASH").trim().toUpperCase() as any,occurredAt:e.occurredAt?new Date(e.occurredAt):undefined,notes:e.notes,source:"ai"});
        result={message:`Sale ${result.invoiceNumber} created for ${money(result.total)}${customerName?` for ${customerName}`:""}. Outstanding: ${money(result.balanceDue)}.`,sale:result,customerId,customerName};
        break;
      }
      case "CREATE_PURCHASE": {
        if(!e.items?.length) return NextResponse.json({error:"I understood the purchase, but need the product and quantity.",needsDetails:true},{status:409});
        result=await createPurchase({businessId:s.businessId,userId:s.user.id,supplierId:e.supplierId||undefined,items:e.items,payment:e.payment||0,paymentMethod:String(e.paymentMethod||"CASH").trim().toUpperCase() as any,occurredAt:e.occurredAt?new Date(e.occurredAt):undefined,source:"ai"});
        result={message:`Purchase ${result.referenceNumber} recorded for ${money(result.total)}.`,purchase:result};
        break;
      }
      case "ADJUST_STOCK": {
        if(!e.productId||!e.quantity) return NextResponse.json({error:"Stock adjustment needs a product and quantity."},{status:409});
        const p=await db.product.findFirst({where:{id:e.productId,businessId:s.businessId,archived:false}}); if(!p)return NextResponse.json({error:"Product not found."},{status:404});
        const delta=Number(e.quantity)*(String(e.direction||"add").toLowerCase().includes("remove")||String(e.direction||"").includes("out")?-1:1); const after=Number(p.stock)+delta; if(after<0)return NextResponse.json({error:"This would make stock negative."},{status:409});
        const updated=await db.$transaction(async tx=>{const x=await tx.product.update({where:{id:p.id},data:{stock:after}});await tx.inventoryMovement.create({data:{businessId:s.businessId,productId:p.id,type:"ADJUSTMENT",quantity:delta,beforeStock:p.stock,afterStock:after,referenceType:"AI",referenceId:action.id,note:"AI stock adjustment"}});return x}); result={message:`${updated.name} stock is now ${updated.stock}.`,product:updated}; break;
      }
      default: return NextResponse.json({error:"This intent is not executable yet. The UI will not pretend it is complete."},{status:422});
    }
    await db.aIAction.update({where:{id:action.id},data:{status:"EXECUTED",result:result as any}});
    await db.auditLog.create({data:{businessId:s.businessId,userId:s.user.id,actorType:"AI",action:"AI_ACTION_EXECUTED",entityType:"AIAction",entityId:action.id,after:result as any}});
    return NextResponse.json({ok:true,result});
  }catch(e:any){return NextResponse.json({error:e.message},{status:400});}
}
