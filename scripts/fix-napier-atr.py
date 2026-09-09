#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path.home() / "hyperliquid-strategy"
if not (root / "src/components/strategy-form.tsx").exists():
    root = Path.cwd()
if not (root / "src/components/strategy-form.tsx").exists():
    sys.exit("Helix not found. Run: cd ~/hyperliquid-strategy")

print("Patching", root)


def load(rel):
    return (root / rel).read_text()


def save(rel, text):
    (root / rel).write_text(text)


# types
t = load("src/lib/bot/types.ts")
t = t.replace("maxBreakThroughAtr: number;", "minPrevBodyAtr: number;", 1)
if "minPrevBodyAtr" not in t:
    t = t.replace("minEngulfBodyAtr: number;", "minPrevBodyAtr: number;\n  minEngulfBodyAtr: number;", 1)
save("src/lib/bot/types.ts", t)
print("types ok")

# defaults
d = load("src/lib/bot/defaults.ts")
d = d.replace("maxBreakThroughAtr: 1.5,", "minPrevBodyAtr: 0.25,", 1)
if "minPrevBodyAtr" not in d:
    d = d.replace("minEngulfBodyAtr: 0.25,", "minPrevBodyAtr: 0.25,\n  minEngulfBodyAtr: 0.25,", 1)
save("src/lib/bot/defaults.ts", d)
print("defaults ok")

# store
s = load("src/lib/bot/store.ts")
if "function clampAtrMult" not in s:
    s = s.replace(
        "function migrateStrategy",
        "function clampAtrMult(value: number | undefined, fallback: number): number {\n"
        "  if (typeof value === \"number\" && Number.isFinite(value)) return Math.max(0, value);\n"
        "  if (typeof fallback === \"number\" && Number.isFinite(fallback)) return Math.max(0, fallback);\n"
        "  return 0;\n"
        "}\n\n"
        "function migrateStrategy",
        1,
    )
old_store = "    maxBreakThroughAtr: incoming.maxBreakThroughAtr ?? DEFAULT_STRATEGY.maxBreakThroughAtr,\n"
s = s.replace(old_store, "", 1)
if "minPrevBodyAtr:" not in s:
    s = s.replace(
        "minEngulfBodyAtr: incoming.minEngulfBodyAtr ?? DEFAULT_STRATEGY.minEngulfBodyAtr,",
        "minEngulfBodyAtr: clampAtrMult(incoming.minEngulfBodyAtr, DEFAULT_STRATEGY.minEngulfBodyAtr),\n"
        "    minPrevBodyAtr: clampAtrMult(\n"
        "      incoming.minPrevBodyAtr,\n"
        "      incoming.minEngulfBodyAtr ?? DEFAULT_STRATEGY.minPrevBodyAtr,\n"
        "    ),",
        1,
    )
save("src/lib/bot/store.ts", s)
print("store ok")

# runtime
r = load("src/lib/bot/runtime.ts")
r = r.replace(
    "typeof globalForBot.helixEngine.state.config.strategy.maxBreakThroughAtr !== \"number\" ||\n      ",
    "",
    1,
)
if "minPrevBodyAtr" not in r:
    r = r.replace(
        "typeof globalForBot.helixEngine.state.config.strategy.minEngulfBodyAtr !== \"number\" ||",
        "typeof globalForBot.helixEngine.state.config.strategy.minPrevBodyAtr !== \"number\" ||\n"
        "      typeof globalForBot.helixEngine.state.config.strategy.minEngulfBodyAtr !== \"number\" ||",
        1,
    )
save("src/lib/bot/runtime.ts", r)
print("runtime ok")

# price-action: replace helper block, and repair a half-paste
HELPERS = (
    "function minBodyNeed(atr: number, minAtr: number): number {\n"
    "  if (!(minAtr > 0)) return 0;\n"
    "  return minAtr * atr;\n"
    "}\n\n"
    "export function engulfingMeetsQuality(args: {\n"
    "  prev: Candle;\n"
    "  curr: Candle;\n"
    "  side: \"long\" | \"short\";\n"
    "  atr: number;\n"
    "  minPrevBodyAtr: number;\n"
    "  minTriggerBodyAtr: number;\n"
    "  maxOpposingWickFrac: number;\n"
    "}): boolean {\n"
    "  const { prev, curr, side, atr, minPrevBodyAtr, minTriggerBodyAtr, maxOpposingWickFrac } = args;\n"
    "  if (atr <= 0) return false;\n"
    "  if (candleBody(prev) + 1e-12 < minBodyNeed(atr, minPrevBodyAtr)) return false;\n"
    "  if (candleBody(curr) + 1e-12 < minBodyNeed(atr, minTriggerBodyAtr)) return false;\n"
    "  return opposingWickFraction(curr, side) + 1e-12 < maxOpposingWickFrac;\n"
    "}\n\n"
    "function atrNeedLabel(minAtr: number, what: string): string {\n"
    "  if (!(minAtr > 0)) return \"no min \" + what;\n"
    "  return String(minAtr) + \"x ATR \" + what;\n"
    "}\n\n"
)

