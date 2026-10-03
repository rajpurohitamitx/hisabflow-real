import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveEntityAdvanced } from "@/lib/ai/advanced";
export async function POST(req:Request){try{const s=await requireSession();const {kind,query}=await req.json();if(!["customer","product","supplier"].includes(kind)||!query)return NextResponse.json({error:"kind and query are required"},{status:400});const r=await resolveEntityAdvanced(s.businessId,kind,query);await db.entityResolutionEvent.create({data:{businessId:s.businessId,kind,query,selectedId:r.selected?.id||null,confidence:r.confidence,candidates:r.matches.map((x:any)=>({id:x.id,name:x.name,score:x._score})),outcome:r.selected?"SELECTED":"CLARIFY"}});return NextResponse.json({ok:true,...r});}catch(e:any){return NextResponse.json({error:e?.message||"Entity resolution failed."},{status:500});}}
