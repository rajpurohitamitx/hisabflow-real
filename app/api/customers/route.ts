import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
const schema=z.object({name:z.string().min(1),phone:z.string().optional(),email:z.string().optional(),address:z.string().optional(),gstin:z.string().optional(),creditLimit:z.coerce.number().min(0).default(0),notes:z.string().optional()});
export async function GET(req:Request){try{const s=await requireSession();const q=new URL(req.url).searchParams.get("q")||"";const customers=await db.customer.findMany({where:{businessId:s.businessId,archived:false,OR:q?[{name:{contains:q,mode:"insensitive"}},{phone:{contains:q}}]:undefined},orderBy:{name:"asc"},take:100});return NextResponse.json({customers});}catch(e:any){return NextResponse.json({error:e.message},{status:401});}}
export async function POST(req:Request){try{const s=await requireSession();const d=schema.parse(await req.json());const c=await db.customer.create({data:{businessId:s.businessId,...d}});await audit({businessId:s.businessId,userId:s.user.id,action:"CUSTOMER_CREATED",entityType:"Customer",entityId:c.id,after:c});return NextResponse.json({customer:c},{status:201});}catch(e:any){return NextResponse.json({error:e?.issues?.[0]?.message||e.message},{status:400});}}
