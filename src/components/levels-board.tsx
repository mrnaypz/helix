"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LevelKind, PublicBotSnapshot } from "@/lib/bot/types";
import { formatPx } from "@/lib/format";
import { cn } from "cn";

const KINDS: LevelKind[] = ["resistance", "support"];

function phaseTone(phase?: string) {
  if (phase === "retested") return "text-amber-300";
  if (phase === "broken") return "text-sky-300";
  if (phase === "filled") return "text-emerald-300";
  if (phase === "failed") return "text-rose-300";
  return "text-muted-foreground";
}

export function LevelsBoard({
  snapshot,
  compact = false,
  onChange,
}: {
  snapshot: PublicBotSnapshot;
  compact?: boolean;
  onChange?: (next: PublicBotSnapshot) => void;
}) {
  const [coin, setCoin] = useState(snapshot.state.config.coins[0] ?? "ETH");
  const [kind, setKind] = useState<LevelKind>("resistance");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const marks = Object.fromEntries(snapshot.markets.map((m) => [m.coin, m.midPx || m.markPx]));
  const setups = Object.fromEntries(snapshot.state.setups.map((s) => [s.levelId, s]));

  const post = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      onChange?.(data as PublicBotSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const parsed = Number(price);
    await post("addLevel", { level: { coin, kind, price: parsed, note } });
    setPrice("");
    setNote("");
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{compact ? "Today's levels" : "Morning chart"}</CardTitle>
        <CardDescription>
          Plot support and resistance before the New York open. The bot only trades these levels on the 5-minute chart
          during {snapshot.session.startLabel}–{snapshot.session.endLabel} ET.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className={cn("grid gap-3", compact ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-5")}>
          <div className="space-y-1.5">
            <Label>Market</Label>
            <Select value={coin} onValueChange={(value) => value && setCoin(value)}>
              <SelectTrigger className="w-full bg-[#12141a] text-foreground hover:bg-[#171a22]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                align="start"
                className="bg-[#12141a] text-foreground ring-white/15"
              >
                {snapshot.state.config.coins.map((c) => (
                  <SelectItem
                    key={c}
                    value={c}
                    className="text-foreground focus:bg-white/10 focus:text-foreground"
                  >
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(value) => value && setKind(value as LevelKind)}>
              <SelectTrigger className="w-full bg-[#12141a] text-foreground hover:bg-[#171a22]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                align="start"
                className="bg-[#12141a] text-foreground ring-white/15"
              >
                {KINDS.map((k) => (
                  <SelectItem
                    key={k}
                    value={k}
                    className="text-foreground capitalize focus:bg-white/10 focus:text-foreground"
                  >
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Price</Label>
            <Input
              inputMode="decimal"
              placeholder={marks[coin] ? String(marks[coin]) : "81250"}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input placeholder="PDH, overnight high…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              disabled={!marks[coin]}
              onClick={() => setPrice(marks[coin] ? String(marks[coin]) : "")}
            >
              Use mid
            </Button>
            <Button disabled={busy || !price} onClick={() => void add()}>
              Add level
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {snapshot.state.levels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No levels yet. Chart them here in the morning, then start the engine for the New York session.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Market</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Vs mid</TableHead>
                <TableHead>Setup</TableHead>
                {!compact ? <TableHead>Note</TableHead> : null}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.state.levels.map((level) => {
                const mid = marks[level.coin];
                const setup = setups[level.id];
                const delta = mid ? ((mid - level.price) / level.price) * 100 : null;
                return (
                  <TableRow key={level.id}>
                    <TableCell className="font-medium">{level.coin}</TableCell>
                    <TableCell className={level.kind === "resistance" ? "text-rose-300" : "text-emerald-300"}>
                      {level.kind}
                    </TableCell>
                    <TableCell className="font-mono">{formatPx(level.price)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%`}
                    </TableCell>
                    <TableCell className={cn("text-xs", phaseTone(setup?.phase))}>
                      {setup?.detail ?? "Armed — waiting for NY 5m bars"}
                    </TableCell>
                    {!compact ? <TableCell className="text-muted-foreground">{level.note || "—"}</TableCell> : null}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void post("removeLevel", { id: level.id })}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {snapshot.state.levels.length > 0 ? (
          <Button variant="ghost" disabled={busy} onClick={() => void post("clearLevels")}>
            Clear all levels
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
