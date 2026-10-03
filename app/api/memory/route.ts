import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
export async function GET(){try{const s=await requireSession();return NextResponse.json({memory:await db.businessMemory.findMany({where:{businessId:s.businessId,active:true},orderBy:{key:"asc"}})});}catch(e:any){return NextResponse.json({error:e.message},{status:401});}}
export async function POST(req:Request){try{const s=await requireSession();const b=await req.json();if(!b.key) return NextResponse.json({error:"Memory key is required."},{status:400});const m=await db.businessMemory.upsert({where:{businessId_key:{businessId:s.businessId,key:b.key}},update:{value:b.value,scope:b.scope||"BUSINESS",active:true},create:{businessId:s.businessId,key:b.key,value:b.value,scope:b.scope||"BUSINESS"}});await audit({businessId:s.businessId,userId:s.user.id,action:"BUSINESS_MEMORY_UPDATED",entityType:"BusinessMemory",entityId:m.id,after:m});return NextResponse.json({memory:m});}catch(e:any){return NextResponse.json({error:e.message},{status:400});}}
