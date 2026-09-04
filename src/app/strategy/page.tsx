import { AppHeader } from "@/components/app-header";
import { StrategyForm } from "@/components/strategy-form";

export default function StrategyPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Starter system</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Strategy</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            You asked for a bot around your trading strategy. That specification is not in this repo yet, so Helix
            ships a complete, tunable dual-EMA trend system on Hyperliquid perps. Send the real rules and this module
            gets replaced — risk, routing, and the desk stay.
          </p>
        </div>
        <StrategyForm />
      </main>
    </>
  );
}
