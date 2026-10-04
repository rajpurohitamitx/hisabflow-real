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
      ...customers.map((x: { name: string }) => x.name),
      ...products.flatMap((x: { name: string; sku: string | null }) => [x.name, x.sku].filter(Boolean) as string[]),
      ...memories.flatMap((x: { key: string; value: unknown }) => [x.key, typeof x.value === "string" ? x.value : ""].filter(Boolean)),
      ...aliases.flatMap((x: { value: string; normalized: string }) => [x.value, x.normalized].filter(Boolean)),
      "Hisab Flow", "rupees", "INR", "cash", "UPI", "credit", "balance", "bill", "invoice", "sale", "purchase", "payment", "stock", "chain", "ring",
    ])).filter(x => x && x.length > 1).slice(0, 1000);

    // Keep the audio as standard Web API binary data. This avoids Node Buffer
    // generic-type incompatibilities in Vercel's TypeScript/fetch definitions.
    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || "audio/webm";

    // Gemini 3.5 Transcribe's documented REST flow uploads the audio through
    // the Files API first, then passes the returned file URI to generateContent.
    // This is more reliable than sending microphone WebM as inlineData.
    const displayName = `hisabflow-voice-${Date.now()}.webm`;

    // Use the documented resumable Files API flow. The Transcribe model's
    // REST examples upload the audio first and then reference the returned
    // file URI from generateContent.
    const initResponse = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "x-goog-upload-protocol": "resumable",
          "x-goog-upload-command": "start",
          "x-goog-upload-header-content-length": String(sourceBytes.byteLength),
          "x-goog-upload-header-content-type": mimeType,
          "content-type": "application/json",
        },
        body: JSON.stringify({ file: { display_name: displayName } }),
        cache: "no-store",
      },
    );

    if (!initResponse.ok) {
      const initData = await initResponse.json().catch(() => ({}));
      throw new Error(initData?.error?.message || `Gemini file upload initialization failed (${initResponse.status}).`);
    }

    const uploadUrl = initResponse.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      throw new Error("Gemini did not return an upload URL for the voice recording.");
    }

    // Build a plain ArrayBuffer so Node/TypeScript fetch accepts the request body
    // without the Buffer<ArrayBufferLike> vs BodyInit type mismatch.
    const uploadBody = new ArrayBuffer(sourceBytes.byteLength);
    new Uint8Array(uploadBody).set(sourceBytes);

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "content-length": String(sourceBytes.byteLength),
        "x-goog-upload-offset": "0",
        "x-goog-upload-command": "upload, finalize",
      },
      body: uploadBody,
      cache: "no-store",
    });

    const uploadData = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      throw new Error(uploadData?.error?.message || `Gemini audio upload failed (${uploadResponse.status}).`);
    }

    const fileUri = uploadData?.file?.uri;
    const uploadedMimeType = uploadData?.file?.mimeType || mimeType;
    if (!fileUri) {
      throw new Error("Gemini uploaded the recording but did not return a file URI.");
    }

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
                  fileData: {
                    fileUri,
                    mimeType: uploadedMimeType,
                  },
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
        "Gemini processed the audio but returned no transcription. Please try a clear 1–15 second recording."
      );
    }

    return NextResponse.json({ text, provider: "gemini", model });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not transcribe audio." }, { status: 500 });
  }
}
