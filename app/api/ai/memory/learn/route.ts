import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { learnBusinessMemory } from "@/lib/ai/advanced";
export async function POST(){try{const s=await requireSession();return NextResponse.json({ok:true,...await learnBusinessMemory(s.businessId)});}catch(e:any){return NextResponse.json({error:e?.message||"Memory learning failed."},{status:500});}}
