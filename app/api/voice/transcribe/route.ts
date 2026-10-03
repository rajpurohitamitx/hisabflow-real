import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    await requireSession();
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Voice AI is not configured. Add OPENAI_API_KEY in your environment." }, { status: 503 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await client.audio.transcriptions.create({
      file,
      model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
      language: mapLanguage(typeof form.get("language") === "string" ? String(form.get("language")) : ""),
      prompt: "Indian business conversation. Preserve names, numbers, currencies, product names and code-mixed Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati and English.",
    });
    return NextResponse.json({ text: result.text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not transcribe audio." }, { status: 500 });
  }
}

function mapLanguage(name:string){const x=name.toLowerCase();return ({english:"en",hindi:"hi",tamil:"ta",telugu:"te",kannada:"kn",malayalam:"ml",marathi:"mr",bengali:"bn",gujarati:"gu"} as Record<string,string>)[x] || undefined;}
