import "server-only";
import { resolveAuthSecret } from "./runtime-config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** AES-256-GCM (Node's built-in OpenSSL) for small secrets stored in the database, e.g. supplier API tokens. */
function key() {
  const material = process.env.DATA_ENCRYPTION_KEY || resolveAuthSecret();
  if (!material) throw new Error("DATA_ENCRYPTION_KEY (or BETTER_AUTH_SECRET) must be set");
  return createHash("sha256").update(material).digest();
}

export function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function unseal(sealed: string): string {
  const [iv, tag, enc] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
