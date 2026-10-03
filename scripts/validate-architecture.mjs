import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const required=[
 'prisma/schema.prisma','lib/services/business.ts','lib/ai/interpret.ts','lib/ai/advanced.ts',
 'app/api/ask/route.ts','app/api/ai/execute/route.ts','app/api/ai/insights/route.ts',
 'app/api/ai/entity/route.ts','app/api/ai/memory/learn/route.ts','app/api/ai/workflows/route.ts',
 'app/api/ai/copilot/route.ts','app/api/voice/realtime/route.ts','app/app/ai-insights/page.tsx'
];
const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
const schema=fs.readFileSync(path.join(root,'prisma/schema.prisma'),'utf8');
const models=[...schema.matchAll(/^model\s+(\w+)/gm)].map(m=>m[1]);
const requiredModels=['AIInsight','EntityResolutionEvent','WorkflowRun','BusinessMemory','Alias','Conversation','AIAction','AuditLog'];
const missingModels=requiredModels.filter(x=>!models.includes(x));
if(missing.length||missingModels.length){console.error(JSON.stringify({ok:false,missing,missingModels},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,filesChecked:required.length,advancedModels:requiredModels},null,2));
