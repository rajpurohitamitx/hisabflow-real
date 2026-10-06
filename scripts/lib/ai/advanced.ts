import OpenAI from "openai";
import { db } from "@/lib/db";
import { normalize } from "@/lib/utils";

export type RiskFlag = { type:string; severity:"LOW"|"MEDIUM"|"HIGH"; score:number; message:string; evidence:any };
export type ForecastPoint = { date:string; actual:number; forecast:number; lower:number; upper:number; method:string };

const num=(v:any)=>Number(v||0);
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const std=(xs:number[])=>{const m=avg(xs);return Math.sqrt(avg(xs.map(x=>(x-m)**2)))||0};

export async function buildForecast(businessId:string, days=30){
  const end=new Date(); end.setHours(23,59,59,999);
  const start=new Date(end); start.setDate(start.getDate()-Math.max(90,days*3)); start.setHours(0,0,0,0);
  const rows=await db.sale.findMany({where:{businessId,status:"CONFIRMED",occurredAt:{gte:start,lte:end}},select:{occurredAt:true,total:true},orderBy:{occurredAt:"asc"}});
  const daily=new Map<string,number>();
  for(const r of rows){const k=r.occurredAt.toISOString().slice(0,10);daily.set(k,(daily.get(k)||0)+num(r.total));}
  const history:number[]=[]; const points:ForecastPoint[]=[];
  for(let i=0;i<Math.max(90,days*3);i++){const d=new Date(start);d.setDate(start.getDate()+i);const k=d.toISOString().slice(0,10);history.push(daily.get(k)||0);}
  const recent=history.slice(-28); const weekly=history.length>=56?history.slice(-56,-28):[];
  const baseline=avg(recent); const trend=recent.length>7?(avg(recent.slice(-7))-avg(recent.slice(0,7)))/7:0;
  const weekdayTotals=new Map<number,number[]>(); history.forEach((v,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const k=d.getDay();const a=weekdayTotals.get(k)||[];a.push(v);weekdayTotals.set(k,a);});
  const overall=avg(history)||baseline;
  const seasonal=(dow:number)=>{const a=weekdayTotals.get(dow)||[];const m=avg(a);return overall?Math.max(.65,Math.min(1.5,m/overall)):1;};
  const noise=Math.max(std(recent)*1.28,baseline*.15);
  for(let i=1;i<=days;i++){
    const d=new Date(end);d.setDate(end.getDate()+i); const forecast=Math.max(0,(baseline+trend*i)*seasonal(d.getDay())); points.push({date:d.toISOString().slice(0,10),actual:0,forecast,lower:Math.max(0,forecast-noise),upper:forecast+noise,method:weekly.length?"28-day level + trend":"28-day level"});
  }
  return {history:history.slice(-90),historyStart:start.toISOString().slice(0,10),baseline,trend,points,confidence:Math.max(0.35,Math.min(0.9,1/(1+std(recent)/(baseline||1))))};
}

