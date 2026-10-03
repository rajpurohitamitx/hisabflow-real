import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createExpense } from "@/lib/services/business";
export async function GET(){try{const s=await requireSession();const {db}=await import("@/lib/db");return NextResponse.json({expenses:await db.expense.findMany({where:{businessId:s.businessId},orderBy:{occurredAt:"desc"},take:100})});}catch(e:any){return NextResponse.json({error:e.message},{status:401});}}
export async function POST(req:Request){try{const s=await requireSession();const b=await req.json();const e=await createExpense({businessId:s.businessId,userId:s.user.id,category:b.category||"General",amount:b.amount,description:b.description,paymentMethod:b.paymentMethod||"CASH",occurredAt:b.occurredAt?new Date(b.occurredAt):undefined});return NextResponse.json({expense:e},{status:201});}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
