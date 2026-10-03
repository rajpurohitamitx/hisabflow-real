import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { dashboardSummary } from "@/lib/services/business";
export async function GET(){try{const s=await requireSession();return NextResponse.json(await dashboardSummary(s.businessId));}catch(e:any){return NextResponse.json({error:e.message},{status:e.message==="UNAUTHENTICATED"?401:500});}}
