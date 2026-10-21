import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Markdown } from "@/components/markdown";
import { saveLegalPage } from "../../actions/store";

export const metadata = { title: "Edit legal page" };

export default async function EditLegalPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStaffPage({ adminOnly: true });
  const page = await prisma.legalPage.findUnique({ where: { slug: (await params).slug } });
  if (!page) notFound();
  return (
    <>
      <PageHeader title={page.title} description="Markdown subset: ## headings, - lists, **bold**, [link](/path), > notice. Remove the DRAFT notice once reviewed, and bump the version." />
      <div className="grid gap-6 2xl:grid-cols-2">
        <Panel title="Edit">
          <ActionForm action={saveLegalPage}>
            <input type="hidden" name="slug" value={page.slug} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" htmlFor="title"><Input id="title" name="title" defaultValue={page.title} required /></Field>
              <Field label="Version" htmlFor="version"><Input id="version" name="version" defaultValue={page.version} required /></Field>
            </div>
            <Field label="Content" htmlFor="content"><Textarea id="content" name="content" defaultValue={page.content} rows={30} className="font-mono text-xs" required /></Field>
            <Checkbox name="published" label="Published" defaultChecked={page.published} />
          </ActionForm>
        </Panel>
        <Panel title="Current preview"><Markdown source={page.content} /></Panel>
      </div>
    </>
  );
}
