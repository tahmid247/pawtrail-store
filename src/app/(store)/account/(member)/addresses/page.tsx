import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { COUNTRIES, EU_COUNTRY_CODES } from "@/lib/countries";
import { AddressCard, AddressForm } from "@/components/account/forms";

export const metadata = { title: "Addresses", robots: { index: false } };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  const countries = [...EU_COUNTRY_CODES, "SM", "VA"].map((code) => ({ code, name: COUNTRIES[code] })).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <h1 className="text-3xl font-extrabold">Addresses</h1>
      <p className="mt-2 text-sm text-muted">Saved addresses are for your reference; you confirm the delivery address on the secure payment page.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {addresses.map((a) => <AddressCard key={a.id} address={a} countries={countries} />)}
      </div>
      <section className="mt-10 max-w-2xl rounded-3xl border border-line p-6">
        <h2 className="mb-5 text-lg font-bold">Add an address</h2>
        <AddressForm countries={countries} />
      </section>
    </>
  );
}
