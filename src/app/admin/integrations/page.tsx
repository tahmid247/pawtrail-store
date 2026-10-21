import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { getPaymentProvider } from "@/lib/payments";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Alert, Badge } from "@/components/ui/misc";
import { syncFulfillmentNow, syncInventoryNow, testCjConnection } from "../actions/store";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requireStaffPage({ adminOnly: true });
  const settings = await getSettings();
  const provider = getPaymentProvider();
  const [logs, webhooks, emails] = await Promise.all([
    prisma.integrationLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 15 }),
    prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const stripeMode = env.stripeSecretKey ? (env.stripeSecretKey.startsWith("sk_live_") ? "live" : "test") : null;
  return (
    <>
      <PageHeader title="Integrations" description="Credentials are configured as server environment variables and are never shown here." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Payments — Stripe">
          <p className="text-sm">Status: {stripeMode ? <Badge tone={stripeMode === "live" ? "success" : "warning"}>{stripeMode} mode</Badge> : <Badge tone="danger">not configured</Badge>}</p>
          <p className="mt-2 text-sm">Webhook secret: {env.stripeWebhookSecret ? <Badge tone="success">set</Badge> : <Badge tone="danger">missing</Badge>}</p>
          <p className="mt-2 text-sm">Active provider: <strong>{provider?.name ?? "none"}</strong></p>
          <p className="mt-3 text-xs text-muted">Webhook endpoint: <code>{env.siteUrl}/api/webhooks/stripe</code> — events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, refund.created, refund.updated.</p>
        </Panel>
        <Panel title="Fulfillment — CJdropshipping">
          <p className="text-sm">API mode: <Badge tone={env.cjMode === "live" ? "success" : "warning"}>{env.cjMode}</Badge> · API key: {env.cjApiKey ? <Badge tone="success">set</Badge> : <Badge>missing</Badge>}</p>
          <p className="mt-2 text-sm">Store fulfillment mode: <strong>{settings.fulfillment.mode}</strong>{settings.fulfillment.autoSubmitOnPayment ? " · auto-submit on" : ""}</p>
          {env.cjMode === "mock" && <Alert tone="warning" className="mt-3">Mock mode: no requests are sent to CJ. The integration is NOT verified until a live authenticated test succeeds.</Alert>}
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionForm action={testCjConnection} submitLabel="Test connection" variant="outline" inline />
            <ActionForm action={syncInventoryNow} submitLabel="Sync inventory" variant="outline" inline />
            <ActionForm action={syncFulfillmentNow} submitLabel="Sync orders & tracking" variant="outline" inline />
          </div>
          <p className="mt-3 text-xs text-muted">Webhook URL: <code>{env.siteUrl}/api/webhooks/cj?key=…CJ_WEBHOOK_SECRET</code></p>
        </Panel>
        <Panel title="Email — Resend">
          <p className="text-sm">Status: {env.resendApiKey ? <Badge tone="success">configured</Badge> : <Badge tone="warning">dev logging only</Badge>}</p>
          <p className="mt-2 text-sm">From: {env.emailFrom}</p>
          <p className="mt-2 text-sm">Admin alerts to: {env.adminAlertEmail ?? <Badge tone="warning">ADMIN_ALERT_EMAIL not set</Badge>}</p>
          <ul className="mt-3 space-y-1 text-xs text-muted">{emails.map((e) => <li key={e.id}>{e.createdAt.toLocaleString("en-GB")} · {e.template} · {e.status}</li>)}</ul>
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Integration log">
          <ul className="space-y-1.5 text-xs">
            {logs.map((l) => <li key={l.id}><Badge tone={l.level === "error" ? "danger" : l.level === "warn" ? "warning" : "neutral"}>{l.level}</Badge> {l.createdAt.toLocaleString("en-GB")} · {l.provider}/{l.action}: {l.message}</li>)}
            {!logs.length && <li className="text-muted">No entries.</li>}
          </ul>
        </Panel>
        <Panel title="Webhook deliveries">
          <ul className="space-y-1.5 text-xs">
            {webhooks.map((w) => <li key={w.id}>{w.receivedAt.toLocaleString("en-GB")} · {w.provider} · {w.type} · <Badge tone={w.status === "failed" ? "danger" : "neutral"}>{w.status}</Badge>{w.error ? ` ${w.error}` : ""}</li>)}
            {!webhooks.length && <li className="text-muted">No webhooks received.</li>}
          </ul>
        </Panel>
      </div>
    </>
  );
}
