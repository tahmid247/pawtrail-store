import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers + nonce-based Content Security Policy + HTTPS enforcement.
 * Next.js reads the nonce from the request CSP header and applies it to its own scripts.
 */
export function middleware(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  const host = req.nextUrl.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";

  // Vercel and most proxies already force HTTPS; this covers self-hosting behind a TLS-terminating proxy.
  if (isProd && !isLocal && process.env.FORCE_HTTPS_REDIRECT !== "false" && req.headers.get("x-forwarded-proto") === "http") {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"} https://plausible.io`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://plausible.io${isProd ? "" : " ws: wss:"}`,
    "frame-src 'self' https://checkout.stripe.com https://js.stripe.com",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(isProd && !isLocal ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.stripe.com\")");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (isProd && !isLocal) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  if (req.nextUrl.pathname.startsWith("/admin") || req.nextUrl.pathname.startsWith("/account")) {
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|products/|api/webhooks).*)", missing: [{ type: "header", key: "next-router-prefetch" }] }],
};
