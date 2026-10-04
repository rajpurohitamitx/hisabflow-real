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
  needsClarification: z.boolean().default(false),
});
export type Interpretation = z.infer<typeof Interpretation>;


function unitKind(unit:string){
  const u=String(unit||'piece').trim().toLowerCase();
  if(/^(kg|kgs|kilo|kilos|kilogram|kilograms)$/.test(u)) return 'kg';
  if(/^(g|gm|gms|gram|grams)$/.test(u)) return 'g';
  if(/^(mg|milligram|milligrams)$/.test(u)) return 'mg';
  return 'other';
}
function quantityToStoredUnit(quantity:number, spokenUnit:string|undefined, storedUnit:string){
  const from=unitKind(spokenUnit||storedUnit), to=unitKind(storedUnit);
  if(from===to || from==='other' || to==='other') return quantity;
  if(from==='g' && to==='kg') return quantity/1000;
  if(from==='kg' && to==='g') return quantity*1000;
  if(from==='mg' && to==='g') return quantity/1000;
  if(from==='g' && to==='mg') return quantity*1000;
  if(from==='mg' && to==='kg') return quantity/1000000;
  if(from==='kg' && to==='mg') return quantity*1000000;
  return quantity;
}
function displayQuantity(quantity:number, unit:string){
  const k=unitKind(unit);
  if(k==='kg' && quantity<1) return `${(quantity*1000).toLocaleString('en-IN',{maximumFractionDigits:3})} g`;
  if(k==='kg') return `${quantity.toLocaleString('en-IN',{maximumFractionDigits:3})} kg`;
  if(k==='g') return `${quantity.toLocaleString('en-IN',{maximumFractionDigits:3})} g`;
  if(k==='mg') return `${quantity.toLocaleString('en-IN',{maximumFractionDigits:3})} mg`;
  return `${quantity.toLocaleString('en-IN',{maximumFractionDigits:3})} ${unit}`;
}

function escapeRegExp(value:string){ return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function explicitProductQuantity(text:string, productName:string){
  const source=String(text||"").replace(/,/g,"");
  const name=escapeRegExp(productName.trim());
  const unit="(?:kg|kgs|kilo|kilos|kilogram|kilograms|g|gm|gms|gram|grams|mg|milligram|milligrams|pieces?|pcs?|units?)";
  const patterns=[
    new RegExp("(?:^|\\b)(\\d+(?:\\.\\d+)?)\\s*("+unit+")?\\s*(?:of\\s+)?"+name+"(?:s)?\\b","i"),
    new RegExp("(?:^|\\b)"+name+"(?:s)?\\s*(?:x|\\*|:)?\\s*(\\d+(?:\\.\\d+)?)\\s*("+unit+")?\\b","i")
  ];
  for(const re of patterns){ const m=source.match(re); if(m) return {quantity:Number(m[1]),unit:m[2]||undefined}; }
  return undefined;
}
function explicitProductAmount(text:string, productName:string){
  const source=String(text||"").replace(/,/g,"");
  const name=escapeRegExp(productName.trim());
  const money="(?:₹|rs\\.?|inr\\s*)?\\s*(\\d+(?:\\.\\d+)?)\\s*(k|thousand|thousands)?";
  const patterns=[
    new RegExp(money+"\\s*(?:worth\\s+of|worth)\\s+"+name+"(?:s)?\\b","i"),
    new RegExp(name+"(?:s)?\\s*(?:worth|value)\\s*(?:of|is|=|:)\\s*"+money,"i")
  ];
  for(const re of patterns){ const m=source.match(re); if(m){ const raw=m[1]||m[2]; if(raw==null) continue; let amount=Number(raw); const full=m[0].toLowerCase(); if(/\b(k|thousand|thousands)\b/.test(full)) amount*=1000; return amount; } }
  return undefined;
}

function amountFromText(text:string){
  const cleaned=text.toLowerCase().replace(/,/g,"");
  const k=cleaned.match(/(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d+)?)\s*k\b/); if(k) return Number(k[1])*1000;
  const thousandWord=cleaned.match(/(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d+)?)\s*(?:thousand|thousands)\b/); if(thousandWord) return Number(thousandWord[1])*1000;
  // Spoken number grouping is commonly transcribed as "2 000" / "20 000".
  const grouped=cleaned.match(/(?:₹|rs\.?|inr\s*)?(\d{1,3})\s+(\d{3})(?!\d)/); if(grouped) return Number(`${grouped[1]}${grouped[2]}`);
  const m=cleaned.match(/(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d+)?)/); return m?Number(m[1]):undefined;
}

