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

async function uploadToGeminiFiles(key: string, bytes: Buffer, mimeType: string, displayName: string) {
  const init = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "x-goog-upload-protocol": "resumable",
      "x-goog-upload-command": "start",
      "x-goog-upload-header-content-length": String(bytes.length),
      "x-goog-upload-header-content-type": mimeType,
      "content-type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
    cache: "no-store",
  });
  const initText = await init.text();
  if (!init.ok) throw new Error(`Gemini file upload init failed (${init.status}): ${initText.slice(0, 600)}`);
  const uploadUrl = init.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini did not return a resumable upload URL.");

  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "content-length": String(bytes.length),
      "x-goog-upload-offset": "0",
      "x-goog-upload-command": "upload, finalize",
    },
    body: bytes,
    cache: "no-store",
  });
  const uploadText = await upload.text();
  if (!upload.ok) throw new Error(`Gemini audio upload failed (${upload.status}): ${uploadText.slice(0, 600)}`);
  let data: any;
  try { data = JSON.parse(uploadText); } catch { throw new Error("Gemini returned an invalid file-upload response."); }
  const uri = data?.file?.uri;
  const uploadedMime = data?.file?.mimeType || mimeType;
  if (!uri) throw new Error("Gemini audio upload completed without a file URI.");
  return { uri, mimeType: uploadedMime };
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "Gemini voice AI is not configured. Add GEMINI_API_KEY in Vercel." }, { status: 503 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    if (file.size < 500) return NextResponse.json({ error: "The recording is empty or too short. Please speak for a moment and try again." }, { status: 400 });
    if (file.size > 18_000_000) return NextResponse.json({ error: "Voice recording is too large. Please keep it short and try again." }, { status: 413 });

    const requestedLanguage = String(form.get("language") || "").toLowerCase();
    const languageCode = LANG_CODES[requestedLanguage];

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

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "audio/webm";
    const uploaded = await uploadToGeminiFiles(key, bytes, mimeType, `hisabflow-voice-${Date.now()}`);

    const model = process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.5-transcribe";
    const audioTranscriptionConfig: Record<string, any> = {
      mode: "SMART",
      customVocabulary: vocabulary,
    };
    if (languageCode) audioTranscriptionConfig.languageCodes = [languageCode];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } }] }],
          generationConfig: { audioTranscriptionConfig },
        }),
        cache: "no-store",
      },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Gemini transcription failed (${response.status}).`);

    const text = String(
      data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join(" ") || data?.text || "",
    ).trim();
    if (!text) throw new Error("Gemini processed the audio but returned no transcription. Please try again with a clear 1–15 second recording.");

    return NextResponse.json({ text, provider: "gemini", model });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not transcribe audio." }, { status: 500 });
  }
}
