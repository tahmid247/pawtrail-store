import Link from "next/link";
import { ShoppingBag, User } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { getCart, cartItemCount } from "@/lib/cart";
import { getCurrentUser } from "@/lib/session";
import { Container } from "@/components/ui/misc";
import { MobileMenu } from "./mobile-menu";
import { Logo } from "./logo";

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

export async function Header() {
  const [settings, cart, user] = await Promise.all([getSettings(), getCart(), getCurrentUser()]);
  const count = cartItemCount(cart);
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75">
      <Container className="flex h-16 items-center justify-between gap-4 sm:h-[4.5rem]">
        <div className="flex items-center gap-2">
          <MobileMenu nav={NAV} signedIn={Boolean(user)} />
          <Logo name={settings.brand.name} logoUrl={settings.brand.logoUrl} />
        </div>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="rounded-full px-4 py-2 text-sm font-medium text-ink/80 transition hover:bg-lavender-pale hover:text-primary">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <Link href={user ? "/account" : "/account/login"} className="hidden rounded-full p-2.5 text-ink/80 transition hover:bg-lavender-pale hover:text-primary sm:inline-flex" aria-label={user ? "My account" : "Sign in"}>
            <User className="size-5" />
          </Link>
          <Link href="/cart" className="relative inline-flex rounded-full p-2.5 text-ink/80 transition hover:bg-lavender-pale hover:text-primary" aria-label={`Shopping cart, ${count} item${count === 1 ? "" : "s"}`}>
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.7rem] font-bold leading-5 text-white" aria-hidden>
                {count}
              </span>
            )}
          </Link>
        </div>
      </Container>
    </header>
  );
}