export async function detectAnomalies(businessId:string, days=60):Promise<RiskFlag[]>{
  const end=new Date(); const start=new Date(end);start.setDate(end.getDate()-days);start.setHours(0,0,0,0);
  const [sales,expenses,payments]=await Promise.all([
    db.sale.findMany({where:{businessId,status:"CONFIRMED",occurredAt:{gte:start}},select:{id:true,total:true,occurredAt:true,customerId:true},orderBy:{occurredAt:"asc"}}),
    db.expense.findMany({where:{businessId,occurredAt:{gte:start}},select:{id:true,amount:true,category:true,occurredAt:true},orderBy:{occurredAt:"asc"}}),
    db.payment.findMany({where:{businessId,occurredAt:{gte:start}},select:{id:true,amount:true,occurredAt:true,customerId:true},orderBy:{occurredAt:"asc"}})
  ]);
  const flags:RiskFlag[]=[];
  const byDay=(rows:any[],field:string)=>{const m=new Map<string,number>();for(const r of rows){const k=r.occurredAt.toISOString().slice(0,10);m.set(k,(m.get(k)||0)+num(r[field]));}return [...m.values()];};
  const checks:[string,number[]][]=[["sales",byDay(sales,"total")],["expenses",byDay(expenses,"amount")],["collections",byDay(payments,"amount")]];
  for(const [name,vals] of checks){if(vals.length<10)continue;const base=vals.slice(0,-1),last=vals.at(-1)||0,m=avg(base),s=std(base);if(s>0&&Math.abs(last-m)>Math.max(2.5*s,m*.75))flags.push({type:"DAILY_SPIKE",severity:"MEDIUM",score:Math.min(1,Math.abs(last-m)/(s*4)),message:`Unusual ${name} activity: latest daily value is ${last.toFixed(0)} vs normal average ${m.toFixed(0)}.`,evidence:{last,average:m,std:s}});}
  const customerCounts=new Map<string,number>();for(const p of payments){if(p.customerId)customerCounts.set(p.customerId,(customerCounts.get(p.customerId)||0)+1)}
  const duplicatePayments=payments.filter(p=>num(p.amount)>0).filter((p,i,a)=>a.findIndex(x=>x.customerId===p.customerId&&x.occurredAt.getTime()===p.occurredAt.getTime()&&num(x.amount)===num(p.amount))!==i);
  if(duplicatePayments.length)flags.push({type:"DUPLICATE_PAYMENT_PATTERN",severity:"HIGH",score:Math.min(1,duplicatePayments.length/3),message:`${duplicatePayments.length} possible duplicate payment record(s) detected. Review before reconciliation.`,evidence:duplicatePayments.slice(0,10).map(x=>({id:x.id,amount:num(x.amount)}))});
  return flags.sort((a,b)=>b.score-a.score);
}

export async function learnBusinessMemory(businessId:string){
  const [business,products,customers,suppliers,memories]=await Promise.all([
    db.business.findUnique({where:{id:businessId},select:{businessType:true,name:true}}),
    db.product.findMany({where:{businessId,archived:false},select:{id:true,name:true,unit:true,reorderPoint:true,stock:true,category:true},take:500}),
    db.customer.findMany({where:{businessId,archived:false},select:{id:true,name:true,phone:true},take:500}),
    db.supplier.findMany({where:{businessId,archived:false},select:{id:true,name:true,phone:true},take:500}),
    db.businessMemory.findMany({where:{businessId,active:true},take:200})
  ]);
  const additions:any[]=[];
  const ensure=async(key:string,value:string,source:string,confidence:number)=>{
    const exists=memories.find(m=>m.key===key&&m.value===value);if(exists)return;
    await db.businessMemory.create({data:{businessId,key,value,scope:"BUSINESS",active:true,source}});additions.push({key,value});
  };
  for(const p of products){if(p.unit)await ensure(`product.unit.${p.id}`,p.unit,"observed",0.98);if(Number(p.reorderPoint)>0)await ensure(`product.reorder.${p.id}`,String(p.reorderPoint),"observed",0.98);}
  if(business?.businessType)await ensure("industry",business.businessType,"business_profile",1);
  return {learned:additions.length,additions};
}

export async function resolveEntityAdvanced(businessId:string, kind:"customer"|"product"|"supplier", query:string){
  const q=normalize(query); if(!q)return {selected:null,matches:[],confidence:0,needsClarification:true};
  const where:any={businessId,archived:false};
  const rows:any[]=kind==="customer"?await db.customer.findMany({where:{...where,OR:[{name:{contains:query,mode:"insensitive"}},{phone:{contains:query}},{aliases:{some:{normalized:q}}}]},take:20}):kind==="supplier"?await db.supplier.findMany({where:{...where,OR:[{name:{contains:query,mode:"insensitive"}},{phone:{contains:query}},{aliases:{some:{normalized:q}}}]},take:20}):await db.product.findMany({where:{...where,OR:[{name:{contains:query,mode:"insensitive"}},{sku:{contains:query,mode:"insensitive"}},{barcode:{contains:query}},{aliases:{some:{normalized:q}}}]},take:20});
  const scored=rows.map(r=>{const name=normalize(r.name);let score=0;if(name===q)score=1;else if(name.startsWith(q))score=.9;else if(name.includes(q))score=.75;else score=.55;return {...r,_score:score};}).sort((a,b)=>b._score-a._score);
  const top=scored[0]?scored[0]._score:0;const second=scored[1]?scored[1]._score:0;const selected=top>=.9&&(top-second>=.08||scored.length===1)?scored[0]:null;
  return {selected,matches:scored.slice(0,8),confidence:selected?top:Math.max(0,top-.15),needsClarification:!selected};
}

