import { requireStaffPage } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { PageHeader, Panel } from "@/components/admin/ui";
import { SettingsNote } from "@/components/admin/settings-note";
import { FaqSettingsForm, SettingsSectionForm, type FieldSpec } from "@/components/admin/settings-form";

export const metadata = { title: "Settings" };

const SECTIONS: { key: string; title: string; fields: FieldSpec[] }[] = [
  { key: "brand", title: "Brand", fields: [
    { key: "name", label: "Brand name" }, { key: "tagline", label: "Tagline" },
    { key: "logoUrl", label: "Logo URL (optional)", type: "nullable", hint: "Leave empty to use the default paw mark." },
    { key: "supportEmail", label: "Support email" }, { key: "phone", label: "Phone (optional)" },
  ] },
  { key: "business", title: "Business & legal identification", fields: [
    { key: "legalName", label: "Legal business name" }, { key: "address", label: "Registered address" }, { key: "country", label: "Country" },
    { key: "vatNumber", label: "VAT number (Partita IVA)" }, { key: "registrationNumber", label: "REA / registration number" },
    { key: "pec", label: "PEC" }, { key: "shareCapital", label: "Share capital (if applicable)" },
  ] },
  { key: "announcement", title: "Announcement bar", fields: [
    { key: "enabled", label: "Show announcement bar", type: "bool" }, { key: "text", label: "Text", hint: "Do not promise free shipping or discounts unless they are actually enabled." }, { key: "link", label: "Link (optional)", type: "nullable" },
  ] },
  { key: "home", title: "Homepage content", fields: [
    { key: "heroHeadline", label: "Hero headline" }, { key: "heroSubheadline", label: "Hero subheadline", type: "textarea" },
    { key: "heroImage", label: "Hero image URL" }, { key: "featuredProductSlug", label: "Featured product slug", type: "nullable" },
    { key: "aboutTitle", label: "About page title" }, { key: "aboutBody", label: "About page text", type: "textarea" },
  ] },
  { key: "commerce", title: "Commerce", fields: [
    { key: "vatRatePercent", label: "VAT rate % (prices are VAT-inclusive)", type: "number" },
    { key: "withdrawalDays", label: "Withdrawal period (days, min. 14)", type: "number" },
    { key: "reservationMinutes", label: "Checkout stock reservation (minutes, 30–1440)", type: "number" },
    { key: "maxQuantityPerItem", label: "Max quantity per item", type: "number" },
    { key: "defaultLowStockThreshold", label: "Default low-stock threshold", type: "number" },
    { key: "checkoutEnabled", label: "Checkout enabled", type: "bool" },
  ] },
  { key: "fulfillment", title: "Fulfillment (CJdropshipping)", fields: [
    { key: "mode", label: 'Mode: "manual" or "cj_api"' },
    { key: "autoSubmitOnPayment", label: "Automatically submit paid orders to CJ (cj_api mode only)", type: "bool" },
    { key: "cjLogisticName", label: "CJ logistic name", hint: "Exactly as listed in CJ (e.g. the shipping method for your warehouse)." },
    { key: "cjFromCountryCode", label: "Ship-from country code", hint: "Warehouse country holding your prepaid stock, e.g. DE, CZ, CN." },
    { key: "cjWarehouseCountryCode", label: "Warehouse country for inventory sync (optional)" },
    { key: "cjStorageId", label: "CJ storage ID (optional — verify with CJ)" },
  ] },
  { key: "social", title: "Social links", fields: [{ key: "instagram", label: "Instagram URL" }, { key: "facebook", label: "Facebook URL" }, { key: "tiktok", label: "TikTok URL" }] },
  { key: "seo", title: "SEO defaults", fields: [{ key: "defaultTitle", label: "Default title (≤ 70)" }, { key: "defaultDescription", label: "Default description (≤ 170)", type: "textarea" }] },
  { key: "analytics", title: "Analytics (loaded only with consent)", fields: [{ key: "plausibleDomain", label: "Plausible domain (optional)" }, { key: "firstPartyEnabled", label: "First-party anonymous page-view counts", type: "bool" }] },
  { key: "theme", title: "Theme colours", fields: [{ key: "primary", label: "Primary" }, { key: "primaryDeep", label: "Deep" }, { key: "lavender", label: "Lavender" }, { key: "lavenderPale", label: "Pale lavender" }] },
];

export default async function SettingsPage() {
  await requireStaffPage({ adminOnly: true });
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Store settings" description="Each section saves independently and is validated on the server." />
      <div className="grid gap-6 xl:grid-cols-2">
        {SECTIONS.map((sec) => (
          <Panel key={sec.key} title={sec.title}>
            <SettingsSectionForm section={sec.key} fields={sec.fields} initial={(s as unknown as Record<string, Record<string, unknown>>)[sec.key]} />
          </Panel>
        ))}
        <Panel title="Shipping note (product page)">
          <SettingsNote value={s.shippingNote} />
        </Panel>
        <Panel title="Homepage FAQ" className="xl:col-span-2"><FaqSettingsForm initial={s.faq} /></Panel>
      </div>
    </>
  );
}
