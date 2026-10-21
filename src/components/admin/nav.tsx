"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

const ITEMS: { href: string; label: string; admin?: boolean }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products", admin: true },
  { href: "/admin/collections", label: "Collections", admin: true },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/discounts", label: "Discounts", admin: true },
  { href: "/admin/shipping", label: "Shipping", admin: true },
  { href: "/admin/integrations", label: "Integrations", admin: true },
  { href: "/admin/settings", label: "Settings", admin: true },
  { href: "/admin/legal", label: "Legal pages", admin: true },
  { href: "/admin/emails", label: "Email templates", admin: true },
  { href: "/admin/newsletter", label: "Newsletter", admin: true },
  { href: "/admin/audit", label: "Audit log", admin: true },
];

export function AdminNav({ role }: { role: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="overflow-x-auto px-3 pb-3 lg:pb-0">
      <ul className="flex gap-1 lg:flex-col">
        {ITEMS.filter((i) => !i.admin || role === "ADMIN").map((i) => {
          const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={active ? "page" : undefined} className={cn("block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-lavender text-primary-deep" : "text-ink/75 hover:bg-lavender-pale")}>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