export async function generateProactiveRecommendations(businessId:string){
  const [forecast,anomalies,dash,lowStock,overdue]=await Promise.all([
    buildForecast(businessId,14),detectAnomalies(businessId,60),
    (async()=>{const {dashboardSummary}=await import("@/lib/services/business");return dashboardSummary(businessId)})(),
    db.product.findMany({where:{businessId,archived:false,reorderPoint:{gt:0}},select:{id:true,name:true,stock:true,reorderPoint:true},take:20}).catch(()=>[] as any[]),
    db.sale.findMany({where:{businessId,status:"CONFIRMED",balanceDue:{gt:0}},select:{id: true,invoiceNumber:true,balanceDue:true,occurredAt:true,customerId:true},orderBy:{balanceDue:"desc"},take:20})
  ]);
  const recommendations:any[]=[];
  if(dash.outstanding>0)recommendations.push({priority:"HIGH",type:"COLLECTION",title:"Follow up on outstanding receivables",reason:`₹${dash.outstanding.toLocaleString("en-IN")} is currently outstanding.`,action:"OPEN_OUTSTANDING"});
  if(dash.lowStock>0)recommendations.push({priority:"MEDIUM",type:"STOCK",title:"Review low-stock products",reason:`${dash.lowStock} product(s) are at or below reorder point.`,action:"OPEN_INVENTORY"});
  const recentCutoff=new Date(); recentCutoff.setDate(recentCutoff.getDate()-30);
  const dead=await db.product.findMany({where:{businessId,archived:false,stock:{gt:0},saleItems:{none:{sale:{occurredAt:{gte:recentCutoff},status:"CONFIRMED"}}}},select:{id:true,name:true,stock:true},take:100});
  if(dead.length>0)recommendations.push({priority:"LOW",type:"DEAD_STOCK_REVIEW",title:"Review slow-moving inventory",reason:`${dead.length} stocked product(s) should be checked against recent sales before reordering.`,action:"OPEN_INVENTORY"});
  for(const a of anomalies.slice(0,3))recommendations.push({priority:a.severity,type:"ANOMALY",title:"Review unusual activity",reason:a.message,action:"OPEN_AI_INSIGHTS"});
  if(forecast.points.length)recommendations.push({priority:"LOW",type:"FORECAST",title:"Plan the next two weeks",reason:`Forecast baseline is about ₹${forecast.baseline.toFixed(0)} sales/day with ${Math.round(forecast.confidence*100)}% heuristic confidence.`,action:"OPEN_FORECAST"});
  if(overdue.length)recommendations.push({priority:"HIGH",type:"OVERDUE",title:"Prioritize overdue invoices",reason:`${overdue.length} open invoice(s) need collection review.`,action:"OPEN_OUTSTANDING"});
  return {recommendations,forecast,anomalies};
}

export async function runIndustryWorkflow(businessId:string, workflow:string, payload:any={}){
  const cfg=await db.industryConfig.findUnique({where:{businessId}});
  const rules:any=cfg?.rules||{}; const industry=cfg?.industry||"general";
  const base={businessId,workflow,industry,executedAt:new Date().toISOString(),rules,payload};
  if(workflow==="DAILY_OPENING") return {...base,steps:["review yesterday sales","review outstanding","review low stock","review pending approvals"],status:"READY"};
  if(workflow==="DAILY_CLOSING") return {...base,steps:["reconcile cash","review payments","check unpaid invoices","review unusual activity"],status:"READY"};
  if(workflow==="COLLECTION_SWEEP") return {...base,steps:["rank outstanding customers","identify overdue accounts","prepare follow-up list"],status:"READY"};
  if(workflow==="STOCK_REVIEW") return {...base,steps:["find low stock","find dead stock","review reorder points"],status:"READY"};
  return {...base,steps:[],status:"UNSUPPORTED_WORKFLOW"};
}
