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

    // Use the Generate Content REST endpoint with inlineData. The previous build
    // sent raw base64 audio to the Interactions API as `data`, while the documented
    // Interactions REST flow expects an uploaded Files API URI. For short microphone
    // recordings, inlineData through generateContent is simpler and works directly
    // from a Vercel serverless function.
    const generationConfig: any = {
      audioTranscriptionConfig: {
        mode: "SMART",
        customVocabulary: vocabulary,
        ...(languageCode ? { languageCodes: [languageCode] } : { languageCodes: [] }),
      },
    };

    const model = process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.5-transcribe";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: audio,
                  },
                },
                {
                  text: "Transcribe the spoken audio accurately. Return only the spoken transcription. Preserve names, products, quantities, currencies, numbers, Hindi/Tamil/Tanglish/Hinglish and other code-switched business speech. Do not answer the speaker or summarize the audio.",
                },
              ],
            },
          ],
          generationConfig,
        }),
        cache: "no-store",
      },
    );

    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || `Gemini transcription failed (${response.status}).`;
      throw new Error(message);
    }

    const text = String(
      data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text || "")
        ?.join(" ") || data?.text || ""
    ).trim();

    if (!text) {
      throw new Error(
        "Gemini received the audio but returned no transcription. Please try again with a clear 1–15 second recording."
      );
    }

    return NextResponse.json({ text, provider: "gemini", model });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not transcribe audio." }, { status: 500 });
  }
}
