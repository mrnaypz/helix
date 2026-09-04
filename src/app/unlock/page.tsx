import { Suspense } from "react";
import { UnlockForm } from "@/components/unlock-form";

export default function UnlockPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Helix</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Unlock</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This desk is reachable from your phone. Enter the PIN from <span className="font-mono">HELIX_PIN</span> on
          the machine that runs the bot.
        </p>
      </div>
      <Suspense>
        <UnlockForm />
      </Suspense>
    </main>
  );
}
