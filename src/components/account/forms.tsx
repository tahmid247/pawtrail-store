"use client";
import { useFormAction } from "@/components/ui/use-form-action";
import { useState, useTransition } from "react";
import { deleteAddress, requestAccountDeletion, saveAddress, updateMarketing, updateProfile } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import type { FormState } from "@/lib/consent";

function Status({ state }: { state: FormState }) {
  if (state?.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const [state, action, pending] = useFormAction(updateProfile, null);
  return (
    <form onSubmit={action} className="max-w-lg space-y-4">
      <Field label="Name" htmlFor="name"><Input id="name" name="name" defaultValue={name} required maxLength={100} autoComplete="name" /></Field>
      <Field label="Email" htmlFor="email" hint="Contact us to change your email address."><Input id="email" value={email} readOnly disabled /></Field>
      <Field label="Phone (optional)" htmlFor="phone"><Input id="phone" name="phone" defaultValue={phone} maxLength={40} autoComplete="tel" /></Field>
      <Status state={state} />
      <Button type="submit" disabled={pending}>Save</Button>
    </form>
  );
}

type Address = { id: string; fullName: string; line1: string; line2: string | null; city: string; province: string | null; postalCode: string; country: string; phone: string | null; isDefault: boolean };

export function AddressForm({ address, countries, onDone }: { address?: Address; countries: { code: string; name: string }[]; onDone?: () => void }) {
  const [state, action, pending] = useFormAction(async (p: FormState, fd: FormData) => {
    const r = await saveAddress(p, fd);
    if (r?.ok) onDone?.();
    return r;
  }, null);
  return (
    <form onSubmit={action} className="grid gap-4 sm:grid-cols-2">
      {address && <input type="hidden" name="id" value={address.id} />}
      <Field label="Full name" htmlFor="fullName" className="sm:col-span-2"><Input id="fullName" name="fullName" required defaultValue={address?.fullName} autoComplete="name" /></Field>
      <Field label="Address" htmlFor="line1" className="sm:col-span-2"><Input id="line1" name="line1" required defaultValue={address?.line1} autoComplete="address-line1" /></Field>
      <Field label="Apartment, suite (optional)" htmlFor="line2" className="sm:col-span-2"><Input id="line2" name="line2" defaultValue={address?.line2 ?? ""} autoComplete="address-line2" /></Field>
      <Field label="Postal code" htmlFor="postalCode"><Input id="postalCode" name="postalCode" required defaultValue={address?.postalCode} autoComplete="postal-code" /></Field>
      <Field label="City" htmlFor="city"><Input id="city" name="city" required defaultValue={address?.city} autoComplete="address-level2" /></Field>
      <Field label="Province (optional)" htmlFor="province"><Input id="province" name="province" defaultValue={address?.province ?? ""} autoComplete="address-level1" /></Field>
      <Field label="Country" htmlFor="country">
        <Select id="country" name="country" defaultValue={address?.country ?? "IT"} autoComplete="country">
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Phone (optional)" htmlFor="aphone"><Input id="aphone" name="phone" defaultValue={address?.phone ?? ""} autoComplete="tel" /></Field>
      <Checkbox name="isDefault" label="Use as default address" defaultChecked={address?.isDefault} className="self-end" />
      <div className="sm:col-span-2 space-y-3"><Status state={state} /><Button type="submit" disabled={pending}>Save address</Button></div>
    </form>
  );
}

export function AddressCard({ address, countries }: { address: Address; countries: { code: string; name: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  if (editing) return <div className="rounded-2xl border border-primary p-5"><AddressForm address={address} countries={countries} onDone={() => setEditing(false)} /></div>;
  return (
    <div className="rounded-2xl border border-line p-5 text-sm">
      <p className="font-semibold">{address.fullName} {address.isDefault && <span className="ml-2 rounded-full bg-lavender px-2 py-0.5 text-xs text-primary-deep">Default</span>}</p>
      <p className="mt-1 text-muted">{address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />{address.postalCode} {address.city} {address.province}<br />{countries.find((c) => c.code === address.country)?.name}</p>
      <div className="mt-4 flex gap-4">
        <button className="font-medium text-primary hover:underline" onClick={() => setEditing(true)}>Edit</button>
        <button className="font-medium text-muted hover:text-danger" disabled={pending} onClick={() => confirm("Delete this address?") && start(() => deleteAddress(address.id))}>Delete</button>
      </div>
    </div>
  );
}

export function MarketingForm({ subscribed }: { subscribed: boolean }) {
  const [state, action, pending] = useFormAction(updateMarketing, null);
  return (
    <form onSubmit={action} className="space-y-4">
      <Checkbox name="marketing" defaultChecked={subscribed} label="Email me about new products and offers (you can unsubscribe at any time)." />
      <Status state={state} />
      <Button type="submit" variant="outline" disabled={pending}>Save preference</Button>
    </form>
  );
}

export function DeletionForm({ pendingRequest }: { pendingRequest: boolean }) {
  const [state, action, pending] = useFormAction(requestAccountDeletion, null);
  if (pendingRequest) return <Alert tone="warning">Your account deletion request is being processed.</Alert>;
  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form onSubmit={action} className="max-w-lg space-y-4">
      <Field label="Reason (optional)" htmlFor="reason"><Textarea id="reason" name="reason" maxLength={1000} rows={3} /></Field>
      <Field label='Type "DELETE" to confirm' htmlFor="confirm"><Input id="confirm" name="confirm" required autoComplete="off" /></Field>
      <Status state={state} />
      <Button type="submit" variant="danger" disabled={pending}>Request account deletion</Button>
    </form>
  );
}
