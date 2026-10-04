import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { interpret } from "@/lib/ai/interpret";

const AFFIRM=/^(yes|yeah|yep|yup|ok|okay|sure|confirm|confirmed|confirm it|confirm this|do it|go ahead|proceed|haan|ha|ji|bilkul|theek|ठीक|हाँ|हां|जी|ஆம்|ஆமாம்|சரி|అవును|ಹೌದು|അതെ|હા|हो)$/iu;
const NEG=/^(no|nope|cancel|stop|not this|nah|nahi|nahin|नहीं|नही|இல்லை|కాదు|ಇಲ್ಲ|ഇಲ್ಲ|ના|leave)$/iu;

export async function POST(req:Request){
  try{
    const s=await requireSession();
    const body=await req.json();
    const text=String(body.text||"").trim();
    const conversationId=String(body.conversationId||"main");
    if(!text) return NextResponse.json({error:"Tell Hisab Flow what you need."},{status:400});

    let conversation=await db.conversation.findUnique({where:{businessId_key:{businessId:s.businessId,key:conversationId}},include:{messages:{orderBy:{createdAt:"desc"},take:16}}});
    if(!conversation) conversation=await db.conversation.create({data:{businessId:s.businessId,key:conversationId}});

    const pending:any=conversation.pendingAction||null;
    // Confirmation/cancellation is handled against the persisted action, not reinterpreted.
    if(pending?.actionId && AFFIRM.test(text)){
      const action=await db.aIAction.findFirst({where:{id:String(pending.actionId),businessId:s.businessId}});
      if(action && action.status!=="EXECUTED"){
        const result={intent:action.intent,entities:action.entities as any,confidence:action.confidence as any,risk:action.risk,response:"Confirmed. Applying the pending action now.",requiresConfirmation:true,needsClarification:false};
        await db.conversationMessage.createMany({data:[{conversationId:conversation.id,role:"user",text},{conversationId:conversation.id,role:"assistant",text:"Confirmed. Applying the pending action now."}]});
        return NextResponse.json({actionId:action.id,conversationId,result,pendingConfirmed:true});
      }
    }
    if(pending?.actionId && NEG.test(text)){
      await db.conversation.update({where:{id:conversation.id},data:{pendingAction:null,lastIntent:"CANCELLED"}});
      await db.conversationMessage.createMany({data:[{conversationId:conversation.id,role:"user",text},{conversationId:conversation.id,role:"assistant",text:"Okay, I won’t make that change."}]});
      return NextResponse.json({actionId:pending.actionId,conversationId,result:{intent:"UNKNOWN",entities:{cancelled:true},confidence:{intent:1},risk:"LOW",response:"Okay, I won’t make that change.",requiresConfirmation:false,needsClarification:false},cancelled:true});
    }

    const recent=(conversation.messages||[]).slice().reverse().map((m:any)=>({role:m.role,text:m.text}));
    const result=await interpret(s.businessId,text,{
      customerId:conversation.customerId,
      productId:conversation.productId,
      lastIntent:conversation.lastIntent,
      pendingIntent:pending?.intent||null,
      pendingEntities:pending?.entities||null,
      pendingQuestion:pending?.question||null,
      history:recent
    });

    let actionId=String(pending?.actionId||"");
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

    const mutation=result.risk!=="LOW" || result.requiresConfirmation || ["RECEIVE_PAYMENT","SETTLE_OUTSTANDING","CREATE_SALE","CREATE_PURCHASE","CREATE_EXPENSE","CREATE_REMINDER","ADJUST_STOCK","MANAGE_ENTITY"].includes(result.intent);
    const readyForConfirmation=mutation && !result.needsClarification;
    const nextPending=readyForConfirmation?{actionId,intent:result.intent,entities:result.entities,question:result.response||"Confirm this action.",status:"WAITING_CONFIRMATION",updatedAt:new Date().toISOString()}:null;

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
