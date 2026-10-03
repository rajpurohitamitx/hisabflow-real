import { requireSession } from "@/lib/auth"; import { dashboardSummary } from "@/lib/services/business"; import { DashboardClient } from "@/components/DashboardClient";
export default async function Dashboard(){const s=await requireSession();const summary=await dashboardSummary(s.businessId);return <DashboardClient initial={summary}/>}
