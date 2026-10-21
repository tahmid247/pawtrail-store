import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/session";
import { LogoMark } from "@/components/store/logo";
import { AdminNav } from "@/components/admin/nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  return (
    <div className="min-h-dvh bg-[#faf9fc] lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4 lg:block">
          <Link href="/admin" className="flex items-center gap-2 font-display font-extrabold"><LogoMark className="size-7" /> Admin</Link>
          <Link href="/" className="text-xs font-medium text-primary lg:mt-1 lg:block">View store ↗</Link>
        </div>
        <AdminNav role={user.role} />
        <p className="hidden px-5 pt-6 text-xs text-muted lg:block">{user.email}<br />{user.role}</p>
      </aside>
      <main id="main" className="min-w-0 p-4 sm:p-8">{children}</main>
    </div>
  );
}
