"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PublicBotSnapshot } from "@/lib/bot/types";
import { clsxPositive, compactNumber, formatPx, money, pct, relativeTime, signedMoney } from "@/lib/format";
import { LevelsBoard } from "@/components/levels-board";
import { cn } from "cn";

async function postAction(action: string) {
  const res = await fetch("/api/bot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as PublicBotSnapshot;
}

function statusTone(status: string) {
  if (status === "running") return "bg-emerald-400/15 text-emerald-300 border-emerald-400/20";
  if (status === "halted") return "bg-rose-400/15 text-rose-300 border-rose-400/20";
  if (status === "paused") return "bg-amber-400/15 text-amber-300 border-amber-400/20";
  return "bg-white/8 text-muted-foreground border-white/10";
}

export function DeskApp({ initial }: { initial: PublicBotSnapshot }) {
  const [snap, setSnap] = useState<PublicBotSnapshot>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetch("/api/bot", { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) throw new Error("Could not load the desk");
          return res.json() as Promise<PublicBotSnapshot>;
        })
        .then((data) => {
          if (!cancelled) {
            setSnap(data);
            setError(null);
          }
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message);
        });
    };
    const id = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const run = async (action: string) => {
    setBusy(action);
    try {
      const next = await postAction(action);
      setSnap(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const paper = snap?.state.paper;
  const totalPnl = paper ? paper.equity - paper.startingEquity : 0;
  const totalPct = paper && paper.startingEquity ? (totalPnl / paper.startingEquity) * 100 : 0;
  const dayPnl = paper ? paper.equity - paper.dayStartEquity : 0;
  const dayPct = paper && paper.dayStartEquity ? (dayPnl / paper.dayStartEquity) * 100 : 0;

  const chartData = useMemo(
    () =>
      (snap?.state.equityCurve ?? []).map((p) => ({
        t: new Date(p.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        equity: Number(p.equity.toFixed(2)),
      })),
    [snap],
  );

  const { state, markets, live } = snap;
  const session = snap.session ?? {
    inSession: false,
    weekend: false,
    dateKey: "",
    clock: "—",
    label: "Session clock unavailable",
    startLabel: "09:30",
    endLabel: "16:00",
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("border capitalize", statusTone(state.status))}>{state.status}</Badge>
            <Badge variant="outline">{state.config.mode === "live" ? "Shadow book" : "Paper"} · {state.config.network}</Badge>
            <Badge variant="outline">{state.config.interval} price action</Badge>
            <Badge className={cn("border", session.inSession ? "border-emerald-400/30 text-emerald-300" : "border-white/10 text-muted-foreground")}>
              {session.clock} · {session.inSession ? "NY open" : "NY closed"}
            </Badge>
            {state.lastTickAt ? (
              <span className="text-xs text-muted-foreground">Tick {relativeTime(state.lastTickAt)}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Engine idle</span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Execution desk</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Chart your levels in the morning, then start the engine for the New York session. It watches 5-minute
            Hyperliquid candles for a break, a pullback, and an engulfing continuation. Live orders stay locked until
            you add an agent wallet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy !== null || state.status === "running"} onClick={() => void run("start")}>
            {busy === "start" ? "Starting…" : "Start"}
          </Button>
          <Button variant="outline" disabled={busy !== null || state.status !== "running"} onClick={() => void run("pause")}>
            Pause
          </Button>
          <Button variant="outline" disabled={busy !== null || state.status === "stopped"} onClick={() => void run("stop")}>
            Stop
          </Button>
          <Button variant="destructive" disabled={busy !== null} onClick={() => void run("kill")}>
            Kill switch
          </Button>
          <Button variant="ghost" disabled={busy !== null || state.config.mode === "live"} onClick={() => void run("reset")}>
            Reset paper
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>
      ) : null}
      {state.lastError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Last tick error: {state.lastError}
        </div>
      ) : null}
      {state.haltReason ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          Halted: {state.haltReason}
        </div>
      ) : null}
      <div className={`rounded-lg border px-3 py-2 text-sm ${session.inSession ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/4 text-muted-foreground"}`}>
        {session.label}. {state.levels.length === 0 ? "No levels charted yet — add them below before the open." : `${state.levels.length} level${state.levels.length === 1 ? "" : "s"} armed.`}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={state.config.mode === "live" ? "Shadow equity" : "Paper equity"}
          value={money(paper?.equity ?? 0)}
          hint={`${signedMoney(totalPnl)} (${pct(totalPct)})`}
          tone={totalPnl}
        />
        <Stat label="Day PnL" value={signedMoney(dayPnl)} hint={`${pct(dayPct)} vs NY open`} tone={dayPnl} />
        <Stat label="Realized" value={signedMoney(paper?.realizedPnl ?? 0)} hint={`Fees ${money(paper?.feesPaid ?? 0)}`} tone={paper?.realizedPnl ?? 0} />
        <Stat
          label="Open risk"
          value={String(state.positions.length)}
          hint={`${state.positions.length}/${state.config.strategy.maxPositions} slots · max ${state.config.strategy.maxLeverage}x`}
        />
      </div>

      <LevelsBoard snapshot={snap} compact onChange={setSnap} />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Equity</CardTitle>
            <CardDescription>Paper book marked to Hyperliquid mids</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            {chartData.length < 2 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                Start the engine to build an equity curve.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="t" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(v: number) => `$${Math.round(v)}`}
                  />
                  <Tooltip
                    contentStyle={{ background: "#101218", border: "1px solid #1f2937", borderRadius: 8 }}
                    formatter={(value) => money(Number(value))}
                  />
                  <Area type="monotone" dataKey="equity" stroke="#34d399" fill="url(#eq)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Hyperliquid tape</CardTitle>
            <CardDescription>Live marks, funding, and 24h change</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {markets.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">Waiting for market data.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coin</TableHead>
                    <TableHead>Mark</TableHead>
                    <TableHead>24h</TableHead>
                    <TableHead>Funding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {markets.map((m) => (
                    <TableRow key={m.coin}>
                      <TableCell className="font-medium">{m.coin}</TableCell>
                      <TableCell className="font-mono">{formatPx(m.markPx)}</TableCell>
                      <TableCell className={clsxPositive(m.changePct)}>{pct(m.changePct)}</TableCell>
                      <TableCell className={clsxPositive(m.funding)}>{(m.funding * 100).toFixed(4)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Positions</CardTitle>
            <CardDescription>Stop beyond the pullback extreme; target is R-multiple or the next level</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {state.positions.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">
                Flat. Waiting for a 5m break → pullback → engulfing on {state.config.coins.join(", ")}.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coin</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Stop / TP</TableHead>
                    <TableHead>uPnL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.positions.map((p) => (
                    <TableRow key={p.coin}>
                      <TableCell className="font-medium">{p.coin}</TableCell>
                      <TableCell className={p.side === "long" ? "text-emerald-400" : "text-rose-400"}>
                        {p.side}
                      </TableCell>
                      <TableCell className="font-mono">{p.size.toPrecision(4)}</TableCell>
                      <TableCell className="font-mono">{formatPx(p.entryPrice)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatPx(p.stopPrice)} / {formatPx(p.takePrice)}
                      </TableCell>
                      <TableCell className={clsxPositive(p.unrealizedPnl)}>{signedMoney(p.unrealizedPnl)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Last signals</CardTitle>
            <CardDescription>5-minute New York session, last closed bar</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {state.lastSignals.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">No signals yet. Start the engine.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.lastSignals.map((s) => (
                    <TableRow key={s.coin}>
                      <TableCell className="font-medium">{s.coin}</TableCell>
                      <TableCell className="uppercase">{s.action}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.levelPrice ? formatPx(s.levelPrice) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">{s.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Fills</CardTitle>
            <CardDescription>Paper fills include Hyperliquid-like taker fees and slippage</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {state.fills.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">No fills yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Coin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>PnL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.fills.slice(0, 12).map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-muted-foreground">{relativeTime(f.ts)}</TableCell>
                      <TableCell>{f.coin}</TableCell>
                      <TableCell>
                        {f.action} {f.side}
                      </TableCell>
                      <TableCell className="font-mono">{formatPx(f.price)}</TableCell>
                      <TableCell className={clsxPositive(f.pnl)}>{f.action === "close" ? signedMoney(f.pnl) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Event log</CardTitle>
            <CardDescription>Engine, risk, and connectivity</CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 overflow-auto p-0">
            {state.events.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">Quiet. Start the bot to see activity.</p>
            ) : (
              <ul className="divide-y divide-white/6">
                {state.events.slice(0, 18).map((e) => (
                  <li key={e.id} className="px-4 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          "text-xs uppercase tracking-wide",
                          e.level === "error" && "text-rose-400",
                          e.level === "warn" && "text-amber-400",
                          e.level === "trade" && "text-emerald-400",
                          e.level === "info" && "text-muted-foreground",
                        )}
                      >
                        {e.level}
                      </span>
                      <span className="text-xs text-muted-foreground">{relativeTime(e.ts)}</span>
                    </div>
                    <p className="mt-1 text-foreground/90">{e.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Hyperliquid hookup</CardTitle>
          <CardDescription>
            Agent wallets can trade but cannot withdraw. The desk refuses live mode until all three gates are green.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Gate ok={live.hasAccount} label="Main account address" detail={live.accountAddress ?? "Set HL_ACCOUNT_ADDRESS"} />
          <Gate ok={live.hasAgentKey} label="Agent private key" detail="Set HL_AGENT_PRIVATE_KEY" />
          <Gate ok={live.liveConfirm} label="Live confirmation" detail='HL_LIVE_CONFIRM=I_UNDERSTAND' />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Volume on tape {markets.map((m) => `${m.coin} ${compactNumber(m.dayNtlVlm)}`).join(" · ") || "—"}. This is not
        financial advice. Size, keys, and go-live stay under your control.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: number;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("mt-1 font-mono text-2xl font-medium", tone !== undefined && clsxPositive(tone))}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Gate({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-medium", ok ? "text-emerald-400" : "text-amber-300")}>
        {ok ? "Ready" : "Missing"}
      </p>
      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
