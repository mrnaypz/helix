"use client";

import { addLevel, clearLevels, removeLevel } from "@/app/bot-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PublicBotSnapshot } from "@/lib/bot/types";
import { formatPx } from "@/lib/format";
import { cn } from "cn";

function phaseTone(phase?: string) {
  if (phase === "retested" || phase === "consolidated") return "text-amber-300";
  if (phase === "broken") return "text-sky-300";
  if (phase === "filled") return "text-emerald-300";
  if (phase === "failed") return "text-rose-300";
  return "text-muted-foreground";
}

function RadioRow({
  name,
  options,
  defaultValue,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-white/15 bg-[#12141a] p-1">
      {options.map((option) => (
        <label
          key={option.value}
          className="inline-flex h-8 min-w-11 cursor-pointer items-center justify-center rounded-md px-2.5 text-xs capitalize text-zinc-400 has-checked:bg-white/15 has-checked:text-white"
        >
          <input type="radio" name={name} value={option.value} defaultChecked={option.value === defaultValue} className="sr-only" />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function LevelsBoard({
  snapshot,
  compact = false,
}: {
  snapshot: PublicBotSnapshot;
  compact?: boolean;
}) {
  const coins = snapshot.state.config.coins;
  const defaultCoin = coins[0] ?? "ETH";
  const marks = Object.fromEntries(snapshot.markets.map((m) => [m.coin, m.midPx || m.markPx]));
  const setups = Object.fromEntries(snapshot.state.setups.map((s) => [s.levelId, s]));
  const mid = marks[defaultCoin];

  return (
    <Card className="overflow-visible">
      <CardHeader className="border-b">
        <CardTitle>{compact ? "Today's levels" : "Morning chart"}</CardTitle>
        <CardDescription>
          Plot support and resistance before the New York open. A 5m close back through a level kills that level — no
          trade. Chart a new price to re-arm that market; if the engine is already running you do not need to restart.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <form action={addLevel} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Market</Label>
            <RadioRow name="coin" defaultValue={defaultCoin} options={coins.map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <RadioRow
              name="kind"
              defaultValue="resistance"
              options={[
                { value: "resistance", label: "Resistance" },
                { value: "support", label: "Support" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="level-price">Price</Label>
            <Input
              id="level-price"
              name="price"
              required
              inputMode="decimal"
              className="h-11 sm:h-8"
              placeholder={mid ? String(mid) : "81250"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="level-note">Note</Label>
            <Input id="level-note" name="note" placeholder="PDH, overnight high…" />
          </div>
          <div className="flex items-end">
            <SubmitButton className="h-11 w-full sm:h-8" pendingLabel="Adding…">
              Add level
            </SubmitButton>
          </div>
        </form>

        {snapshot.state.levels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chart them here in the morning, then start the engine for the New York session. If a level invalidates,
            add a new one — the running engine picks it up on the next tick.
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
                const mark = marks[level.coin];
                const setup = setups[level.id];
                const delta = mark ? ((mark - level.price) / level.price) * 100 : null;
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
                      <form action={removeLevel}>
                        <input type="hidden" name="id" value={level.id} />
                        <SubmitButton variant="ghost" size="sm" pendingLabel="Removing…">
                          Remove
                        </SubmitButton>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {snapshot.state.levels.length > 0 ? (
          <form action={clearLevels}>
            <SubmitButton variant="ghost" pendingLabel="Clearing…">
              Clear all levels
            </SubmitButton>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