p = load("src/lib/strategy/price-action.ts")
starts = []
for marker in (
    "export function breakTooFarThroughLevel",
    "function minBodyNeed",
    "export function engulfingMeetsQuality",
):
    i = p.find(marker)
    if i >= 0:
        starts.append(i)
if not starts:
    sys.exit("price-action.ts: cannot find quality helpers")
start = min(starts)
end = p.find("function replayLevel")
if end < 0:
    sys.exit("price-action.ts looks cut off. Run: git checkout -- src/lib/strategy/price-action.ts")
p = p[:start] + HELPERS + p[end:]
p = p.replace(
    "        const atr = atrPriorTo(history, atrValues, curr.t);\n",
    "",
    1,
)
blow = p.find("        if (breakTooFarThroughLevel")
if blow >= 0:
    nxt = p.find("        phase = \"broken\";", blow)
    if nxt < 0:
        sys.exit("price-action.ts: could not drop blow-through if")
    p = p[:blow] + p[nxt:]
p = p.replace(
    "        minBodyAtr: config.minEngulfBodyAtr ?? 0.25,\n",
    "        minPrevBodyAtr: config.minPrevBodyAtr ?? config.minEngulfBodyAtr ?? 0.25,\n"
    "        minTriggerBodyAtr: config.minEngulfBodyAtr ?? 0.25,\n",
    1,
)
if "quality.minBodyAtr" in p:
    lines = []
    for line in p.splitlines(True):
        if "quality.minBodyAtr" in line:
            lines.append(
                "        setup.detail = \"Rejected engulfing — \" + atrNeedLabel(quality.minPrevBodyAtr, \"previous body\")"
                " + \", \" + atrNeedLabel(quality.minTriggerBodyAtr, \"engulfing body\")"
                " + \", opposing wick under \" + Math.round(quality.maxOpposingWickFrac * 100) + \"%\";\n"
            )
        else:
            lines.append(line)
    p = "".join(lines)
if "breakTooFarThroughLevel" in p:
    sys.exit("price-action.ts still has blow-through")
save("src/lib/strategy/price-action.ts", p)
print("price-action ok")

# Rules form
f = load("src/components/strategy-form.tsx")
old_num = (
    "            label=\"Max break through (× ATR)\"\n"
    "            value={s.maxBreakThroughAtr}\n"
    "            step=\"0.1\"\n"
    "            onChange={(v) => setS({ maxBreakThroughAtr: v })}\n"
)
new_num = (
    "            label=\"Min previous body (× ATR)\"\n"
    "            value={s.minPrevBodyAtr ?? s.minEngulfBodyAtr ?? 0.25}\n"
    "            step=\"0.05\"\n"
    "            onChange={(v) => setS({ minPrevBodyAtr: Number.isFinite(v) ? Math.max(0, v) : 0 })}\n"
)
if old_num in f:
    f = f.replace(old_num, new_num, 1)
elif "Min previous body" not in f:
    f = f.replace("Max break through (× ATR)", "Min previous body (× ATR)", 1)
    f = f.replace("s.maxBreakThroughAtr", "s.minPrevBodyAtr ?? s.minEngulfBodyAtr ?? 0.25")
    f = f.replace("setS({ maxBreakThroughAtr: v })", "setS({ minPrevBodyAtr: Number.isFinite(v) ? Math.max(0, v) : 0 })")
f = f.replace(
    "A break that closes more than 1.5× that through the level is dead — no\n            consolidation, no trade. ",
    "A close through the level still counts as a break even if it is a large candle. ",
    1,
)
save("src/components/strategy-form.tsx", f)
form = load("src/components/strategy-form.tsx")
print("Max break through:", "Max break through" in form)
print("Min previous body:", "Min previous body" in form)
if "Max break through" in form or "Min previous body" not in form:
    sys.exit("FAIL: Rules form did not update")
print("PATCH OK")
print("Now run:")
print("  cd", root)
print("  npm run dev")
