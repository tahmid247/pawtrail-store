import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { defaultEmailTemplates, emailTemplateKeys } from "@/lib/email/templates";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Field, Input, Textarea } from "@/components/ui/field";
import { saveEmailTemplate } from "../actions/store";

export const metadata = { title: "Email templates" };

export default async function EmailsPage() {
  await requireStaffPage({ adminOnly: true });
  const stored = await prisma.emailTemplate.findMany();
  return (
    <>
      <PageHeader title="Email templates" description="Plain text with {{placeholders}}. Values are escaped automatically. Available everywhere: {{brandName}}, {{supportEmail}}, {{siteUrl}}." />
      <div className="grid gap-6 xl:grid-cols-2">
        {emailTemplateKeys.map((key) => {
          const t = stored.find((s) => s.key === key) ?? { key, ...defaultEmailTemplates[key] };
          const vars = [...new Set(defaultEmailTemplates[key].body.match(/\{\{\s*\w+\s*\}\}/g) ?? [])].join(" ");
          return (
            <Panel key={key} title={t.name}>
              <ActionForm action={saveEmailTemplate}>
                <input type="hidden" name="key" value={key} />
                <input type="hidden" name="name" value={t.name} />
                <Field label="Subject" htmlFor={`s-${key}`}><Input id={`s-${key}`} name="subject" defaultValue={t.subject} required /></Field>
                <Field label="Body" htmlFor={`b-${key}`} hint={`Variables: ${vars}`}><Textarea id={`b-${key}`} name="body" defaultValue={t.body} rows={8} required /></Field>
              </ActionForm>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
