import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
              <li>On the 5-minute chart it waits for a close through a level, a pullback into that level, then a closed engulfing candle in the breakout direction.</li>
              <li>Stop sits beyond the pullback extreme. Target is 2R, or the next charted level if that is closer.</li>
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
            <CardDescription>This is the encoded version of your example. Tell me if a detail is wrong.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="text-foreground/90">Long (resistance):</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>A 5m candle closes above your resistance.</li>
              <li>A later 5m candle pulls back so its low tags the level (or a small zone around it) and the close holds above.</li>
              <li>A later 5m candle is bullish and fully engulfs the previous candle&apos;s body.</li>
              <li>Entry on that close. If price closes back below the level before the engulfing, the setup dies.</li>
            </ol>
            <p className="pt-2 text-foreground/90">Short is the mirror off support, only if shorts are enabled.</p>
            <p>
              It does not enter on the break itself. If that is too strict (you sometimes take the first close through
              the level), say so and we can add a second entry mode.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. What you still own live</CardTitle>
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
