import { spawnSync } from 'node:child_process';
const run=(cmd,args,env={})=>{const r=spawnSync(cmd,args,{stdio:'inherit',shell:false,env:{...process.env,...env}});if(r.status!==0)process.exit(r.status??1)};
// Generate Prisma Client on every build. On production Vercel builds, apply reviewed migrations first.
if(process.env.VERCEL_ENV==='production' && process.env.DATABASE_URL){run(process.platform==='win32'?'npx.cmd':'npx',['prisma','migrate','deploy']);}
run(process.platform==='win32'?'npx.cmd':'npx',['prisma','generate']);
run(process.platform==='win32'?'npx.cmd':'npx',['next','build']);
