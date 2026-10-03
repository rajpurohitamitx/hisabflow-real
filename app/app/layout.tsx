import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
export default async function Layout({children}:{children:React.ReactNode}){try{const s=await requireSession();return <AppShell user={s.user} business={s.business}>{children}</AppShell>}catch{redirect('/login')}}
