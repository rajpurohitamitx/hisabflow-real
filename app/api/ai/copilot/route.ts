import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateProactiveRecommendations, runIndustryWorkflow } from "@/lib/ai/advanced";
import { isLocalAIEnabled, ollamaJson } from "@/lib/ai/ollama";
import { geminiJson, isGeminiEnabled } from "@/lib/ai/gemini";

export async function POST(req:Request){
  try{
    const s=await requireSession();
    const body=await req.json().catch(()=>({}));
    const goal=body.goal||"Run my business checkup";
    const autoExecuteLowRisk=Boolean(body.autoExecuteLowRisk);
    const plan=await generateProactiveRecommendations(s.businessId);
    let narrative=`Business copilot plan for: ${goal}.\n\n`+plan.recommendations.map((x:any,i:number)=>`${i+1}. [${x.priority}] ${x.title}: ${x.reason}`).join("\n");
    try{
      const system="You are the planning layer of Hisab Flow. Do not invent financial facts. Turn grounded business signals into concise actionable steps. Never directly execute money-moving actions. Return JSON with summary and steps; each step has title, reason, risk (LOW/MEDIUM/HIGH), action.";
      if(isLocalAIEnabled()) {
        const result=await ollamaJson([{role:"system",content:system},{role:"user",content:narrative}]);
        narrative=JSON.stringify(result);
      } else if(isGeminiEnabled()){
        const result=await geminiJson([{role:"user",content:`${system}\n\nGrounded business signals:\n${narrative}`}]);
        narrative=JSON.stringify(result);
      } else if(process.env.OPENAI_API_KEY){
        const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
        const r=await client.responses.create({model:process.env.OPENAI_TEXT_MODEL||"gpt-5.6-luna",input:[{role:"system",content:system},{role:"user",content:narrative}],text:{format:{type:"json_schema",name:"copilot_plan",strict:true,schema:{type:"object",properties:{summary:{type:"string"},steps:{type:"array",items:{type:"object",properties:{title:{type:"string"},reason:{type:"string"},risk:{type:"string",enum:["LOW","MEDIUM","HIGH"]},action:{type:"string"}},required:["title","reason","risk","action"],additionalProperties:false}}},required:["summary","steps"],additionalProperties:false}}}} as any);
        narrative=JSON.stringify(JSON.parse(r.output_text));
      }
    }catch{}
    const workflow=await runIndustryWorkflow(s.businessId,"DAILY_OPENING",{goal,autoExecuteLowRisk});
    const run=await db.workflowRun.create({data:{businessId:s.businessId,workflow:"COPILOT",status:"READY",input:{goal,autoExecuteLowRisk},result:{plan,workflow,narrative}}});
    return NextResponse.json({ok:true,runId:run.id,plan,workflow,narrative});
  }catch(e:any){return NextResponse.json({error:e?.message||"Copilot failed."},{status:e?.message==="UNAUTHENTICATED"?401:500});}
}
