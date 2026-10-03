import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    await requireSession();
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Voice AI is not configured. Add OPENAI_API_KEY." }, { status: 503 });
    const offer = await req.text();
    if (!offer.trim()) return NextResponse.json({ error: "WebRTC SDP offer is required." }, { status: 400 });
    const language = req.headers.get("x-hisab-language") || "Auto";
    const instructions = `You are Hisab Flow's real-time voice interface for an Indian business owner. Be warm, concise and natural. Understand English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati and code-mixed speech. Preserve names, numbers, INR amounts and business terms. You are a voice interface, not the accounting database. For every business request, call the hisab_command tool with the user's natural-language command. Never invent transaction results. If a tool says confirmation is required, tell the user clearly and wait for confirmation. Language preference: ${language}.`;
    const session = {
      type: "realtime",
      model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
      audio: {
        input: { noise_reduction: { type: "near_field" }, transcription: { model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe", ...(language !== "Auto" ? { language: languageCode(language) } : {}) } },
        output: { voice: process.env.OPENAI_REALTIME_VOICE || "marin", speed: 1.0 },
      },
      instructions,
      tools: [{ type: "function", name: "hisab_command", description: "Send the user's complete natural-language business request to Hisab Flow. The server will interpret it against live business data and enforce permissions and financial safety.", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false } }],
      tool_choice: "auto",
      output_modalities: ["audio"],
    };
    const form = new FormData();
    form.append("sdp", offer);
    form.append("session", JSON.stringify(session));
    const r = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
    const body = await r.text();
    return new NextResponse(body, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || "application/sdp" } });
  } catch (e: any) { return NextResponse.json({ error: e?.message || "Could not start realtime voice." }, { status: 500 }); }
}
function languageCode(name: string) { const x=name.toLowerCase(); return ({english:"en",hindi:"hi",tamil:"ta",telugu:"te",kannada:"kn",malayalam:"ml",marathi:"mr",bengali:"bn",gujarati:"gu"} as Record<string,string>)[x] || undefined; }
