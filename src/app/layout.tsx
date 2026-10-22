import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { TranslateGuard } from "@/components/translate-guard";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import { getSettings } from "@/lib/settings";
import { resolveSiteUrl } from "@/lib/runtime-config";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { CookieConsent } from "@/components/store/cookie-consent";
import { Analytics } from "@/components/store/analytics";

const siteUrl = resolveSiteUrl();

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: s.seo.defaultTitle, template: `%s | ${s.brand.name}` },
    description: s.seo.defaultDescription,
    applicationName: s.brand.name,
    openGraph: { type: "website", siteName: s.brand.name, locale: "en_IE", images: [{ url: s.home.heroImage, width: 800, height: 800 }] },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
  };
}

// Pages depend on live store settings, cart and session: always render on request.
export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#7047EB", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
  const t = settings.theme;
  // Theme values are validated hex colours (see settingsSchema), so this style block cannot carry injected CSS/HTML.
  const themeCss = `:root{--brand-primary:${t.primary};--brand-primary-deep:${t.primaryDeep};--brand-lavender:${t.lavender};--brand-lavender-pale:${t.lavenderPale}}`;
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="content-language" content="en" />
        <style>{themeCss}</style>
      </head>
      <body className="min-h-dvh">
        <TranslateGuard />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <a href="#main" className="sr-only z-[100] rounded-full bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        {children}
        <CookieConsent initial={consent} />
        <Analytics plausibleDomain={settings.analytics.plausibleDomain || null} initialConsent={consent?.analytics ?? false} />
      </body>
    </html>
  );
}
