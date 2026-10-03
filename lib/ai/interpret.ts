import OpenAI from "openai";
import { isLocalAIEnabled, ollamaJson } from "./ollama";
import { geminiJson, isGeminiEnabled } from "./gemini";
import { z } from "zod";
import { db } from "../db";
import { normalize } from "../utils";
import { resolveEntityAdvanced } from "./advanced";

export const Interpretation = z.object({
  intent: z.string(),
  entities: z.record(z.string(), z.any()),
  confidence: z.record(z.string(), z.number().min(0).max(1)),
  risk: z.enum(["LOW","MEDIUM","HIGH"]),
  response: z.string().optional(),
  requiresConfirmation: z.boolean().default(false),
});
export type Interpretation = z.infer<typeof Interpretation>;

function amountFromText(text:string){
  const cleaned=text.toLowerCase().replace(/,/g,"");
  const k=cleaned.match(/(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d+)?)\s*k\b/); if(k) return Number(k[1])*1000;
  const m=cleaned.match(/(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d+)?)/); return m?Number(m[1]):undefined;
}

async function resolveCustomer(businessId:string, query:string){
  const r=await resolveEntityAdvanced(businessId,"customer",query);
  return {matches:r.matches,selected:r.selected,confidence:r.confidence};
}
async function resolveProduct(businessId:string, query:string){
  const r=await resolveEntityAdvanced(businessId,"product",query);
  return {matches:r.matches,selected:r.selected,confidence:r.confidence};
}

