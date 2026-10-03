export type GeminiMessage = { role: "user" | "model"; content: string };

function key() {
  return process.env.GEMINI_API_KEY || "";
}

function model() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

export function isGeminiEnabled() {
  return (process.env.AI_PROVIDER || "deterministic").toLowerCase() === "gemini" && Boolean(key());
}

export async function geminiJson(messages: GeminiMessage[], timeoutMs = 45000): Promise<any> {
  if (!key()) throw new Error("GEMINI_API_KEY is not configured.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const contents = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent?key=${encodeURIComponent(key())}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `Gemini returned ${response.status}.`);
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}";
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}
