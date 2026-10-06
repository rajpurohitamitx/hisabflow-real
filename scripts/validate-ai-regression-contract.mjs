import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ask=read('app/api/ask/route.ts');
const interpret=read('lib/ai/interpret.ts');
const execute=read('app/api/ai/execute/route.ts');
const required=[
  ['pending actions survive clarification',/const nextPending=mutation\?/s,ask],
  ['affirmations execute persisted action',/pendingConfirmed:true/,ask],
  ['vague leave is not destructive',/Do you want me to cancel the pending action\?/,ask],
  ['current action entities can be overridden safely',/entitiesOverride/,execute],
  ['idempotent action claim',/updateMany\(\{where:\{id:action\.id,businessId:s\.businessId,status:"INTERPRETED"\}/,execute],
  ['server clears completed pending action',/pendingAction:Prisma\.DbNull/,execute],
  ['relative reminder dates are deterministic',/normalizeReminderRelativeDate/,interpret],
  ['strict customer resolution',/Never fuzzy-map a new name such as Ram to Ramesh/,interpret],
  ['payment/sale semantic safety',/paymentLanguage && !saleLanguageStrong/,interpret]
];
let failed=[];
for(const [name,re,file] of required) if(!re.test(file)) failed.push(name);
const cases=JSON.parse(fs.readFileSync(path.join(root,'scripts/ai-regression-cases.json'),'utf8'));
if(cases.cases.length<10) failed.push('golden regression case set too small');
if(failed.length){console.error(JSON.stringify({ok:false,failed},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:required.length,goldenCases:cases.cases.length},null,2));
