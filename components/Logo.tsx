import { Sparkles } from "lucide-react";
export function Logo({dark=false}:{dark?:boolean}){return <div className={`flex items-center gap-2 font-black tracking-tight ${dark?"text-white":"text-[#0c6b4d]"}`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0c6b4d] text-white"><Sparkles size={17}/></span><span>Hisab<span className="text-[#45b987]">Flow</span></span></div>}
