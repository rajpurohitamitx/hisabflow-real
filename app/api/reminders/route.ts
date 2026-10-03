import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
const schema=z.object({title:z.string().min(1),dueAt:z.string(),customerId:z.string().optional(),notes:z.string().optional(),channel:z.string().default("in_app")});
export async function GET(){try{const s=await requireSession();return NextResponse.json({reminders:await db.reminder.findMany({where:{businessId:s.businessId,status:"PENDING"},include:{customer:true},orderBy:{dueAt:"asc"}})});}catch(e:any){return NextResponse.json({error:e.message},{status:401});}}
export async function POST(req:Request){try{const s=await requireSession();const d=schema.parse(await req.json());const r=await db.reminder.create({data:{businessId:s.businessId,title:d.title,dueAt:new Date(d.dueAt),customerId:d.customerId,notes:d.notes,channel:d.channel}});await audit({businessId:s.businessId,userId:s.user.id,action:"REMINDER_CREATED",entityType:"Reminder",entityId:r.id,after:r});return NextResponse.json({reminder:r},{status:201});}catch(e:any){return NextResponse.json({error:e?.issues?.[0]?.message||e.message},{status:400});}}
