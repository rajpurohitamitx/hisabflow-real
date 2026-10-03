import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET(){try{const s=await requireSession();return NextResponse.json({logs:await db.auditLog.findMany({where:{businessId:s.businessId},orderBy:{createdAt:"desc"},take:100,include:{user:{select:{name:true}}}})});}catch(e:any){return NextResponse.json({error:e.message},{status:401});}}
