import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const COOKIE = "hf_session";
function secretKey(){
  const raw=process.env.SESSION_SECRET;
  if(process.env.NODE_ENV==='production' && (!raw || raw.length<32)) throw new Error('SESSION_SECRET must be configured with at least 32 characters in production.');
  return new TextEncoder().encode(raw || "dev-only-change-me-please-32-chars");
}
export async function createSession(userId:string,businessId:string){const token=await new SignJWT({userId,businessId}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("30d").sign(secretKey());const jar=await cookies();jar.set(COOKIE,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==='production',path:"/",maxAge:60*60*24*30});}
export async function clearSession(){(await cookies()).delete(COOKIE)}
export async function getSession(){const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;try{return(await jwtVerify(token,secretKey())).payload as {userId:string;businessId:string}}catch{return null}}
export async function requireSession(){const session=await getSession();if(!session?.userId||!session.businessId)throw new Error('UNAUTHENTICATED');const membership=await db.membership.findUnique({where:{userId_businessId:{userId:session.userId,businessId:session.businessId}},include:{user:true,business:true}});if(!membership)throw new Error('UNAUTHENTICATED');return membership}
