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
            5-minute New York session. One asset at a time, always 10x. Size is 70% of the account as margin. Stop is
            0.5% of price and target is 1% (5% / 10% ROE at 10x). A close back through the level exits an open trade.
            Break-even after 0.55%; a 5-bar give-up after 0.8%. Plot levels on the Levels page.
          </p>
        </div>
        <StrategyForm initial={snapshot.state.config} />
      </main>
    </>
  );
}
