import { db } from '../lib/db';
async function main(){
  const rows = await db.$queryRaw<{ok:number}[]>`SELECT 1 AS ok`;
  if(rows[0]?.ok !== 1) throw new Error('PostgreSQL connectivity check failed.');
  const result = await db.$queryRaw<{count:bigint}[]>`SELECT COUNT(*)::bigint AS count FROM information_schema.tables WHERE table_schema='public'`;
  if(Number(result[0]?.count||0) < 40) throw new Error(`Expected the Hisab Flow schema to contain at least 40 tables; found ${result[0]?.count}.`);
  console.log(JSON.stringify({ok:true,postgres:true,tables:Number(result[0].count)},null,2));
  await db.$disconnect();
}
main().catch(async e=>{console.error(e);await db.$disconnect();process.exit(1)});
