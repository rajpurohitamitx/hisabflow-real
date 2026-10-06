import fs from 'node:fs';
const ask=fs.readFileSync(new URL('../app/api/ask/route.ts', import.meta.url),'utf8');
const interpret=fs.readFileSync(new URL('../lib/ai/interpret.ts', import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../components/AskHisab.tsx', import.meta.url),'utf8');
const execute=fs.readFileSync(new URL('../app/api/ai/execute/route.ts', import.meta.url),'utf8');
const checks=[
 ['new message gets fresh interpretation before pending patch',ask.includes('const fresh=await interpret')],
 ['read-only intents bypass pending mutation',ask.includes('const readOnlyIntents=new Set')&&ask.includes('readOnlyIntents.has(fresh.intent)')],
 ['bulk destructive request is refused',ask.includes('destructiveRequest:true')],
 ['customer balance list is deterministic',interpret.includes('OUTSTANDING_CUSTOMERS')&&interpret.includes('customers?|clients?')],
 ['reminder search exists',interpret.includes('SEARCH_REMINDERS')&&execute.includes('case "SEARCH_REMINDERS"')],
 ['safe reads auto execute',ui.includes('const safeRead=readOnlyIntents.has(result.intent)')],
 ['outstanding never negative',fs.readFileSync(new URL('../lib/services/business.ts', import.meta.url),'utf8').includes('return net.gt(0) ? net : new D(0);')],
];
let ok=true; for(const [n,v] of checks){console.log(`${v?'PASS':'FAIL'} ${n}`); if(!v)ok=false} process.exit(ok?0:1);