async function resolveCustomer(businessId:string, query:string){
  // Customer identity must be strict. Never fuzzy-map a new name such as Ram to Ramesh.
  const raw=String(query||"").trim(); const q=normalize(raw);
  if(!q) return {matches:[],selected:null,confidence:0};
  const rows=await db.customer.findMany({where:{businessId,archived:false},select:{id:true,name:true,phone:true,address:true,aliases:{select:{value:true,normalized:true}}},take:500});
  const scored=rows.map((c:any)=>{
    const name=normalize(c.name); const aliases=(c.aliases||[]).map((a:any)=>normalize(a.normalized||a.value)); let score=0;
    if(name===q || aliases.includes(q)) score=1;
    else if(q.startsWith(name+" ")) score=.99;
    else if(aliases.some((a:string)=>a && q.startsWith(a+" "))) score=.99;
    return {...c,_score:score};
  }).filter((x:any)=>x._score>0).sort((a:any,b:any)=>b._score-a._score);
  const top=scored[0]?scored[0]._score:0; const topMatches=scored.filter((x:any)=>x._score===top).slice(0,8);
  const selected=topMatches.length===1 && top>=.99 ? topMatches[0] : null;
  return {matches:topMatches,selected,confidence:selected?top:0};
}

function extractNewCustomerCorrection(text:string){
  const t=String(text||"").trim();
  const patterns=[
    /(?:not|no|nah)\b.*?\bnew\s+cust(?:omer|mer)\b\s+(?:named\s+|called\s+)?([\p{L}][\p{L}.'-]{1,30})(?:\s+(?:from|at)\s+(.+))?$/iu,
    /(?:new\s+cust(?:omer|mer))\s+(?:named\s+|called\s+)?([\p{L}][\p{L}.'-]{1,30})(?:\s+(?:from|at)\s+(.+))?$/iu,
    /(?:naya|nayi|new)\s+cust(?:omer|mer)\s+(?:hai|is)?\s*([\p{L}][\p{L}.'-]{1,30})(?:\s+(?:from|at)\s+(.+))?$/iu
  ];
  for(const re of patterns){const m=t.match(re);if(m)return {name:m[1].trim(),address:m[2]?.trim()||""};}
  return null;
}

async function resolveProduct(businessId:string, query:string){
  const r=await resolveEntityAdvanced(businessId,"product",query);
  return {matches:r.matches,selected:r.selected,confidence:r.confidence};
}

export async function interpret(businessId:string,text:string,context?:{
  customerId?:string|null;
  productId?:string|null;
  lastIntent?:string|null;
  pendingIntent?:string|null;
  pendingEntities?:Record<string,any>|null;
  pendingQuestion?:string|null;
  history?:Array<{role:string;text:string}>;
}):Promise<Interpretation>{
  const memories=await db.businessMemory.findMany({where:{businessId,active:true},take:50});

  // Gemini is the primary hosted AI provider in the free/demo build. It is intentionally
  // given a broad interpretation contract rather than a list of sentence templates.
  // The deterministic parser below is only a safety fallback when no AI provider exists.
  // Resolve conversational replies BEFORE calling the model. A bare “yes/haan/ஆம்”
  // must answer the pending question, never become a fresh unrelated AI request.
  const pendingEntities=context?.pendingEntities || null;
  const pendingIntent=context?.pendingIntent || null;
  // A newly spoken customer name must never inherit the previous customer from the
  // conversation. Contextual customerId is only for pronoun/follow-up messages.
  const looksLikeExplicitCustomer = (value:string) => {
    const t=value.trim();
    if(!t) return false;
    // A named customer normally appears as the grammatical subject/object of a
    // payment/sale phrase. Pronouns deliberately remain contextual.
    if(/^(?:he|she|they|him|her|them|avan|aval|avanga|uske|usko|unhone|woh|அவன்|அவள்|அவர்கள்|அவரை|वह|उसने|उसे|वे|उन्होंने)\b/i.test(t)) return false;
    if(/^(?:i|me|we|you|my|mera|meri|main|maine|मैं|मेरा|मेरी|நான்|என்|మన|నేను)\b/i.test(t)) return false;
    return /^(?:[\p{L}][\p{L}.'-]{1,30})(?:\s+(?:[\p{L}][\p{L}.'-]{1,20})){0,2}\s*(?:paid|pay|gave|gave me|received from|from|bought|purchased|took|liya|ne|ku|ko|se|க்கு|கிட்ட|ने|को|से|ने)$/iu.test(t)
      || /\b(?:paid|pay|gave|received from|bought|purchased|took|liya|ne|ku|ko|se|க்கு|கிட்ட|ने|को|से)\b/i.test(t) && !/\b(?:he|she|they|him|her|them|avan|aval|avanga|uske|usko|woh|அவன்|அவள்|वह|उसने)\b/i.test(t) && /^[\p{L}]/u.test(t);
  };
  const earlyCustomerCorrection=extractNewCustomerCorrection(text);
  const safeContextCustomerId = (looksLikeExplicitCustomer(String(text)) || earlyCustomerCorrection) ? null : (context?.customerId || null);
  const normalizedReply=normalize(text);
  const affirmative=/^(yes|yeah|yep|yup|ok|okay|sure|confirm|confirmed|confirm it|confirm this|u confirm it|you confirm it|do it|go ahead|proceed|haan|ha|ji|bilkul|theek|ठीक|हाँ|हां|जी|ஆம்|ஆமாம்|சரி|అవును|ಹೌದು|അതെ|હા|हो)\b/i.test(text.trim());
  const negative=/^(no|nope|cancel|stop|not this|nah|nahi|nahin|नहीं|नही|இல்லை|కాదు|ಇಲ್ಲ|ഇല്ല|ના)\b/i.test(text.trim());
  const newCustomerCorrection=earlyCustomerCorrection;
  if(pendingIntent && pendingEntities && newCustomerCorrection){
    const entities:any={...pendingEntities,customerId:null,customerName:newCustomerCorrection.name,customerQuery:newCustomerCorrection.name,proposedCustomerName:newCustomerCorrection.name,createCustomer:true,customerResolution:"CREATE_OR_CONFIRM"};
    if(newCustomerCorrection.address) entities.proposedCustomerAddress=newCustomerCorrection.address;
    const r=await resolveCustomer(businessId,newCustomerCorrection.name);
    if(r.selected){
      entities.customerId=r.selected.id; entities.customerName=r.selected.name; entities.customerResolution="RESOLVED"; entities.createCustomer=false; entities.matches=[{id:r.selected.id,name:r.selected.name,phone:r.selected.phone}];
      return Interpretation.parse({intent:pendingIntent,entities,confidence:{intent:.99,customer:.99},risk:"MEDIUM",response:`I found ${r.selected.name}. Please confirm this action.`,requiresConfirmation:true,needsClarification:false});
    }
    return Interpretation.parse({intent:pendingIntent,entities,confidence:{intent:.99,customer:.99},risk:"MEDIUM",response:`Got it — this is a new customer named ${newCustomerCorrection.name}${newCustomerCorrection.address?` at ${newCustomerCorrection.address}`:""}. Please confirm to continue.`,requiresConfirmation:true,needsClarification:false});
  }
  if(pendingIntent && pendingEntities && (affirmative || negative)){
    if(negative) return Interpretation.parse({intent:"UNKNOWN",entities:{cancelled:true},confidence:{intent:1},risk:"LOW",response:"Okay, I won't make that change.",requiresConfirmation:false,needsClarification:false});
    const entities={...pendingEntities};
    if(entities.customerResolution==="CREATE_OR_CONFIRM" || entities.proposedCustomerName) entities.createCustomer=true;
    return Interpretation.parse({
      intent:pendingIntent, entities, confidence:{intent:1,entities:1},
      risk:pendingIntent==="GENERAL_BUSINESS_QUERY"||pendingIntent==="LOW_STOCK"||pendingIntent==="DAILY_BRIEFING"?"LOW":"MEDIUM",
      response:entities.createCustomer && entities.proposedCustomerName ? `Add ${entities.proposedCustomerName} and record this ${pendingIntent==="CREATE_SALE"?"sale":pendingIntent==="CREATE_PURCHASE"?"purchase":"action"}?` : "Confirmed. I’m ready to apply this action.",
      requiresConfirmation:true, needsClarification:false
    });
  }

  // If the user supplies a name/address while resolving a missing customer, keep the
  // original financial operation and use the reply as the entity-resolution answer.
  if(pendingIntent && pendingEntities && pendingEntities.customerResolution==="CREATE_OR_CONFIRM" && !affirmative && !negative){
    const candidate=text.trim();
    if(candidate){
      const r=await resolveCustomer(businessId,candidate);
      const entities={...pendingEntities};
      if(r.selected){
        entities.customerId=r.selected.id; entities.customerName=r.selected.name; entities.customerResolution="RESOLVED"; entities.matches=[{id:r.selected.id,name:r.selected.name,phone:r.selected.phone}];
        return Interpretation.parse({intent:pendingIntent,entities,confidence:{intent:.99,customer:.99},risk:"MEDIUM",response:`I found ${r.selected.name}. Please confirm this action.`,requiresConfirmation:true,needsClarification:false});
      }
      entities.proposedCustomerName=candidate.split(/[,|-]/)[0].trim() || candidate;
      const address=candidate.split(/[,|-]/).slice(1).join(",").trim();
      if(address) entities.proposedCustomerAddress=address;
      entities.createCustomer=true; entities.customerResolution="CREATE_OR_CONFIRM";
      return Interpretation.parse({intent:pendingIntent,entities,confidence:{intent:.98,customer:.85},risk:"MEDIUM",response:`I’ll use ${entities.proposedCustomerName}${address?` at ${address}`:""}. Please confirm to continue.`,requiresConfirmation:true,needsClarification:false});
    }
  }

  const deleteMatch=text.trim().match(/^(?:remove|delete|archive)\s+(?:customer\s+)?([\p{L}][\p{L}.'-]{1,40})$/iu);
  if(deleteMatch){
    const q=deleteMatch[1].trim(); const r=await resolveCustomer(businessId,q);
    if(r.selected){
      return Interpretation.parse({intent:"DELETE_CUSTOMER",entities:{customerId:r.selected.id,customerName:r.selected.name,customerQuery:q,matches:[{id:r.selected.id,name:r.selected.name,phone:r.selected.phone}]},confidence:{intent:.99,customer:1},risk:"HIGH",response:`I found ${r.selected.name}. Do you want me to archive this customer? Their historical sales and payments will be retained.`,requiresConfirmation:true,needsClarification:false});
    }
    return Interpretation.parse({intent:"DELETE_CUSTOMER",entities:{customerQuery:q,customerName:q,customerResolution:"CREATE_OR_CONFIRM",matches:r.matches.map((x:any)=>({id:x.id,name:x.name,phone:x.phone}))},confidence:{intent:.95,customer:.8},risk:"HIGH",response:`I couldn't find a customer named ${q}. I won't remove anyone.`,requiresConfirmation:false,needsClarification:true});
  }

  if(isLocalAIEnabled() || isGeminiEnabled() || process.env.OPENAI_API_KEY){
    try {
      const systemPrompt=`You are the universal natural-language interpretation layer for Hisab Flow, an AI business operating assistant for Indian small businesses.

Your job is NOT to match fixed phrases. Understand the user's meaning from ANY natural language, any supported Indian language, English, transliteration, code-mixing, incomplete speech, follow-up answers, pronouns and conversational references. Examples are illustrative only; NEVER restrict interpretation to those examples.

You must:
1. Understand what the user is trying to accomplish, even when the wording is unusual.
2. Extract money, quantities, dates, payment methods, customer/product/supplier names, locations, notes and relationships accurately.
3. Preserve the semantic meaning of Indian number expressions: 200, 2 000, 2,000, two thousand, दो सौ, दो हजार, இருநூறு, 2k, 20k, etc. Do not confuse 2,000 with 2.
4. Resolve entities conservatively using the live business records supplied by the application. Never invent IDs.
5. If exactly one entity is a clear match, return its name/query so the server can resolve it. If multiple are plausible, return all useful candidates and ask the user to choose. If none exists and the user appears to refer to a person/customer, set customerResolution to CREATE_OR_CONFIRM and ask whether a new customer should be added.
6. Understand follow-up answers such as "yes", "no", "Jinal Adyar", "the second one", "haan", "ஆம்", "yes add her", "show me", and "where is it".
7. For a sale, if the user gives a money value for a product (for example, "Jinal took ₹200 worth of Bajra") and the product has a stored sellingPrice, calculate quantity = amount / sellingPrice. If the user gives quantity (for example, "Jinal took 500 grams of Bajra"), calculate amount = quantity × sellingPrice. Respect kg/g/mg conversion and the product.unit. Never treat this as a missing quantity when the price makes the quantity determinable. A short follow-up refers to the pending question or immediately previous business question unless the user clearly starts a new topic. Use pending conversation context and recent history.
8. Ask the smallest possible clarification question when required information is missing. Never guess a financial value, person or product.
9. For a financial mutation, require confirmation after all required entities/values are resolved. Confirmation can be answered by voice or text.
10. For informational questions, answer naturally from the business data request and do not create a mutation.
11. If the request is casual/non-business, respond naturally without pretending it is a transaction.

Supported action intents are not a language restriction. Choose the best one from this set when applicable: RECEIVE_PAYMENT, CREATE_SALE, CREATE_PURCHASE, CREATE_EXPENSE, CREATE_REMINDER, CUSTOMER_BALANCE, CUSTOMER_STATEMENT, SALES_TODAY, LOW_STOCK, DAILY_BRIEFING, OUTSTANDING_CUSTOMERS, SUPPLIER_DUES, PROFIT_SUMMARY, SEARCH_BUSINESS, ADJUST_STOCK, GENERAL_BUSINESS_QUERY, SALES_ANALYSIS, MANAGE_ENTITY, UNKNOWN. MANAGE_ENTITY is the universal conversational CRUD intent for customers, products, suppliers, expenses and reminders. Use entities {operation:"CREATE|UPDATE|ARCHIVE|CANCEL|COMPLETE", entityType:"CUSTOMER|PRODUCT|SUPPLIER|EXPENSE|REMINDER|SALE|PURCHASE|PAYMENT", entityId, name, fields:{...}, query, matches}. Never invent entityId; resolve explicit names from live records or ask a clarification.

For RECEIVE_PAYMENT, entities may include: customerName, customerQuery, customerId, amount, paymentMethod, currency, matches, customerResolution, proposedCustomerName, proposedCustomerAddress, createCustomer.
For CREATE_SALE/CREATE_PURCHASE, entities may include items [{productName, productId, quantity, unitPrice}], customer/supplier fields, amount/payment, paymentMethod and notes. For MANAGE_ENTITY, preserve the user's intended operation and fields exactly; explicit names override old context, while pronouns may use pending context.
For GENERAL_BUSINESS_QUERY, put the user's question in query and describe any useful filters/date ranges. For purchase/sales searches, include minAmount/maxAmount when the user asks for an amount threshold. Use SALES_ANALYSIS for questions such as “why did sales change”, “what caused sales to drop/grow”, or comparisons across periods.

Return ONLY valid JSON with this exact top-level shape:
{"intent":"string","entities":{},"confidence":{},"risk":"LOW|MEDIUM|HIGH","response":"string","requiresConfirmation":false,"needsClarification":false}

If clarification is needed, response MUST be the exact short question the UI should ask. Set needsClarification=true. If a new customer should be proposed, include customerResolution="CREATE_OR_CONFIRM" and proposedCustomerName. If confirmation is needed, response should clearly state what will happen and ask for confirmation.

Business memory: ${JSON.stringify(memories.map(m=>({key:m.key,value:m.value})))}
Recent conversation history: ${JSON.stringify(context?.history||[])}
Conversation context: ${JSON.stringify(context||{})}`;

      let parsed:any;
      if(isLocalAIEnabled()) parsed=await ollamaJson([{role:"system",content:systemPrompt},{role:"user",content:text}]);
      else if(isGeminiEnabled()) parsed=await geminiJson([{role:"user",content:`${systemPrompt}\n\nUser request:\n${text}`}]);
      else {
        const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
        const response=await client.responses.create({model:(process.env.OPENAI_TEXT_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-luna"),input:[{role:"system",content:systemPrompt},{role:"user",content:text}],text:{format:{type:"json_schema",name:"hisabflow_interpretation",strict:true,schema:{type:"object",properties:{intent:{type:"string"},entities:{type:"object",additionalProperties:true},confidence:{type:"object",additionalProperties:{type:"number"}},risk:{type:"string",enum:["LOW","MEDIUM","HIGH"]},response:{type:"string"},requiresConfirmation:{type:"boolean"},needsClarification:{type:"boolean"}},required:["intent","entities","confidence","risk","response","requiresConfirmation","needsClarification"],additionalProperties:false}}}} as any);
        parsed=JSON.parse(response.output_text);
      }

      parsed.entities ||= {};
      parsed.confidence ||= {};
      parsed.needsClarification=Boolean(parsed.needsClarification);

      // Conversational confirmation/selection: carry the unresolved operation forward
      // so replies like "yes", "haan", "ஆம்" or "Jinal Adyar" are answers to the
      // question Hisab Flow just asked, not unrelated new messages.
      const affirmative=/^(yes|yeah|yep|yup|ok|okay|sure|confirm|confirmed|haan|ha|ji|bilkul|theek|ठीक|हाँ|हां|जी|ஆம்|ஆமாம்|சரி|అవును|ಹೌದು|അതെ|हो|હા)\b/i.test(String(text).trim());
      const negative=/^(no|nope|cancel|stop|not this|nah|nahi|nahin|नहीं|नही|இல்லை|కాదు|ಇಲ್ಲ|ഇല്ല|ના)\b/i.test(String(text).trim());
      if(context?.pendingIntent && context.pendingEntities){
        if(affirmative){
          parsed.intent=context.pendingIntent;
          parsed.entities={...context.pendingEntities,...parsed.entities,createCustomer:context.pendingEntities.customerResolution==='CREATE_OR_CONFIRM'||context.pendingEntities.proposedCustomerName?true:parsed.entities.createCustomer};
          if(context.pendingEntities.proposedCustomerName && !parsed.entities.customerName) parsed.entities.customerName=context.pendingEntities.proposedCustomerName;
          if(context.pendingEntities.proposedCustomerAddress && !parsed.entities.proposedCustomerAddress) parsed.entities.proposedCustomerAddress=context.pendingEntities.proposedCustomerAddress;
          parsed.needsClarification=false;
          parsed.requiresConfirmation=true;
          parsed.response=parsed.entities.createCustomer&&parsed.entities.proposedCustomerName?`Add ${parsed.entities.proposedCustomerName} and record this ${parsed.intent==="CREATE_SALE"?"sale":parsed.intent==="CREATE_PURCHASE"?"purchase":"action"}?`:"Please confirm this action.";
        } else if(negative){
          parsed.intent="UNKNOWN";
          parsed.entities={cancelled:true};
          parsed.needsClarification=false;
          parsed.requiresConfirmation=false;
          parsed.response="Okay, I won't make that change.";
        }
      }

      // Resolve/reconcile customer identity against the CURRENT explicit name. Never
      // keep a stale conversation customerId when the user names another customer.
      const explicitName=String(parsed.entities.customerName||parsed.entities.customerQuery||parsed.entities.proposedCustomerName||earlyCustomerCorrection?.name||"").trim();
      if(explicitName){
        const r=await resolveCustomer(businessId,explicitName);
        parsed.entities.matches=r.matches.map((x:any)=>({id:x.id,name:x.name,phone:x.phone,address:x.address}));
        if(r.selected){
          parsed.entities.customerId=r.selected.id; parsed.entities.customerName=r.selected.name; parsed.entities.customerQuery=explicitName;
          if(parsed.entities.customerResolution!=="CREATE_OR_CONFIRM") parsed.entities.customerResolution="RESOLVED";
        } else {
          parsed.entities.customerId=null; parsed.entities.customerName=explicitName;
          if(parsed.intent==="CUSTOMER_STATEMENT"||parsed.intent==="CUSTOMER_BALANCE"||parsed.intent==="OUTSTANDING_CUSTOMERS") parsed.entities.createCustomer=false;
          if(parsed.entities.createCustomer!==true){
            parsed.entities.customerResolution="CREATE_OR_CONFIRM";
            parsed.entities.proposedCustomerName=explicitName;
            parsed.needsClarification=true; parsed.requiresConfirmation=true;
            parsed.response=`I couldn't find ${explicitName} in your customers. Should I add this as a new customer and continue with this ${parsed.intent==="CREATE_SALE"?"sale":parsed.intent==="CREATE_PURCHASE"?"purchase":"action"}?`;
          }
        }
      }
      if(parsed.entities.productName && !parsed.entities.productId){
        const r=await resolveProduct(businessId,String(parsed.entities.productName));
        parsed.entities.productMatches=r.matches.map((x:any)=>({id:x.id,name:x.name,sku:x.sku,stock:String(x.stock),unit:x.unit,sellingPrice:Number(x.sellingPrice||0)}));
        if(r.selected){ parsed.entities.productId=r.selected.id; parsed.entities.productName=r.selected.name; parsed.entities.productUnit=r.selected.unit; parsed.entities.sellingPrice=Number(r.selected.sellingPrice||0); }
        else if(r.matches.length!==1){ parsed.needsClarification=true; parsed.response=parsed.response||`Which product do you mean by ${parsed.entities.productName}?`; }
      }
      if(Array.isArray(parsed.entities.items)){
        const resolved:any[]=[];
        for(const rawItem of parsed.entities.items){
          const item:any={...rawItem};
          const productQuery=String(item.productName||item.name||"").trim();
          const r=await resolveProduct(businessId,productQuery);
          if(r.selected){
            const product:any=r.selected;
            item.productId=product.id;
            item.productName=product.name;
            item.unit=product.unit;
            item.sellingPrice=Number(product.sellingPrice||0);

            // Numeric values in the user's actual sentence are authoritative.
            // Never let the language model turn "500 grams" into "500 kg" or
            // invent a value such as "2 20". Prices always come from the DB.
            const explicitQty=explicitProductQuantity(text,String(product.name));
            const explicitValue=explicitProductAmount(text,String(product.name));
            if(explicitQty){
              item.quantity=quantityToStoredUnit(explicitQty.quantity,explicitQty.unit,String(product.unit||"piece"));
              item.quantityUnit=product.unit;
              item.amount=Number(product.sellingPrice)>0 ? Number(item.quantity)*Number(product.sellingPrice) : undefined;
              item.calculatedFromQuantity=true;
            } else if(explicitValue!=null && Number(product.sellingPrice)>0){
              item.quantity=explicitValue/Number(product.sellingPrice);
              item.quantityUnit=product.unit;
              item.amount=explicitValue;
              item.calculatedFromAmount=true;
            } else {
              let quantity=item.quantity==null?undefined:Number(item.quantity);
              const explicitAmount=item.amount!=null?Number(item.amount):(parsed.intent==='CREATE_SALE' && parsed.entities.amount!=null && parsed.entities.items.length===1?Number(parsed.entities.amount):undefined);
              const spokenUnit=String(item.quantityUnit||item.unitName||"").trim()||undefined;
              if(quantity!=null && Number.isFinite(quantity) && spokenUnit) quantity=quantityToStoredUnit(quantity,spokenUnit,String(product.unit||"piece"));
              if((quantity==null || !Number.isFinite(quantity) || quantity<=0) && explicitAmount!=null && explicitAmount>0 && Number(product.sellingPrice)>0){
                quantity=explicitAmount/Number(product.sellingPrice);
                item.quantity=quantity; item.quantityUnit=product.unit; item.amount=explicitAmount; item.calculatedFromAmount=true;
              } else if(quantity!=null && quantity>0 && Number(product.sellingPrice)>0){
                item.quantity=quantity; item.amount=quantity*Number(product.sellingPrice); item.calculatedFromQuantity=true;
              } else if(quantity!=null && quantity>0 && explicitAmount!=null){
                item.quantity=quantity; item.amount=explicitAmount;
              }
            }
            item.rate=Number(product.sellingPrice||0);
            item.unitPrice=Number(product.sellingPrice||0);
            item.displayQuantity=item.quantity!=null?displayQuantity(Number(item.quantity),String(product.unit||"piece")):undefined;
          } else {
            item.productMatches=r.matches.map((x:any)=>({id:x.id,name:x.name,sku:x.sku,stock:String(x.stock),unit:x.unit,sellingPrice:Number(x.sellingPrice||0)}));
          }
          resolved.push(item);
        }
        parsed.entities.items=resolved;
        if(resolved.some((x:any)=>!x.productId)) parsed.needsClarification=true;
      }

      // A product + customer + money/quantity phrase is a sale, not a payment, when
      // the language describes the customer taking/buying the goods. This protects
      // natural Hindi/Tamil/Tanglish phrasing from being misclassified as RECEIVE_PAYMENT.
      const saleLanguage=/(\btook\b|\bgot\b|\bbought\b|\bpurchased\b|\bworth\b|\bki?d?ha?\b|\bliya\b|\ble liya\b|\bvaangina\b|\bvangi\b|\beduththu\b|\bஎடுத்த\b|\bவாங்க\b|\bखरीदा\b|\bलिए\b|\bलिया\b)/i.test(String(text));
      if(parsed.intent==='RECEIVE_PAYMENT' && Array.isArray(parsed.entities.items) && parsed.entities.items.length && saleLanguage){
        parsed.intent='CREATE_SALE';
      }

      // Conversational confirmations are always treated as financial confirmation, not a new action.
      const mutationIntents=["RECEIVE_PAYMENT","CREATE_SALE","CREATE_PURCHASE","CREATE_EXPENSE","ADJUST_STOCK","MANAGE_ENTITY"];
      if(mutationIntents.includes(parsed.intent)){
        const e=parsed.entities||{};
        if(parsed.intent==="RECEIVE_PAYMENT") {
          // Explicit phrases such as "cut the due", "against outstanding",
          // "balance was due" mean this payment must be allocated to an
          // existing receivable rather than silently becoming an advance.
          e.applyToOutstanding = Boolean(e.applyToOutstanding) || /\b(due|outstanding|balance|against|cut|credit)\b|बाकी|उधार|बकाया|काट|बकाया|கடன்|பாக்கி|பாலன்ஸ்/i.test(String(text));
        }
        if(parsed.intent==="RECEIVE_PAYMENT" && (e.amount===null || e.amount===undefined || Number.isNaN(Number(e.amount)))){
          parsed.needsClarification=true; parsed.requiresConfirmation=false; parsed.response="How much did the customer pay?";
        }
        if((parsed.intent==="CREATE_SALE"||parsed.intent==="CREATE_PURCHASE") && Array.isArray(e.items)){
          const unresolved=e.items.some((x:any)=>!x.productId);
          const missingQuantity=e.items.some((x:any)=>x.quantity===null||x.quantity===undefined||Number(x.quantity)<=0);
          const cannotPrice=e.items.some((x:any)=>(x.quantity===null||x.quantity===undefined||Number(x.quantity)<=0) && !(x.amount!=null && Number(x.amount)>0 && Number(x.sellingPrice)>0));
          const missingPrice=e.items.some((x:any)=>Number(x.sellingPrice||0)<=0 && ((x.quantity!=null&&Number(x.quantity)>0)|| (x.amount!=null&&Number(x.amount)>0)));
          if(unresolved){parsed.needsClarification=true;parsed.requiresConfirmation=false;parsed.response="Which product should I use?";}
          else if(missingPrice){parsed.needsClarification=true;parsed.requiresConfirmation=false;parsed.response="I found the product, but it has no selling price. What selling price should I use?";}
          else if(cannotPrice || (missingQuantity && !e.amount)){parsed.needsClarification=true;parsed.requiresConfirmation=false;parsed.response="Tell me either the quantity or the total value, and I’ll calculate the other from the product selling price.";}
        }
        if(!parsed.needsClarification){
          parsed.requiresConfirmation=true;
          const customer=e.customerName||e.customerQuery||e.proposedCustomerName;
          const itemText=Array.isArray(e.items)?e.items.map((x:any)=>`${x.displayQuantity||x.quantity} × ${x.productName||x.name||"item"}${x.rate!=null?` at ₹${Number(x.rate).toLocaleString("en-IN")}/${x.unit||"unit"}`:x.sellingPrice!=null?` at ₹${Number(x.sellingPrice).toLocaleString("en-IN")}/${x.unit||"unit"}`:""}`).join(", "):"";
          const derivedAmount=Array.isArray(e.items)?e.items.reduce((sum:number,x:any)=>sum+(x.quantity!=null&&x.rate!=null?Number(x.quantity)*Number(x.rate):x.amount!=null?Number(x.amount):0),0):0;
          if(Array.isArray(e.items) && derivedAmount>0) e.amount=derivedAmount;
          const amount=derivedAmount>0?`₹${derivedAmount.toLocaleString("en-IN")}`:"";
          const payment=e.payment!=null?`₹${Number(e.payment).toLocaleString("en-IN")} paid`:"";
          const method=e.paymentMethod?` via ${String(e.paymentMethod).toLowerCase()}`:"";
          if(parsed.intent==="RECEIVE_PAYMENT") parsed.response=`I understood: ${customer||"the customer"} ${e.createCustomer?"will be added and ":""}will pay ${amount}${method}. Should I record it?`;
          else if(parsed.intent==="CREATE_SALE") parsed.response=`I understood: ${customer?customer+" — ":""}${itemText||"the requested sale"}${amount?` for ${amount}`:""}${payment?`, ${payment}${method}`:""}. Should I save this sale?`;
          else if(parsed.intent==="CREATE_PURCHASE") parsed.response=`I understood: ${itemText||"the requested purchase"}${amount?` for ${amount}`:""}${customer?` from ${customer}`:""}. Should I record this purchase?`;
          else if(parsed.intent==="CREATE_EXPENSE") parsed.response=`I understood: expense of ${amount}${e.category?` for ${e.category}`:""}. Should I record it?`;
          else if(parsed.intent==="ADJUST_STOCK") parsed.response=`I understood: adjust ${e.productName||"the product"} by ${e.quantity||"the requested quantity"}. Should I apply it?`;
          else if(parsed.intent==="MANAGE_ENTITY") {
            const op=String(e.operation||"UPDATE").toUpperCase(), typ=String(e.entityType||"record").toLowerCase(), name=e.name||e.customerName||e.productName||e.supplierName||e.query||"this record";
            const actionWord=op==="CREATE"?"create":op==="ARCHIVE"?"archive":op==="CANCEL"?"cancel":op==="COMPLETE"?"complete":"update";
            parsed.risk=(op==="ARCHIVE"||op==="CANCEL")?"HIGH":"MEDIUM";
            parsed.response=`I understood: ${actionWord} ${typ} ${name}. Should I do that?`;
          }
        }
      }
      return Interpretation.parse(parsed);
    } catch (err) {
      // If Gemini is explicitly configured, do not silently reinterpret with brittle regexes.
      // Return a safe clarification instead of risking a wrong financial transaction.
      if(isGeminiEnabled()) return Interpretation.parse({intent:"UNKNOWN",entities:{text},confidence:{intent:0.05},risk:"LOW",response:"I couldn't interpret that reliably. Please say it again in your own words.",requiresConfirmation:false,needsClarification:true});
    }
  }

  const t=normalize(text);
  const amount=amountFromText(text);
  const paymentWords=/(paid|payment|received|gave|give|de\s*diye|payment\s*aa|pay|paisa|₹|रुप|पैसे|दिया|दिए|கொடுத்த|பணம்)/i.test(text);
  if(paymentWords && amount===undefined && safeContextCustomerId) return Interpretation.parse({intent:"RECEIVE_PAYMENT",entities:{customerId:safeContextCustomerId,customerName:"",amount:null,currency:"INR"},confidence:{intent:0.96,customer:0.98,amount:0.15},risk:"MEDIUM",requiresConfirmation:false,needsClarification:true,response:"How much did the customer pay?"});
  if(context?.lastIntent==="RECEIVE_PAYMENT" && amount!==undefined && safeContextCustomerId) return Interpretation.parse({intent:"RECEIVE_PAYMENT",entities:{customerId:safeContextCustomerId,customerName:"",amount,currency:"INR"},confidence:{intent:0.97,customer:0.98,amount:0.98},risk:"MEDIUM",requiresConfirmation:true,needsClarification:false,response:`I understood a ₹${amount.toLocaleString("en-IN")} payment from the customer.`});
  if(paymentWords && amount!==undefined){
    const rawName=text.replace(/\b(?:paid|payment|received|gave|give|from|de|diye|ne|ku|ka|ko|se|par|la|pannitaan|vandhuduchu|vandhudhu|aa|gaya|रुपये|रुपया|पैसे|दिया|दिए|கொடுத்த|பணம்|₹|rs\.?|inr|\d[\d,.]*k?\b)\b/gi," ").replace(/\s+/g," ").trim();
    const customerQuery=rawName || (safeContextCustomerId?"context":"");
    let customerId=safeContextCustomerId, customerName=""; let matches:any[]=[]; let conf=0.6;
    if(customerQuery && customerQuery!=="context"){ const r=await resolveCustomer(businessId,customerQuery); matches=r.matches; if(r.selected){customerId=r.selected.id;customerName=r.selected.name;conf=r.confidence;} }
    return Interpretation.parse({intent:"RECEIVE_PAYMENT",entities:{customerId,customerName,customerQuery,amount,currency:"INR",matches:matches.map(x=>({id:x.id,name:x.name,phone:x.phone})),customerResolution:!customerId&&matches.length===0?"CREATE_OR_CONFIRM":undefined,proposedCustomerName:!customerId&&matches.length===0?customerQuery:undefined},confidence:{intent:0.95,customer:conf,amount:0.98},risk:"MEDIUM",requiresConfirmation:true,needsClarification:!customerId,response:customerId?`I understood a ₹${amount.toLocaleString("en-IN")} payment from ${customerName}. Please confirm.`:`I couldn't find that customer. Should I add ${customerQuery} as a new customer?`});
  }
  if(/sales today|today.*sales|sales.*today|aaj.*sale|innaiku.*sale|today.*sold/i.test(text)) return Interpretation.parse({intent:"SALES_TODAY",entities:{},confidence:{intent:.97},risk:"LOW",requiresConfirmation:false,needsClarification:false,response:"I’ll calculate today’s confirmed sales from your live records."});
  if(/low stock|low inventory|reorder|stock low|kam stock|stock kam|porul kam/i.test(text)) return Interpretation.parse({intent:"LOW_STOCK",entities:{},confidence:{intent:.97},risk:"LOW",requiresConfirmation:false,needsClarification:false,response:"I’ll check live inventory and reorder points."});
  if(/profit|p&l|p\s*&\s*l|earnings|margin|laabh|munafa/i.test(text)) return Interpretation.parse({intent:"PROFIT_SUMMARY",entities:{},confidence:{intent:.93},risk:"LOW",requiresConfirmation:false,needsClarification:false,response:"I’ll calculate the business profit view."});
  return Interpretation.parse({intent:"UNKNOWN",entities:{text},confidence:{intent:.2},risk:"LOW",requiresConfirmation:false,needsClarification:true,response:"Tell me what you want to know or do, in your own words."});
}
