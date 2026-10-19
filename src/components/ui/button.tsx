import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "ghost" | "outline" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-paper hover:bg-ink-soft active:bg-ink disabled:opacity-50",
  accent:
    "bg-copper text-white hover:bg-copper-soft active:bg-copper disabled:opacity-50",
  ghost: "text-ink hover:bg-paper-dim",
  outline:
    "border border-line bg-white text-ink hover:border-ink/40 hover:bg-paper",
  danger: "bg-red text-white hover:bg-red/90 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export function buttonVariants(variant: Variant = "primary", size: Size = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[3px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button className={cn(buttonVariants(variant, size), className)} {...props} />
  );
}
