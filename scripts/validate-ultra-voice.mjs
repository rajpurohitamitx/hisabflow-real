import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "components/VoiceAssistant.tsx",
  "components/AppShell.tsx",
  "components/AskHisab.tsx",
  "app/api/voice/transcribe/route.ts",
  "app/api/ai/execute/route.ts",
  "lib/ai/interpret.ts",
  ".env.production.example",
];
const errors = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing ${file}`);
}
const voice = fs.readFileSync(path.join(root, "components/VoiceAssistant.tsx"), "utf8");
const transcribe = fs.readFileSync(path.join(root, "app/api/voice/transcribe/route.ts"), "utf8");
const shell = fs.readFileSync(path.join(root, "components/AppShell.tsx"), "utf8");
const env = fs.readFileSync(path.join(root, ".env.production.example"), "utf8");
for (const [needle, label] of [
  ["Hi Hisab", "wake phrase"],
  ["SpeechRecognition", "wake-word listener"],
  ["MediaRecorder", "voice capture"],
  ["/api/voice/transcribe", "Gemini transcription route"],
  ["conversationId: \"hi-hisab\"", "persistent voice conversation"],
  ["VoiceAssistant", "global app-shell voice assistant"],
]) if (!voice.includes(needle) && !shell.includes(needle)) errors.push(`Missing ${label}`);
if (!transcribe.includes("gemini-3.5-transcribe")) errors.push("Gemini 3.5 transcription model is not present in the voice route.");
if (!transcribe.includes("x-goog-upload-command") || !transcribe.includes("/v1beta/interactions")) errors.push("Documented Gemini Files/Interactions transcription flow is incomplete.");
if (!env.includes('GEMINI_MODEL="gemini-3.5-flash-lite"')) errors.push("Example Gemini semantic model is not set to Gemini 3.5.");
if (!env.includes('GEMINI_TRANSCRIBE_MODEL="gemini-3.5-transcribe"')) errors.push("Example Gemini transcription model is missing.");
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Ultra voice validation passed: wake phrase, persistent voice assistant, Gemini transcription, and app-shell integration are present.");
