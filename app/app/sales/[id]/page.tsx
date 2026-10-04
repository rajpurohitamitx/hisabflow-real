import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, UserRound, ReceiptText, Package, WalletCards } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { money, dateIN } from '@/lib/utils';

export default async function SaleDetail({params}:{params:Promise<{id:string}>}){
 const s=await requireSession(); const {id}=await params;
 const sale=await db.sale.findFirst({where:{id,businessId:s.businessId},include:{customer:true,items:{include:{product:true}},payments:{orderBy:{occurredAt:'asc'}},allocations:{include:{payment:true}}}});
 if(!sale) notFound();
 const paid=Number(sale.amountPaid), due=Number(sale.balanceDue), total=Number(sale.total);
 return <div className="mx-auto max-w-[1200px] px-5 py-7 lg:px-8">
  <Link href="/app/sales" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#718078]"><ArrowLeft size={15}/> Sales</Link>
  <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
   <div className="card p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-[.16em] text-[#8a9791]">Sale / Invoice</div><h1 className="mt-1 text-2xl font-black">{sale.invoiceNumber}</h1><div className="mt-1 text-sm text-[#718078]">{dateIN(sale.occurredAt)}</div></div><span className={due>0?'badge badge-amber':'badge badge-green'}>{due>0?`Due ${money(due)}`:<><CheckCircle2 size={12}/> Paid</>}</span></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Sale total" value={money(total)}/><Metric label="Paid" value={money(paid)}/><Metric label="Balance due" value={money(due)}/></div>
    <div className="mt-7"><div className="flex items-center gap-2 font-black"><Package size={17} className="text-[#0c6b4d]"/> What was purchased</div><div className="mt-3 overflow-hidden rounded-2xl border border-[#e4ebe7]">{sale.items.map((x:any)=><div key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ee] p-4 last:border-0"><div><div className="font-bold">{x.nameSnapshot}</div><div className="text-xs text-[#7d8b84]">{Number(x.quantity)} {x.product?.unit||'unit'} × {money(x.rate)}</div></div><div className="font-black">{money(x.lineTotal)}</div></div>)}</div></div>
    <div className="mt-7"><div className="flex items-center gap-2 font-black"><WalletCards size={17} className="text-[#0c6b4d]"/> Payments</div><div className="mt-3 space-y-2">{sale.payments.length?sale.payments.map((p:any)=><div key={p.id} className="flex items-center justify-between rounded-2xl bg-[#f6f9f7] p-4"><div><div className="font-bold">{p.kind==='CUSTOMER_RECEIPT'?'Payment received':'Payment'}</div><div className="text-xs text-[#7d8b84]">{p.method} · {dateIN(p.occurredAt)}</div></div><div className="font-black text-[#0c6b4d]">{money(p.amount)}</div></div>):<div className="rounded-2xl bg-[#f6f9f7] p-4 text-sm text-[#718078]">No payment recorded on this sale.</div>}</div></div>
   </div>
   <div className="space-y-5">
    <div className="card p-6"><div className="flex items-center gap-2 font-black"><UserRound size={17} className="text-[#0c6b4d]"/> Customer</div>{sale.customer?<><Link href={`/app/customers/${sale.customer.id}`} className="mt-4 block rounded-2xl border border-[#dfe9e4] p-4 hover:bg-[#f7faf8]"><div className="text-lg font-black">{sale.customer.name}</div><div className="mt-1 text-sm text-[#718078]">{sale.customer.phone||'No phone'} · {sale.customer.address||'No address'}</div><div className="mt-2 text-xs font-bold text-[#0c6b4d]">Open full customer profile →</div></Link></>:<div className="mt-4 rounded-2xl bg-[#f6f9f7] p-4"><div className="font-bold">Walk-in customer</div><div className="mt-1 text-sm text-[#718078]">No customer profile was attached to this sale, so there are no customer details to display.</div></div>}</div>
    <div className="card p-6"><div className="flex items-center gap-2 font-black"><ReceiptText size={17} className="text-[#0c6b4d]"/> Accounting</div><div className="mt-4 space-y-3 text-sm"><Info label="Invoice" value={sale.invoiceNumber}/><Info label="Source" value={sale.source}/><Info label="Status" value={sale.status}/><Info label="Created" value={dateIN(sale.createdAt)}/><Info label="Notes" value={sale.notes||'—'}/></div></div>
   </div>
  </div>
 </div>
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-[#f6f9f7] p-4"><div className="text-xs text-[#819088]">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>}
function Info({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-4 border-b border-[#edf0ee] pb-3"><span className="text-[#7c8a83]">{label}</span><b className="text-right">{value}</b></div>}
