export function money(value: unknown) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}
export function dateIN(value: Date | string) { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
export function normalize(s: string) { return s.toLowerCase().replace(/[^a-z0-9\u0900-\u097f\u0b80-\u0bff\s]/gi, " ").replace(/\s+/g, " ").trim(); }
export function decimalToNumber<T extends Record<string, unknown>>(obj: T): T { return JSON.parse(JSON.stringify(obj, (_, v) => typeof v === "object" && v && "toNumber" in v && typeof (v as {toNumber?:unknown}).toNumber === "function" ? (v as {toNumber:()=>number}).toNumber() : v)); }
