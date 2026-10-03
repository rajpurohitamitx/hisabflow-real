'use client';
import { useEffect } from 'react';
export default function Error({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
  useEffect(()=>{console.error(error)},[error]);
  return <main className="min-h-screen grid place-items-center p-6"><section className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-semibold">Something went wrong</h1><p className="mt-2 text-sm text-slate-600">Your data was not intentionally deleted. Please try again.</p><button onClick={()=>reset()} className="mt-6 rounded-xl bg-emerald-700 px-5 py-3 text-white">Try again</button></section></main>;
}
