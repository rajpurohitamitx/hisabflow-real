import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { runIndustryWorkflow } from "@/lib/ai/advanced";
export async function POST(req:Request){try{const s=await requireSession();const {workflow,payload}=await req.json();const result=await runIndustryWorkflow(s.businessId,workflow,payload||{});const run=await db.workflowRun.create({data:{businessId:s.businessId,workflow,status:result.status,input:payload||{},result}});return NextResponse.json({ok:true,run,result});}catch(e:any){return NextResponse.json({error:e?.message||"Workflow failed."},{status:500});}}
