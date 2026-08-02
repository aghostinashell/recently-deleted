const encoder = new TextEncoder();

export function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256(value) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function base64url(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")), (char) => char.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return crypto.subtle.sign("HMAC", key, encoder.encode(value));
}

export async function signContext(payload, secret) {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${base64url(await hmac(secret, body))}`;
}

export async function verifyContext(token, secret) {
  if (!token || !secret) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = new Uint8Array(await hmac(secret, body));
  const received = decodeBase64url(signature);
  if (expected.length !== received.length) return null;
  let mismatch = 0;
  expected.forEach((byte, index) => { mismatch |= byte ^ received[index]; });
  if (mismatch !== 0) return null;
  const payload = JSON.parse(new TextDecoder().decode(decodeBase64url(body)));
  if (payload.expiresAt && Date.now() > payload.expiresAt) return null;
  return payload;
}

export function sanitizeMetadata(value, depth = 0) {
  if (depth > 3 || value == null) return value == null ? null : undefined;
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value !== "object") return undefined;
  const blocked = /pass(code|word)|secret|token|message(_| )?(text|content)|form(_| )?(text|content)|email_address|phone_number/i;
  return Object.fromEntries(Object.entries(value).slice(0, 40)
    .filter(([key]) => !blocked.test(key))
    .map(([key, item]) => [key.slice(0, 80), sanitizeMetadata(item, depth + 1)])
    .filter(([, item]) => item !== undefined));
}
