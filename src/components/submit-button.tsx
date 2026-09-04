"use client";

import { useFormStatus } from "react-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant,
  size,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
} & VariantProps<typeof buttonVariants>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className={cn("cursor-pointer", className)} variant={variant} size={size} disabled={pending}>
      {pending ? pendingLabel ?? "Working…" : children}
    </Button>
  );
}
