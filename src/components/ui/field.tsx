import * as React from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-ink-soft">
        {label}
      </span>
      {children}
      {hint && !error ? (
        <span className="mt-1 block text-xs text-ink-soft/70">{hint}</span>
      ) : null}
      {error ? <span className="mt-1 block text-xs text-red">{error}</span> : null}
    </label>
  );
}

const controlClass =
  "block w-full rounded-[3px] border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50 focus:border-copper focus:outline-none focus:ring-1 focus:ring-copper/40 disabled:bg-paper-dim";

export function Input({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-24", className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select className={cn(controlClass, "appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
}
