/** Secrets a workspace gives Studio (registry tokens) are encrypted at rest and never shown again. */

async function key(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encrypt(plain: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret), new TextEncoder().encode(plain));
  return `${b64(iv)}.${b64(data)}`;
}

export async function decrypt(enc: string, secret: string): Promise<string> {
  const [iv, data] = enc.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(secret), unb64(data));
  return new TextDecoder().decode(plain);
}

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A random key for `polyxd studio push`: shown once, stored hashed. */
export function newApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return "pxs_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
