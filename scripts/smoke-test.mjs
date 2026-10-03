import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const required=[
 'app/api/auth/login/route.ts','app/api/auth/register/route.ts','app/api/auth/logout/route.ts',
 'app/api/sales/route.ts','app/api/purchases/route.ts','app/api/payments/route.ts',
 'app/api/customers/route.ts','app/api/products/route.ts','app/api/expenses/route.ts',
 'app/api/ask/route.ts','app/api/ai/execute/route.ts','app/api/ai/insights/route.ts',
 'app/api/ai/entity/route.ts','app/api/ai/memory/learn/route.ts','app/api/ai/workflows/route.ts','app/api/ai/copilot/route.ts',
 'lib/services/business.ts','lib/ai/interpret.ts','lib/ai/advanced.ts','prisma/schema.prisma'
];
const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const checks={
 nextBuild:Boolean(pkg.scripts?.build),
 prismaGenerate:Boolean(pkg.scripts?.['db:generate']),
 prismaDeploy:Boolean(pkg.scripts?.['db:deploy']),
 auth:fs.existsSync(path.join(root,'lib/auth.ts')),
 envExample:fs.existsSync(path.join(root,'.env.example')),
 securityHeaders:fs.existsSync(path.join(root,'next.config.ts')),
 missing
};
if(missing.length || !checks.nextBuild || !checks.prismaGenerate || !checks.prismaDeploy){console.error(JSON.stringify({ok:false,checks},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks},null,2));
