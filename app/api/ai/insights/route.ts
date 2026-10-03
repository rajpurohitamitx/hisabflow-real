import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { detectAnomalies, buildForecast, generateProactiveRecommendations } from "@/lib/ai/advanced";

export async function GET(){
  try{const s=await requireSession(); const [forecast,anomalies,recs]=await Promise.all([buildForecast(s.businessId,30),detectAnomalies(s.businessId,90),generateProactiveRecommendations(s.businessId)]); return NextResponse.json({ok:true,forecast,anomalies,recommendations:recs.recommendations});}
  catch(e:any){return NextResponse.json({error:e?.message||"Unable to generate insights."},{status:500});}
}
