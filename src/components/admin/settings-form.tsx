"use client";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { saveSettings } from "@/app/admin/actions/store";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { formatFaqs, parseFaqs } from "@/lib/admin-format";

export type FieldSpec = { key: string; label: string; type?: "text" | "textarea" | "bool" | "number" | "color" | "nullable"; hint?: string };

/** Edits one settings section; values are serialised to JSON and validated again on the server. */
export function SettingsSectionForm({ section, fields, initial }: { section: string; fields: FieldSpec[]; initial: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));
  return (
    <ActionForm action={saveSettings}>
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="payload" value={JSON.stringify(values)} />
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `${section}-${f.key}`;
          const v = values[f.key];
          if (f.type === "bool") return <Checkbox key={f.key} label={f.label} checked={Boolean(v)} onChange={(e) => set(f.key, e.target.checked)} className="sm:col-span-2" />;
          if (f.type === "textarea")
            return <Field key={f.key} label={f.label} htmlFor={id} hint={f.hint} className="sm:col-span-2"><Textarea id={id} rows={4} value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} /></Field>;
          return (
            <Field key={f.key} label={f.label} htmlFor={id} hint={f.hint}>
              <Input
                id={id}
                type={f.type === "number" ? "number" : "text"}
                step="any"
                value={v == null ? "" : String(v)}
                onChange={(e) => set(f.key, f.type === "number" ? Number(e.target.value) : f.type === "nullable" ? e.target.value || null : e.target.value)}
              />
            </Field>
          );
        })}
      </div>
    </ActionForm>
  );
}

export function FaqSettingsForm({ initial }: { initial: { question: string; answer: string }[] }) {
  const [text, setText] = useState(formatFaqs(initial));
  let payload = "[]";
  let problem: string | null = null;
  try {
    payload = JSON.stringify(parseFaqs(text));
  } catch (e) {
    problem = (e as Error).message;
  }
  return (
    <ActionForm action={saveSettings}>
      <input type="hidden" name="section" value="faq" />
      <input type="hidden" name="payload" value={payload} />
      <Field label="Homepage FAQ" htmlFor="faq-text" hint='Blocks of "Q: …" / "A: …" separated by a blank line. Only state verified facts.' error={problem}>
        <Textarea id="faq-text" rows={16} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
    </ActionForm>
  );
}
