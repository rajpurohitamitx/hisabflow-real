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

function amountFromText(text:string){
  const cleaned=text.toLowerCase().replace(/,/g,"");
  const k=cleaned.match(/(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d+)?)\s*k\b/); if(k) return Number(k[1])*1000;
  const thousandWord=cleaned.match(/(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d+)?)\s*(?:thousand|thousands)\b/); if(thousandWord) return Number(thousandWord[1])*1000;
  // Spoken number grouping is commonly transcribed as "2 000" / "20 000".
  const grouped=cleaned.match(/(?:₹|rs\.?|inr\s*)?(\d{1,3})\s+(\d{3})(?!\d)/); if(grouped) return Number(`${grouped[1]}${grouped[2]}`);
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
  const normalizedReply=normalize(text);
  const affirmative=/^(yes|yeah|yep|yup|ok|okay|sure|confirm|confirmed|confirm it|confirm this|u confirm it|you confirm it|do it|go ahead|proceed|haan|ha|ji|bilkul|theek|ठीक|हाँ|हां|जी|ஆம்|ஆமாம்|சரி|అవును|ಹೌದು|അതെ|હા|हो)\b/i.test(text.trim());
  const negative=/^(no|nope|cancel|stop|not this|nah|nahi|nahin|नहीं|नही|இல்லை|కాదు|ಇಲ್ಲ|ഇല്ല|ના)\b/i.test(text.trim());
  if(pendingIntent && pendingEntities && (affirmative || negative)){
    if(negative) return Interpretation.parse({intent:"UNKNOWN",entities:{cancelled:true},confidence:{intent:1},risk:"LOW",response:"Okay, I won't make that change.",requiresConfirmation:false,needsClarification:false});
    const entities={...pendingEntities};
    if(entities.customerResolution==="CREATE_OR_CONFIRM" || entities.proposedCustomerName) entities.createCustomer=true;
    return Interpretation.parse({
      intent:pendingIntent, entities, confidence:{intent:1,entities:1},
      risk:pendingIntent==="GENERAL_BUSINESS_QUERY"||pendingIntent==="LOW_STOCK"||pendingIntent==="DAILY_BRIEFING"?"LOW":"MEDIUM",
      response:entities.createCustomer && entities.proposedCustomerName ? `Add ${entities.proposedCustomerName} and record this action?` : "Confirmed. I’m ready to apply this action.",
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
6. Understand follow-up answers such as "yes", "no", "Jinal Adyar", "the second one", "haan", "ஆம்", "yes add her", "show me", and "where is it". A short follow-up refers to the pending question or immediately previous business question unless the user clearly starts a new topic. Use pending conversation context and recent history.
7. Ask the smallest possible clarification question when required information is missing. Never guess a financial value, person or product.
8. For a financial mutation, require confirmation after all required entities/values are resolved. Confirmation can be answered by voice or text.
9. For informational questions, answer naturally from the business data request and do not create a mutation.
10. If the request is casual/non-business, respond naturally without pretending it is a transaction.

Supported action intents are not a language restriction. Choose the best one from this set when applicable: RECEIVE_PAYMENT, CREATE_SALE, CREATE_PURCHASE, CREATE_EXPENSE, CREATE_REMINDER, CUSTOMER_BALANCE, CUSTOMER_STATEMENT, SALES_TODAY, LOW_STOCK, DAILY_BRIEFING, OUTSTANDING_CUSTOMERS, SUPPLIER_DUES, PROFIT_SUMMARY, SEARCH_BUSINESS, ADJUST_STOCK, GENERAL_BUSINESS_QUERY, SALES_ANALYSIS, UNKNOWN.

For RECEIVE_PAYMENT, entities may include: customerName, customerQuery, customerId, amount, paymentMethod, currency, matches, customerResolution, proposedCustomerName, proposedCustomerAddress, createCustomer.
For CREATE_SALE/CREATE_PURCHASE, entities may include items [{productName, productId, quantity, unitPrice}], customer/supplier fields, amount/payment, paymentMethod and notes.
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
      if(context?.pendingIntent && context.pendingEntities && !parsed.needsClarification && (affirmative || negative)){ /* server-side pending handling above is authoritative */ }

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
          parsed.response=parsed.entities.createCustomer&&parsed.entities.proposedCustomerName?`Add ${parsed.entities.proposedCustomerName} and record this payment?`:"Please confirm this action.";
        } else if(negative){
          parsed.intent="UNKNOWN";
          parsed.entities={cancelled:true};
          parsed.needsClarification=false;
          parsed.requiresConfirmation=false;
          parsed.response="Okay, I won't make that change.";
        }
      }

      // Resolve names against tenant-scoped records after AI interpretation.
      if(parsed.entities.customerName && !parsed.entities.customerId){
        const r=await resolveCustomer(businessId,String(parsed.entities.customerName));
        parsed.entities.matches=r.matches.map((x:any)=>({id:x.id,name:x.name,phone:x.phone}));
        if(r.selected){ parsed.entities.customerId=r.selected.id; parsed.entities.customerName=r.selected.name; }
        else if(r.matches.length===0 && parsed.entities.createCustomer!==true){
          parsed.entities.customerResolution="CREATE_OR_CONFIRM";
          parsed.entities.proposedCustomerName=String(parsed.entities.customerName);
          parsed.needsClarification=true;
          parsed.requiresConfirmation=true;
          parsed.response=`I couldn't find ${parsed.entities.proposedCustomerName} in your customers. Should I add this as a new customer and record the payment?`;
        } else if(r.matches.length>1){
          parsed.needsClarification=true;
          parsed.response=`I found multiple customers matching ${parsed.entities.customerName}. Which one do you mean?`;
        }
      }
      if(parsed.entities.customerQuery && !parsed.entities.customerId && !parsed.entities.customerName){
        const r=await resolveCustomer(businessId,String(parsed.entities.customerQuery));
        parsed.entities.matches=r.matches.map((x:any)=>({id:x.id,name:x.name,phone:x.phone}));
        if(r.selected){ parsed.entities.customerId=r.selected.id; parsed.entities.customerName=r.selected.name; }
      }
      if(parsed.entities.productName && !parsed.entities.productId){
        const r=await resolveProduct(businessId,String(parsed.entities.productName));
        parsed.entities.productMatches=r.matches.map((x:any)=>({id:x.id,name:x.name,sku:x.sku,stock:String(x.stock)}));
        if(r.selected){ parsed.entities.productId=r.selected.id; parsed.entities.productName=r.selected.name; }
        else if(r.matches.length!==1){ parsed.needsClarification=true; parsed.response=parsed.response||`Which product do you mean by ${parsed.entities.productName}?`; }
      }
      if(Array.isArray(parsed.entities.items)){
        const resolved=[];
        for(const item of parsed.entities.items){
          const r=await resolveProduct(businessId,String(item.productName||item.name||""));
          if(r.selected) resolved.push({...item,productId:r.selected.id,productName:r.selected.name});
          else resolved.push({...item,productMatches:r.matches.map((x:any)=>({id:x.id,name:x.name,sku:x.sku,stock:String(x.stock)}))});
        }
        parsed.entities.items=resolved;
        if(resolved.some((x:any)=>!x.productId)) parsed.needsClarification=true;
      }

      // Conversational confirmations are always treated as financial confirmation, not a new action.
      if(parsed.intent==="RECEIVE_PAYMENT" || parsed.intent==="CREATE_SALE" || parsed.intent==="CREATE_PURCHASE" || parsed.intent==="CREATE_EXPENSE" || parsed.intent==="ADJUST_STOCK"){
        if(!parsed.needsClarification) parsed.requiresConfirmation=true;
        if(parsed.intent==="RECEIVE_PAYMENT" && !parsed.entities.customerId && !parsed.entities.customerResolution){
          parsed.needsClarification=true;
          parsed.response=parsed.response||"Which customer is this payment for?";
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
  if(paymentWords && amount===undefined && context?.customerId) return Interpretation.parse({intent:"RECEIVE_PAYMENT",entities:{customerId:context.customerId,customerName:"",amount:null,currency:"INR"},confidence:{intent:0.96,customer:0.98,amount:0.15},risk:"MEDIUM",requiresConfirmation:false,needsClarification:true,response:"How much did the customer pay?"});
  if(context?.lastIntent==="RECEIVE_PAYMENT" && amount!==undefined && context.customerId) return Interpretation.parse({intent:"RECEIVE_PAYMENT",entities:{customerId:context.customerId,customerName:"",amount,currency:"INR"},confidence:{intent:0.97,customer:0.98,amount:0.98},risk:"MEDIUM",requiresConfirmation:true,needsClarification:false,response:`I understood a ₹${amount.toLocaleString("en-IN")} payment from the customer.`});
  if(paymentWords && amount!==undefined){
    const rawName=text.replace(/\b(?:paid|payment|received|gave|give|from|de|diye|ne|ku|ka|ko|se|par|la|pannitaan|vandhuduchu|vandhudhu|aa|gaya|रुपये|रुपया|पैसे|दिया|दिए|கொடுத்த|பணம்|₹|rs\.?|inr|\d[\d,.]*k?\b)\b/gi," ").replace(/\s+/g," ").trim();
    const customerQuery=rawName || (context?.customerId?"context":"");
    let customerId=context?.customerId||null, customerName=""; let matches:any[]=[]; let conf=0.6;
    if(customerQuery && customerQuery!=="context"){ const r=await resolveCustomer(businessId,customerQuery); matches=r.matches; if(r.selected){customerId=r.selected.id;customerName=r.selected.name;conf=r.confidence;} }
    return Interpretation.parse({intent:"RECEIVE_PAYMENT",entities:{customerId,customerName,customerQuery,amount,currency:"INR",matches:matches.map(x=>({id:x.id,name:x.name,phone:x.phone})),customerResolution:!customerId&&matches.length===0?"CREATE_OR_CONFIRM":undefined,proposedCustomerName:!customerId&&matches.length===0?customerQuery:undefined},confidence:{intent:0.95,customer:conf,amount:0.98},risk:"MEDIUM",requiresConfirmation:true,needsClarification:!customerId,response:customerId?`I understood a ₹${amount.toLocaleString("en-IN")} payment from ${customerName}. Please confirm.`:`I couldn't find that customer. Should I add ${customerQuery} as a new customer?`});
  }
  if(/sales today|today.*sales|sales.*today|aaj.*sale|innaiku.*sale|today.*sold/i.test(text)) return Interpretation.parse({intent:"SALES_TODAY",entities:{},confidence:{intent:.97},risk:"LOW",requiresConfirmation:false,needsClarification:false,response:"I’ll calculate today’s confirmed sales from your live records."});
  if(/low stock|low inventory|reorder|stock low|kam stock|stock kam|porul kam/i.test(text)) return Interpretation.parse({intent:"LOW_STOCK",entities:{},confidence:{intent:.97},risk:"LOW",requiresConfirmation:false,needsClarification:false,response:"I’ll check live inventory and reorder points."});
  if(/profit|p&l|p\s*&\s*l|earnings|margin|laabh|munafa/i.test(text)) return Interpretation.parse({intent:"PROFIT_SUMMARY",entities:{},confidence:{intent:.93},risk:"LOW",requiresConfirmation:false,needsClarification:false,response:"I’ll calculate the business profit view."});
  return Interpretation.parse({intent:"UNKNOWN",entities:{text},confidence:{intent:.2},risk:"LOW",requiresConfirmation:false,needsClarification:true,response:"Tell me what you want to know or do, in your own words."});
}
