import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

const schema=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(8),businessName:z.string().min(2),businessType:z.string().default("general")});
export async function POST(req:Request){
  try{
    const data=schema.parse(await req.json());
    const exists=await db.user.findUnique({where:{email:data.email.toLowerCase()}}); if(exists) return NextResponse.json({error:"An account with this email already exists."},{status:409});
    const passwordHash=await bcrypt.hash(data.password,12);
    const result=await db.$transaction(async tx=>{
      const user=await tx.user.create({data:{name:data.name,email:data.email.toLowerCase(),passwordHash}});
      const business=await tx.business.create({data:{name:data.businessName,businessType:data.businessType}});
      await tx.membership.create({data:{userId:user.id,businessId:business.id,role:"OWNER"}});
      const branch=await tx.branch.create({data:{businessId:business.id,name:"Main Branch",code:"MAIN",isMain:true}});
      await tx.industryConfig.create({data:{businessId:business.id,industry:data.businessType,fields:{},rules:{},vocabulary:{},workflows:{},templates:{}}});
      return {user,business,branch};
    });
    await createSession(result.user.id,result.business.id);
    return NextResponse.json({ok:true});
  }catch(e:any){return NextResponse.json({error:e?.issues?.[0]?.message||e?.message||"Registration failed."},{status:400});}
}
