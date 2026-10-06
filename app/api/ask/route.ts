import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { interpret } from "@/lib/ai/interpret";
import { Prisma } from "@prisma/client";

const AFFIRM=/^(yes|yeah|yep|yup|ok|okay|sure|confirm|confirmed|confirm it|confirm this|do it|go ahead|proceed|haan|ha|ji|bilkul|theek|ठीक|हाँ|हां|जी|ஆம்|ஆமாம்|சரி|అవును|ಹೌದು|അതെ|હા|हो)$/iu;
const NEG=/^(no|nope|cancel|stop|not this|nah|nahi|nahin|नहीं|नही|இல்லை|కాదు|ಇಲ್ಲ|ഇಲ್ಲ|ના)$/iu;

export async function POST(req:Request){
  try{
    const s=await requireSession();
    const body=await req.json();
    const text=String(body.text||"").trim();
    const conversationId=String(body.conversationId||"main");
    if(!text) return NextResponse.json({error:"Tell Hisab Flow what you need."},{status:400});

    const existingConversation=await db.conversation.findUnique({where:{businessId_key:{businessId:s.businessId,key:conversationId}},include:{messages:{orderBy:{createdAt:"desc"},take:16}}});
    const conversation=existingConversation ?? await db.conversation.create({data:{businessId:s.businessId,key:conversationId},include:{messages:{orderBy:{createdAt:"desc"},take:16}}});

    const pending:any=conversation.pendingAction||null;
    const lastExecuted=await db.aIAction.findFirst({where:{businessId:s.businessId,status:"EXECUTED"},orderBy:{createdAt:"desc"},select:{id:true,intent:true,result:true}});

    // A pending financial action is NOT a global mode. Every new utterance gets a
    // fresh interpretation first. Only explicit confirmation/cancellation, a clear
    // correction/field answer, or an otherwise unresolved follow-up may patch the
    // pending action. This prevents stale Jinal/Ramesh/reminder state from hijacking
    // unrelated questions.
    const affirmative=AFFIRM.test(text);
    const negative=NEG.test(text);

    if(pending?.actionId && /^leave$/iu.test(text)){
      return NextResponse.json({actionId:pending.actionId,conversationId,result:{intent:pending.intent,entities:pending.entities,confidence:{intent:1},risk:"LOW",response:"Do you want me to cancel the pending action?",requiresConfirmation:false,needsClarification:true},pending});
    }

    if(pending?.actionId && affirmative && pending.status==="WAITING_CONFIRMATION"){
      const action=await db.aIAction.findFirst({where:{id:String(pending.actionId),businessId:s.businessId}});
      const pendingEntities:any=pending.entities||{};
      const unresolved=Boolean(pendingEntities.customerResolution==="CREATE_OR_CONFIRM" && !pendingEntities.customerId) || Boolean(pendingEntities.productMatches?.length && !pendingEntities.productId);
      if(action && action.status!=="EXECUTED" && !unresolved){
        const result={intent:action.intent,entities:action.entities as any,confidence:action.confidence as any,risk:action.risk,response:"Confirmed. Applying the pending action now.",requiresConfirmation:true,needsClarification:false};
        await db.conversationMessage.createMany({data:[{conversationId:conversation.id,role:"user",text},{conversationId:conversation.id,role:"assistant",text:"Confirmed. Applying the pending action now."}]});
        return NextResponse.json({actionId:action.id,conversationId,result,pendingConfirmed:true});
      }
    }

    if(pending?.actionId && negative){
      await db.conversation.update({where:{id:conversation.id},data:{pendingAction:Prisma.DbNull,lastIntent:"CANCELLED"}});
      await db.aIAction.updateMany({where:{id:String(pending.actionId),businessId:s.businessId,status:{not:"EXECUTED"}},data:{status:"REJECTED"}});
      await db.conversationMessage.createMany({data:[{conversationId:conversation.id,role:"user",text},{conversationId:conversation.id,role:"assistant",text:"Okay, I won’t make that change."}]});
      return NextResponse.json({actionId:pending.actionId,conversationId,result:{intent:"UNKNOWN",entities:{cancelled:true},confidence:{intent:1},risk:"LOW",response:"Okay, I won’t make that change.",requiresConfirmation:false,needsClarification:false},cancelled:true});
    }

    // First interpret the NEW message without stale pending context. This is the key
    // separation between "answer my previous question" and "start a new request".
    const fresh=await interpret(s.businessId,text,{
      customerId:conversation.customerId,
      productId:conversation.productId,
      lastIntent:conversation.lastIntent,
      history:(conversation.messages||[]).slice().reverse().map((m:any)=>({role:m.role,text:m.text})),
      lastResult:lastExecuted?{intent:lastExecuted.intent,...(lastExecuted.result as any)}:null,lastActionId:lastExecuted?.id||null
    });

    // Read-only requests always win over pending mutation state.
    const readOnlyIntents=new Set([
      "CUSTOMER_BALANCE","CUSTOMER_STATEMENT","CUSTOMER_TOP_TRANSACTIONS",
      "SALES_TODAY","SALES_ON_DATE","LOW_STOCK","DAILY_BRIEFING","OUTSTANDING_CUSTOMERS",
      "SUPPLIER_DUES","PROFIT_SUMMARY","SEARCH_BUSINESS","SEARCH_REMINDERS",
      "GENERAL_BUSINESS_QUERY","SALES_ANALYSIS"
    ]);
    const explicitNewCommand=/^(show|list|find|search|tell|what|which|who|how|why|explain|compare|give|take|create|add|record|make|bill|sell|buy|purchase|remind|delete|remove|archive|update|change|clear|settle|pay|paid|received|order|call|set|schedule)\b/i.test(text);
    const clearlyNew=readOnlyIntents.has(fresh.intent) || explicitNewCommand;

    let result:any=fresh;
    let continuingPending=false;

    // A matching mutation intent is a natural field patch. Unknown/incomplete
    // replies can also patch a pending action, but a fresh read/new command cannot.
    if(pending?.actionId && !clearlyNew && !affirmative && !negative){
      const pendingMutation=new Set([
        "RECEIVE_PAYMENT","SETTLE_OUTSTANDING","CREATE_SALE","CREATE_PURCHASE",
        "CREATE_EXPENSE","CREATE_REMINDER","ADJUST_STOCK","UNDO_LAST_ACTION","MANAGE_ENTITY","DELETE_CUSTOMER"
      ]);
      const sameIntent=fresh.intent===pending.intent;
      const patchLike=fresh.intent==="UNKNOWN" || sameIntent ||
        (pending.intent==="CREATE_REMINDER" && /\b(title|remind|reminder|tomorrow|today|date|time|at\s+\d|call|due)\b/i.test(text));
      if(pendingMutation.has(String(pending.intent)) && patchLike){
        const patched=await interpret(s.businessId,text,{
          customerId:conversation.customerId,
          productId:conversation.productId,
          lastIntent:conversation.lastIntent,
          pendingIntent:pending.intent,
          pendingEntities:pending.entities,
          pendingQuestion:pending.question,
          history:(conversation.messages||[]).slice().reverse().map((m:any)=>({role:m.role,text:m.text})),
          lastResult:lastExecuted?{intent:lastExecuted.intent,...(lastExecuted.result as any)}:null,lastActionId:lastExecuted?.id||null
        });
        result=patched;
        continuingPending=true;
      }
    }

    // Never execute destructive bulk requests from natural language. Historical
    // accounting records are not physically deleted; bulk deletion needs an explicit
    // product-specific workflow, not a generic AI confirmation card.
    if(/\b(delete|remove|erase|reset|clear)\b/i.test(text) && /\b(all|every|everyone|customers?|balances?|due|outstanding|payments?|history|records?)\b/i.test(text) && !/\b(only|just)\s+(this|one)\b/i.test(text)){
      result={intent:"UNKNOWN",entities:{destructiveRequest:true},confidence:{intent:1},risk:"HIGH",response:"I won’t delete or reset all customer balances or historical financial records. Those records must remain auditable. I can instead show the outstanding customers, settle a specific customer’s balance, or help reverse a specific transaction.",requiresConfirmation:false,needsClarification:false};
      continuingPending=false;
    }

    let actionId=String(continuingPending ? (pending?.actionId||"") : "");
    if(actionId){
      const existing=await db.aIAction.findFirst({where:{id:actionId,businessId:s.businessId,status:{not:"EXECUTED"}}});
      if(existing){
        await db.aIAction.update({where:{id:existing.id},data:{input:text,intent:result.intent,entities:result.entities as any,confidence:result.confidence as any,risk:result.risk,status:"INTERPRETED"}});
        actionId=existing.id;
      }
    }
    if(!actionId){
      const action=await db.aIAction.create({data:{businessId:s.businessId,userId:s.user.id,input:text,intent:result.intent,entities:result.entities as any,confidence:result.confidence as any,risk:result.risk,status:"INTERPRETED"}});
      actionId=action.id;
    }

    const mutation=!readOnlyIntents.has(result.intent) && (result.risk!=="LOW" || result.requiresConfirmation || ["RECEIVE_PAYMENT","SETTLE_OUTSTANDING","CREATE_SALE","CREATE_PURCHASE","CREATE_EXPENSE","CREATE_REMINDER","ADJUST_STOCK","UNDO_LAST_ACTION","MANAGE_ENTITY","DELETE_CUSTOMER"].includes(result.intent));
    // NEVER discard an unresolved mutation. Clarifications are part of the same
    // pending operation: the next user message patches this action rather than
    // starting a new one. This is the core fix for repeated reminder/customer
    // questions and context loss.
    const nextPending=mutation?{
      actionId,
      intent:result.intent,
      entities:result.entities,
      question:result.response||"Tell me the missing detail.",
      status:result.needsClarification?"WAITING_INPUT":"WAITING_CONFIRMATION",
      updatedAt:new Date().toISOString()
    }:null;

    await db.conversationMessage.createMany({data:[{conversationId:conversation.id,role:"user",text},{conversationId:conversation.id,role:"assistant",text:result.response||""}]});
    const ce:any=result.entities||{};
    await db.conversation.update({where:{id:conversation.id},data:{
      customerId:ce.customerId||conversation.customerId,
      productId:ce.productId||conversation.productId,
      lastIntent:result.intent,
      pendingAction:nextPending as any
    }});
    return NextResponse.json({actionId,conversationId,result,pending:nextPending});
  }catch(e:any){
    return NextResponse.json({error:e.message},{status:e.message==="UNAUTHENTICATED"?401:500});
  }
}
