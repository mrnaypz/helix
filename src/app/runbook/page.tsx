import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RunbookPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Operating plan</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">How Helix goes live</h1>
          <p className="mt-2 text-muted-foreground">
            This is the execution layout, what I still need from you, and what you own once the bot is trading.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Execution layout</CardTitle>
            <CardDescription>What is already built versus what still depends on your rules.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Helix is a Hyperliquid execution desk. The dashboard talks to a Node engine. The engine pulls
              candles, mids, and funding from the public Info API, evaluates a strategy, applies risk, then either
              simulates fills (paper) or signs IOC orders with an agent wallet (live).
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-foreground/90">
              <li>Market data: Hyperliquid `/info` (candles, meta, mids, funding, account state).</li>
              <li>Strategy: dual EMA crossover with ATR stop/target. This is the starter until your rules replace it.</li>
              <li>Risk: percent-of-equity sizing, leverage cap, max positions, daily loss halt, post-stop cooldown, kill switch.</li>
              <li>Paper broker: live prices, modeled taker fee and slippage, persistent book in `data/bot-state.json`.</li>
              <li>Live broker: `@nktkas/hyperliquid` + viem, agent key only, testnet by default, no withdrawals.</li>
              <li>Ops surface: this desk for start/pause/stop/kill, strategy edits, and the fill/event log.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. What I need from you</CardTitle>
            <CardDescription>Without this, the bot can paper-trade the default trend system, not your edge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Need title="Your strategy, in rules">
              Markets, session, timeframe, entry, invalidation, extras (funding, volume, news blackouts), and whether
              you scale, pyramid, or run one shot. Vague descriptions become a generic EMA bot.
            </Need>
            <Need title="Risk budget">
              Account size you will actually allocate, max leverage, max positions, daily/weekly stop, and whether a
              stop-out flattens everything or just that coin.
            </Need>
            <Need title="Universe">
              Which perps (BTC, ETH, SOL, …), isolated vs cross, and assets you never want touched.
            </Need>
            <Need title="Hyperliquid keys — only when you are ready">
              Main wallet address, an <strong>agent / API wallet</strong> approved at app.hyperliquid.xyz/API, and
              whether we start on testnet or mainnet. Never send a withdrawal-capable seed. Agent wallets cannot
              withdraw.
            </Need>
            <Need title="Go-live confirmation">
              Paper first, then testnet with dust, then mainnet with a hard cap. Live mode also requires
              `HL_LIVE_CONFIRM=I_UNDERSTAND` in the environment.
            </Need>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. What you own once it is live</CardTitle>
            <CardDescription>The bot does not replace you as the operator.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Need title="Keep the process up">
              The engine only trades while this app (or `npm run bot`) is running. Use a host that stays online, or
              a process manager. If the process dies, open orders and positions stay on Hyperliquid until you act.
            </Need>
            <Need title="Watch the first sessions">
              Compare fills to intent. If your rules are not encoded yet, treat every paper/live fill as a prototype,
              not your strategy.
            </Need>
            <Need title="Fund and defund yourself">
              Deposit USDC on Hyperliquid, keep a buffer above maintenance, and withdraw from the official app. The
              bot will never implement withdrawals.
            </Need>
            <Need title="Rotate and revoke keys">
              If a key leaks, revoke the agent in the Hyperliquid API page and generate a new one. Restart the desk
              with the new env vars.
            </Need>
            <Need title="Use the kill switch">
              Flatten + halt from the desk. You should also be able to cancel orders and close positions on
              app.hyperliquid.xyz if the bot host is unreachable.
            </Need>
            <Need title="Tax, venue, and risk">
              You are responsible for PnL reporting, venue outages, liquidations, and the fact that past paper results
              do not survive a regime change.
            </Need>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Recommended sequence</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground/90">
              <li>Run paper on mainnet prices from the Desk. Tune EMAs and risk until the behavior matches what you want — or send me your real rules to replace this module.</li>
              <li>Create a Hyperliquid testnet account, approve an agent wallet, set env vars, switch mode to live on testnet.</li>
              <li>Trade dust size. Confirm orders, leverage, and flatten on kill.</li>
              <li>Move to mainnet with a tiny cap. Raise size only after the live book matches the paper book.</li>
            </ol>
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
