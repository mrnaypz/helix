#!/usr/bin/env python3
"""Patch Helix on this machine: drop 1.5× ATR blow-through, split previous vs engulfing body ATR."""

from __future__ import annotations

from pathlib import Path
import sys

CANDIDATES = [
    Path.home() / "hyperliquid-strategy",
    Path.cwd(),
]


def root() -> Path:
    for candidate in CANDIDATES:
        if (candidate / "src/components/strategy-form.tsx").exists():
            return candidate
    sys.exit("Could not find Helix. Run this from ~/hyperliquid-strategy")


def sub(path: Path, old: str, new: str) -> bool:
    text = path.read_text()
    if old not in text:
        return False
    path.write_text(text.replace(old, new, 1))
    return True


def sub_any(path: Path, pairs: list[tuple[str, str]], label: str) -> None:
    text = path.read_text()
    for old, new in pairs:
        if old in text:
            path.write_text(text.replace(old, new, 1))
            print(f"  patched {label}")
            return
        text = path.read_text()
    # already done?
    if any(marker in path.read_text() for _, new in pairs for marker in (new[20:80],)):
        print(f"  already {label}")
        return
    raise SystemExit(f"Could not patch {path} ({label}). File does not match expected text.")


def main() -> None:
    base = root()
    print(f"Patching {base}")

    types = base / "src/lib/bot/types.ts"
    sub_any(
        types,
        [
            (
                "  allowRangeBreakEntry: boolean;\n  maxBreakThroughAtr: number;\n  minEngulfBodyAtr: number;\n",
                "  allowRangeBreakEntry: boolean;\n  minPrevBodyAtr: number;\n  minEngulfBodyAtr: number;\n",
            ),
            (
                "  maxBreakThroughAtr: number;\n  minEngulfBodyAtr: number;\n",
                "  minPrevBodyAtr: number;\n  minEngulfBodyAtr: number;\n",
            ),
        ],
        "types.ts",
    )
    if "minPrevBodyAtr" not in types.read_text():
        if not sub(
            types,
            "  minEngulfBodyAtr: number;\n",
            "  minPrevBodyAtr: number;\n  minEngulfBodyAtr: number;\n",
        ):
            raise SystemExit("types.ts: missing minPrevBodyAtr after patch")
        print("  inserted minPrevBodyAtr in types.ts")

    defaults = base / "src/lib/bot/defaults.ts"
    sub_any(
        defaults,
        [
            (
                "  allowRangeBreakEntry: true,\n  maxBreakThroughAtr: 1.5,\n  minEngulfBodyAtr: 0.25,\n",
                "  allowRangeBreakEntry: true,\n  minPrevBodyAtr: 0.25,\n  minEngulfBodyAtr: 0.25,\n",
            ),
            (
                "  maxBreakThroughAtr: 1.5,\n  minEngulfBodyAtr: 0.25,\n",
                "  minPrevBodyAtr: 0.25,\n  minEngulfBodyAtr: 0.25,\n",
            ),
        ],
        "defaults.ts",
    )
    if "minPrevBodyAtr" not in defaults.read_text():
        if not sub(
            defaults,
            "  minEngulfBodyAtr: 0.25,\n",
            "  minPrevBodyAtr: 0.25,\n  minEngulfBodyAtr: 0.25,\n",
        ):
            raise SystemExit("defaults.ts: missing minPrevBodyAtr after patch")
        print("  inserted minPrevBodyAtr in defaults.ts")

    store = base / "src/lib/bot/store.ts"
    store_text = store.read_text()
    if "function clampAtrMult" not in store_text:
        needle = "function priceFromLegacyRoe"
        idx = store_text.find(needle)
        if idx < 0:
            raise SystemExit("store.ts: no priceFromLegacyRoe")
        # insert clamp helper before migrateStrategy
        helper = '''function clampAtrMult(value: number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof fallback === "number" && Number.isFinite(fallback)) return Math.max(0, fallback);
  return 0;
}

'''
        store_text = store_text.replace(
            "function migrateStrategy",
            helper + "function migrateStrategy",
            1,
        )
        store.write_text(store_text)
        print("  added clampAtrMult in store.ts")
        store_text = store.read_text()

    if "maxBreakThroughAtr: incoming.maxBreakThroughAtr" in store_text:
        store_text = store_text.replace(
            "    maxBreakThroughAtr: incoming.maxBreakThroughAtr ?? DEFAULT_STRATEGY.maxBreakThroughAtr,\n    minEngulfBodyAtr: incoming.minEngulfBodyAtr ?? DEFAULT_STRATEGY.minEngulfBodyAtr,\n",
            """    minEngulfBodyAtr: clampAtrMult(incoming.minEngulfBodyAtr, DEFAULT_STRATEGY.minEngulfBodyAtr),
    minPrevBodyAtr: clampAtrMult(
      incoming.minPrevBodyAtr,
      incoming.minEngulfBodyAtr ?? DEFAULT_STRATEGY.minPrevBodyAtr,
    ),
""",
            1,
        )
        store.write_text(store_text)
        print("  patched store.ts migrate")
    elif "minPrevBodyAtr:" in store_text:
        print("  already store.ts migrate")
    else:
        if "minEngulfBodyAtr: incoming.minEngulfBodyAtr" in store_text:
            store_text = store_text.replace(
                "    minEngulfBodyAtr: incoming.minEngulfBodyAtr ?? DEFAULT_STRATEGY.minEngulfBodyAtr,\n",
                """    minEngulfBodyAtr: clampAtrMult(incoming.minEngulfBodyAtr, DEFAULT_STRATEGY.minEngulfBodyAtr),
    minPrevBodyAtr: clampAtrMult(
      incoming.minPrevBodyAtr,
      incoming.minEngulfBodyAtr ?? DEFAULT_STRATEGY.minPrevBodyAtr,
    ),
""",
                1,
            )
            store.write_text(store_text)
            print("  patched store.ts migrate (no maxBreakThrough line)")
        else:
            raise SystemExit("store.ts: could not patch migrateStrategy")

    runtime = base / "src/lib/bot/runtime.ts"
    runtime_text = runtime.read_text()
    runtime_text = runtime_text.replace(
        "typeof globalForBot.helixEngine.state.config.strategy.maxBreakThroughAtr !== \"number\" ||\n      ",
        "",
        1,
    )
    if "minPrevBodyAtr" not in runtime_text:
        runtime_text = runtime_text.replace(
            "typeof globalForBot.helixEngine.state.config.strategy.minEngulfBodyAtr !== \"number\" ||",
            'typeof globalForBot.helixEngine.state.config.strategy.minPrevBodyAtr !== "number" ||\n      typeof globalForBot.helixEngine.state.config.strategy.minEngulfBodyAtr !== "number" ||',
            1,
        )
    runtime.write_text(runtime_text)
    print("  patched runtime.ts")

    pa = base / "src/lib/strategy/price-action.ts"
    pa_text = pa.read_text()
    old_fn = '''export function breakTooFarThroughLevel(close: number, levelPrice: number, atr: number, maxAtr: number): boolean {
  if (atr <= 0 || maxAtr <= 0) return false;
  return Math.abs(close - levelPrice) > maxAtr * atr + 1e-12;
}

export function engulfingMeetsQuality(args: {
  prev: Candle;
  curr: Candle;
  side: "long" | "short";
  atr: number;
  minBodyAtr: number;
  maxOpposingWickFrac: number;
}): boolean {
  const { prev, curr, side, atr, minBodyAtr, maxOpposingWickFrac } = args;
  if (atr <= 0) return false;
  const need = minBodyAtr * atr;
  if (candleBody(prev) + 1e-12 < need) return false;
  if (candleBody(curr) + 1e-12 < need) return false;
  return opposingWickFraction(curr, side) + 1e-12 < maxOpposingWickFrac;
}
'''
    new_fn = '''function minBodyNeed(atr: number, minAtr: number): number {
  if (!(minAtr > 0)) return 0;
  return minAtr * atr;
}

export function engulfingMeetsQuality(args: {
  prev: Candle;
  curr: Candle;
  side: "long" | "short";
  atr: number;
  minPrevBodyAtr: number;
  minTriggerBodyAtr: number;
  maxOpposingWickFrac: number;
}): boolean {
  const { prev, curr, side, atr, minPrevBodyAtr, minTriggerBodyAtr, maxOpposingWickFrac } = args;
  if (atr <= 0) return false;
  if (candleBody(prev) + 1e-12 < minBodyNeed(atr, minPrevBodyAtr)) return false;
  if (candleBody(curr) + 1e-12 < minBodyNeed(atr, minTriggerBodyAtr)) return false;
  return opposingWickFraction(curr, side) + 1e-12 < maxOpposingWickFrac;
}

function atrNeedLabel(minAtr: number, what: string): string {
  if (!(minAtr > 0)) return `no min ${what}`;
  return `${minAtr}× ATR ${what}`;
}
'''
    if old_fn in pa_text:
        pa_text = pa_text.replace(old_fn, new_fn, 1)
        print("  replaced engulfing quality helpers")
    elif "minPrevBodyAtr: number" in pa_text and "breakTooFarThroughLevel" not in pa_text:
        print("  already engulfing quality helpers")
    elif "minBodyAtr: number" in pa_text:
        raise SystemExit("price-action.ts: found old minBodyAtr signature but not the exact helper block")
    else:
        print("  already engulfing quality helpers?")

    old_break = '''      if (longBreak || shortBreak) {
        const atr = atrPriorTo(history, atrValues, curr.t);
        if (breakTooFarThroughLevel(curr.c, level.price, atr, config.maxBreakThroughAtr ?? 1.5)) {
          phase = "failed";
          setup.brokeAt = curr.t;
          setup.detail = `Invalidated — break close more than ${config.maxBreakThroughAtr ?? 1.5}× ATR through the level`;
          break;
        }
        phase = "broken";
'''
    new_break = '''      if (longBreak || shortBreak) {
        phase = "broken";
'''
    if old_break in pa_text:
        pa_text = pa_text.replace(old_break, new_break, 1)
        print("  removed blow-through invalidation")
    elif "breakTooFarThroughLevel" in pa_text:
        raise SystemExit("price-action.ts: still references breakTooFarThroughLevel")
    else:
        print("  already no blow-through invalidation")

    old_q = '''        minBodyAtr: config.minEngulfBodyAtr ?? 0.25,
        maxOpposingWickFrac: config.maxOpposingWickFrac ?? 0.3,
'''
    new_q = '''        minPrevBodyAtr: config.minPrevBodyAtr ?? config.minEngulfBodyAtr ?? 0.25,
        minTriggerBodyAtr: config.minEngulfBodyAtr ?? 0.25,
        maxOpposingWickFrac: config.maxOpposingWickFrac ?? 0.3,
'''
    if old_q in pa_text:
        pa_text = pa_text.replace(old_q, new_q, 1)
        print("  split ATR quality config")
    elif "minPrevBodyAtr: config.minPrevBodyAtr" in pa_text:
        print("  already split ATR quality config")
    else:
        raise SystemExit("price-action.ts: could not patch quality object")

    old_detail = "Rejected engulfing — need ${quality.minBodyAtr}× ATR bodies and opposing wick under ${Math.round(quality.maxOpposingWickFrac * 100)}%"
    new_detail = "Rejected engulfing — need ${atrNeedLabel(quality.minPrevBodyAtr, \"previous body\")}, ${atrNeedLabel(quality.minTriggerBodyAtr, \"engulfing body\")}, opposing wick under ${Math.round(quality.maxOpposingWickFrac * 100)}%"
    if old_detail in pa_text:
        pa_text = pa_text.replace(old_detail, new_detail, 1)
        print("  patched reject detail")
    pa.write_text(pa_text)

    form = base / "src/components/strategy-form.tsx"
    form_text = form.read_text()
    old_card = '''          <CardDescription>
            ATR is a typical recent 5m stretch. A break that closes more than 1.5× that through the level is dead — no
            consolidation, no trade. An engulfing needs a real body on both the trigger and the previous bar (0.25×
            ATR), and the trigger cannot be mostly an opposing wick (buy tail on a short, sell tail on a long).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Num
            label="Max break through (× ATR)"
            value={s.maxBreakThroughAtr}
            step="0.1"
            onChange={(v) => setS({ maxBreakThroughAtr: v })}
          />
          <Num
            label="Min engulfing body (× ATR)"
            value={s.minEngulfBodyAtr}
            step="0.05"
            onChange={(v) => setS({ minEngulfBodyAtr: v })}
          />
          <Num
            label="Max opposing wick (% of bar)"
            value={Math.round((s.maxOpposingWickFrac ?? 0.3) * 100)}
            step="1"
            onChange={(v) => setS({ maxOpposingWickFrac: v / 100 })}
          />
'''
    new_card = '''          <CardDescription>
            ATR is the average size of recent 5-minute bars — a typical high-to-low, not a target you sit above or
            below. 0.25 means that candle’s body must be at least a quarter of a typical bar. 1.0 means the body is as
            big as a typical whole bar. 0 turns the size filter off for that candle, so even a doji can pass. Negative
            numbers are treated as 0; a body cannot be smaller than nothing. The trigger still cannot be mostly an
            opposing wick (buy tail on a short, sell tail on a long). A close through the level still counts as a
            break even if it is a large candle.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Num
            label="Min previous body (× ATR)"
            value={s.minPrevBodyAtr ?? s.minEngulfBodyAtr ?? 0.25}
            step="0.05"
            onChange={(v) => setS({ minPrevBodyAtr: Number.isFinite(v) ? Math.max(0, v) : 0 })}
          />
          <Num
            label="Min engulfing body (× ATR)"
            value={s.minEngulfBodyAtr ?? 0.25}
            step="0.05"
            onChange={(v) => setS({ minEngulfBodyAtr: Number.isFinite(v) ? Math.max(0, v) : 0 })}
          />
          <Num
            label="Max opposing wick (% of bar)"
            value={Math.round((s.maxOpposingWickFrac ?? 0.3) * 100)}
            step="1"
            onChange={(v) => setS({ maxOpposingWickFrac: Number.isFinite(v) ? Math.max(0, v) / 100 : 0 })}
          />
'''
    if old_card in form_text:
        form.write_text(form_text.replace(old_card, new_card, 1))
        print("  patched strategy-form.tsx")
    elif "Min previous body" in form_text and "Max break through" not in form_text:
        print("  already strategy-form.tsx")
    elif "Max break through" in form_text:
        raise SystemExit("strategy-form.tsx: still has Max break through but card text did not match")
    else:
        print("  already strategy-form.tsx?")

    desk = base / "src/components/desk-app.tsx"
    if desk.exists():
        desk_text = desk.read_text()
        desk_text2 = desk_text.replace(
            "Thin dojis, long opposing wicks, and blow-through breaks are\n              rejected.",
            "Thin dojis and long opposing wicks on engulfing triggers are\n              rejected.",
            1,
        )
        if desk_text2 != desk_text:
            desk.write_text(desk_text2)
            print("  patched desk-app.tsx")
        else:
            print("  desk-app.tsx copy ok")

    runbook = base / "src/app/runbook/page.tsx"
    if runbook.exists():
        rb = runbook.read_text()
        rb2 = rb.replace(
            "A break that closes more than 1.5× ATR through the level is dead. Engulfing entries need both bodies at least 0.25× ATR and the trigger’s opposing wick under 30% of the bar.",
            "Engulfing quality is on Rules: previous-bar body and trigger-bar body each have their own ATR minimum (0.25× by default; 0 turns that filter off), and the trigger’s opposing wick must stay under 30% of the bar. A large breakout candle does not kill the level.",
            1,
        )
        if rb2 != rb:
            runbook.write_text(rb2)
            print("  patched runbook")
        else:
            print("  runbook copy ok")

    form_check = (base / "src/components/strategy-form.tsx").read_text()
    pa_check = (base / "src/lib/strategy/price-action.ts").read_text()
    if "Max break through" in form_check:
        raise SystemExit("FAIL: Max break through still in Rules form")
    if "Min previous body" not in form_check:
        raise SystemExit("FAIL: Min previous body not in Rules form")
    if "breakTooFarThroughLevel" in pa_check:
        raise SystemExit("FAIL: blow-through function still in engine")
    print("OK. Stop npm run dev (Ctrl+C), start it again, then hard-refresh Brave (Ctrl+Shift+R) on Rules.")


if __name__ == "__main__":
    main()
