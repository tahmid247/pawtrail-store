"use client";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { saveSettings } from "@/app/admin/actions/store";
import { Textarea } from "@/components/ui/field";

export function SettingsNote({ value }: { value: string }) {
  const [v, setV] = useState(value);
  return (
    <ActionForm action={saveSettings}>
      <input type="hidden" name="section" value="shippingNote" />
      <input type="hidden" name="payload" value={JSON.stringify(v)} />
      <Textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} aria-label="Shipping note" />
    </ActionForm>
  );
}
