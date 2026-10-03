import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquareText, Phone, ReceiptText } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { money, dateIN } from '@/lib/utils';

export default async function CustomerDetail({params}:{params:Promise<{id:string}>}) {
  const s=await requireSession();
  const {id}=await params;
  const c=await db.customer.findFirst({where:{id,businessId:s.businessId},include:{sales:{orderBy:{occurredAt:'desc'},take:20,include:{items:true}},payments:{orderBy:{occurredAt:'desc'},take:20},reminders:{orderBy:{dueAt:'asc'},take:10}}});
  if(!c) notFound();
  const balance=c.sales.reduce((a,x)=>a+Number(x.balanceDue),0);
  const events=[
    ...c.sales.map(x=>({type:'sale',date:x.occurredAt,title:`Invoice ${x.invoiceNumber}`,amount:Number(x.total),status:Number(x.balanceDue)>0?`Due ${money(x.balanceDue)}`:'Paid'})),
    ...c.payments.map(x=>({type:'payment',date:x.occurredAt,title:'Payment received',amount:Number(x.amount),status:x.method}))
  ].sort((a,b)=>+new Date(b.date)-+new Date(a.date));
  return <div className="mx-auto max-w-[1200px] px-5 py-7 lg:px-8">
    <Link href="/app/customers" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#718078]"><ArrowLeft size={15}/> Customers</Link>
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <div className="card p-6"><div className="flex items-start justify-between"><div><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#dff4ea] text-xl font-black text-[#0c6b4d]">{c.name.slice(0,1).toUpperCase()}</div><h1 className="mt-4 text-2xl font-black">{c.name}</h1><div className="mt-1 flex gap-3 text-sm text-[#718078]"><span className="flex items-center gap-1"><Phone size={14}/>{c.phone||'No phone'}</span></div></div><Link href={`/app/ask?customer=${c.id}`} className="btn btn-soft"><MessageSquareText size={15}/> Ask</Link></div><div className="mt-7 grid grid-cols-3 gap-3"><Metric label="Outstanding" value={money(balance)}/><Metric label="Invoices" value={String(c.sales.length)}/><Metric label="Payments" value={String(c.payments.length)}/></div></div>
      <div className="card p-6"><div className="font-black">Customer context</div><div className="mt-4 space-y-3 text-sm"><Info label="Email" value={c.email||'—'}/><Info label="GSTIN" value={c.gstin||'—'}/><Info label="Credit limit" value={money(c.creditLimit)}/><Info label="Notes" value={c.notes||'—'}/></div></div>
    </div>
    <div className="card mt-5 overflow-hidden"><div className="border-b border-[#e3e9e5] p-5"><div className="flex items-center gap-2 font-black"><ReceiptText size={17} className="text-[#0c6b4d]"/> Transaction timeline</div></div><div className="divide-y divide-[#e9eeeb]">{events.length?events.map((x,i)=><div key={i} className="flex items-center justify-between p-4"><div><div className="font-bold">{x.title}</div><div className="text-xs text-[#87948e]">{dateIN(x.date)} · {x.status}</div></div><div className={`font-black ${x.type==='payment'?'text-[#0c6b4d]':''}`}>{x.type==='payment'?'+ ':''}{money(x.amount)}</div></div>):<div className="p-10 text-center text-sm text-[#718078]">No transactions yet.</div>}</div></div>
  </div>
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-[#f6f9f7] p-4"><div className="text-xs text-[#819088]">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>}
function Info({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-4 border-b border-[#edf0ee] pb-3"><span className="text-[#7c8a83]">{label}</span><b className="text-right">{value}</b></div>}
