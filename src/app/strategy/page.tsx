import { AppHeader } from "@/components/app-header";
import { StrategyForm } from "@/components/strategy-form";
import { getEngine } from "@/lib/bot/runtime";
import type { PublicBotSnapshot } from "@/lib/bot/types";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const engine = await getEngine();
  const snapshot = JSON.parse(JSON.stringify(engine.snapshot())) as PublicBotSnapshot;

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Your rules</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Price action</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            5-minute New York session. You still chart the levels each morning. The bot takes the break, the pullback,
            and the engulfing continuation. Tune session hours and risk here; plot levels on the Levels page.
          </p>
        </div>
        <StrategyForm initial={snapshot.state.config} />
      </main>
    </>
  );
}
