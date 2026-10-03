import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const LANG_CODES: Record<string, string> = {
  english: "en-IN", hindi: "hi-IN", tamil: "ta-IN", telugu: "te-IN",
  kannada: "kn-IN", malayalam: "ml-IN", marathi: "mr-IN", bengali: "bn-IN",
  gujarati: "gu-IN",
};

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "Gemini voice AI is not configured. Add GEMINI_API_KEY in Vercel." }, { status: 503 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    if (file.size > 18_000_000) return NextResponse.json({ error: "Voice recording is too large. Please keep it short and try again." }, { status: 413 });

    const requestedLanguage = String(form.get("language") || "").toLowerCase();
    const languageCode = LANG_CODES[requestedLanguage];

    // Give the transcription model the vocabulary that actually exists in this business.
    // This is deliberately dynamic: customer/product names do not need to be hard-coded.
    const [customers, products, memories, aliases] = await Promise.all([
      db.customer.findMany({ where: { businessId: session.businessId, archived: false }, select: { name: true }, take: 250 }),
      db.product.findMany({ where: { businessId: session.businessId, archived: false }, select: { name: true, sku: true }, take: 250 }),
      db.businessMemory.findMany({ where: { businessId: session.businessId, active: true }, select: { key: true, value: true }, take: 100 }),
      db.alias.findMany({ where: { businessId: session.businessId }, select: { value: true, normalized: true }, take: 250 }),
    ]);

    const vocabulary = Array.from(new Set([
      ...customers.map(x => x.name),
      ...products.flatMap(x => [x.name, x.sku].filter(Boolean) as string[]),
      ...memories.flatMap(x => [x.key, x.value].filter(Boolean) as string[]),
      ...aliases.flatMap(x => [x.value, x.normalized].filter(Boolean)),
      "Hisab Flow", "rupees", "INR", "cash", "UPI", "credit", "balance", "bill", "invoice", "sale", "purchase", "payment", "stock", "chain", "ring",
    ])).filter(x => x && x.length > 1).slice(0, 1000);

    const audio = Buffer.from(await file.arrayBuffer()).toString("base64");
    const mimeType = file.type || "audio/webm";

    const transcriptionConfig: any = {
      mode: "smart",
      custom_vocabulary: vocabulary,
    };
    if (languageCode) transcriptionConfig.language_codes = [languageCode];
    else transcriptionConfig.language_codes = [];

    // Gemini 3.5 Transcribe is specifically designed for multilingual/code-switched speech,
    // automatic language detection, smart number formatting and custom vocabulary biasing.
    // We use the Interactions API with inline audio so no local server or browser STT is needed.
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        model: process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.5-transcribe",
        input: [{ type: "audio", data: audio, mime_type: mimeType }],
        generation_config: { transcription_config: transcriptionConfig },
      }),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Gemini transcription failed (${response.status}).`);
    const text = String(data?.output_text || data?.outputs?.find((x: any) => x.type === "text")?.text || "").trim();
    if (!text) throw new Error("Gemini returned an empty transcription. Please try speaking again.");
    return NextResponse.json({ text, provider: "gemini", model: process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.5-transcribe" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not transcribe audio." }, { status: 500 });
  }
}
