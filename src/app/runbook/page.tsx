import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RunbookPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Operating plan</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Daily workflow</h1>
          <p className="mt-2 text-muted-foreground">
            Chart levels in the morning. Arm the bot for the New York session. It trades your 5-minute price-action
            rules on Hyperliquid; it does not pick the levels for you.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. What the bot does</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-5 text-foreground/90">
              <li>You plot support and resistance from your morning chart (previous day high/low, overnight range, equal highs, etc.).</li>
              <li>Start the engine when you want it watching. Entries are blocked until 09:30 ET (editable).</li>
              <li>On the 5-minute chart it waits for a close through a level, at least a few bars of consolidation (price does not have to tag the level), then a closed engulfing candle.</li>
              <li>If a 5m candle closes back through the level, that level is dead. No trade.</li>
              <li>One market at a time. The first valid trigger takes the slot. Size is 70% of the account as margin. Stop is 5% ROE and target is 10% ROE, inclusive of leverage.</li>
              <li>At 16:00 ET it flattens (optional). Kill switch is always available.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Your morning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Need title="Chart as you already do">
              Keep using whatever you chart on. Then type those prices into Levels — one row per support or resistance,
              per market. Use mid if you want the current print as a starting point, then edit.
            </Need>
            <Need title="Do not start entries overnight">
              You can leave the process running. It will not take a new trade before the New York window. Premarket is
              for charting, not for the bot to hunt.
            </Need>
            <Need title="Start it for the cash session">
              At or just before 09:30 ET, hit Start on the desk. Confirm the session badge reads NY open and that
              today&apos;s levels are armed.
            </Need>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. How a trade is defined</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="text-foreground/90">Long (resistance):</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>A 5m candle closes above your resistance.</li>
              <li>At least three later 5m candles stay above the level. They do not have to wick into it.</li>
              <li>A later 5m candle is bullish and fully engulfs the previous candle&apos;s body. That close is the entry.</li>
              <li>If any 5m candle closes back below the resistance before entry, the level is invalidated. The bot will not trade it.</li>
            </ol>
            <p className="pt-2 text-foreground/90">Short is the mirror off support, only if shorts are enabled.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. After a level dies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Need title="Leave it">
              Do nothing. That market sits out for the rest of the day unless another still-valid level on it is
              waiting.
            </Need>
            <Need title="Update the level">
              Remove the dead row if you want, then add the new price (for example a strong wick). If the engine is
              already running, that new level is live on the next tick — you do not restart, and you do not re-arm
              anything else. The bot only counts 5m bars from the moment you add it, so this morning&apos;s failed break
              does not poison the new level.
            </Need>
            <Need title="If you stopped the engine">
              Hit Start on the desk after you chart the new level. Adding a level does not start a stopped engine.
            </Need>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. What you still own live</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Need title="The levels">If you skip the morning chart, the bot has nothing to trade.</Need>
            <Need title="The process">Keep `npm run dev` or `npm run bot` up through the session.</Need>
            <Need title="The override">If a level is wrong, remove it. If the tape is news-driven, Stop or Kill.</Need>
            <Need title="Keys and capital">Agent wallet only, never a withdrawal seed. Fund and withdraw in the official Hyperliquid app.</Need>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Need({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-muted-foreground">{children}</p>
    </div>
  );
}