export async function interpret(businessId:string,text:string,context?:{customerId?:string|null;productId?:string|null;lastIntent?:string|null}):Promise<Interpretation>{
  const memories=await db.businessMemory.findMany({where:{businessId,active:true},take:30});
  if(isLocalAIEnabled() || isGeminiEnabled() || process.env.OPENAI_API_KEY){
    try {
      const systemPrompt=`You are Hisab Flow's interpretation engine. Never execute actions. Return JSON only. Understand Indian English, Hindi, Tamil, Hinglish, Tanglish and code-mixed business speech. Map natural language to intents such as RECEIVE_PAYMENT, CREATE_SALE, CREATE_EXPENSE, CUSTOMER_BALANCE, SALES_TODAY, LOW_STOCK, DAILY_BRIEFING, SEARCH_CUSTOMERS. Resolve ambiguity conservatively. Business memory: ${JSON.stringify(memories.map(m=>({key:m.key,value:m.value})))} Context: ${JSON.stringify(context||{})}. Treat pronouns like he/him/that customer/that product as references to the supplied context. Never invent an entity ID. If multiple candidates remain plausible, return the candidates and require clarification. Return this JSON shape: {"intent":"string","entities":{},"confidence":{},"risk":"LOW|MEDIUM|HIGH","response":"string","requiresConfirmation":false}.`;
      let parsed:any;
      if(isLocalAIEnabled()) {
        parsed=await ollamaJson([{role:"system",content:systemPrompt},{role:"user",content:text}]);
      } else if(isGeminiEnabled()) {
        parsed=await geminiJson([{role:"user",content:`${systemPrompt}\n\nUser request: ${text}`}]);
      } else {
        const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
        const response=await client.responses.create({model:(process.env.OPENAI_TEXT_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-luna"),input:[{role:"system",content:systemPrompt},{role:"user",content:text}],text:{format:{type:"json_schema",name:"hisabflow_interpretation",strict:true,schema:{type:"object",properties:{intent:{type:"string"},entities:{type:"object",additionalProperties:true},confidence:{type:"object",additionalProperties:{type:"number"}},risk:{type:"string",enum:["LOW","MEDIUM","HIGH"]},response:{type:"string"},requiresConfirmation:{type:"boolean"}},required:["intent","entities","confidence","risk","response","requiresConfirmation"],additionalProperties:false}}}} as any);
        parsed=JSON.parse(response.output_text);
      }
      // Resolve human names to tenant-scoped IDs after the model interprets the sentence.
      if(parsed.entities?.customerName && !parsed.entities.customerId){const r=await resolveCustomer(businessId,String(parsed.entities.customerName));parsed.entities.matches=r.matches.map((x:any)=>({id:x.id,name:x.name,phone:x.phone}));if(r.selected){parsed.entities.customerId=r.selected.id;parsed.entities.customerName=r.selected.name}}
      if(parsed.entities?.productName && !parsed.entities.productId){const r=await resolveProduct(businessId,String(parsed.entities.productName));parsed.entities.productMatches=r.matches.map((x:any)=>({id:x.id,name:x.name,sku:x.sku,stock:String(x.stock)}));if(r.selected){parsed.entities.productId=r.selected.id;parsed.entities.productName=r.selected.name}}
      if(Array.isArray(parsed.entities?.items)){
        const resolved=[];for(const item of parsed.entities.items){const r=await resolveProduct(businessId,String(item.productName||item.name||""));if(r.selected)resolved.push({...item,productId:r.selected.id,productName:r.selected.name});else resolved.push(item)}parsed.entities.items=resolved;
      }
      if(parsed.intent==="CREATE_SALE"||parsed.intent==="CREATE_PURCHASE") parsed.requiresConfirmation=true;
      return Interpretation.parse(parsed);
    } catch { /* fall through to deterministic parser */ }
  }
  const t=normalize(text);
  const amount=amountFromText(text);
  const paymentWords=/(paid|payment|received|gave|de\s*diye|payment\s*aa|pay|paisa|₹)/i.test(text);
  if(paymentWords && amount===undefined && context?.customerId){
    return Interpretation.parse({intent:"RECEIVE_PAYMENT",entities:{customerId:context.customerId,customerName:"",amount:null,currency:"INR"},confidence:{intent:0.96,customer:0.98,amount:0.15},risk:"MEDIUM",requiresConfirmation:false,response:"How much did the customer pay?"});
  }
  if(context?.lastIntent==="RECEIVE_PAYMENT" && amount!==undefined && context.customerId){
    return Interpretation.parse({intent:"RECEIVE_PAYMENT",entities:{customerId:context.customerId,customerName:"",amount,currency:"INR"},confidence:{intent:0.97,customer:0.98,amount:0.98},risk:"MEDIUM",requiresConfirmation:true,response:`I understood a ₹${amount.toLocaleString("en-IN")} payment from the customer in our current conversation.`});
  }
  if(paymentWords && amount!==undefined){
    const rawName=text.replace(/\b(?:paid|payment|received|gave|give|from|de|diye|ne|ku|ka|ko|se|par|la|pannitaan|vandhuduchu|vandhudhu|aa|gaya|₹|rs\.?|inr|\d[\d,.]*k?\b)\b/gi," " ).replace(/\s+/g," ").trim();
    const customerQuery=rawName || (context?.customerId?"context":"");
    let customerId=context?.customerId||null, customerName=""; let matches:any[]=[]; let conf=0.6;
    if(customerQuery && customerQuery!=="context") { const r=await resolveCustomer(businessId,customerQuery); matches=r.matches; if(r.selected){customerId=r.selected.id;customerName=r.selected.name;conf=r.confidence;} }
    return Interpretation.parse({intent:"RECEIVE_PAYMENT",entities:{customerId,customerName,customerQuery,amount,currency:"INR",matches:matches.map(x=>({id:x.id,name:x.name,phone:x.phone}))},confidence:{intent:0.95,customer:conf,amount:0.98},risk:"MEDIUM",requiresConfirmation:true,response:customerId?`I understood a ₹${amount.toLocaleString("en-IN")} payment from ${customerName}.`:`I need to know which customer this ₹${amount.toLocaleString("en-IN")} payment belongs to.`});
  }
  if(/remind|reminder|follow up|yaad dila|nyabagam|gurthu/i.test(text)) {
    const q=t.replace(/remind|reminder|follow up|me|next monday|tomorrow|yaad dila|nyabagam|gurthu|please|him|her|them/g," ").replace(/\s+/g," ").trim();
    const r=q?await resolveCustomer(businessId,q):{selected:null,matches:[],confidence:0};
    return Interpretation.parse({intent:"CREATE_REMINDER",entities:{customerId:r.selected?.id||context?.customerId||null,customerName:r.selected?.name||"",title:"Customer follow-up",dueAt:/tomorrow/i.test(text)?"TOMORROW":"NEXT_MONDAY",matches:r.matches.map(x=>({id:x.id,name:x.name,phone:x.phone}))},confidence:{intent:.9,customer:r.confidence||.5},risk:"MEDIUM",requiresConfirmation:true,response:r.selected?`I can create a follow-up for ${r.selected.name}.`:"Tell me which customer the reminder is for."});
  }
  if(/statement|account statement|ledger|hisab dikhao|kanakku|account history/i.test(text) && (context?.customerId || /ramesh|suresh|kumar|customer/i.test(text))) {
    const q=t.replace(/statement|account statement|ledger|show|hisab|dikhao|kanakku|account|history|of|for/g," ").replace(/\s+/g," ").trim(); const r=await resolveCustomer(businessId,q);
    return Interpretation.parse({intent:"CUSTOMER_STATEMENT",entities:{customerId:r.selected?.id||context?.customerId||null,customerName:r.selected?.name||"",customerQuery:q,matches:r.matches.map(x=>({id:x.id,name:x.name,phone:x.phone}))},confidence:{intent:.93,customer:r.confidence||.5},risk:"LOW",requiresConfirmation:false,response:r.selected?`I’ll show ${r.selected.name}'s complete account history.`:"Which customer should I show?"});
  }
  if(/low stock|low inventory|reorder|stock low|kam stock|stock kam|porul kam/i.test(text)) return Interpretation.parse({intent:"LOW_STOCK",entities:{},confidence:{intent:.97},risk:"LOW",requiresConfirmation:false,response:"I’ll check live inventory and reorder points."});
  if(/sales today|today.*sales|sales.*today|aaj.*sale|innaiku.*sale|today.*sold/i.test(text)) return Interpretation.parse({intent:"SALES_TODAY",entities:{},confidence:{intent:.97},risk:"LOW",requiresConfirmation:false,response:"I’ll calculate today’s confirmed sales from your live records."});
  if(/daily briefing|what should i do|what.*do today|business briefing|today.*summary|aaj.*summary|innaiku.*summary/i.test(text)) return Interpretation.parse({intent:"DAILY_BRIEFING",entities:{},confidence:{intent:.96},risk:"LOW",requiresConfirmation:false,response:"I’ll prepare your business briefing from sales, collections, dues, expenses and stock."});
  if(/who owes|customers.*owe|pending customers|outstanding customers|dues|receivable|yaar.*dena|kaun.*dena|yaar.*baaki|customers.*pending/i.test(text)) return Interpretation.parse({intent:"OUTSTANDING_CUSTOMERS",entities:{},confidence:{intent:.95},risk:"LOW",requiresConfirmation:false,response:"I’ll find customers with outstanding balances and sort them by amount."});
  if(/supplier|vendor|payable|purchase due|supplier.*balance|vendor.*balance/i.test(text)) return Interpretation.parse({intent:"SUPPLIER_DUES",entities:{},confidence:{intent:.9},risk:"LOW",requiresConfirmation:false,response:"I’ll check supplier balances and pending purchases."});
  if(/profit|p&l|p\s*&\s*l|earnings|margin|laabh|munafa/i.test(text)) return Interpretation.parse({intent:"PROFIT_SUMMARY",entities:{},confidence:{intent:.93},risk:"LOW",requiresConfirmation:false,response:"I’ll calculate the business profit view from recorded sales, purchases and expenses."});
  if(/expense|electricity|rent|salary|fuel|delivery|bill.*paid|kharcha|selavu|celavu/i.test(text) && amount!==undefined) {
    const category=/electricity|current|eb|bijli/i.test(text)?"Electricity":/rent/i.test(text)?"Rent":/salary|wages/i.test(text)?"Salary":/fuel|petrol|diesel/i.test(text)?"Fuel":/delivery|courier/i.test(text)?"Delivery":"General";
    return Interpretation.parse({intent:"CREATE_EXPENSE",entities:{amount,description:text,category},confidence:{intent:.9,amount:.98},risk:"MEDIUM",requiresConfirmation:true,response:`I understood a ${category.toLowerCase()} expense of ₹${amount.toLocaleString("en-IN")}.`});
  }
  if(/search|find|show|list|above|below|unpaid|transactions|purchase.*above|sale.*above|customers.*more than/i.test(text)) return Interpretation.parse({intent:"SEARCH_BUSINESS",entities:{query:text},confidence:{intent:.78},risk:"LOW",requiresConfirmation:false,response:"I’ll search the live business records for that."});
  if(/add stock|stock add|received stock|inventory add|restock|maal aaya|stock vandhudhu/i.test(text)) return Interpretation.parse({intent:"ADJUST_STOCK",entities:{text},confidence:{intent:.72},risk:"HIGH",requiresConfirmation:true,response:"I can add stock, but I need the product and quantity before changing inventory."});
  if(/bill|invoice|sold|sell|sale|becha|bech diya|vittu|vithuten/i.test(text)) {
    const nums=[...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:k|kg|pcs?|pieces?|units?)?/gi)].map(m=>Number(m[1]));
    return Interpretation.parse({intent:"CREATE_SALE",entities:{text,amount:amount,quantity:nums.length?nums[0]:undefined},confidence:{intent:.72},risk:"HIGH",requiresConfirmation:true,response:"I can create the invoice and update stock. Tell me the customer, product, quantity and rate if any detail is missing."});
  }
  if(/purchase|bought|buy|kharida|vaangina|vaangiyathu|supplier se liya/i.test(text)) return Interpretation.parse({intent:"CREATE_PURCHASE",entities:{text,amount},confidence:{intent:.72},risk:"HIGH",requiresConfirmation:true,response:"I can record the purchase and increase stock. I’ll validate the supplier, product, quantity and rate before posting it."});
  return Interpretation.parse({intent:"UNKNOWN",entities:{text},confidence:{intent:.2},risk:"LOW",requiresConfirmation:false,response:"I can work with natural business language, but I need one more detail to act safely. You can ask about sales, purchases, payments, customers, suppliers, inventory, expenses, reports, reminders or say exactly what happened."});

}
