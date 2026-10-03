import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { interpret } from "@/lib/ai/interpret";

export async function POST(req:Request){
  try{
    const s=await requireSession(); const body=await req.json(); const {text,conversationId="default",pendingContext}=body;
    if(!text?.trim()) return NextResponse.json({error:"Tell Hisab Flow what you need."},{status:400});
    const conversation=await db.conversation.findUnique({where:{businessId_key:{businessId:s.businessId,key:conversationId}},include:{messages:{orderBy:{createdAt:"desc"},take:12}}});
    const result=await interpret(s.businessId,text,{customerId:conversation?.customerId,productId:conversation?.productId,lastIntent:conversation?.lastIntent,pendingIntent:pendingContext?.intent||null,pendingEntities:pendingContext?.entities||null,pendingQuestion:pendingContext?.question||null,history:(conversation?.messages||[]).slice().reverse().map((m:any)=>({role:m.role,text:m.text}))});
    const action=await db.aIAction.create({data:{businessId:s.businessId,userId:s.user.id,input:text,intent:result.intent,entities:result.entities as any,confidence:result.confidence as any,risk:result.risk,status:"INTERPRETED"}});
    const conv=conversation || await db.conversation.create({data:{businessId:s.businessId,key:conversationId}});
    await db.conversationMessage.createMany({data:[{conversationId:conv.id,role:"user",text},{conversationId:conv.id,role:"assistant",text:result.response||""}]});
    await db.conversation.update({where:{id:conv.id},data:{customerId:(result.entities as any).customerId||conv.customerId,productId:(result.entities as any).productId||conv.productId,lastIntent:result.intent}});
    return NextResponse.json({actionId:action.id,conversationId,result});
  }catch(e:any){return NextResponse.json({error:e.message},{status:e.message==="UNAUTHENTICATED"?401:500});}
}
