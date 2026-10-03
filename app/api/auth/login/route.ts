import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
const schema=z.object({email:z.string().email(),password:z.string().min(1)});
export async function POST(req:Request){
  try{const data=schema.parse(await req.json()); const user=await db.user.findUnique({where:{email:data.email.toLowerCase()},include:{memberships:{include:{business:true},orderBy:{createdAt:"asc"}}}}); if(!user||!(await bcrypt.compare(data.password,user.passwordHash))) return NextResponse.json({error:"Invalid email or password."},{status:401}); const membership=user.memberships[0]; if(!membership) return NextResponse.json({error:"No business is connected to this account."},{status:403}); await createSession(user.id,membership.businessId); return NextResponse.json({ok:true});}
  catch(e:any){return NextResponse.json({error:e?.message||"Login failed."},{status:400});}
}
