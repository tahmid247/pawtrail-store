import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Container } from "@/components/ui/misc";
import { SignOutButton } from "@/components/account/sign-out";

const NAV = [
  ["/account", "Orders"],
  ["/account/profile", "Profile"],
  ["/account/addresses", "Addresses"],
  ["/account/security", "Security"],
  ["/account/privacy", "Privacy & data"],
];

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[220px_1fr]">
      <aside>
        <p className="text-sm text-muted">Signed in as</p>
        <p className="truncate font-semibold">{user.name}</p>
        <nav aria-label="Account" className="mt-6">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map(([href, label]) => (
              <li key={href}><Link href={href} className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium hover:bg-lavender-pale hover:text-primary">{label}</Link></li>
            ))}
            {(user.role === "ADMIN" || user.role === "SUPPORT") && (
              <li><Link href="/admin" className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:bg-lavender-pale">Admin dashboard</Link></li>
            )}
            <li><SignOutButton /></li>
          </ul>
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </Container>
  );
}
