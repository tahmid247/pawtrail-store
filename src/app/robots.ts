import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/runtime-config";

export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/api", "/cart", "/checkout", "/track", "/newsletter"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
