import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "light" | "outlineLight";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary select-none";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-[0_8px_20px_-8px_rgb(112_71_235/0.7)] hover:bg-primary-deep hover:-translate-y-px active:translate-y-0",
  secondary: "bg-lavender text-primary-deep hover:bg-[#e2d9ff]",
  outline: "border border-line bg-white text-ink hover:border-primary hover:text-primary",
  ghost: "text-ink hover:bg-lavender-pale",
  danger: "bg-danger text-white hover:bg-[#912018]",
  light: "bg-white text-primary-deep shadow-[0_10px_30px_-10px_rgb(0_0_0/0.45)] hover:bg-lavender hover:-translate-y-px active:translate-y-0",
  outlineLight: "border border-white/35 text-white hover:bg-white/10 hover:border-white/60",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[0.95rem]",
  lg: "h-13 px-8 text-base min-h-[3.25rem]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
