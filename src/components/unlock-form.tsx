"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UnlockForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not unlock");
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="pin">PIN</Label>
        <Input
          id="pin"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="h-12 text-lg tracking-[0.3em]"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
        />
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <Button type="submit" className="h-12 w-full" disabled={busy || !pin}>
        {busy ? "Unlocking…" : "Unlock desk"}
      </Button>
    </form>
  );
}
