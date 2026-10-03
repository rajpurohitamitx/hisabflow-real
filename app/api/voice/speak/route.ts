import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    await requireSession();
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Voice AI is not configured." }, { status: 503 });
    const { text, voice = "coral", language } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: "Text is required." }, { status: 400 });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = language ? `Speak naturally for an Indian business owner. Language preference: ${language}. Keep numbers and currency clear.` : "Speak naturally, warmly and clearly for an Indian business owner.";
    const audio = await client.audio.speech.create({ model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", voice, input: text, instructions: prompt, response_format: "mp3" } as any);
    return new NextResponse(Buffer.from(await audio.arrayBuffer()), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not synthesize speech." }, { status: 500 });
  }
}
