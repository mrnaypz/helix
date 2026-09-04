import { AppHeader } from "@/components/app-header";
import { getEngine } from "@/lib/bot/runtime";
import type { PublicBotSnapshot } from "@/lib/bot/types";
import { LevelsLive } from "@/components/levels-live";

export const dynamic = "force-dynamic";

export default async function LevelsPage() {
  const engine = await getEngine();
  const snapshot = JSON.parse(JSON.stringify(engine.snapshot())) as PublicBotSnapshot;

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Morning ritual</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Chart today&apos;s levels</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Mark support and resistance from your morning chart. Leave the engine off until the New York session, then
            start it on the desk. It will wait for a 5-minute break of a level, a pullback, and an engulfing
            continuation candle — it will not chase the first breakout print.
          </p>
        </div>
        <LevelsLive initial={snapshot} />
      </main>
    </>
  );
}
