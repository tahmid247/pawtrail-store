import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomToken } from "./crypto";

const MAX_BYTES = 5 * 1024 * 1024;

/** Detects the real image type from magic bytes (the client-provided MIME type is not trusted). */
export function sniffImage(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

/**
 * Stores an uploaded product image and returns its public URL.
 * Production: Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_STORAGE_BUCKET, public bucket).
 * Development: written to /public/uploads (not suitable for serverless hosting).
 */
export async function storeImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("Images must be 5 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffImage(buf);
  if (!ext) throw new Error("Only JPEG, PNG and WebP images are allowed.");
  const name = `${Date.now()}-${randomToken(9)}.${ext}`;
  const contentType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET = "product-images" } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": contentType, "x-upsert": "false" },
      body: buf,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${name}`;
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_UPLOADS !== "true") {
    throw new Error("Configure Supabase Storage for image uploads in production.");
  }
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${name}`;
}
