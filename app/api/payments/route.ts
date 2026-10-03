import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { receivePayment } from "@/lib/services/business";
export async function POST(req:Request){try{const s=await requireSession();const b=await req.json();const p=await receivePayment({businessId:s.businessId,userId:s.user.id,customerId:b.customerId,supplierId:b.supplierId,amount:b.amount,method:b.method||"CASH",saleId:b.saleId,purchaseId:b.purchaseId,notes:b.notes,occurredAt:b.occurredAt?new Date(b.occurredAt):undefined,source:b.source||"manual"});return NextResponse.json({payment:p},{status:201});}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
